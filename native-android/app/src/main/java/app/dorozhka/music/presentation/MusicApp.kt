package app.dorozhka.music.presentation

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import coil.compose.AsyncImage
import app.dorozhka.music.domain.model.Track
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import kotlin.math.max

private object Destinations {
    const val HOME = "home"
    const val SEARCH = "search"
    const val PLAYER = "player"
    const val LIBRARY = "library"
}

@Composable
fun MusicApp(viewModel: MusicViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()
    val route = backStack?.destination?.route
    val onEvent: (MusicEvent) -> Unit = viewModel::onEvent

    Scaffold(
        containerColor = Color(0xFF08090C),
        contentWindowInsets = WindowInsets.safeDrawing,
        bottomBar = {
            Column {
                if (state.playback.currentTrack != null && route != Destinations.PLAYER) {
                    MiniPlayer(state.playback, onEvent) { nav.navigate(Destinations.PLAYER) }
                }
                if (route != Destinations.PLAYER) {
                    NavigationBar(containerColor = Color(0xFF101115), contentColor = Color.White) {
                        NavigationBarItem(
                            selected = route == Destinations.HOME,
                            onClick = { nav.navigate(Destinations.HOME) { popUpTo(nav.graph.findStartDestination().id) { saveState = true }; launchSingleTop = true; restoreState = true } },
                            icon = { Icon(Icons.Filled.Home, null) }, label = { Text("Главная") }
                        )
                        NavigationBarItem(
                            selected = route == Destinations.SEARCH,
                            onClick = { nav.navigate(Destinations.SEARCH) { launchSingleTop = true } },
                            icon = { Icon(Icons.Filled.Search, null) }, label = { Text("Поиск") }
                        )
                        NavigationBarItem(
                            selected = route == Destinations.LIBRARY,
                            onClick = { nav.navigate(Destinations.LIBRARY) { launchSingleTop = true } },
                            icon = { Icon(Icons.Filled.LibraryMusic, null) }, label = { Text("Медиатека") }
                        )
                    }
                }
            }
        }
    ) { padding ->
        NavHost(navController = nav, startDestination = Destinations.HOME, modifier = Modifier.padding(padding)) {
            composable(Destinations.HOME) {
                HomeScreen(state, onEvent) { nav.navigate(Destinations.PLAYER) }
            }
            composable(Destinations.SEARCH) {
                SearchScreen(state, onEvent) { nav.navigate(Destinations.PLAYER) }
            }
            composable(Destinations.LIBRARY) {
                LibraryScreen(state, onEvent) { nav.navigate(Destinations.PLAYER) }
            }
            composable(Destinations.PLAYER) {
                PlayerScreen(state, onEvent) { nav.popBackStack() }
            }
        }
    }
}

@Composable
private fun HomeScreen(state: MusicUiState, onEvent: (MusicEvent) -> Unit, openPlayer: () -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 24.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        item {
            Text("DOROZHKA", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
            Text("Мой поток", style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.ExtraBold)
            Text("Музыка под твоё настроение", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        item {
            Box(
                Modifier.fillMaxWidth().height(178.dp).clip(RoundedCornerShape(26.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFF30343A), Color(0xFF121419), Color(0xFF39452B))))
                    .clickable { onEvent(MusicEvent.Refresh) }.padding(22.dp),
                contentAlignment = Alignment.BottomStart
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("ТВОЯ МУЗЫКА", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelSmall)
                    Text("Открой новый звук", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    Text("Обновить подборку  →", color = Color.LightGray)
                }
            }
        }
        item {
            Text("Под настроение", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("Фокус", "Энергия", "Ночь", "Спокойствие").forEach {
                    Surface(shape = CircleShape, color = Color(0xFF1A1C21)) {
                        Text(it, Modifier.padding(horizontal = 14.dp, vertical = 10.dp), color = Color.White)
                    }
                }
            }
        }
        item { Text("Популярное", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
        if (state.trending.isEmpty()) {
            item {
                Text(
                    state.error ?: "Каталог пока пуст. Подключи сервер каталога и добавь лицензированные треки.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 24.dp)
                )
            }
        }
        items(state.trending, key = { it.id }) { track ->
            TrackRow(track, onPlay = { onEvent(MusicEvent.PlayTrack(track, state.trending)) }, onLike = { onEvent(MusicEvent.ToggleLike(track.id)) })
        }
    }
}

@Composable
private fun SearchScreen(state: MusicUiState, onEvent: (MusicEvent) -> Unit, openPlayer: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 24.dp)) {
        Text("Поиск", style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.ExtraBold)
        Spacer(Modifier.height(16.dp))
        OutlinedTextField(
            value = state.query,
            onValueChange = { onEvent(MusicEvent.Search(it)) },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Трек, альбом или исполнитель") },
            leadingIcon = { Icon(Icons.Filled.Search, null) },
            singleLine = true,
            shape = RoundedCornerShape(18.dp)
        )
        Spacer(Modifier.height(16.dp))
        when {
            state.isLoading -> LinearProgressIndicator(Modifier.fillMaxWidth())
            state.query.isBlank() -> Text("Ищи музыку в едином каталоге Дорожки", color = MaterialTheme.colorScheme.onSurfaceVariant)
            state.searchResults.isEmpty() -> Text(state.error ?: "Ничего не найдено", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        LazyColumn(contentPadding = PaddingValues(bottom = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(state.searchResults, key = { it.id }) { track ->
                TrackRow(track, onPlay = { onEvent(MusicEvent.PlayTrack(track, state.searchResults)) }, onLike = { onEvent(MusicEvent.ToggleLike(track.id)) })
            }
        }
    }
}

@Composable
private fun LibraryScreen(state: MusicUiState, onEvent: (MusicEvent) -> Unit, openPlayer: () -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item { Text("Медиатека", style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.ExtraBold) }
        item { Text("Избранное", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
        if (state.likedTracks.isEmpty()) item { Text("Отмечай треки сердцем — они появятся здесь.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        items(state.likedTracks, key = { it.id }) { track ->
            TrackRow(track, onPlay = { onEvent(MusicEvent.PlayTrack(track, state.likedTracks)) }, onLike = { onEvent(MusicEvent.ToggleLike(track.id)) })
        }
    }
}

@Composable
private fun TrackRow(track: Track, onPlay: () -> Unit, onLike: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).clickable(onClick = onPlay).padding(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AsyncImage(model = track.imageUrl, contentDescription = null, modifier = Modifier.size(54.dp).clip(RoundedCornerShape(10.dp)))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(track.title, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.SemiBold)
            Text(track.artist, maxLines = 1, overflow = TextOverflow.Ellipsis, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        }
        IconButton(onClick = onLike) {
            Icon(if (track.isLiked) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder, null, tint = if (track.isLiked) MaterialTheme.colorScheme.primary else Color.Gray)
        }
    }
}

@Composable
private fun MiniPlayer(playback: app.dorozhka.music.playback.PlaybackUiState, onEvent: (MusicEvent) -> Unit, onOpen: () -> Unit) {
    val track = playback.currentTrack ?: return
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 5.dp)
            .clip(RoundedCornerShape(16.dp)).background(Color(0xFF202126))
            .clickable(onClick = onOpen).padding(9.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AsyncImage(track.imageUrl, null, Modifier.size(42.dp).clip(RoundedCornerShape(8.dp)))
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(track.title, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.SemiBold)
            Text(track.artist, maxLines = 1, color = Color.Gray, style = MaterialTheme.typography.labelSmall)
        }
        IconButton(onClick = { onEvent(MusicEvent.TogglePlayPause) }) {
            Icon(if (playback.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow, null)
        }
        IconButton(onClick = { onEvent(MusicEvent.Next) }) { Icon(Icons.Filled.SkipNext, null) }
    }
}

@Composable
private fun PlayerScreen(state: MusicUiState, onEvent: (MusicEvent) -> Unit, onBack: () -> Unit) {
    val playback = state.playback
    val track = playback.currentTrack
    if (track == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("Выбери трек в каталоге") }
        return
    }
    val duration = max(playback.durationMs, track.durationMs).coerceAtLeast(1L)
    Column(
        Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF303238), Color(0xFF111216), Color(0xFF08090C))))
            .padding(horizontal = 24.dp, vertical = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("‹", Modifier.clickable(onClick = onBack), style = MaterialTheme.typography.headlineLarge)
            Spacer(Modifier.weight(1f))
            Text("СЕЙЧАС ИГРАЕТ", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            Text("•••", color = Color.Gray)
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            AsyncImage(
                model = track.imageUrl,
                contentDescription = "Обложка ${track.title}",
                modifier = Modifier.fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(26.dp))
            )
            Spacer(Modifier.height(28.dp))
            Text(track.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(track.artist, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Column(Modifier.fillMaxWidth()) {
            AnimatedWaveform(playback.isPlaying, Modifier.fillMaxWidth().height(38.dp))
            Slider(
                value = playback.positionMs.coerceIn(0, duration).toFloat(),
                onValueChange = { onEvent(MusicEvent.SeekTo(it.toLong())) },
                valueRange = 0f..duration.toFloat()
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(formatTime(playback.positionMs), style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                Text(formatTime(duration), style = MaterialTheme.typography.labelSmall, color = Color.Gray)
            }
            Spacer(Modifier.height(14.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { onEvent(MusicEvent.Shuffle) }) { Icon(Icons.Filled.Shuffle, null, tint = if (playback.shuffleEnabled) MaterialTheme.colorScheme.primary else Color.Gray) }
                IconButton(onClick = { onEvent(MusicEvent.Previous) }) { Icon(Icons.Filled.SkipPrevious, null, modifier = Modifier.size(34.dp)) }
                FilledIconButton(onClick = { onEvent(MusicEvent.TogglePlayPause) }, modifier = Modifier.size(70.dp), shape = CircleShape) {
                    AnimatedContent(playback.isPlaying, label = "play-pause") { playing ->
                        Icon(if (playing) Icons.Filled.Pause else Icons.Filled.PlayArrow, null, modifier = Modifier.size(38.dp))
                    }
                }
                IconButton(onClick = { onEvent(MusicEvent.Next) }) { Icon(Icons.Filled.SkipNext, null, modifier = Modifier.size(34.dp)) }
                IconButton(onClick = { onEvent(MusicEvent.Repeat) }) { Icon(Icons.Filled.Repeat, null, tint = if (playback.repeatMode != 0) MaterialTheme.colorScheme.primary else Color.Gray) }
            }
        }
    }
}

@Composable
private fun AnimatedWaveform(playing: Boolean, modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "wave")
    val phase by transition.animateFloat(
        initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(900, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "phase"
    )
    Canvas(modifier) {
        val count = 44
        val gap = size.width / (count * 1.8f)
        val barWidth = gap * .8f
        repeat(count) { index ->
            val wave = if (playing) (.2f + .8f * kotlin.math.abs(kotlin.math.sin(index * .42f + phase * 4f))) else .16f
            val height = size.height * wave
            drawRoundRect(
                color = Color(0xFFC4FF6B).copy(alpha = .45f + wave * .5f),
                topLeft = Offset(index * (barWidth + gap), (size.height - height) / 2f),
                size = Size(barWidth, height),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(barWidth, barWidth)
            )
        }
    }
}

private fun formatTime(ms: Long): String {
    val seconds = (ms.coerceAtLeast(0) / 1000)
    return "${seconds / 60}:${(seconds % 60).toString().padStart(2, '0')}"
}
