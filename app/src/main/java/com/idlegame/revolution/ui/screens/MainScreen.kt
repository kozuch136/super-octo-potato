package com.idlegame.revolution.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.idlegame.revolution.game.GameUiState
import com.idlegame.revolution.game.ResourceType
import com.idlegame.revolution.game.formatAmount
import com.idlegame.revolution.ui.theme.*

@Composable
fun MainScreen(
    state: GameUiState,
    onClickCredits: () -> Unit,
    onDismissOffline: () -> Unit
) {
    // Offline progress dialog
    if (state.offlineProgressSeconds > 5) {
        OfflineProgressDialog(
            seconds = state.offlineProgressSeconds,
            creditsPerSec = state.resourcesPerSecond[ResourceType.CREDITS] ?: 0.0,
            onDismiss = onDismissOffline
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // Title
        Text(
            text = "REVOLUTION IDLE",
            color = AccentCyan,
            fontSize = 22.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 4.sp
        )

        // Stats
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            StatCard(
                label = "Total Earned",
                value = state.totalCreditsEarned.formatAmount(),
                color = AccentGold,
                emoji = "💰"
            )
            StatCard(
                label = "Neurons",
                value = state.neurons.toString(),
                color = AccentPurple,
                emoji = "🧠"
            )
            StatCard(
                label = "Prestige",
                value = "×${state.prestigeCount}",
                color = AccentGreen,
                emoji = "⚡"
            )
        }

        Spacer(modifier = Modifier.weight(1f))

        // Big click button
        ClickButton(
            credits = state.resources[ResourceType.CREDITS] ?: 0.0,
            creditsPerSec = state.resourcesPerSecond[ResourceType.CREDITS] ?: 0.0,
            onClick = onClickCredits
        )

        Spacer(modifier = Modifier.weight(1f))

        // Neuron multiplier info
        if (state.neurons > 0) {
            NeuronBonusCard(neurons = state.neurons)
        }

        // Prestige preview
        if (state.prestigeNeuronsPreview > 0) {
            PrestigePreviewCard(neurons = state.prestigeNeuronsPreview)
        }
    }
}

@Composable
fun ClickButton(credits: Double, creditsPerSec: Double, onClick: () -> Unit) {
    val interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) 0.92f else 1f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy),
        label = "button_scale"
    )

    val glowAlpha by rememberInfiniteTransition(label = "glow").animateFloat(
        initialValue = 0.4f,
        targetValue = 0.9f,
        animationSpec = infiniteRepeatable(
            animation = tween(1500, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "glow_alpha"
    )

    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier
                .size(200.dp)
                .scale(scale)
        ) {
            // Glow ring
            Box(
                modifier = Modifier
                    .size(200.dp)
                    .clip(CircleShape)
                    .background(AccentGold.copy(alpha = glowAlpha * 0.15f))
            )

            // Main button
            Button(
                onClick = onClick,
                interactionSource = interactionSource,
                modifier = Modifier
                    .size(180.dp)
                    .align(Alignment.Center)
                    .clip(CircleShape),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.Transparent
                ),
                contentPadding = PaddingValues(0.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.radialGradient(
                                colors = listOf(
                                    AccentGold.copy(alpha = 0.3f),
                                    Color(0xFF7B5E00).copy(alpha = 0.8f)
                                )
                            ),
                            CircleShape
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "₵", fontSize = 56.sp, color = AccentGold, fontWeight = FontWeight.Bold)
                        Text(
                            text = credits.formatAmount(),
                            fontSize = 16.sp,
                            color = AccentGold,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = "TAP TO EARN CREDITS",
            color = TextSecondary,
            fontSize = 12.sp,
            letterSpacing = 2.sp
        )
        if (creditsPerSec > 0) {
            Text(
                text = "+${creditsPerSec.formatAmount()} /s auto",
                color = AccentGreen,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
fun StatCard(label: String, value: String, color: Color, emoji: String) {
    Column(
        modifier = Modifier
            .background(DarkCard, RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(text = emoji, fontSize = 18.sp)
        Text(text = value, color = color, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        Text(text = label, color = TextSecondary, fontSize = 10.sp)
    }
}

@Composable
fun NeuronBonusCard(neurons: Int) {
    val bonus = neurons * 10
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFE040FB).copy(alpha = 0.1f), RoundedCornerShape(10.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Text(text = "🧠 ", fontSize = 16.sp)
        Text(
            text = "$neurons Neurons → +$bonus% all production",
            color = Color(0xFFE040FB),
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
fun PrestigePreviewCard(neurons: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(AccentCyan.copy(alpha = 0.08f), RoundedCornerShape(10.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Text(text = "⚡ ", fontSize = 16.sp)
        Text(
            text = "Prestige available: +$neurons Neurons",
            color = AccentCyan,
            fontSize = 13.sp
        )
    }
}

@Composable
fun OfflineProgressDialog(seconds: Double, creditsPerSec: Double, onDismiss: () -> Unit) {
    val hours = (seconds / 3600).toInt()
    val minutes = ((seconds % 3600) / 60).toInt()
    val earned = (creditsPerSec * seconds * 0.5).formatAmount()

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = DarkCard,
        title = {
            Text(
                "Welcome back! 🎉",
                color = AccentGold,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        },
        text = {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    "You were away for",
                    color = TextSecondary,
                    textAlign = TextAlign.Center
                )
                Text(
                    "${if (hours > 0) "${hours}h " else ""}${minutes}m",
                    color = TextPrimary,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "Your factories earned:",
                    color = TextSecondary,
                    textAlign = TextAlign.Center
                )
                Text(
                    "₵ $earned",
                    color = AccentGold,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
                Text(
                    "(50% offline efficiency)",
                    color = TextSecondary,
                    fontSize = 11.sp,
                    textAlign = TextAlign.Center
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(containerColor = AccentGold),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("COLLECT", color = DarkBackground, fontWeight = FontWeight.Bold)
            }
        }
    )
}
