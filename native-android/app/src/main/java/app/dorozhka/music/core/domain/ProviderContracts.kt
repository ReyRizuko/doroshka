package app.dorozhka.music.core.domain

import kotlinx.coroutines.flow.Flow

data class CatalogTrack(
    val id: String, val title: String, val artist: String, val durationMs: Long,
    val imageUrl: String? = null, val lowResSourceUrl: String? = null,
    val localCachePath: String? = null, val isLiked: Boolean = false
)

interface CatalogProvider {
    fun searchTracks(query: String): Flow<List<CatalogTrack>>
    fun getTrending(): Flow<List<CatalogTrack>>
}

interface AudioSourceProvider {
    suspend fun resolveAudioStreamUrl(trackId: String): String
}

interface DownloadPermissionProvider {
    suspend fun isDownloadAllowed(trackId: String): Boolean
}
