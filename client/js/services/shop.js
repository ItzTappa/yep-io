// The hourly rotating shop. Everyone sees the same 4 items in the same hour (it is generated from
// the current UTC hour), and each item unlocks once your stats from this hour reach its target.
import { ITEMS_DB } from '../data/items.js';
import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { createRng, hashString } from '../core/math.js';

const SHOP_SIZE = 4;

// Targets per rarity (1 = common ... 5 = legendary). Each shop slot gets ±20% of this.
const STAT_TYPES = [
    { type: 'kills', label: 'Kills', targets: [15, 30, 50, 80, 120] },
    { type: 'distance', label: 'Dist.', targets: [15000, 30000, 60000, 90000, 150000] },
    { type: 'time', label: 'Secs', targets: [300, 600, 1200, 2400, 3600] },
    { type: 'points', label: 'Pts', targets: [1000, 2500, 5000, 10000, 20000] }
];

const ROTATING = Object.values(ITEMS_DB).filter(i => i.isRotating && !i.hideFromStore);

export function currentHourKey(now = new Date()) {
    return now.toISOString().slice(0, 13); // e.g. "2026-11-11T18"
}

export function msUntilRotation(now = Date.now()) {
    return 3600000 - (now % 3600000);
}

let cache = { key: null, items: [] };

export function getShop() {
    const key = currentHourKey();
    if (cache.key !== key) cache = { key, items: generateShop(key) };
    return cache.items;
}

function generateShop(key) {
    const rng = createRng(hashString(key));
    const pool = [...ROTATING];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, SHOP_SIZE).map(item => {
        const stat = STAT_TYPES[Math.floor(rng() * STAT_TYPES.length)];
        const base = stat.targets[item.rarity - 1];
        let req = Math.floor(base + rng() * base * 0.4 - base * 0.2);
        if (stat.type === 'distance' || stat.type === 'points') req = Math.ceil(req / 100) * 100;
        if (stat.type === 'time') req = Math.ceil(req / 10) * 10;
        return { id: item.id, type: stat.type, req, label: stat.label };
    });
}

// Your progress this hour (resets automatically when the hour changes).
export function hourlyProgress() {
    const key = currentHourKey();
    if (state.profile.hourly.key !== key) {
        state.profile.hourly = { key, kills: 0, time: 0, points: 0, distance: 0 };
    }
    return state.profile.hourly;
}

export function addHourlyProgress({ kills = 0, time = 0, points = 0, distance = 0 }) {
    const h = hourlyProgress();
    h.kills += kills;
    h.time += time;
    h.points += points;
    h.distance += distance;
}

export function shopEntryFor(itemId) {
    return getShop().find(entry => entry.id === itemId) || null;
}

// Fires 'shop:rotated' when the hour rolls over while the game is open.
export function startShopClock() {
    let key = currentHourKey();
    setInterval(() => {
        const now = currentHourKey();
        if (now !== key) {
            key = now;
            emit('shop:rotated');
        }
    }, 1000);
}
