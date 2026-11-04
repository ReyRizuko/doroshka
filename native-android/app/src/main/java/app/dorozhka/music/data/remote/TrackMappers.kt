package app.dorozhka.music.data.remote

import app.dorozhka.music.domain.model.Track

fun TrackDto.toDomain(): Track = Track(
    id = id,
    title = title,
    artist = artist,
    audioUrl = audioUrl,
    imageUrl = imageUrl,
    durationMs = (durationSeconds * 1000).toLong().coerceAtLeast(0)
)
