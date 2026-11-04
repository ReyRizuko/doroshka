package app.dorozhka.music.data.repository

import app.dorozhka.music.data.local.TrackDao
import app.dorozhka.music.data.local.TrackEntity
import app.dorozhka.music.data.remote.MusicApiService
import app.dorozhka.music.data.remote.toDomain
import app.dorozhka.music.domain.model.Track
import app.dorozhka.music.domain.repository.MusicRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MusicRepositoryImpl @Inject constructor(
    private val dao: TrackDao,
    private val api: MusicApiService
) : MusicRepository {

    override fun observeTrending(forceRefresh: Boolean): Flow<List<Track>> = flow {
        val cached = dao.observeAll()
        if (forceRefresh || dao.getById("__catalog_seed__") == null) {
            runCatching {
                val remote = api.getTrending().items.map { it.toDomain() }
                if (remote.isNotEmpty()) dao.upsertAll(remote.map(TrackEntity::fromDomain))
            }
        }
        emitAll(cached.map { rows -> rows.map(TrackEntity::toDomain) })
    }.flowOn(Dispatchers.IO)

    override fun searchTracks(query: String): Flow<List<Track>> = flow {
        val term = query.trim()
        if (term.isEmpty()) {
            emitAll(dao.observeAll().map { rows -> rows.map(TrackEntity::toDomain) })
        } else {
            emitAll(dao.searchLocal(term).map { rows -> rows.map(TrackEntity::toDomain) })
            // Search network is executed separately by searchRemote() to keep this stream cancellable.
        }
    }.flowOn(Dispatchers.IO)

    suspend fun refreshSearch(query: String): List<Track> = withContext(Dispatchers.IO) {
        val remote = api.searchTracks(query).items.map { it.toDomain() }
        if (remote.isNotEmpty()) dao.upsertAll(remote.map(TrackEntity::fromDomain))
        remote
    }

    override fun observeLiked(): Flow<List<Track>> =
        dao.observeLiked().map { rows -> rows.map(TrackEntity::toDomain) }

    override suspend fun toggleLike(trackId: String) = withContext(Dispatchers.IO) {
        if (dao.getById(trackId) != null) dao.toggleLike(trackId)
    }

    override suspend fun getTrack(trackId: String): Track? = withContext(Dispatchers.IO) {
        dao.getById(trackId)?.toDomain() ?: runCatching { api.getTrackDetails(trackId).toDomain() }
            .getOrNull()?.also { dao.upsert(TrackEntity.fromDomain(it)) }
    }
}
