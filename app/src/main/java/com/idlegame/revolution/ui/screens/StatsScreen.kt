package com.idlegame.revolution.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.idlegame.revolution.game.*
import com.idlegame.revolution.ui.theme.*

@Composable
fun StatsScreen(
    state: GameUiState,
    onSave: () -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(vertical = 20.dp)
    ) {
        item {
            Text(
                "📊 STATISTICS",
                color = AccentCyan,
                fontSize = 18.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 3.sp
            )
        }

        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = DarkCard)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("General", color = AccentGold, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    StatRow("Total Credits Earned", "₵ ${state.totalCreditsEarned.formatAmount()}", AccentGold)
                    StatRow("Prestige Count", "${state.prestigeCount}", AccentCyan)
                    StatRow("Neurons", "${state.neurons}", AccentPurple)
                    StatRow("Production Bonus", "+${state.neurons * 10}%", AccentGreen)
                }
            }
        }

        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = DarkCard)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Resources Per Second", color = AccentCyan, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    state.resourcesPerSecond.entries
                        .filter { (_, v) -> v != 0.0 }
                        .sortedByDescending { (_, v) -> kotlin.math.abs(v) }
                        .forEach { (type, rate) ->
                            val color = if (rate >= 0) AccentGreen else androidx.compose.ui.graphics.Color(0xFFFF5252)
                            StatRow(
                                label = "${type.symbol} ${type.displayName}",
                                value = "${if (rate >= 0) "+" else ""}${rate.formatAmount()}/s",
                                color = color
                            )
                        }
                    if (state.resourcesPerSecond.all { (_, v) -> v == 0.0 }) {
                        Text("No production yet – buy some buildings!", color = TextSecondary, fontSize = 12.sp)
                    }
                }
            }
        }

        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = DarkCard)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Buildings", color = AccentCyan, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    val ownedBuildings = BUILDING_DEFS.filter { (state.buildings[it.id] ?: 0) > 0 }
                    if (ownedBuildings.isEmpty()) {
                        Text("No buildings yet!", color = TextSecondary, fontSize = 12.sp)
                    } else {
                        ownedBuildings.forEach { def ->
                            val count = state.buildings[def.id] ?: 0
                            StatRow(
                                label = "${def.emoji} ${def.name}",
                                value = count.toString(),
                                color = TextPrimary
                            )
                        }
                    }
                }
            }
        }

        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = DarkCard)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Upgrades Purchased", color = AccentCyan, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    val purchased = UPGRADE_DEFS.filter { it.id in state.purchasedUpgrades }
                    if (purchased.isEmpty()) {
                        Text("No upgrades purchased yet!", color = TextSecondary, fontSize = 12.sp)
                    } else {
                        purchased.forEach { def ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(text = "✅", fontSize = 14.sp)
                                Text(
                                    text = def.name,
                                    color = TextPrimary,
                                    fontSize = 13.sp,
                                    modifier = Modifier.weight(1f)
                                )
                                Text(
                                    text = "×${def.multiplier.toInt()}",
                                    color = AccentGold,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }

        item {
            Button(
                onClick = onSave,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = AccentCyan)
            ) {
                Text(
                    "💾 SAVE GAME",
                    color = DarkBackground,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 14.sp
                )
            }
        }
    }
}
