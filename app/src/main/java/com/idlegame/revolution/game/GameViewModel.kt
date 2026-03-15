package com.idlegame.revolution.game

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.pow

private const val TICK_RATE_MS = 200L
private const val SAVE_INTERVAL_TICKS = 50 // save every 10 seconds
private const val MAX_OFFLINE_SECONDS = 3 * 60 * 60.0 // 3 hours max offline progress

data class GameUiState(
    val resources: Map<ResourceType, Double> = ResourceType.values()
        .filter { it != ResourceType.NEURONS }
        .associateWith { 0.0 }
        .toMutableMap()
        .also { it[ResourceType.CREDITS] = 10.0 },
    val resourcesPerSecond: Map<ResourceType, Double> = ResourceType.values()
        .associateWith { 0.0 },
    val buildings: Map<BuildingId, Int> = BuildingId.values().associateWith { 0 },
    val purchasedUpgrades: Set<UpgradeId> = emptySet(),
    val unlockedBuildings: Set<BuildingId> = setOf(BuildingId.ORE_MINE),
    val unlockedUpgrades: Set<UpgradeId> = emptySet(),
    val totalCreditsEarned: Double = 0.0,
    val neurons: Int = 0,
    val prestigeCount: Int = 0,
    val prestigeNeuronsPreview: Int = 0,
    val offlineProgressSeconds: Double = 0.0
)

class GameViewModel(application: Application) : AndroidViewModel(application) {

    private val gson = Gson()
    private val prefs = application.getSharedPreferences("game_save", Context.MODE_PRIVATE)

    private val _uiState = MutableStateFlow(GameUiState())
    val uiState: StateFlow<GameUiState> = _uiState.asStateFlow()

    private var tickCount = 0

    init {
        loadGame()
        startGameLoop()
    }

    // ─── Game loop ────────────────────────────────────────────────────────────

    private fun startGameLoop() {
        viewModelScope.launch {
            while (true) {
                delay(TICK_RATE_MS)
                tick()
            }
        }
    }

    private fun tick() {
        val state = _uiState.value
        val dt = TICK_RATE_MS / 1000.0

        val perSecond = computeProductionRates(state)
        val newResources = state.resources.toMutableMap()
        var creditsGained = 0.0

        // Determine limiting factor for each building production
        val buildingDefs = BUILDING_DEFS.associateBy { it.id }

        // Apply production
        for (def in BUILDING_DEFS) {
            val count = state.buildings[def.id] ?: 0
            if (count == 0) continue

            val mult = getBuildingMultiplier(state, def.id)
            val neuronMult = getNeuronMultiplier(state.neurons)
            val actualRate = def.production.amount * count * mult * neuronMult * dt

            // Check if we have enough resources to consume
            var canProduce = actualRate
            for ((consumeType, consumeRate) in def.production.consumes) {
                val available = newResources[consumeType] ?: 0.0
                val needed = consumeRate * count * mult * neuronMult * dt
                if (available < needed) {
                    val ratio = available / needed
                    canProduce = minOf(canProduce, actualRate * ratio)
                }
            }

            if (canProduce <= 0) continue

            // Consume resources proportionally
            for ((consumeType, consumeRate) in def.production.consumes) {
                val needed = consumeRate * count * mult * neuronMult * dt
                val actualConsumed = needed * (canProduce / actualRate)
                newResources[consumeType] = maxOf(0.0, (newResources[consumeType] ?: 0.0) - actualConsumed)
            }

            // Produce resources
            val produced = canProduce
            newResources[def.production.produces] = (newResources[def.production.produces] ?: 0.0) + produced

            if (def.production.produces == ResourceType.CREDITS) {
                creditsGained += produced
            }
        }

        val newTotalCredits = state.totalCreditsEarned + creditsGained

        // Recompute unlocks
        val newUnlockedBuildings = computeUnlockedBuildings(newResources, state.purchasedUpgrades, newTotalCredits, state.neurons)
        val newUnlockedUpgrades = computeUnlockedUpgrades(newResources, state.purchasedUpgrades, newTotalCredits)

        val prestigePreview = computeNeuronsFromPrestige(newTotalCredits)

        tickCount++
        if (tickCount % SAVE_INTERVAL_TICKS == 0) {
            saveGame(_uiState.value.copy(
                resources = newResources,
                resourcesPerSecond = perSecond,
                totalCreditsEarned = newTotalCredits,
                unlockedBuildings = newUnlockedBuildings,
                unlockedUpgrades = newUnlockedUpgrades,
                prestigeNeuronsPreview = prestigePreview
            ))
        }

        _uiState.value = _uiState.value.copy(
            resources = newResources,
            resourcesPerSecond = perSecond,
            totalCreditsEarned = newTotalCredits,
            unlockedBuildings = newUnlockedBuildings,
            unlockedUpgrades = newUnlockedUpgrades,
            prestigeNeuronsPreview = prestigePreview,
            offlineProgressSeconds = 0.0
        )
    }

    private fun computeProductionRates(state: GameUiState): Map<ResourceType, Double> {
        val rates = ResourceType.values().associateWith { 0.0 }.toMutableMap()
        val neuronMult = getNeuronMultiplier(state.neurons)

        for (def in BUILDING_DEFS) {
            val count = state.buildings[def.id] ?: 0
            if (count == 0) continue
            val mult = getBuildingMultiplier(state, def.id)
            val rate = def.production.amount * count * mult * neuronMult
            rates[def.production.produces] = (rates[def.production.produces] ?: 0.0) + rate
            for ((consumeType, consumeRate) in def.production.consumes) {
                rates[consumeType] = (rates[consumeType] ?: 0.0) - consumeRate * count * mult * neuronMult
            }
        }
        return rates
    }

    private fun getBuildingMultiplier(state: GameUiState, buildingId: BuildingId): Double {
        var mult = 1.0
        for (upgradeId in state.purchasedUpgrades) {
            val upgrade = UPGRADE_DEFS.find { it.id == upgradeId } ?: continue
            if (upgrade.affectsBuilding == buildingId) {
                mult *= upgrade.multiplier
            }
        }
        return mult
    }

    private fun getNeuronMultiplier(neurons: Int): Double {
        return 1.0 + neurons * 0.1  // each neuron = +10% global production
    }

    private fun computeNeuronsFromPrestige(totalCredits: Double): Int {
        if (totalCredits < 1000) return 0
        return floor(ln(totalCredits / 1000.0) / ln(10.0)).toInt().coerceAtLeast(0)
    }

    private fun computeUnlockedBuildings(
        resources: Map<ResourceType, Double>,
        purchasedUpgrades: Set<UpgradeId>,
        totalCredits: Double,
        neurons: Int
    ): Set<BuildingId> {
        return BUILDING_DEFS.filter { def ->
            def.unlockRequirement.all { (type, amount) ->
                (resources[type] ?: 0.0) >= amount || totalCredits >= amount
            }
        }.map { it.id }.toSet() + BuildingId.ORE_MINE
    }

    private fun computeUnlockedUpgrades(
        resources: Map<ResourceType, Double>,
        purchasedUpgrades: Set<UpgradeId>,
        totalCredits: Double
    ): Set<UpgradeId> {
        return UPGRADE_DEFS.filter { def ->
            def.id !in purchasedUpgrades &&
            def.unlockRequirement.all { (type, amount) ->
                (resources[type] ?: 0.0) >= amount
            }
        }.map { it.id }.toSet()
    }

    // ─── Player actions ───────────────────────────────────────────────────────

    fun clickCredits() {
        val state = _uiState.value
        val clickValue = getClickValue(state)
        val newCredits = (state.resources[ResourceType.CREDITS] ?: 0.0) + clickValue
        val newTotal = state.totalCreditsEarned + clickValue
        _uiState.value = state.copy(
            resources = state.resources.toMutableMap().also { it[ResourceType.CREDITS] = newCredits },
            totalCreditsEarned = newTotal
        )
    }

    private fun getClickValue(state: GameUiState): Double {
        val neuronMult = getNeuronMultiplier(state.neurons)
        val base = 1.0 + (state.buildings[BuildingId.ORE_MINE] ?: 0) * 0.1
        return base * neuronMult
    }

    fun buyBuilding(buildingId: BuildingId) {
        val state = _uiState.value
        val def = BUILDING_DEFS.find { it.id == buildingId } ?: return
        val currentCount = state.buildings[buildingId] ?: 0
        val cost = def.getCostForCount(currentCount)

        if (!canAfford(state.resources, cost)) return

        val newResources = deductCost(state.resources, cost)
        val newBuildings = state.buildings.toMutableMap().also { it[buildingId] = currentCount + 1 }

        _uiState.value = state.copy(resources = newResources, buildings = newBuildings)
    }

    fun buyUpgrade(upgradeId: UpgradeId) {
        val state = _uiState.value
        if (upgradeId in state.purchasedUpgrades) return
        val def = UPGRADE_DEFS.find { it.id == upgradeId } ?: return

        if (!canAfford(state.resources, def.cost)) return

        val newResources = deductCost(state.resources, def.cost)
        val newUpgrades = state.purchasedUpgrades + upgradeId

        _uiState.value = state.copy(resources = newResources, purchasedUpgrades = newUpgrades)
    }

    fun prestige() {
        val state = _uiState.value
        val gainedNeurons = computeNeuronsFromPrestige(state.totalCreditsEarned)
        if (gainedNeurons == 0) return

        val newNeurons = state.neurons + gainedNeurons
        _uiState.value = GameUiState(
            resources = ResourceType.values()
                .filter { it != ResourceType.NEURONS }
                .associateWith { 0.0 }
                .toMutableMap()
                .also { it[ResourceType.CREDITS] = 10.0 },
            buildings = BuildingId.values().associateWith { 0 },
            purchasedUpgrades = emptySet(),
            unlockedBuildings = setOf(BuildingId.ORE_MINE),
            neurons = newNeurons,
            prestigeCount = state.prestigeCount + 1,
            totalCreditsEarned = 0.0
        )
        saveGame(_uiState.value)
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    fun canAfford(resources: Map<ResourceType, Double>, cost: Map<ResourceType, Double>): Boolean {
        return cost.all { (type, amount) -> (resources[type] ?: 0.0) >= amount }
    }

    private fun deductCost(
        resources: Map<ResourceType, Double>,
        cost: Map<ResourceType, Double>
    ): Map<ResourceType, Double> {
        return resources.toMutableMap().also { map ->
            cost.forEach { (type, amount) ->
                map[type] = (map[type] ?: 0.0) - amount
            }
        }
    }

    // ─── Save / Load ──────────────────────────────────────────────────────────

    fun saveGame(state: GameUiState = _uiState.value) {
        val save = GameSave(
            resources = state.resources.mapKeys { it.key.name },
            buildings = state.buildings.mapKeys { it.key.name },
            purchasedUpgrades = state.purchasedUpgrades.map { it.name },
            totalCreditsEarned = state.totalCreditsEarned,
            neurons = state.neurons,
            prestigeCount = state.prestigeCount,
            lastSaveTime = System.currentTimeMillis()
        )
        prefs.edit().putString("save", gson.toJson(save)).apply()
    }

    private fun loadGame() {
        val json = prefs.getString("save", null) ?: return
        runCatching {
            val save = gson.fromJson(json, GameSave::class.java)
            val resources = ResourceType.values()
                .filter { it != ResourceType.NEURONS }
                .associateWith { rt -> save.resources[rt.name] ?: if (rt == ResourceType.CREDITS) 10.0 else 0.0 }
                .toMutableMap()

            val buildings = BuildingId.values()
                .associateWith { bid -> save.buildings[bid.name] ?: 0 }

            val upgrades = save.purchasedUpgrades
                .mapNotNull { name -> runCatching { UpgradeId.valueOf(name) }.getOrNull() }
                .toSet()

            // Calculate offline progress
            val offlineSeconds = minOf(
                (System.currentTimeMillis() - save.lastSaveTime) / 1000.0,
                MAX_OFFLINE_SECONDS
            )

            val baseState = GameUiState(
                resources = resources,
                buildings = buildings,
                purchasedUpgrades = upgrades,
                unlockedBuildings = computeUnlockedBuildings(resources, upgrades, save.totalCreditsEarned, save.neurons),
                unlockedUpgrades = computeUnlockedUpgrades(resources, upgrades, save.totalCreditsEarned),
                totalCreditsEarned = save.totalCreditsEarned,
                neurons = save.neurons,
                prestigeCount = save.prestigeCount
            )

            // Apply offline production (simplified - no consumption chain for offline)
            val offlineResources = resources.toMutableMap()
            var offlineCredits = 0.0

            if (offlineSeconds > 5) {
                val rates = computeProductionRates(baseState)
                for ((resType, rate) in rates) {
                    if (rate > 0) {
                        offlineResources[resType] = (offlineResources[resType] ?: 0.0) + rate * offlineSeconds * 0.5
                    }
                }
                offlineCredits = (rates[ResourceType.CREDITS] ?: 0.0) * offlineSeconds * 0.5
            }

            _uiState.value = baseState.copy(
                resources = offlineResources,
                totalCreditsEarned = save.totalCreditsEarned + offlineCredits,
                offlineProgressSeconds = if (offlineSeconds > 5) offlineSeconds else 0.0
            )
        }
    }

    fun dismissOfflineProgress() {
        _uiState.value = _uiState.value.copy(offlineProgressSeconds = 0.0)
    }
}
