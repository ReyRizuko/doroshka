package app.dorozhka.music.playback

import android.content.ComponentName
import android.content.Context
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import app.dorozhka.music.domain.model.Track
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.util.concurrent.Executor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

data class PlaybackUiState(
    val currentTrack: Track? = null,
    val isPlaying: Boolean = false,
    val positionMs: Long = 0,
    val durationMs: Long = 0,
    val playbackState: Int = Player.STATE_IDLE,
    val shuffleEnabled: Boolean = false,
    val repeatMode: Int = Player.REPEAT_MODE_OFF
)

@Singleton
class PlayerConnection @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val _state = MutableStateFlow(PlaybackUiState())
    val state: StateFlow<PlaybackUiState> = _state.asStateFlow()
    private val _progress = MutableStateFlow(0L)
    val progress: StateFlow<Long> = _progress.asStateFlow()
    private var controller: MediaController? = null
    private var pendingQueue: Pair<List<Track>, Int>? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val listener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) = publish()
        override fun onPlaybackStateChanged(playbackState: Int) = publish()
        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) = publish()
        override fun onShuffleModeEnabledChanged(shuffleModeEnabled: Boolean) = publish()
        override fun onRepeatModeChanged(repeatMode: Int) = publish()
        override fun onEvents(player: Player, events: Player.Events) = publish()
    }

    init {
        val token = SessionToken(context, ComponentName(context, MusicPlaybackService::class.java))
        val future = MediaController.Builder(context, token).buildAsync()
        future.addListener({
            runCatching { future.get() }.onSuccess { mediaController ->
                controller = mediaController
                mediaController.addListener(listener)
                pendingQueue?.let { (tracks, index) -> pendingQueue = null; playQueue(tracks, index) }
                publish()
            }
        }, Executor { it.run() })
        scope.launch {
            while (isActive) {
                val activePlayer = controller
                if (activePlayer != null) {
                    _progress.value = activePlayer.currentPosition.coerceAtLeast(0L)
                    delay(if (activePlayer.isPlaying) 250L else 500L)
                } else {
                    delay(500L)
                }
            }
        }
    }

    private fun publish() {
        val p = controller ?: return
        val metadata = p.currentMediaItem?.mediaMetadata
        val track = p.currentMediaItem?.let { item ->
            Track(
                id = item.mediaId,
                title = metadata?.title?.toString().orEmpty(),
                artist = metadata?.artist?.toString().orEmpty(),
                audioUrl = item.localConfiguration?.uri?.toString().orEmpty(),
                imageUrl = metadata?.artworkUri?.toString(),
                durationMs = p.duration.coerceAtLeast(0)
            )
        }
        _progress.value = p.currentPosition.coerceAtLeast(0L)
        _state.update {
            it.copy(
                currentTrack = track,
                isPlaying = p.isPlaying,
                positionMs = p.currentPosition.coerceAtLeast(0),
                durationMs = p.duration.coerceAtLeast(0),
                playbackState = p.playbackState,
                shuffleEnabled = p.shuffleModeEnabled,
                repeatMode = p.repeatMode
            )
        }
    }

    fun playQueue(tracks: List<Track>, startIndex: Int = 0) {
        val p = controller
        if (p == null) { pendingQueue = tracks to startIndex; return }
        val items = tracks.map { track ->
            MediaItem.Builder()
                .setMediaId(track.id)
                .setUri(track.audioUrl)
                .setMediaMetadata(
                    MediaMetadata.Builder()
                        .setTitle(track.title)
                        .setArtist(track.artist)
                        .setArtworkUri(track.imageUrl?.let(android.net.Uri::parse))
                        .build()
                ).build()
        }
        if (items.isEmpty()) return
        p.setMediaItems(items, startIndex.coerceIn(items.indices), 0L)
        p.prepare()
        p.play()
    }

    fun togglePlayPause() { controller?.let { if (it.isPlaying) it.pause() else it.play() } }
    fun seekTo(positionMs: Long) { controller?.seekTo(positionMs.coerceAtLeast(0)) }
    fun next() { controller?.seekToNext() }
    fun previous() { controller?.seekToPrevious() }
    fun toggleShuffle() { controller?.let { it.shuffleModeEnabled = !it.shuffleModeEnabled } }
    fun cycleRepeat() { controller?.let { it.repeatMode = when (it.repeatMode) {
        Player.REPEAT_MODE_OFF -> Player.REPEAT_MODE_ALL
        Player.REPEAT_MODE_ALL -> Player.REPEAT_MODE_ONE
        else -> Player.REPEAT_MODE_OFF
    } } }
}
