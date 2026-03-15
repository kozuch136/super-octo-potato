package com.idlegame.revolution.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val DarkBackground = Color(0xFF0A0E1A)
val DarkSurface = Color(0xFF111827)
val DarkCard = Color(0xFF1E2837)
val AccentCyan = Color(0xFF00E5FF)
val AccentGold = Color(0xFFFFD700)
val AccentGreen = Color(0xFF76FF03)
val AccentPurple = Color(0xFFE040FB)
val TextPrimary = Color(0xFFE8EAF6)
val TextSecondary = Color(0xFF90A4AE)

private val AppColorScheme = darkColorScheme(
    primary = AccentCyan,
    secondary = AccentGold,
    tertiary = AccentGreen,
    background = DarkBackground,
    surface = DarkSurface,
    onPrimary = DarkBackground,
    onSecondary = DarkBackground,
    onBackground = TextPrimary,
    onSurface = TextPrimary
)

@Composable
fun RevolutionIdleTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = AppColorScheme,
        content = content
    )
}
