// Bots: AI movement and shooting.
// In multiplayer only the match host runs bot AI; everyone else mirrors the host's bots
// ("replicas") but still fires their guns locally so bullets reach you without lag.
import { Projectile } from '../../entities/Projectile.js';
import { distance } from '../../core/math.js';
import { volleyAngles, volleyDamageScale, isEnemy, isGhosting } from '../combat.js';
import { BALANCE } from '../../data/balance.js';

export function updateBots(engine) {
    const referencePoints = engine.player && !engine.isDemo ? engine.player.points : 100;
    // During the first steps of the tutorial bots don't go after you.
    const hostile = engine.tutorial?.calm ? (a, b) => b !== engine.player && isEnemy(a, b) : isEnemy;

    for (const bot of [...engine.bots]) {
        if (bot.isDead) continue;

        if (bot.isReplica) {
            followHost(bot);
        } else {
            bot.updateBot(engine.ships, { referencePoints, isEnemy: hostile });
            keepInBounds(engine, bot);
            if (bot.justDashed) {
                bot.justDashed = false;
                engine.net?.broadcastBotAction(bot, { t: 'dash' });
            }
            if (bot.justUsedAbility) {
                bot.justUsedAbility = false;
                engine.net?.broadcastBotAction(bot, { t: 'ability', ab: bot.activeAbility, a: +bot.angle.toFixed(3) });
            }
        }

        if (engine.intro.active) continue;
        fireWeapons(engine, bot, hostile);
    }
}

function followHost(bot) {
    const t = bot.netTarget;
    if (!t) return;
    const prevX = bot.x;
    const prevY = bot.y;
    if (Math.hypot(t.x - bot.x, t.y - bot.y) > 500) {
        bot.x = t.x;
        bot.y = t.y;
    } else {
        bot.x += (t.x - bot.x) * 0.35;
        bot.y += (t.y - bot.y) * 0.35;
    }
    bot.vx = bot.x - prevX;
    bot.vy = bot.y - prevY;
    bot.angle = t.angle;
    bot.updateTimers({ regen: false });
    bot.updateTrail();
}

function keepInBounds(engine, bot) {
    const margin = 300;
    const size = engine.worldSize;
    if (bot.x < margin) bot.vx += (margin - bot.x) * 0.002;
    if (bot.y < margin) bot.vy += (margin - bot.y) * 0.002;
    if (bot.x > size - margin) bot.vx -= (bot.x - (size - margin)) * 0.002;
    if (bot.y > size - margin) bot.vy -= (bot.y - (size - margin)) * 0.002;

    const storm = engine.storm;
    if (storm.active && !engine.intro.active && distance(bot.x, bot.y, storm.x, storm.y) > storm.radius - 300) {
        bot.targetX = storm.x + (Math.random() - 0.5) * storm.radius * 0.5;
        bot.targetY = storm.y + (Math.random() - 0.5) * storm.radius * 0.5;
        bot.changeTargetTimer = 120;
    }

    bot.x = Math.max(0, Math.min(size, bot.x));
    bot.y = Math.max(0, Math.min(size, bot.y));

    // Bots can't enter safe zones.
    for (const zone of engine.safeZones) {
        let d = distance(bot.x, bot.y, zone.x, zone.y);
        const minAllowed = zone.radius + bot.size;
        if (d < minAllowed) {
            if (d === 0) {
                d = 1;
                bot.x += 1;
            }
            const overlap = minAllowed - d;
            bot.x += ((bot.x - zone.x) / d) * overlap;
            bot.y += ((bot.y - zone.y) / d) * overlap;
        }
    }
}

function fireWeapons(engine, bot, hostile) {
    if (bot.fireCooldown <= 0 && hasEnemyNearby(engine, bot, hostile)) {
        const angles = volleyAngles(bot);
        const scale = volleyDamageScale(angles.length);
        for (const angle of angles) engine.fireProjectile(bot, angle, scale);
        bot.fireCooldown = bot.fireRate;
    }
    if (bot.missiles > 0) {
        if (bot.missileCooldown <= 0) {
            engine.addProjectile(new Projectile(bot.x, bot.y, bot.angle, bot, { isMissile: true }));
            bot.missileCooldown = BALANCE.upgrades.missileCooldown.base - bot.missiles * BALANCE.upgrades.missileCooldown.perTier;
        }
        bot.missileCooldown--;
    }
}

function hasEnemyNearby(engine, bot, hostile) {
    for (const p of engine.ships) {
        if (p === bot || p.isDead || p.inSafeZone || !hostile(bot, p) || isGhosting(p)) continue;
        if (distance(bot.x, bot.y, p.x, p.y) < 600) return true;
    }
    return false;
}
