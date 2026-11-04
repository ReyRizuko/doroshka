package app.dorozhka.music.presentation.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Colors = darkColorScheme(
    primary = Color(0xFFC4FF6B),
    onPrimary = Color(0xFF10140A),
    secondary = Color(0xFFB7C79A),
    background = Color(0xFF08090C),
    surface = Color(0xFF111216),
    surfaceVariant = Color(0xFF1B1C21),
    onSurface = Color(0xFFF4F4F5),
    onSurfaceVariant = Color(0xFF999AA1)
)

@Composable
fun DoroshkaTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Colors, content = content)
}
