package com.idlegame.revolution.game

import kotlin.math.pow

// ─── Resource types ──────────────────────────────────────────────────────────

enum class ResourceType(
    val displayName: String,
    val symbol: String,
    val color: Long
) {
    CREDITS("Credits", "₵", 0xFFFFD700),
    ORE("Ore", "⛏", 0xFFB87333),
    METAL("Metal", "⚙", 0xFF9E9E9E),
    ENERGY("Energy", "⚡", 0xFF00E5FF),
    CHIPS("Chips", "💾", 0xFF76FF03),
    DATA("Data", "📊", 0xFFE040FB),
    NEURONS("Neurons", "🧠", 0xFFFF6F00)
}

data class Resource(
    val type: ResourceType,
    var amount: Double = 0.0,
    var perSecond: Double = 0.0
)

// ─── Building definitions ─────────────────────────────────────────────────────

enum class BuildingId {
    ORE_MINE, SMELTER, POWER_PLANT, CHIP_FACTORY, DATA_SERVER, CREDIT_PROCESSOR,
    QUANTUM_MINE, NEURAL_ARRAY
}

data class ProductionRate(
    val produces: ResourceType,
    val amount: Double,
    val consumes: List<Pair<ResourceType, Double>> = emptyList()
)

data class BuildingDef(
    val id: BuildingId,
    val name: String,
    val description: String,
    val emoji: String,
    val baseCost: Map<ResourceType, Double>,
    val costScaling: Double = 1.15,
    val production: ProductionRate,
    val unlockRequirement: Map<ResourceType, Double> = emptyMap(),
    val tier: Int = 1
)

val BUILDING_DEFS = listOf(
    BuildingDef(
        id = BuildingId.ORE_MINE,
        name = "Ore Mine",
        description = "Extracts raw ore from the ground",
        emoji = "⛏️",
        baseCost = mapOf(ResourceType.CREDITS to 10.0),
        production = ProductionRate(
            produces = ResourceType.ORE,
            amount = 1.0
        ),
        tier = 1
    ),
    BuildingDef(
        id = BuildingId.SMELTER,
        name = "Smelter",
        description = "Converts ore into refined metal",
        emoji = "🔥",
        baseCost = mapOf(ResourceType.CREDITS to 80.0),
        production = ProductionRate(
            produces = ResourceType.METAL,
            amount = 0.5,
            consumes = listOf(ResourceType.ORE to 1.0)
        ),
        unlockRequirement = mapOf(ResourceType.ORE to 20.0),
        tier = 1
    ),
    BuildingDef(
        id = BuildingId.POWER_PLANT,
        name = "Power Plant",
        description = "Generates energy to power operations",
        emoji = "⚡",
        baseCost = mapOf(ResourceType.CREDITS to 50.0, ResourceType.METAL to 5.0),
        production = ProductionRate(
            produces = ResourceType.ENERGY,
            amount = 2.0
        ),
        unlockRequirement = mapOf(ResourceType.METAL to 5.0),
        tier = 2
    ),
    BuildingDef(
        id = BuildingId.CHIP_FACTORY,
        name = "Chip Factory",
        description = "Manufactures microchips from metal and energy",
        emoji = "💾",
        baseCost = mapOf(ResourceType.CREDITS to 500.0, ResourceType.METAL to 20.0),
        production = ProductionRate(
            produces = ResourceType.CHIPS,
            amount = 0.2,
            consumes = listOf(ResourceType.METAL to 0.5, ResourceType.ENERGY to 1.0)
        ),
        unlockRequirement = mapOf(ResourceType.METAL to 50.0, ResourceType.ENERGY to 10.0),
        tier = 2
    ),
    BuildingDef(
        id = BuildingId.DATA_SERVER,
        name = "Data Server",
        description = "Processes chips into valuable data streams",
        emoji = "🖥️",
        baseCost = mapOf(ResourceType.CREDITS to 5000.0, ResourceType.CHIPS to 10.0),
        production = ProductionRate(
            produces = ResourceType.DATA,
            amount = 0.1,
            consumes = listOf(ResourceType.CHIPS to 0.2, ResourceType.ENERGY to 2.0)
        ),
        unlockRequirement = mapOf(ResourceType.CHIPS to 10.0),
        tier = 3
    ),
    BuildingDef(
        id = BuildingId.CREDIT_PROCESSOR,
        name = "Credit Processor",
        description = "Converts data into a stream of credits",
        emoji = "💰",
        baseCost = mapOf(ResourceType.CREDITS to 25000.0, ResourceType.DATA to 5.0),
        production = ProductionRate(
            produces = ResourceType.CREDITS,
            amount = 50.0,
            consumes = listOf(ResourceType.DATA to 0.1)
        ),
        unlockRequirement = mapOf(ResourceType.DATA to 5.0),
        tier = 3
    ),
    BuildingDef(
        id = BuildingId.QUANTUM_MINE,
        name = "Quantum Mine",
        description = "Uses quantum tunneling to extract ore at incredible speed",
        emoji = "🔬",
        baseCost = mapOf(ResourceType.CREDITS to 1_000_000.0, ResourceType.CHIPS to 500.0),
        production = ProductionRate(
            produces = ResourceType.ORE,
            amount = 100.0
        ),
        unlockRequirement = mapOf(ResourceType.CHIPS to 100.0, ResourceType.DATA to 50.0),
        tier = 4
    ),
    BuildingDef(
        id = BuildingId.NEURAL_ARRAY,
        name = "Neural Array",
        description = "Advanced AI network that generates massive data flows",
        emoji = "🧬",
        baseCost = mapOf(ResourceType.CREDITS to 10_000_000.0, ResourceType.DATA to 1000.0),
        production = ProductionRate(
            produces = ResourceType.DATA,
            amount = 10.0,
            consumes = listOf(ResourceType.ENERGY to 10.0, ResourceType.CHIPS to 1.0)
        ),
        unlockRequirement = mapOf(ResourceType.DATA to 1000.0),
        tier = 4
    )
)

// ─── Upgrade definitions ──────────────────────────────────────────────────────

enum class UpgradeId {
    BETTER_PICKAXES, REINFORCED_FURNACE, EFFICIENT_COOLING,
    QUANTUM_CIRCUITS, PARALLEL_PROCESSING, DARK_ENERGY_TAP,
    AUTOMATED_MINING, NEURAL_BOOST, CREDIT_ALGORITHM
}

data class UpgradeDef(
    val id: UpgradeId,
    val name: String,
    val description: String,
    val emoji: String,
    val cost: Map<ResourceType, Double>,
    val effect: String,
    val multiplier: Double,
    val affectsBuilding: BuildingId? = null,
    val affectsResource: ResourceType? = null,
    val unlockRequirement: Map<ResourceType, Double> = emptyMap()
)

val UPGRADE_DEFS = listOf(
    UpgradeDef(
        id = UpgradeId.BETTER_PICKAXES,
        name = "Better Pickaxes",
        description = "Sharper tools mean more ore per swing",
        emoji = "⛏️",
        cost = mapOf(ResourceType.CREDITS to 200.0),
        effect = "Ore Mine production ×2",
        multiplier = 2.0,
        affectsBuilding = BuildingId.ORE_MINE,
        unlockRequirement = mapOf(ResourceType.ORE to 50.0)
    ),
    UpgradeDef(
        id = UpgradeId.REINFORCED_FURNACE,
        name = "Reinforced Furnace",
        description = "Higher temperatures, faster smelting",
        emoji = "🔥",
        cost = mapOf(ResourceType.CREDITS to 1000.0, ResourceType.METAL to 10.0),
        effect = "Smelter production ×2",
        multiplier = 2.0,
        affectsBuilding = BuildingId.SMELTER,
        unlockRequirement = mapOf(ResourceType.METAL to 30.0)
    ),
    UpgradeDef(
        id = UpgradeId.EFFICIENT_COOLING,
        name = "Efficient Cooling",
        description = "Liquid cooling makes power plants more efficient",
        emoji = "❄️",
        cost = mapOf(ResourceType.CREDITS to 2000.0, ResourceType.METAL to 20.0),
        effect = "Power Plant production ×2",
        multiplier = 2.0,
        affectsBuilding = BuildingId.POWER_PLANT,
        unlockRequirement = mapOf(ResourceType.ENERGY to 50.0)
    ),
    UpgradeDef(
        id = UpgradeId.QUANTUM_CIRCUITS,
        name = "Quantum Circuits",
        description = "Quantum logic gates dramatically speed up chip production",
        emoji = "🔮",
        cost = mapOf(ResourceType.CREDITS to 20000.0, ResourceType.CHIPS to 50.0),
        effect = "Chip Factory production ×3",
        multiplier = 3.0,
        affectsBuilding = BuildingId.CHIP_FACTORY,
        unlockRequirement = mapOf(ResourceType.CHIPS to 50.0)
    ),
    UpgradeDef(
        id = UpgradeId.PARALLEL_PROCESSING,
        name = "Parallel Processing",
        description = "Distributed computing boosts data generation",
        emoji = "🖥️",
        cost = mapOf(ResourceType.CREDITS to 100000.0, ResourceType.DATA to 50.0),
        effect = "Data Server production ×3",
        multiplier = 3.0,
        affectsBuilding = BuildingId.DATA_SERVER,
        unlockRequirement = mapOf(ResourceType.DATA to 50.0)
    ),
    UpgradeDef(
        id = UpgradeId.DARK_ENERGY_TAP,
        name = "Dark Energy Tap",
        description = "Harness zero-point energy for unlimited power",
        emoji = "🌑",
        cost = mapOf(ResourceType.CREDITS to 500000.0, ResourceType.DATA to 200.0),
        effect = "All energy production ×5",
        multiplier = 5.0,
        affectsBuilding = BuildingId.POWER_PLANT,
        unlockRequirement = mapOf(ResourceType.DATA to 200.0)
    ),
    UpgradeDef(
        id = UpgradeId.AUTOMATED_MINING,
        name = "Automated Mining",
        description = "Robots handle all mining tasks autonomously",
        emoji = "🤖",
        cost = mapOf(ResourceType.CREDITS to 50000.0, ResourceType.CHIPS to 100.0),
        effect = "Ore Mine production ×5",
        multiplier = 5.0,
        affectsBuilding = BuildingId.ORE_MINE,
        unlockRequirement = mapOf(ResourceType.CHIPS to 100.0)
    ),
    UpgradeDef(
        id = UpgradeId.NEURAL_BOOST,
        name = "Neural Boost",
        description = "Machine learning optimizes all production chains",
        emoji = "🧠",
        cost = mapOf(ResourceType.CREDITS to 5_000_000.0, ResourceType.DATA to 1000.0),
        effect = "Neural Array production ×4",
        multiplier = 4.0,
        affectsBuilding = BuildingId.NEURAL_ARRAY,
        unlockRequirement = mapOf(ResourceType.DATA to 1000.0)
    ),
    UpgradeDef(
        id = UpgradeId.CREDIT_ALGORITHM,
        name = "Credit Algorithm",
        description = "Optimized financial algorithms maximize credit output",
        emoji = "💹",
        cost = mapOf(ResourceType.CREDITS to 1_000_000.0, ResourceType.DATA to 500.0),
        effect = "Credit Processor production ×4",
        multiplier = 4.0,
        affectsBuilding = BuildingId.CREDIT_PROCESSOR,
        unlockRequirement = mapOf(ResourceType.DATA to 500.0)
    )
)

// ─── Game state ───────────────────────────────────────────────────────────────

data class BuildingState(
    val id: BuildingId,
    var count: Int = 0
)

data class GameSave(
    val resources: Map<String, Double> = emptyMap(),
    val buildings: Map<String, Int> = emptyMap(),
    val purchasedUpgrades: List<String> = emptyList(),
    val totalCreditsEarned: Double = 0.0,
    val neurons: Int = 0,
    val prestigeCount: Int = 0,
    val lastSaveTime: Long = System.currentTimeMillis()
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

fun Double.formatAmount(): String {
    return when {
        this >= 1_000_000_000_000.0 -> "%.2fT".format(this / 1_000_000_000_000.0)
        this >= 1_000_000_000.0 -> "%.2fB".format(this / 1_000_000_000.0)
        this >= 1_000_000.0 -> "%.2fM".format(this / 1_000_000.0)
        this >= 1_000.0 -> "%.2fK".format(this / 1_000.0)
        this >= 10.0 -> "%.1f".format(this)
        else -> "%.2f".format(this)
    }
}

fun BuildingDef.getCostForCount(currentCount: Int): Map<ResourceType, Double> {
    val scale = costScaling.pow(currentCount.toDouble())
    return baseCost.mapValues { (_, v) -> v * scale }
}
