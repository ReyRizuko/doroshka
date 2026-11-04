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
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

@Singleton
class MusicRepositoryImpl @Inject constructor(
    private val dao: TrackDao,
    private val api: MusicApiService,
    @Named("musicBaseUrl") private val baseUrl: String
) : MusicRepository {

    override fun observeTrending(forceRefresh: Boolean): Flow<List<Track>> = flow {
        val cached = dao.observeAll().first()
        emit(cached.map(TrackEntity::toDomain))
        if (forceRefresh || cached.isEmpty()) {
            val remote = api.getTrending().items.map { it.toDomain(baseUrl) }
            if (remote.isNotEmpty()) {
                val merged = remote.map { track ->
                    val existing = dao.getById(track.id)
                    TrackEntity.fromDomain(
                        track.copy(
                            isLiked = existing?.isLiked ?: false,
                            localCachePath = existing?.localCachePath
                        )
                    )
                }
                dao.upsertAll(merged)
            }
        }
        emitAll(dao.observeAll().map { rows -> rows.map(TrackEntity::toDomain) })
    }.flowOn(Dispatchers.IO)

    override fun searchTracks(query: String): Flow<List<Track>> = flow {
        val term = query.trim()
        if (term.isEmpty()) {
            emitAll(dao.observeAll().map { rows -> rows.map(TrackEntity::toDomain) })
            return@flow
        }
        emit(dao.searchLocal(term).first().map(TrackEntity::toDomain))
        val remote = api.searchTracks(term).items.map { it.toDomain(baseUrl) }
        if (remote.isNotEmpty()) {
            dao.upsertAll(remote.map { track ->
                val existing = dao.getById(track.id)
                TrackEntity.fromDomain(
                    track.copy(
                        isLiked = existing?.isLiked ?: false,
                        localCachePath = existing?.localCachePath
                    )
                )
            })
        }
        emitAll(dao.searchLocal(term).map { rows -> rows.map(TrackEntity::toDomain) })
    }.flowOn(Dispatchers.IO)

    override fun observeLiked(): Flow<List<Track>> =
        dao.observeLiked().map { rows -> rows.map(TrackEntity::toDomain) }

    override suspend fun toggleLike(trackId: String) = withContext(Dispatchers.IO) {
        if (dao.getById(trackId) != null) dao.toggleLike(trackId)
    }

    override suspend fun getTrack(trackId: String): Track? = withContext(Dispatchers.IO) {
        dao.getById(trackId)?.toDomain() ?: runCatching {
            api.getTrackDetails(trackId).toDomain(baseUrl)
        }.getOrNull()?.let { remote ->
            val existing = dao.getById(trackId)
            remote.copy(
                isLiked = existing?.isLiked ?: false,
                localCachePath = existing?.localCachePath
            ).also { dao.upsert(TrackEntity.fromDomain(it)) }
        }
    }
}
