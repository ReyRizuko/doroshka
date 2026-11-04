package app.dorozhka.music.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface TrackDao {
    @Query("SELECT * FROM tracks ORDER BY cachedAt DESC")
    fun observeAll(): Flow<List<TrackEntity>>

    @Query("SELECT * FROM tracks WHERE isLiked = 1 ORDER BY title COLLATE NOCASE")
    fun observeLiked(): Flow<List<TrackEntity>>

    @Query("SELECT * FROM tracks WHERE title LIKE '%' || :query || '%' OR artist LIKE '%' || :query || '%' ORDER BY title COLLATE NOCASE")
    fun searchLocal(query: String): Flow<List<TrackEntity>>

    @Query("SELECT * FROM tracks WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): TrackEntity?

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertCatalogRows(tracks: List<TrackEntity>)

    @Query("""
        UPDATE tracks SET title = :title, artist = :artist, audioUrl = :audioUrl,
            imageUrl = :imageUrl, durationMs = :durationMs, cachedAt = :cachedAt
        WHERE id = :id
    """)
    suspend fun updateCatalogMetadata(
        id: String, title: String, artist: String, audioUrl: String,
        imageUrl: String?, durationMs: Long, cachedAt: Long
    )

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(tracks: List<TrackEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(track: TrackEntity)

    @Query("UPDATE tracks SET isLiked = CASE WHEN isLiked = 1 THEN 0 ELSE 1 END WHERE id = :id")
    suspend fun toggleLike(id: String)

    @Query("UPDATE tracks SET localCachePath = :absolutePath WHERE id = :id")
    suspend fun updateLocalPath(id: String, absolutePath: String)

    @Query("DELETE FROM tracks WHERE id = :id")
    suspend fun delete(id: String)

    @Query("DELETE FROM tracks WHERE isLiked = 0")
    suspend fun clearUnlikedCache()
}
