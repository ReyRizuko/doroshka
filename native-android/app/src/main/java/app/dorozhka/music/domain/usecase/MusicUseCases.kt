package app.dorozhka.music.domain.usecase

import app.dorozhka.music.domain.repository.MusicRepository
import javax.inject.Inject

class GetTrendingTracksUseCase @Inject constructor(private val repository: MusicRepository) {
    operator fun invoke(forceRefresh: Boolean = false) = repository.observeTrending(forceRefresh)
}
class SearchTracksUseCase @Inject constructor(private val repository: MusicRepository) {
    operator fun invoke(query: String) = repository.searchTracks(query)
}
class ToggleLikeTrackUseCase @Inject constructor(private val repository: MusicRepository) {
    suspend operator fun invoke(trackId: String) = repository.toggleLike(trackId)
}
