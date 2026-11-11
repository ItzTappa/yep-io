// Positions shared by drawing code and gameplay code, so what you see is exactly what hits.

// How long each ability stays active once used, in ticks (60 = 1 second).
export const ABILITY_DURATION = {
    juggernaut: 300, repulsor: 300, cloak: 300,
    minigun: 240, strafe_run: 240, blade_ring: 240,
    sonic_boom: 180,
    phase_strike: 30
};
export const DEFAULT_ABILITY_DURATION = 120;

export const ORBITER_BLADE_RADIUS = 9;

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
    const total = ABILITY_DURATION.blade_ring;
    const progress = 1 - Math.max(0, e.abilityTimer) / total;
    return 60 + 190 * Math.sin(Math.PI * Math.min(1, Math.max(0, progress)));
}

// Armour visuals grow with Hull Integrity or Armor Plating, whichever is higher.
export const armorTierOf = (e) => Math.max(e.upgrades.health || 0, e.upgrades.plating || 0);
