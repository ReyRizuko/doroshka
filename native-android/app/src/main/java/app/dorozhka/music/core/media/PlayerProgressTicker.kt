package app.dorozhka.music.core.media

import androidx.media3.common.Player
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/** Position-only observable, intentionally separate from the screen's main playback state. */
class PlayerProgressTicker(
    private val player: Player,
    private val scope: CoroutineScope
) {
    private val mutablePosition = MutableStateFlow(0L)
    val position: StateFlow<Long> = mutablePosition.asStateFlow()
    private var tickerJob: Job? = null

    fun start() {
        if (tickerJob?.isActive == true) return
        tickerJob = scope.launch {
            while (isActive) {
                mutablePosition.value = player.currentPosition.coerceAtLeast(0L)
                delay(if (player.isPlaying) 250L else 500L)
            }
        }
    }

    fun cancel() {
        tickerJob?.cancel()
        tickerJob = null
    }
}
