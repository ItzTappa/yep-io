// XP and health orbs: keeps the arena topped up, pulls orbs toward nearby ships (Orb Magnet
// increases the range) and collects them. Uses a spatial grid so each ship only checks
// the orbs near it instead of all 3000.
import { Orb } from '../../entities/pickups.js';
import { sounds } from '../../core/sound.js';
import { distance } from '../../core/math.js';

const CELL = 200;

export function desiredOrbCount(engine) {
    if (engine.isDemo) return engine.config.orbCount;
    return engine.mode === 'duel' ? 0 : engine.config.orbCount;
}

export function updateOrbs(engine) {
    refill(engine);

    const grid = new Map();
    for (const orb of engine.orbs) {
        const key = cellKey(Math.floor(orb.x / CELL), Math.floor(orb.y / CELL));
        let cell = grid.get(key);
        if (!cell) grid.set(key, (cell = []));
        cell.push(orb);
    }

    const p = engine.player;
    if (p && !p.isDead && !engine.isDemo && !engine.isGameOver && !engine.intro.active) {
        collectNear(engine, grid, p);
    }
    for (const bot of engine.bots) {
        if (!bot.isDead) collectNear(engine, grid, bot);
    }

    if (engine.orbs.some(o => o.collected)) engine.orbs = engine.orbs.filter(o => !o.collected);
}

function refill(engine) {
    const desired = desiredOrbCount(engine);
    if (engine.orbs.length >= desired) return;
    const anchors = engine.ships.filter(s => !s.isDead);
    const spawnCount = Math.min(100, desired - engine.orbs.length);
    for (let i = 0; i < spawnCount; i++) {
        let x;
        let y;
        // Most new orbs appear near someone so the action areas stay fed.
        if (Math.random() < 0.6 && anchors.length > 0) {
            const ref = anchors[Math.floor(Math.random() * anchors.length)];
            const angle = Math.random() * Math.PI * 2;
            const dist = 300 + Math.random() * 1700;
            x = Math.max(0, Math.min(engine.worldSize, ref.x + Math.cos(angle) * dist));
            y = Math.max(0, Math.min(engine.worldSize, ref.y + Math.sin(angle) * dist));
        } else {
            x = Math.random() * engine.worldSize;
            y = Math.random() * engine.worldSize;
        }
        engine.orbs.push(new Orb(x, y, 'xp', 1, 0));
    }
}

function collectNear(engine, grid, ship) {
    const pullRadius = 150 + ship.magnet * 100;
    const minCx = Math.floor((ship.x - pullRadius) / CELL);
    const maxCx = Math.floor((ship.x + pullRadius) / CELL);
    const minCy = Math.floor((ship.y - pullRadius) / CELL);
    const maxCy = Math.floor((ship.y + pullRadius) / CELL);

    for (let cx = minCx; cx <= maxCx; cx++) {
        for (let cy = minCy; cy <= maxCy; cy++) {
            const cell = grid.get(cellKey(cx, cy));
            if (!cell) continue;
            for (const orb of cell) {
                if (orb.collected) continue;
                const d = distance(ship.x, ship.y, orb.x, orb.y);
                if (d >= pullRadius) continue;
                orb.x += (ship.x - orb.x) * 0.1;
                orb.y += (ship.y - orb.y) * 0.1;
                if (d < ship.size + orb.size) collect(engine, ship, orb);
            }
        }
    }
}

function collect(engine, ship, orb) {
    orb.collected = true;
    // Mirrored bots only "eat" orbs so the arena looks the same; the host awards their points.
    if (ship.isReplica) return;

    if (ship === engine.player) sounds.play('xp_pickup', { category: 'pickup', varyPitch: true });
    if (orb.type === 'health') {
        ship.health = Math.min(ship.maxHealth, ship.health + orb.healAmount);
    } else {
        const value = orb.value * ship.scavenger;
        ship.points += value;
        ship.upgradeProgress += value;
    }
}

const cellKey = (cx, cy) => cx * 100003 + cy;
