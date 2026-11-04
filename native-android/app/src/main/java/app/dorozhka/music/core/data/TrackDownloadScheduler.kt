package app.dorozhka.music.core.data

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import app.dorozhka.music.core.domain.TrackDownloadScheduler
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TrackDownloadSchedulerImpl @Inject constructor(
    @ApplicationContext context: Context
) : TrackDownloadScheduler {
    private val workManager = WorkManager.getInstance(context)

    override fun enqueue(trackId: String) {
        require(trackId.isNotBlank())
        val request = OneTimeWorkRequestBuilder<TrackDownloadWorker>()
            .setInputData(workDataOf(TrackDownloadWorker.KEY_TRACK_ID to trackId))
            .setConstraints(Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build())
            .build()
        workManager.enqueueUniqueWork(
            "offline-track-" + trackId,
            ExistingWorkPolicy.KEEP,
            request
        )
    }
}
