package app.dorozhka.music.core.domain

interface TrackDownloadScheduler {
    fun enqueue(trackId: String)
}
