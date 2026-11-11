// The Lucky Slot Machine: rarely spawns somewhere on the map; touch it for a random upgrade.
import { LuckySlotMachine } from '../../entities/pickups.js';
import { UPGRADE_POOL, maxTierOf, abilityName, TIER_COLORS } from '../../data/upgrades.js';
import { distance } from '../../core/math.js';
import { MATCH } from '../../config.js';

export function updateSlotMachines(engine) {
    const machines = engine.slotMachines;
    const p = engine.player;

    for (let i = machines.length - 1; i >= 0; i--) {
        const machine = machines[i];
        machine.update();
        if (machine.lifeTimer <= 0) {
            machines.splice(i, 1);
            continue;
        }
        if (p && !p.isDead && !engine.isDemo && !engine.isGameOver && distance(p.x, p.y, machine.x, machine.y) < p.size + machine.size) {
            machines.splice(i, 1);
            engine.hooks.onSlotMachine?.();
        }
    }

    if (!engine.isDemo && !engine.isGameOver && machines.length === 0 && Math.random() < MATCH.slotMachineChancePerTick) {
        const pos = engine.getSafeSpawnPosition(1000);
        machines.push(new LuckySlotMachine(pos.x, pos.y));
    }
}

const usable = (upg, p) => !upg.classes || upg.classes.includes(p.type);

// Rolls and applies the slot machine prize. 10% chance of an ability (if you have none),
// otherwise a stat upgrade jumps to a random tier (T5 15%, T4 20%, T3 25%, T2 25%, T1 15%).
export function rollSlotReward(p) {
    let roll = Math.random();

    if (roll < 0.10 && !p.activeAbility) {
        const abilities = UPGRADE_POOL.filter(u => u.isActiveAbility && usable(u, p));
        if (abilities.length > 0) {
            const ability = abilities[Math.floor(Math.random() * abilities.length)];
            p.applyUpgrade(ability.id);
            return { text: `LEGENDARY!\n${abilityName(ability.id)}`, color: '#ff00ff' };
        }
        roll = 0.5;
    }

    const stats = UPGRADE_POOL.filter(u => !u.isActiveAbility && usable(u, p));
    let upgrade = stats[Math.floor(Math.random() * stats.length)];
    let tier = roll < 0.15 ? 5 : roll < 0.35 ? 4 : roll < 0.60 ? 3 : roll < 0.85 ? 2 : 1;

    let maxTier = maxTierOf(upgrade, p);
    let current = p.upgrades[upgrade.id] || 0;
    tier = Math.min(tier, maxTier);

    // Already at (or past) the rolled tier: bump it by one instead, or pick something not maxed.
    if (current >= tier) {
        if (current < maxTier) {
            tier = current + 1;
        } else {
            const unmaxed = stats.filter(u => (p.upgrades[u.id] || 0) < maxTierOf(u, p));
            if (unmaxed.length > 0) {
                upgrade = unmaxed[Math.floor(Math.random() * unmaxed.length)];
                current = p.upgrades[upgrade.id] || 0;
                tier = current + 1;
            } else {
                tier = current;
            }
        }
    }

    for (let i = current; i < tier; i++) p.applyUpgrade(upgrade.id);
    return { text: `UPGRADED!\n${upgrade.title} T${tier}`, color: TIER_COLORS[tier] || '#fff' };
}
