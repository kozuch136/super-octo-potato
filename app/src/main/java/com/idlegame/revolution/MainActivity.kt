package com.idlegame.revolution

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.idlegame.revolution.game.BuildingId
import com.idlegame.revolution.game.GameViewModel
import com.idlegame.revolution.game.UpgradeId
import com.idlegame.revolution.ui.screens.*
import com.idlegame.revolution.ui.theme.*

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            RevolutionIdleTheme {
                GameApp()
            }
        }
    }
}

enum class Screen(val label: String, val icon: ImageVector) {
    MAIN("Main", Icons.Filled.Home),
    BUILDINGS("Build", Icons.Filled.Business),
    UPGRADES("Upgrades", Icons.Filled.Science),
    PRESTIGE("Prestige", Icons.Filled.AutoAwesome),
    STATS("Stats", Icons.Filled.BarChart)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GameApp() {
    val viewModel: GameViewModel = viewModel()
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var currentScreen by remember { mutableStateOf(Screen.MAIN) }

    Scaffold(
        bottomBar = {
            NavigationBar(
                containerColor = DarkSurface,
                tonalElevation = 0.dp
            ) {
                Screen.values().forEach { screen ->
                    NavigationBarItem(
                        selected = currentScreen == screen,
                        onClick = { currentScreen = screen },
                        icon = {
                            Icon(
                                imageVector = screen.icon,
                                contentDescription = screen.label
                            )
                        },
                        label = { Text(screen.label) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = AccentCyan,
                            selectedTextColor = AccentCyan,
                            indicatorColor = AccentCyan.copy(alpha = 0.15f),
                            unselectedIconColor = TextSecondary,
                            unselectedTextColor = TextSecondary
                        )
                    )
                }
            }
        },
        containerColor = DarkBackground
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(DarkBackground)
        ) {
            // Resource bar always visible at top
            ResourceBar(state = state)

            // Screen content
            Box(modifier = Modifier.weight(1f)) {
                when (currentScreen) {
                    Screen.MAIN -> MainScreen(
                        state = state,
                        onClickCredits = { viewModel.clickCredits() },
                        onDismissOffline = { viewModel.dismissOfflineProgress() }
                    )
                    Screen.BUILDINGS -> BuildingsScreen(
                        state = state,
                        onBuyBuilding = { id: BuildingId -> viewModel.buyBuilding(id) }
                    )
                    Screen.UPGRADES -> UpgradesScreen(
                        state = state,
                        onBuyUpgrade = { id: UpgradeId -> viewModel.buyUpgrade(id) }
                    )
                    Screen.PRESTIGE -> PrestigeScreen(
                        state = state,
                        onPrestige = { viewModel.prestige() }
                    )
                    Screen.STATS -> StatsScreen(
                        state = state,
                        onSave = { viewModel.saveGame() }
                    )
                }
            }
        }
    }
}
