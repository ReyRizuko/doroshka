package app.dorozhka.music.core.data

import app.dorozhka.music.core.domain.TrackLikeRepository
import app.dorozhka.music.data.local.TrackDao
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RoomTrackLikeRepository @Inject constructor(
    private val dao: TrackDao
) : TrackLikeRepository {
    override suspend fun toggleLike(trackId: String) {
        require(trackId.isNotBlank())
        dao.toggleLike(trackId)
    }
}
