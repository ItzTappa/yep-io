// Moves every projectile and resolves hits (evasion, piercing, shrapnel, nuke explosions).
import { Projectile } from '../../entities/Projectile.js';
import { distance } from '../../core/math.js';
import { isEnemy, isGhosting } from '../combat.js';

const NUKE_RADIUS = 320;

export function updateProjectiles(engine) {
    const ships = engine.ships;
    const list = engine.projectiles;

    for (let i = list.length - 1; i >= 0; i--) {
        const proj = list[i];
        const canTarget = (t) => isEnemy(proj.owner, t);
        proj.update(ships, canTarget);

        if (proj.destroyed || engine.safeZones.some(z => z.contains(proj.x, proj.y))) {
            if (!proj.destroyed) engine.spawnParticles(proj.x, proj.y, proj.color, 3);
            list.splice(i, 1);
            continue;
        }

        let spent = false;
        for (const target of ships) {
            if (target === proj.owner || target.isDead || !canTarget(target) || isGhosting(target)) continue;
            if (proj.hitTargets.includes(target)) continue;
            if (distance(proj.x, proj.y, target.x, target.y) >= target.size + proj.hitRadius) continue;

            proj.hitTargets.push(target);
            // Evasion: a dodged bullet passes through this target for good.
            if (target.evasion > 0 && Math.random() < target.evasion) {
                engine.spawnParticles(target.x, target.y, '#ffffff', 2);
                continue;
            }

            if (proj.isNuke) {
                explodeNuke(engine, proj);
                spent = true;
                break;
            }

            let damage = proj.damage;
            if (target.health < target.maxHealth * 0.5) damage *= 1 + (proj.owner.executioner || 0);
            const landed = engine.damage(target, damage, proj.owner, {
                hitSound: 0.3,
                shake: 8,
                particles: { x: proj.x, y: proj.y, color: proj.color, count: 4 }
            });
            if (landed) spawnShrapnel(engine, proj, target, damage);

            if (proj.pierce > 0) {
                proj.pierce--;
            } else {
                spent = true;
            }
            break;
        }

        if (!spent && proj.life <= 0 && proj.isNuke) explodeNuke(engine, proj);
        if (spent || proj.life <= 0) list.splice(i, 1);
    }
}

// Shrapnel: normal bullets burst into fragments on hit.
function spawnShrapnel(engine, proj, target, damage) {
    const owner = proj.owner;
    if (!owner.shrapnel || proj.isMissile || proj.isNuke || proj.isRailgun || proj.isFragment || proj.isFire) return;
    const count = 2 + owner.shrapnel;
    const offset = Math.random() * Math.PI * 2;
    for (let k = 0; k < count; k++) {
        const angle = offset + (k / count) * Math.PI * 2;
        const frag = new Projectile(proj.x, proj.y, angle, owner);
        frag.x = proj.x;
        frag.y = proj.y;
        frag.isFragment = true;
        frag.speed = 9;
        frag.life = 14;
        frag.pierce = 0;
        frag.sizeScale = 0.5;
        frag.damage = Math.max(1, damage * 0.25);
        frag.color = owner.color;
        frag.hitTargets = [target];
        engine.addProjectile(frag);
    }
}

function explodeNuke(engine, proj) {
    engine.spawnParticles(proj.x, proj.y, '#ff00ff', 40);
    engine.spawnParticles(proj.x, proj.y, '#ffaa00', 30);
    engine.playSoundAt('enemy_death', proj.x, proj.y, { category: 'heavy' });
    if (engine.player && distance(engine.player.x, engine.player.y, proj.x, proj.y) < 900) engine.shake(20);
    for (const ship of engine.ships) {
        if (ship.isDead || !isEnemy(proj.owner, ship)) continue;
        if (distance(proj.x, proj.y, ship.x, ship.y) < NUKE_RADIUS + ship.size) {
            engine.damage(ship, proj.damage, proj.owner, { armor: false });
        }
    }
}
