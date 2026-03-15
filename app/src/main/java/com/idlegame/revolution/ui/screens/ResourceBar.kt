package com.idlegame.revolution.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.idlegame.revolution.game.GameUiState
import com.idlegame.revolution.game.ResourceType
import com.idlegame.revolution.game.formatAmount
import com.idlegame.revolution.ui.theme.DarkCard
import com.idlegame.revolution.ui.theme.TextSecondary

@Composable
fun ResourceBar(state: GameUiState, modifier: Modifier = Modifier) {
    val displayResources = listOf(
        ResourceType.CREDITS,
        ResourceType.ORE,
        ResourceType.METAL,
        ResourceType.ENERGY,
        ResourceType.CHIPS,
        ResourceType.DATA
    ).filter { (state.resources[it] ?: 0.0) > 0.001 || it == ResourceType.CREDITS }

    LazyRow(
        modifier = modifier
            .fillMaxWidth()
            .background(DarkCard)
            .padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(displayResources) { resType ->
            ResourceChip(
                type = resType,
                amount = state.resources[resType] ?: 0.0,
                perSecond = state.resourcesPerSecond[resType] ?: 0.0
            )
        }
        if (state.neurons > 0) {
            item {
                ResourceChip(
                    type = ResourceType.NEURONS,
                    amount = state.neurons.toDouble(),
                    perSecond = 0.0
                )
            }
        }
    }
}

@Composable
fun ResourceChip(type: ResourceType, amount: Double, perSecond: Double) {
    val color = Color(type.color)
    Column(
        modifier = Modifier
            .background(color.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "${type.symbol} ${amount.formatAmount()}",
            color = color,
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp
        )
        if (perSecond != 0.0) {
            Text(
                text = "${if (perSecond >= 0) "+" else ""}${perSecond.formatAmount()}/s",
                color = if (perSecond >= 0) TextSecondary else Color(0xFFFF5252),
                fontSize = 10.sp
            )
        }
    }
}
