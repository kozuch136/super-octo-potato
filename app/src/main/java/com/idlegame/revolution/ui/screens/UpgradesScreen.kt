package com.idlegame.revolution.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.idlegame.revolution.game.*
import com.idlegame.revolution.ui.theme.*

@Composable
fun UpgradesScreen(
    state: GameUiState,
    onBuyUpgrade: (UpgradeId) -> Unit
) {
    val availableUpgrades = UPGRADE_DEFS.filter { it.id in state.unlockedUpgrades }
    val purchasedUpgrades = UPGRADE_DEFS.filter { it.id in state.purchasedUpgrades }
    val lockedUpgrades = UPGRADE_DEFS.filter {
        it.id !in state.unlockedUpgrades && it.id !in state.purchasedUpgrades
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(horizontal = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(vertical = 12.dp)
    ) {
        item {
            Text(
                text = "🔬 UPGRADES",
                color = AccentCyan,
                fontSize = 18.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 3.sp
            )
        }

        if (availableUpgrades.isNotEmpty()) {
            item {
                Text(
                    "AVAILABLE",
                    color = AccentGreen,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
            items(availableUpgrades) { def ->
                val canAfford = def.cost.all { (type, amount) ->
                    (state.resources[type] ?: 0.0) >= amount
                }
                UpgradeCard(def = def, canAfford = canAfford, isPurchased = false, isLocked = false) {
                    onBuyUpgrade(def.id)
                }
            }
        }

        if (purchasedUpgrades.isNotEmpty()) {
            item {
                Text(
                    "PURCHASED",
                    color = TextSecondary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
            items(purchasedUpgrades) { def ->
                UpgradeCard(def = def, canAfford = false, isPurchased = true, isLocked = false) {}
            }
        }

        if (lockedUpgrades.isNotEmpty()) {
            item {
                Text(
                    "LOCKED",
                    color = TextSecondary.copy(alpha = 0.5f),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
            items(lockedUpgrades) { def ->
                UpgradeCard(def = def, canAfford = false, isPurchased = false, isLocked = true) {}
            }
        }
    }
}

@Composable
fun UpgradeCard(
    def: UpgradeDef,
    canAfford: Boolean,
    isPurchased: Boolean,
    isLocked: Boolean,
    onBuy: () -> Unit
) {
    val alpha = when {
        isPurchased -> 0.5f
        isLocked -> 0.3f
        else -> 1f
    }
    val borderColor = when {
        isPurchased -> TextSecondary.copy(alpha = 0.3f)
        canAfford -> AccentGold.copy(alpha = 0.5f)
        isLocked -> Color.Transparent
        else -> DarkCard
    }

    Card(
        modifier = Modifier
            .fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isPurchased)
                DarkCard.copy(alpha = 0.5f)
            else DarkCard
        ),
        border = androidx.compose.foundation.BorderStroke(1.dp, borderColor)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = if (isPurchased) "✅" else if (isLocked) "🔒" else def.emoji,
                fontSize = 30.sp
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = def.name,
                    color = if (isLocked) TextSecondary.copy(alpha = 0.5f) else TextPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
                Text(
                    text = def.description,
                    color = TextSecondary.copy(alpha = if (isLocked) 0.4f else 0.8f),
                    fontSize = 11.sp
                )
                Spacer(modifier = Modifier.height(3.dp))
                Text(
                    text = def.effect,
                    color = if (isLocked) TextSecondary.copy(alpha = 0.3f) else AccentGold,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )

                if (!isLocked && !isPurchased) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        def.cost.forEach { (type, amount) ->
                            Text(
                                text = "${type.symbol} ${amount.formatAmount()}",
                                color = Color(type.color).copy(alpha = 0.8f),
                                fontSize = 11.sp
                            )
                        }
                    }
                }

                if (isLocked && def.unlockRequirement.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Requires: " + def.unlockRequirement.entries.joinToString(", ") { (type, amt) ->
                            "${amt.formatAmount()} ${type.displayName}"
                        },
                        color = TextSecondary.copy(alpha = 0.4f),
                        fontSize = 10.sp
                    )
                }
            }

            if (!isPurchased && !isLocked) {
                Spacer(modifier = Modifier.width(8.dp))
                Button(
                    onClick = onBuy,
                    enabled = canAfford,
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (canAfford) AccentGold else DarkCard,
                        disabledContainerColor = DarkCard
                    ),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    Text(
                        text = "BUY",
                        color = if (canAfford) DarkBackground else TextSecondary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                }
            }
        }
    }
}
