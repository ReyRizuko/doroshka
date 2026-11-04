package app.dorozhka.music.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import app.dorozhka.music.domain.model.Track

@Entity(tableName = "tracks")
data class TrackEntity(
    @PrimaryKey val id: String,
    val title: String,
    val artist: String,
    val audioUrl: String,
    val imageUrl: String?,
    val durationMs: Long,
    val isLiked: Boolean = false,
    val localCachePath: String? = null,
    val cachedAt: Long = System.currentTimeMillis()
) {
    fun toDomain() = Track(id, title, artist, audioUrl, imageUrl, durationMs, isLiked, localCachePath)
    companion object {
        fun fromDomain(track: Track) = TrackEntity(
            track.id, track.title, track.artist, track.audioUrl, track.imageUrl,
            track.durationMs, track.isLiked, track.localCachePath
        )
    }
}
