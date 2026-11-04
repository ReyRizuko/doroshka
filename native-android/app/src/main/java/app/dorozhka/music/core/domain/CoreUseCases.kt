package app.dorozhka.music.core.domain

import javax.inject.Inject
import kotlinx.coroutines.flow.Flow

class SearchTracksUseCase @Inject constructor(
    private val catalogProvider: CatalogProvider
) {
    operator fun invoke(query: String): Flow<List<CatalogTrack>> =
        catalogProvider.searchTracks(query.trim())
}

class StreamAudioUseCase @Inject constructor(
    private val audioSourceProvider: AudioSourceProvider
) {
    suspend operator fun invoke(trackId: String): String =
        audioSourceProvider.resolveAudioStreamUrl(trackId)
}

class DownloadTrackUseCase @Inject constructor(
    private val scheduler: TrackDownloadScheduler
) {
    operator fun invoke(trackId: String) {
        scheduler.enqueue(trackId)
    }
}

interface TrackLikeRepository {
    suspend fun toggleLike(trackId: String)
}

class ToggleLikeUseCase @Inject constructor(
    private val repository: TrackLikeRepository
) {
    suspend operator fun invoke(trackId: String) {
        repository.toggleLike(trackId)
    }
}
