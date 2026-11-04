package app.dorozhka.music.core.data

import app.dorozhka.music.core.domain.CatalogProvider
import app.dorozhka.music.core.domain.CatalogTrack
import app.dorozhka.music.data.local.TrackDao
import app.dorozhka.music.data.local.TrackEntity
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext

@Singleton
class RoomBackedCatalogProvider @Inject constructor(
    private val api: CoreStreamApi,
    private val dao: TrackDao
) : CatalogProvider {

    override fun searchTracks(query: String): Flow<List<CatalogTrack>> = flow {
        val normalized = query.trim()
        if (normalized.isNotEmpty()) {
            runCatching {
                withContext(Dispatchers.IO) {
                    api.search(normalized).forEach { dto ->
                        val source = dto.audioUrl.orEmpty()
                        dao.insertCatalogRows(
                            listOf(
                                TrackEntity(
                                    id = dto.id,
                                    title = dto.title,
                                    artist = dto.artist,
                                    audioUrl = source,
                                    imageUrl = dto.imageUrl,
                                    durationMs = dto.durationMs
                                )
                            )
                        )
                        dao.updateCatalogMetadata(
                            id = dto.id,
                            title = dto.title,
                            artist = dto.artist,
                            audioUrl = source,
                            imageUrl = dto.imageUrl,
                            durationMs = dto.durationMs,
                            cachedAt = System.currentTimeMillis()
                        )
                    }
                }
            }
        }
        emitAll(dao.searchLocal(normalized).map { rows -> rows.map { it.toCatalogTrack() } })
    }

    override fun getTrending(): Flow<List<CatalogTrack>> = flow {
        runCatching {
            withContext(Dispatchers.IO) {
                api.trending().forEach { dto ->
                    val source = dto.audioUrl.orEmpty()
                    dao.insertCatalogRows(
                        listOf(
                            TrackEntity(
                                id = dto.id,
                                title = dto.title,
                                artist = dto.artist,
                                audioUrl = source,
                                imageUrl = dto.imageUrl,
                                durationMs = dto.durationMs
                            )
                        )
                    )
                    dao.updateCatalogMetadata(
                        id = dto.id,
                        title = dto.title,
                        artist = dto.artist,
                        audioUrl = source,
                        imageUrl = dto.imageUrl,
                        durationMs = dto.durationMs,
                        cachedAt = System.currentTimeMillis()
                    )
                }
            }
        }
        emitAll(dao.observeAll().map { rows -> rows.map { it.toCatalogTrack() } })
    }

    private fun TrackEntity.toCatalogTrack() = CatalogTrack(
        id = id,
        title = title,
        artist = artist,
        durationMs = durationMs,
        imageUrl = imageUrl,
        lowResSourceUrl = audioUrl,
        localCachePath = localCachePath,
        isLiked = isLiked
    )
}
