// Picks which upgrades to offer. Upgrades you already own get rarer each tier (weight halves),
// and once you hold an active ability no other ability is offered.
import { UPGRADE_POOL, maxTierOf } from '../data/upgrades.js';

export function availableUpgrades(entity, { abilities = true } = {}) {
    return UPGRADE_POOL.filter(upg => {
        if (upg.isActiveAbility && (!abilities || entity.activeAbility)) return false;
        if ((entity.upgrades[upg.id] || 0) >= maxTierOf(upg, entity)) return false;
        return !upg.classes || upg.classes.includes(entity.type);
    });
}

export function getWeightedUpgrades(entity, count = 3) {
    const pool = availableUpgrades(entity).map(upg => ({
        upg,
        weight: upg.weight * Math.pow(0.5, entity.upgrades[upg.id] || 0)
    }));

    const choices = [];
    while (choices.length < count && pool.length > 0) {
        const total = pool.reduce((sum, item) => sum + item.weight, 0);
        let roll = Math.random() * total;
        let index = pool.findIndex(item => (roll -= item.weight) <= 0);
        if (index === -1) index = pool.length - 1;
        choices.push(pool[index].upg);
        pool.splice(index, 1);
    }
    return choices;
}
