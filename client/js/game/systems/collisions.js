// Ship-vs-ship contact: ships push each other apart, Ramming Spikes hurt on contact,
// and Orbiter blades hit enemies and block enemy bullets.
import { distance } from '../../core/math.js';
import { isEnemy, isGhosting, isImmune } from '../combat.js';
import { orbiterPositions, ORBITER_BLADE_RADIUS } from '../../entities/geometry.js';
import { BALANCE } from '../../data/balance.js';

const B = BALANCE.upgrades;

export function updateCollisions(engine) {
    const ships = engine.ships;
    for (let i = 0; i < ships.length; i++) {
        for (let j = i + 1; j < ships.length; j++) {
            const a = ships[i];
            const b = ships[j];
            if (a.isDead || b.isDead || isGhosting(a) || isGhosting(b)) continue;

            const dist = distance(a.x, a.y, b.x, b.y);
            const minDistance = a.size + b.size;
            if (dist >= minDistance || dist === 0) continue;

            pushApart(engine, a, b, dist, minDistance);
            if (!isEnemy(a, b)) continue;
            spikeHit(engine, a, b);
            if (!b.isDead && !a.isDead) spikeHit(engine, b, a);
        }
    }
    updateOrbiters(engine);
}

// Only ships this computer controls get moved; mirrored ships follow their owner's position.
function pushApart(engine, a, b, dist, minDistance) {
    const moveA = engine.controlsMovement(a);
    const moveB = engine.controlsMovement(b);
    if (!moveA && !moveB) return;
    const overlap = minDistance - dist;
    const nx = (a.x - b.x) / dist;
    const ny = (a.y - b.y) / dist;
    const shareA = moveA && moveB ? 0.5 : moveA ? 1 : 0;
    const shareB = moveA && moveB ? 0.5 : moveB ? 1 : 0;
    a.x += nx * overlap * shareA;
    a.y += ny * overlap * shareA;
    b.x -= nx * overlap * shareB;
    b.y -= ny * overlap * shareB;
}

function spikeHit(engine, attacker, target) {
    if (attacker.spikes <= 0 || attacker.spikeCooldown > 0) return;
    attacker.spikeCooldown = B.spikeCooldownTicks;
    const damage = attacker.spikes * (B.spikeDamagePerTier[attacker.type] || 5);
    if (!isImmune(target)) engine.spawnParticles(target.x, target.y, '#ff4444', 5);
    engine.damage(target, damage, attacker, { hitSound: 0.4, shake: 8 });
}

function updateOrbiters(engine) {
    const now = Date.now();
    for (const owner of engine.ships) {
        if (owner.isDead || owner.orbiters <= 0) continue;
        const blades = orbiterPositions(owner, now);

        // Blades block enemy bullets and missiles (not nukes or the railgun).
        for (const proj of engine.projectiles) {
            if (proj.isNuke || proj.isRailgun || proj.isFire || !isEnemy(proj.owner, owner)) continue;
            if (blades.some(b => distance(b.x, b.y, proj.x, proj.y) < ORBITER_BLADE_RADIUS + 6)) {
                proj.destroyed = true;
                engine.spawnParticles(proj.x, proj.y, '#a855f7', 3);
            }
        }

        for (const target of engine.ships) {
            if (target.isDead || !isEnemy(owner, target)) continue;
            if ((owner.orbiterHitTicks.get(target.uid) || 0) > engine.frame) continue;
            const touching = blades.some(b => distance(b.x, b.y, target.x, target.y) < ORBITER_BLADE_RADIUS + target.size);
            if (!touching) continue;
            owner.orbiterHitTicks.set(target.uid, engine.frame + Math.round(B.orbiterHitCooldownTicks / owner.overclock));
            engine.spawnParticles(target.x, target.y, '#a855f7', 4);
            engine.damage(target, B.orbiterDamagePerTier * owner.orbiterDamage, owner, { hitSound: 0.3 });
        }
    }
}
