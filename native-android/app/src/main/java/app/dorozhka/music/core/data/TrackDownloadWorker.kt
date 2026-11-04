package app.dorozhka.music.core.data

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import app.dorozhka.music.core.domain.AudioSourceProvider
import app.dorozhka.music.core.domain.DownloadPermissionProvider
import app.dorozhka.music.data.local.TrackDao
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

@HiltWorker
class TrackDownloadWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val audioSourceProvider: AudioSourceProvider,
    private val permissionProvider: DownloadPermissionProvider,
    private val trackDao: TrackDao,
    private val httpClient: OkHttpClient
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val trackId = inputData.getString(KEY_TRACK_ID)
            ?.takeIf { it.isNotBlank() } ?: return@withContext Result.failure()
        var temporaryFile: File? = null

        try {
            if (!permissionProvider.isDownloadAllowed(trackId)) return@withContext Result.failure()
            val streamUrl = audioSourceProvider.resolveAudioStreamUrl(trackId)
            val request = Request.Builder().url(streamUrl).get().build()

            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext if (response.code >= 500 || response.code == 429) {
                        Result.retry()
                    } else Result.failure()
                }

                val body = response.body ?: return@withContext Result.failure()
                if (body.contentLength() > MAX_DOWNLOAD_BYTES) return@withContext Result.failure()

                val safeId = trackId.replace(Regex("[^A-Za-z0-9_-]"), "_").take(72)
                val directory = File(applicationContext.filesDir, "offline-audio")
                if (!directory.exists() && !directory.mkdirs()) {
                    throw IllegalStateException("Cannot create offline audio directory")
                }

                val destination = File(directory, safeId + ".media")
                val tempFile = File(directory, UUID.randomUUID().toString() + ".part")
                temporaryFile = tempFile

                body.byteStream().use { input ->
                    FileOutputStream(tempFile).use { output ->
                        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                        var totalBytes = 0L
                        while (true) {
                            if (isStopped) throw InterruptedException("Download stopped")
                            val read = input.read(buffer)
                            if (read < 0) break
                            totalBytes += read
                            if (totalBytes > MAX_DOWNLOAD_BYTES) {
                                throw IllegalStateException("Download exceeds configured size limit")
                            }
                            output.write(buffer, 0, read)
                        }
                        output.fd.sync()
                    }
                }

                if (tempFile.length() == 0L) return@withContext Result.failure()
                if (destination.exists() && !destination.delete()) {
                    throw IllegalStateException("Cannot replace previous offline file")
                }
                if (!tempFile.renameTo(destination)) {
                    throw IllegalStateException("Cannot finalize offline file")
                }

                trackDao.updateLocalPath(trackId, destination.absolutePath)
                temporaryFile = null
                Result.success()
            }
        } catch (_: InterruptedException) {
            temporaryFile?.delete()
            Result.failure()
        } catch (_: Exception) {
            temporaryFile?.delete()
            if (runAttemptCount < MAX_RETRIES) Result.retry() else Result.failure()
        }
    }

    companion object {
        const val KEY_TRACK_ID = "track_id"
        private const val MAX_DOWNLOAD_BYTES = 250L * 1024L * 1024L
        private const val MAX_RETRIES = 3
    }
}
