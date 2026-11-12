// Active abilities (E key), plus the dash add-ons (Shockwave, Afterburner).
// Runs for every ship. Damage goes through engine.damage(), which decides whether this computer
// is the one allowed to apply it (see GameEngine.damageAuthority).
import { Projectile } from '../entities/Projectile.js';
import { distance } from '../core/math.js';
import { bladeRingRadius, REPULSOR_RANGE } from '../entities/geometry.js';
import { isEnemy } from './combat.js';
import { BALANCE } from '../data/balance.js';

// One-shot effects when an ability is used.
const ON_TRIGGER = {
    bullet_nova(engine, p) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 18) engine.fireProjectile(p, a);
        engine.spawnParticles(p.x, p.y, '#00ffcc', 20);
    },

    blink(engine, p) {
        engine.playSoundAt('ability_blink', p.x, p.y, { category: 'ability' });
        engine.spawnParticles(p.x, p.y, '#a855f7', 15);
        p.x = Math.max(0, Math.min(engine.worldSize, p.x + Math.cos(p.angle) * 400));
        p.y = Math.max(0, Math.min(engine.worldSize, p.y + Math.sin(p.angle) * 400));
        engine.spawnParticles(p.x, p.y, '#a855f7', 15);
    },

    emp(engine, p) {
        engine.playSoundAt('ability_emp', p.x, p.y, { category: 'ability' });
        engine.spawnParticles(p.x, p.y, '#00ffff', 40);
        if (p.isPlayer) engine.shake(15);
        forEachEnemyInRange(engine, p, 600, (e) => {
            e.fireCooldown = 180;
            e.dashCooldown = 180;
            e.vx *= 0.2;
            e.vy *= 0.2;
            engine.damage(e, 20, p, { armor: false });
        });
    },

    missile_swarm(engine, p) {
        engine.playSoundAt('ability_missile', p.x, p.y, { category: 'ability' });
        for (let i = -2.5; i <= 2.5; i++) engine.addProjectile(new Projectile(p.x, p.y, p.angle + i * 0.2, p, { isMissile: true }));
    },

    earthshatter(engine, p) {
        engine.spawnParticles(p.x, p.y, '#ffaa00', 50);
        if (p.isPlayer) engine.shake(25);
        forEachEnemyInRange(engine, p, 450, (e) => {
            e.vx += (e.x - p.x) * 0.1;
            e.vy += (e.y - p.y) * 0.1;
            engine.damage(e, 70, p, { armor: false });
        });
    },

    tactical_nuke(engine, p) {
        engine.playSoundAt('ability_nuke', p.x, p.y, { category: 'ability' });
        engine.addProjectile(new Projectile(p.x, p.y, p.angle, p, { isNuke: true }));
    },

    railgun(engine, p) {
        engine.playSoundAt('plasma_gun', p.x, p.y, { category: 'ability' });
        if (p.isPlayer) engine.shake(20);
        const beam = new Projectile(p.x, p.y, p.angle, p);
        beam.isRailgun = true;
        beam.speed = 40;
        beam.pierce = 999;
        beam.damage = 40 + p.baseDamage * 2.5;
        beam.color = '#ff00ff';
        beam.sizeScale = 3.0;
        beam.life = 100;
        engine.addProjectile(beam);
    },

    shield(engine, p) {
        engine.playSoundAt('ability_shield', p.x, p.y, { category: 'ability' });
    },

    minigun(engine, p) {
        engine.playSoundAt('ability_minigun', p.x, p.y, { category: 'ability' });
    },

    // Lunges forward; anything you pass through takes a big hit once.
    phase_strike(engine, p) {
        p.phaseHits = new Set();
        p.vx += Math.cos(p.angle) * p.speed * 4.5;
        p.vy += Math.sin(p.angle) * p.speed * 4.5;
        engine.spawnParticles(p.x, p.y, '#ff3300', 15);
    }
};

// Effects that keep running while the ability timer is active.
const WHILE_ACTIVE = {
    repulsor(engine, p) {
        forEachEnemyInRange(engine, p, REPULSOR_RANGE, (e) => {
            e.vx += (e.x - p.x) * 0.05;
            e.vy += (e.y - p.y) * 0.05;
        });
        if (engine.frame % 10 !== 0) return;
        for (const proj of engine.projectiles) {
            if (!isEnemy(proj.owner, p) || distance(p.x, p.y, proj.x, proj.y) >= REPULSOR_RANGE) continue;
            proj.angle += Math.PI;   // reflect enemy shots back at them, at half damage
            proj.owner = p;
            proj.color = '#00ffff';
            proj.damage *= 0.5;
            proj.hitTargets = [];
        }
    },

    strafe_run(engine, p) {
        if (engine.frame % 8 !== 0) return;
        engine.fireProjectile(p, p.angle + 0.35);
        engine.fireProjectile(p, p.angle - 0.35);
    },

    blade_ring(engine, p) {
        if (engine.frame % 10 !== 0) return;
        const radius = bladeRingRadius(p);
        forEachEnemyInRange(engine, p, radius, (e) => {
            engine.spawnParticles(e.x, e.y, '#ff0000', 3);
            engine.damage(e, 9, p, { armor: false });
        }, { addTargetSize: true });
    },

    sonic_boom(engine, p) {
        for (const e of engine.ships) {
            if (!isEnemy(p, e) || e.isDead) continue;
            if (distance(p.x, p.y, e.x, e.y) < p.size + e.size + 20) engine.damage(e, 4, p, { armor: false });
        }
    },

    phase_strike(engine, p) {
        if (!p.phaseHits) p.phaseHits = new Set();
        for (const e of engine.ships) {
            if (!isEnemy(p, e) || e.isDead || p.phaseHits.has(e.uid)) continue;
            if (distance(p.x, p.y, e.x, e.y) < p.size + e.size + 20) {
                p.phaseHits.add(e.uid);
                engine.spawnParticles(e.x, e.y, '#ff3300', 10);
                engine.damage(e, 50 + p.baseDamage * 2, p, { armor: false });
            }
        }
    }
};

function forEachEnemyInRange(engine, p, range, fn, { addTargetSize = false } = {}) {
    for (const e of engine.ships) {
        if (e.isDead || !isEnemy(p, e)) continue;
        if (distance(p.x, p.y, e.x, e.y) < range + (addTargetSize ? e.size : 0)) fn(e);
    }
}

export function updateAbilities(engine) {
    for (const p of engine.ships) {
        if (p.isDead) continue;

        if (p.abilityTriggered) {
            p.abilityTriggered = false;
            ON_TRIGGER[p.activeAbility]?.(engine, p);
        }
        if (p.abilityTimer > 0) WHILE_ACTIVE[p.activeAbility]?.(engine, p);

        if (p.wantsShockwave) {
            p.wantsShockwave = false;
            shockwave(engine, p);
        }
        // Afterburner: a trail of fire while dashing.
        if (p.dashTimer > 0 && p.afterburner > 0 && engine.frame % 2 === 0 && !engine.intro.active) {
            const fire = new Projectile(p.x, p.y, 0, p);
            fire.speed = 0;
            fire.life = 30 + p.afterburner * 10;
            fire.damage = 10 * p.afterburner;
            fire.color = '#ffaa00';
            fire.sizeScale = 1.5;
            fire.isFire = true;
            engine.addProjectile(fire);
        }
    }
}

function shockwave(engine, p) {
    engine.playSoundAt('take_damage', p.x, p.y, { category: 'heavy', volume: 0.4 });
    engine.spawnParticles(p.x, p.y, '#ffcc00', 20);
    if (engine.player && distance(engine.player.x, engine.player.y, p.x, p.y) < 500) engine.shake(10);
    forEachEnemyInRange(engine, p, BALANCE.upgrades.shockwaveRadius, (e) => {
        e.vx += (e.x - p.x) * 0.05;
        e.vy += (e.y - p.y) * 0.05;
        engine.damage(e, p.shockwave * BALANCE.upgrades.shockwavePerTier, p, { armor: false });
    });
}
