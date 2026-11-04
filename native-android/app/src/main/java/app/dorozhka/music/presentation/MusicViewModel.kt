package app.dorozhka.music.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.dorozhka.music.domain.model.Track
import app.dorozhka.music.domain.repository.MusicRepository
import app.dorozhka.music.domain.usecase.GetTrendingTracksUseCase
import app.dorozhka.music.domain.usecase.SearchTracksUseCase
import app.dorozhka.music.domain.usecase.ToggleLikeTrackUseCase
import app.dorozhka.music.playback.PlaybackUiState
import app.dorozhka.music.playback.PlayerConnection
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class MusicUiState(
    val trending: List<Track> = emptyList(),
    val searchResults: List<Track> = emptyList(),
    val likedTracks: List<Track> = emptyList(),
    val playback: PlaybackUiState = PlaybackUiState(),
    val query: String = "",
    val isLoading: Boolean = false,
    val error: String? = null
)

sealed interface MusicEvent {
    data class PlayTrack(val track: Track, val source: List<Track>) : MusicEvent
    data class Search(val query: String) : MusicEvent
    data class SeekTo(val positionMs: Long) : MusicEvent
    data class ToggleLike(val trackId: String) : MusicEvent
    data object TogglePlayPause : MusicEvent
    data object Next : MusicEvent
    data object Previous : MusicEvent
    data object Shuffle : MusicEvent
    data object Repeat : MusicEvent
    data object Refresh : MusicEvent
}

@OptIn(FlowPreview::class)
@HiltViewModel
class MusicViewModel @Inject constructor(
    private val getTrending: GetTrendingTracksUseCase,
    private val searchTracks: SearchTracksUseCase,
    private val toggleLike: ToggleLikeTrackUseCase,
    private val repository: MusicRepository,
    private val player: PlayerConnection
) : ViewModel() {
    private val query = MutableStateFlow("")
    private val trending = MutableStateFlow<List<Track>>(emptyList())
    private val results = MutableStateFlow<List<Track>>(emptyList())
    private val liked = MutableStateFlow<List<Track>>(emptyList())
    private val loading = MutableStateFlow(false)
    private val error = MutableStateFlow<String?>(null)

    val uiState: StateFlow<MusicUiState> = combine(
        trending, results, liked, player.state, query, loading, error
    ) { values ->
        MusicUiState(
            trending = values[0] as List<Track>,
            searchResults = values[1] as List<Track>,
            likedTracks = values[2] as List<Track>,
            playback = values[3] as PlaybackUiState,
            query = values[4] as String,
            isLoading = values[5] as Boolean,
            error = values[6] as String?
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), MusicUiState())

    init {
        viewModelScope.launch {
            getTrending().catch { error.value = it.message ?: "Не удалось загрузить каталог" }
                .collect { trending.value = it }
        }
        viewModelScope.launch {
            repository.observeLiked().collect { liked.value = it }
        }
        viewModelScope.launch {
            query.debounce(350).distinctUntilChanged().collect { term ->
                if (term.isBlank()) {
                    results.value = emptyList()
                } else {
                    loading.value = true
                    error.value = null
                    searchTracks(term).catch { error.value = it.message }.collect { results.value = it; loading.value = false }
                }
            }
        }
    }

    fun onEvent(event: MusicEvent) {
        when (event) {
            is MusicEvent.Search -> query.value = event.query
            is MusicEvent.PlayTrack -> player.playQueue(event.source, event.source.indexOfFirst { it.id == event.track.id }.coerceAtLeast(0))
            is MusicEvent.SeekTo -> player.seekTo(event.positionMs)
            is MusicEvent.ToggleLike -> viewModelScope.launch { toggleLike(event.trackId) }
            MusicEvent.TogglePlayPause -> player.togglePlayPause()
            MusicEvent.Next -> player.next()
            MusicEvent.Previous -> player.previous()
            MusicEvent.Shuffle -> player.toggleShuffle()
            MusicEvent.Repeat -> player.cycleRepeat()
            MusicEvent.Refresh -> viewModelScope.launch {
                getTrending(true).catch { error.value = it.message }.collect { trending.value = it }
            }
        }
    }
}
