package app.dorozhka.music.domain.model

data class Track(
    val id: String,
    val title: String,
    val artist: String,
    val audioUrl: String,
    val imageUrl: String?,
    val durationMs: Long,
    val isLiked: Boolean = false,
    val localCachePath: String? = null
)
