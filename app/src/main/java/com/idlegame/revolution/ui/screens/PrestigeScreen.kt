package com.idlegame.revolution.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.idlegame.revolution.game.GameUiState
import com.idlegame.revolution.game.formatAmount
import com.idlegame.revolution.ui.theme.*

@Composable
fun PrestigeScreen(
    state: GameUiState,
    onPrestige: () -> Unit
) {
    var showConfirmDialog by remember { mutableStateOf(false) }
    val canPrestige = state.prestigeNeuronsPreview > 0

    if (showConfirmDialog) {
        PrestigeConfirmDialog(
            neuronsGained = state.prestigeNeuronsPreview,
            currentNeurons = state.neurons,
            onConfirm = {
                showConfirmDialog = false
                onPrestige()
            },
            onDismiss = { showConfirmDialog = false }
        )
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(horizontal = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        contentPadding = PaddingValues(vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Text(
                text = "⚡ PRESTIGE",
                color = AccentCyan,
                fontSize = 22.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 4.sp
            )
        }

        item {
            // Prestige explanation card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = DarkCard)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "What is Prestige?",
                        color = AccentGold,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "Reset all your buildings, upgrades, and resources in exchange for Neurons — a permanent multiplier that boosts ALL production in every future run.",
                        color = TextSecondary,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center,
                        lineHeight = 20.sp
                    )
                }
            }
        }

        item {
            // Neuron formula card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = DarkCard)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Neurons Formula", color = TextSecondary, fontSize = 12.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Neurons = floor( log₁₀(Total Credits / 1000) )",
                        color = AccentPurple,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("Neuron Bonus", color = TextSecondary, fontSize = 12.sp)
                    Text(
                        text = "+10% production per Neuron",
                        color = AccentGreen,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        item {
            // Current stats card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = DarkCard)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Current Run Stats", color = AccentCyan, fontSize = 14.sp, fontWeight = FontWeight.Bold)

                    StatRow(
                        label = "Total Credits Earned",
                        value = "₵ ${state.totalCreditsEarned.formatAmount()}",
                        color = AccentGold
                    )
                    StatRow(
                        label = "Current Neurons",
                        value = "🧠 ${state.neurons}",
                        color = AccentPurple
                    )
                    StatRow(
                        label = "Current Bonus",
                        value = "+${state.neurons * 10}% all production",
                        color = AccentGreen
                    )
                    StatRow(
                        label = "Prestige Count",
                        value = "×${state.prestigeCount}",
                        color = AccentCyan
                    )
                }
            }
        }

        item {
            // Prestige gain preview
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (canPrestige)
                        AccentPurple.copy(alpha = 0.1f)
                    else DarkCard
                ),
                border = if (canPrestige)
                    androidx.compose.foundation.BorderStroke(1.dp, AccentPurple.copy(alpha = 0.4f))
                else null
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = if (canPrestige) "Prestige Reward" else "Not Yet Available",
                        color = if (canPrestige) AccentPurple else TextSecondary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )

                    if (canPrestige) {
                        Text(
                            text = "+${state.prestigeNeuronsPreview} Neurons",
                            color = AccentPurple,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        Text(
                            text = "${state.neurons} → ${state.neurons + state.prestigeNeuronsPreview} Neurons",
                            color = TextSecondary,
                            fontSize = 13.sp
                        )
                        Text(
                            text = "+${(state.neurons + state.prestigeNeuronsPreview) * 10}% production bonus",
                            color = AccentGreen,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    } else {
                        Text(
                            text = "Earn at least ₵1,000 total to unlock prestige",
                            color = TextSecondary,
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center
                        )
                        val needed = 1000.0
                        val progress = (state.totalCreditsEarned / needed).coerceIn(0.0, 1.0)
                        Spacer(modifier = Modifier.height(4.dp))
                        LinearProgressIndicator(
                            progress = { progress.toFloat() },
                            modifier = Modifier.fillMaxWidth(),
                            color = AccentCyan,
                            trackColor = DarkBackground
                        )
                        Text(
                            text = "₵${state.totalCreditsEarned.formatAmount()} / ₵${needed.formatAmount()}",
                            color = TextSecondary,
                            fontSize = 11.sp
                        )
                    }
                }
            }
        }

        item {
            Button(
                onClick = { showConfirmDialog = true },
                enabled = canPrestige,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = AccentPurple,
                    disabledContainerColor = DarkCard
                )
            ) {
                Text(
                    text = if (canPrestige) "⚡ PRESTIGE NOW ⚡" else "🔒 PRESTIGE LOCKED",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = if (canPrestige) DarkBackground else TextSecondary,
                    letterSpacing = 2.sp
                )
            }
        }
    }
}

@Composable
fun StatRow(label: String, value: String, color: androidx.compose.ui.graphics.Color) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, color = TextSecondary, fontSize = 13.sp)
        Text(text = value, color = color, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun PrestigeConfirmDialog(
    neuronsGained: Int,
    currentNeurons: Int,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = DarkCard,
        title = {
            Text(
                "⚡ Confirm Prestige",
                color = AccentPurple,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "You will RESET everything and gain:",
                    color = TextSecondary
                )
                Text(
                    "+$neuronsGained Neurons (${currentNeurons} → ${currentNeurons + neuronsGained})",
                    color = AccentPurple,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "New production bonus: +${(currentNeurons + neuronsGained) * 10}%",
                    color = AccentGreen,
                    fontWeight = FontWeight.Medium
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    "All buildings, upgrades, and resources (except Neurons) will be lost.",
                    color = TextSecondary.copy(alpha = 0.7f),
                    fontSize = 12.sp
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(containerColor = AccentPurple)
            ) {
                Text("PRESTIGE", color = DarkBackground, fontWeight = FontWeight.ExtraBold)
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onDismiss) {
                Text("Cancel", color = TextSecondary)
            }
        }
    )
}
