package app.dorozhka.music.core.data

import app.dorozhka.music.core.domain.AudioSourceProvider
import app.dorozhka.music.core.domain.DownloadPermissionProvider
import java.net.URI
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GenericAudioSourceProviderImpl @Inject constructor(
    private val api: CoreStreamApi
) : AudioSourceProvider, DownloadPermissionProvider {
    override suspend fun resolveAudioStreamUrl(trackId: String): String {
        require(trackId.isNotBlank())
        val rawUrl = api.resolveStream(trackId).url
        val uri = runCatching { URI(rawUrl) }
            .getOrElse { throw IllegalStateException("Provider returned an invalid media URL", it) }
        require(uri.scheme.equals("https", true)) { "Only HTTPS media URLs are accepted" }
        require(!uri.host.isNullOrBlank()) { "Provider returned a URL without a host" }
        return rawUrl
    }

    override suspend fun isDownloadAllowed(trackId: String): Boolean {
        require(trackId.isNotBlank())
        return api.resolveStream(trackId).downloadAllowed
    }
}
