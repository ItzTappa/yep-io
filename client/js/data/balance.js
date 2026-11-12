// Every balance number for combat, upgrades and the economy, in one place.
// Class stats live in classes.js, upgrade/ability lists in upgrades.js, match setup in config.js.
//
// Rule of thumb used here: upgrades are PERCENTAGES of your class's base stats, so every class
// gets the same relative benefit from the same upgrade (flat bonuses made Jets scale far better).
export const BALANCE = {
    upgrades: {
        healthPct: 0.15,            // Hull Integrity: +15% of class base HP per tier
        damagePct: 0.15,            // Weapon Damage: +15% of class base damage per tier
        fireRateMult: 0.88,         // Auto-Loader: shot delay x0.88 per tier (T5 = 1.9x fire rate)
        fireRateMinTicks: 4,
        heavyArtDamagePct: 0.08,    // Heavy Artillery: +8% base damage and bigger bullets per tier
        heavyArtSize: 0.4,
        platingReduction: 0.06,     // Armor Plating: -6% damage taken per tier (T5 = -30%)
        platingHealthPct: 0.05,
        regenPctPerSec: 0.006,      // Nanobots: heal 0.6% of max HP per second per tier
        lifestealPct: 0.05,         // Vampirism: heal 5% of damage dealt per tier
        dashCooldownMult: 0.85,     // Dash Cooldown: x0.85 per tier
        dashCooldownMinTicks: 40,
        sniperLifeTicks: 10,        // Sniper Sight: +10 ticks of bullet life and +2 bullet speed per tier
        sniperSpeed: 2.5,
        evasionPerTier: 0.06,
        executionerPerTier: 0.15,   // bonus damage vs targets under 50% HP
        multishotExtraDamage: 0.45, // each extra Multishot barrel adds 45% of a bullet (not 100%)
        rearguardDamage: [0, 0.5, 0.75, 1.0],   // rear bullet damage at Rearguard T1/T2/T3
        missileCooldown: { base: 110, perTier: 12 },     // ticks between missiles: 98, 86, 74, 62, 50
        missileDamage: { flat: 6, ofBase: 0.3 },
        spikeDamagePerTier: { square: 8, circle: 6, triangle: 5 },
        spikeCooldownTicks: 25,
        orbiterDamagePerTier: 6,    // per blade hit, scaled by orbiter tier (see Orbiters)
        orbiterHitCooldownTicks: 20,// divided by Overclock
        shockwavePerTier: 20,
        shockwaveRadius: 220,
        shockwaveCooldownTicks: 90  // at most one shockwave every 1.5 seconds
    },

    healthOrbs: { smallPct: 0.08, bigPct: 0.22, bigChance: 0.25, dropChance: 0.27 }, // dropChance: per kill

    bots: {
        // Bots chase a points total relative to the player: 10%..110% of yours by personality.
        targetMin: 0.1,
        targetRange: 1.0,
        decayAbove: 1.1,            // shed points above 110% of their target
        soloStackedMaxPoints: 2000  // the rare "stacked lobby" solo match starts bots at up to this
    },

    storm: {
        minRadius: 450,             // battle royale storm stops shrinking here
        duelStartRadius: 1500,      // 1v1 storm so duels can't turn into endless kiting
        duelMinRadius: 350,
        duelDelaySeconds: 45,
        duelShrinkPerSecond: 8
    },

    xp: {
        perLevelBase: 1500,         // XP to go from level L to L+1 = base + perLevel * L
        perLevel: 140,
        perSecondAlive: 1.5,
        perUpgrade: 10,
        brVictory: 500,
        brPerPlacement: 10,         // (players - placement) * this, battle royale only
        duelVictory: 250
    }
};
