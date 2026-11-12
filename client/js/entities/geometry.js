// Positions shared by drawing code and gameplay code, so what you see is exactly what hits.
import { getUpgrade } from '../data/upgrades.js';

export const ORBITER_BLADE_RADIUS = 9;

// Repulsor pushes enemies and reflects enemy shots within this distance.
export const REPULSOR_RANGE = 300;

// Where each orbiter blade currently is (world coordinates).
export function orbiterPositions(e, now = Date.now()) {
    const spin = (now / 500) * e.overclock;
    const ring = e.size + 25;
    const out = [];
    for (let i = 0; i < e.orbiters; i++) {
        const angle = spin + (i / e.orbiters) * Math.PI * 2;
        out.push({ x: e.x + Math.cos(angle) * ring, y: e.y + Math.sin(angle) * ring });
    }
    return out;
}

// Blade Ring expands out to 250 and back in over the ability's duration.
export function bladeRingRadius(e) {
    const total = getUpgrade('blade_ring').duration;
    const progress = 1 - Math.max(0, e.abilityTimer) / total;
    return 60 + 190 * Math.sin(Math.PI * Math.min(1, Math.max(0, progress)));
}

// Armour visuals grow with Hull Integrity or Armor Plating, whichever is higher.
export const armorTierOf = (e) => Math.max(e.upgrades.health || 0, e.upgrades.plating || 0);
