package app.dorozhka.music.domain.repository

import app.dorozhka.music.domain.model.Track
import kotlinx.coroutines.flow.Flow

interface MusicRepository {
    fun observeTrending(forceRefresh: Boolean = false): Flow<List<Track>>
    fun searchTracks(query: String): Flow<List<Track>>
    fun observeLiked(): Flow<List<Track>>
    suspend fun toggleLike(trackId: String)
    suspend fun getTrack(trackId: String): Track?
}
