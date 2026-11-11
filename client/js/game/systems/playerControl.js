// The local player's ship: movement, aiming, dash, ability and auto-fire.
import { settings } from '../../core/settings.js';
import { sounds } from '../../core/sound.js';
import { OFFENSIVE_ABILITIES } from '../../data/upgrades.js';
import { Projectile } from '../../entities/Projectile.js';
import { volleyAngles } from '../combat.js';

export function updateLocalPlayer(engine) {
    const p = engine.player;
    if (!p || p.isDead || engine.isDemo || engine.isGameOver) return;
    const input = engine.input;
    const binds = settings.keybinds;

    if (engine.intro.active) {
        p.angle = -Math.PI / 2;
        input.consume(binds.dash);
        input.consume(binds.ability);
    } else {
        const { dx, dy } = input.movementVector(binds);

        if (input.consume(binds.dash) && p.dash(dx, dy)) {
            sounds.play('dash', { category: 'combat', volume: 0.4 });
            engine.spawnParticles(p.x, p.y, '#ffffff', 8);
            engine.shake(5);
            engine.net?.sendAction({ t: 'dash' });
        }

        if (input.consume(binds.ability)) tryUseAbility(engine, p);

        if (dx !== 0 || dy !== 0) {
            const length = Math.hypot(dx, dy);
            const boosted = p.abilityTimer > 0 && (p.activeAbility === 'overdrive' || p.activeAbility === 'sonic_boom');
            const speed = p.speed * (boosted ? 2.5 : 1.0);
            p.vx += (dx / length) * speed * 0.2;
            p.vy += (dy / length) * speed * 0.2;
        }

        if (!input.isTouchDevice) {
            const screenX = engine.width / 2 + (p.x - engine.camera.x) * engine.camera.zoom;
            const screenY = engine.height / 2 + (p.y - engine.camera.y) * engine.camera.zoom;
            p.angle = Math.atan2(input.mouseY - screenY, input.mouseX - screenX);
        } else if (input.aimAngle !== null) {
            p.angle = input.aimAngle;
        }
    }

    p.x = Math.max(0, Math.min(engine.worldSize, p.x));
    p.y = Math.max(0, Math.min(engine.worldSize, p.y));
    const stats = engine.matchStats;
    stats.distance += Math.hypot(p.x - stats.lastX, p.y - stats.lastY);
    stats.lastX = p.x;
    stats.lastY = p.y;

    p.update();

    // Weapons are offline during the intro shot and inside safe zones.
    if (engine.intro.active || p.inSafeZone) return;

    if (p.fireCooldown <= 0) {
        const angles = volleyAngles(p);
        for (const angle of angles) engine.fireProjectile(p, angle);
        p.fireCooldown = p.fireRate;
        engine.net?.sendShoot(angles, 'b');
    }

    if (p.missiles > 0) {
        if (p.missileCooldown <= 0) {
            engine.addProjectile(new Projectile(p.x, p.y, p.angle, p, { isMissile: true }));
            p.missileCooldown = Math.max(20, 90 - p.missiles * 15);
            engine.net?.sendShoot([p.angle], 'm');
        }
        p.missileCooldown--;
    }
}

function tryUseAbility(engine, p) {
    if (!p.activeAbility || p.abilityCooldown > 0) return;
    if (p.inSafeZone && OFFENSIVE_ABILITIES.has(p.activeAbility)) {
        sounds.play('ui_error', { category: 'ui' });
        return;
    }
    if (p.useAbility()) {
        engine.shake(8);
        engine.net?.sendAction({ t: 'ability', ab: p.activeAbility, a: +p.angle.toFixed(3) });
    }
}
