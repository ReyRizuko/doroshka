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

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(tracks: List<TrackEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(track: TrackEntity)

    @Query("UPDATE tracks SET isLiked = CASE WHEN isLiked = 1 THEN 0 ELSE 1 END WHERE id = :id")
    suspend fun toggleLike(id: String)

    @Query("DELETE FROM tracks WHERE id = :id")
    suspend fun delete(id: String)

    @Query("DELETE FROM tracks WHERE isLiked = 0")
    suspend fun clearUnlikedCache()
}
