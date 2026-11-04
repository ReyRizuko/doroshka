package app.dorozhka.music.data.remote

import app.dorozhka.music.domain.model.Track

fun TrackDto.toDomain(baseUrl: String): Track {
    fun absolute(value: String?): String? = when {
        value.isNullOrBlank() -> null
        value.startsWith("https://") -> value
        value.startsWith("/") -> baseUrl.trimEnd('/') + value
        else -> baseUrl.trimEnd('/') + "/" + value
    }
    return Track(
        id = id,
        title = title,
        artist = artist,
        audioUrl = absolute(audioUrl).orEmpty(),
        imageUrl = absolute(imageUrl),
        durationMs = (durationSeconds * 1000).toLong().coerceAtLeast(0)
    )
}
