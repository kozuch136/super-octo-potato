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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.idlegame.revolution.game.*
import com.idlegame.revolution.ui.theme.*

@Composable
fun BuildingsScreen(
    state: GameUiState,
    onBuyBuilding: (BuildingId) -> Unit
) {
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
                text = "🏭 BUILDINGS",
                color = AccentCyan,
                fontSize = 18.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 3.sp,
                modifier = Modifier.padding(bottom = 4.dp)
            )
        }

        val tiers = BUILDING_DEFS.groupBy { it.tier }
        tiers.toSortedMap().forEach { (tier, defs) ->
            item {
                TierHeader(tier = tier)
            }
            items(defs) { def ->
                val isUnlocked = def.id in state.unlockedBuildings
                val count = state.buildings[def.id] ?: 0
                val cost = def.getCostForCount(count)
                val canAfford = cost.all { (type, amount) -> (state.resources[type] ?: 0.0) >= amount }
                val production = computeBuildingProductionDisplay(def, state)

                BuildingCard(
                    def = def,
                    count = count,
                    cost = cost,
                    canAfford = canAfford,
                    isUnlocked = isUnlocked,
                    productionDisplay = production,
                    onBuy = { onBuyBuilding(def.id) }
                )
            }
        }
    }
}

@Composable
fun TierHeader(tier: Int) {
    val label = when (tier) {
        1 -> "⛏ BASIC PRODUCTION"
        2 -> "⚡ POWER & CHIPS"
        3 -> "📊 DATA ECONOMY"
        4 -> "🔬 ADVANCED TECH"
        else -> "TIER $tier"
    }
    Text(
        text = label,
        color = TextSecondary,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 2.sp,
        modifier = Modifier.padding(top = 8.dp, bottom = 2.dp)
    )
}

@Composable
fun BuildingCard(
    def: BuildingDef,
    count: Int,
    cost: Map<ResourceType, Double>,
    canAfford: Boolean,
    isUnlocked: Boolean,
    productionDisplay: String,
    onBuy: () -> Unit
) {
    val cardAlpha = if (isUnlocked) 1f else 0.4f
    val borderColor = when {
        !isUnlocked -> TextSecondary.copy(alpha = 0.2f)
        canAfford -> AccentGreen.copy(alpha = 0.4f)
        else -> DarkCard
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(cardAlpha),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = DarkCard),
        border = androidx.compose.foundation.BorderStroke(1.dp, borderColor)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Emoji + count badge
            Box(
                modifier = Modifier.size(52.dp),
                contentAlignment = Alignment.BottomEnd
            ) {
                Text(
                    text = def.emoji,
                    fontSize = 36.sp,
                    modifier = Modifier.align(Alignment.TopStart)
                )
                if (count > 0) {
                    Box(
                        modifier = Modifier
                            .background(AccentCyan, RoundedCornerShape(6.dp))
                            .padding(horizontal = 4.dp, vertical = 1.dp)
                    ) {
                        Text(
                            text = count.toString(),
                            color = DarkBackground,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Info
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = def.name,
                    color = if (isUnlocked) TextPrimary else TextSecondary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp
                )
                Text(
                    text = def.description,
                    color = TextSecondary,
                    fontSize = 11.sp
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = productionDisplay,
                    color = AccentGreen,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            // Buy button + cost
            Column(horizontalAlignment = Alignment.End) {
                Button(
                    onClick = onBuy,
                    enabled = isUnlocked && canAfford,
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (canAfford) AccentGreen else DarkCard,
                        disabledContainerColor = DarkCard.copy(alpha = 0.6f)
                    ),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = "BUY",
                        color = if (canAfford && isUnlocked) DarkBackground else TextSecondary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                cost.entries.take(3).forEach { (type, amount) ->
                    Text(
                        text = "${type.symbol} ${amount.formatAmount()}",
                        color = Color(type.color).copy(alpha = 0.8f),
                        fontSize = 10.sp
                    )
                }
            }
        }
    }
}

private fun computeBuildingProductionDisplay(def: BuildingDef, state: GameUiState): String {
    val count = state.buildings[def.id] ?: 0
    val baseRate = def.production.amount
    val sb = StringBuilder()
    sb.append("+${baseRate.formatAmount()} ${def.production.produces.symbol}/s each")
    if (count > 0) {
        val mult = getBuildingMultiplier(state, def.id)
        val totalRate = baseRate * count * mult
        sb.append(" → ${totalRate.formatAmount()}/s total")
    }
    for ((consumeType, consumeRate) in def.production.consumes) {
        sb.append(" | -${consumeRate.formatAmount()} ${consumeType.symbol}/s")
    }
    return sb.toString()
}

private fun getBuildingMultiplier(state: GameUiState, buildingId: BuildingId): Double {
    var mult = 1.0
    for (upgradeId in state.purchasedUpgrades) {
        val upgrade = UPGRADE_DEFS.find { it.id == upgradeId } ?: continue
        if (upgrade.affectsBuilding == buildingId) mult *= upgrade.multiplier
    }
    return mult * (1.0 + state.neurons * 0.1)
}
