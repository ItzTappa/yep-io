// Safe zones and the battle royale storm.
import { SafeZone } from '../../entities/SafeZone.js';
import { distance } from '../../core/math.js';
import { MATCH, STORM, TICKS_PER_SECOND } from '../../config.js';
import { STORM_SOURCE } from '../combat.js';

export function updateSafeZones(engine) {
    const zones = engine.safeZones;

    // Who is standing in a zone right now (bots are never allowed in).
    for (const ship of engine.ships) {
        ship.inSafeZone = !ship.isBot && !ship.isDead && zones.some(z => z.contains(ship.x, ship.y));
    }

    const p = engine.player;
    if (p && !p.isDead && p.inSafeZone && !engine.isGameOver) {
        p.health = Math.min(p.maxHealth, p.health + (p.maxHealth * 0.05) / TICKS_PER_SECOND);
    }

    // The zone owner (solo player, or the match host) runs the zone timers.
    if (engine.ownsWorld && !engine.isDemo && !engine.isGameOver) {
        for (let i = zones.length - 1; i >= 0; i--) {
            const zone = zones[i];
            const users = engine.ships.filter(s => !s.isDead && (s === p || s.isTeammate));
            zone.update(users.some(s => zone.contains(s.x, s.y)));
            if (zone.expired) {
                zones.splice(i, 1);
                engine.safeZoneRespawnTimer = MATCH.safeZoneRespawnTicks;
            }
        }
        if (zones.length < MATCH.safeZones && engine.mode !== 'duel' && !engine.isTutorial) {
            if (engine.safeZoneRespawnTimer > 0) {
                engine.safeZoneRespawnTimer--;
            } else {
                const pos = engine.getSafeSpawnPosition(engine.worldSize / 2);
                zones.push(new SafeZone(pos.x, pos.y));
                engine.safeZoneRespawnTimer = MATCH.safeZoneRespawnTicks;
            }
        }
    }

    // Activation sounds (heard by everyone nearby, wherever the zone is simulated).
    for (const zone of zones) {
        const prev = zone.lastSeenState;
        const prevTimer = zone.lastSeenTimer;
        if (prev === 'idle' && zone.state === 'triggering') {
            engine.playSoundAt('sz_tick', zone.x, zone.y, { category: 'alert', volume: 0.6 });
        } else if (zone.state === 'triggering' && zone.triggerTimer % 60 === 0 && zone.triggerTimer !== prevTimer) {
            engine.playSoundAt('sz_tick', zone.x, zone.y, { category: 'alert', volume: 0.6 });
        }
        if (prev && prev !== 'active' && zone.state === 'active') {
            engine.playSoundAt('sz_on', zone.x, zone.y, { category: 'alert' });
        }
        zone.lastSeenState = zone.state;
        zone.lastSeenTimer = zone.triggerTimer;
    }
}

// Mirrors the host's zones on other players' screens.
export function applyNetZones(engine, netZones) {
    const byId = new Map(engine.safeZones.map(z => [z.id, z]));
    engine.safeZones = netZones.map(data => {
        const zone = byId.get(data[0]) || new SafeZone(data[1], data[2], data[0]);
        zone.applyNet(data);
        return zone;
    });
}

// The storm shrinks with real time, so every player's storm matches even if their frame rates differ.
export function updateStorm(engine) {
    const storm = engine.storm;
    if (!storm.active || engine.intro.active) return;

    const seconds = Math.max(0, (performance.now() - storm.startedAt) / 1000 - storm.delaySeconds);
    storm.radius = Math.max(storm.minRadius || 0, storm.startRadius - (storm.shrinkPerSecond ?? STORM.shrinkPerSecond) * seconds);

    if (engine.frame % STORM.damageEveryTicks !== 0) return;
    for (const ship of engine.ships) {
        if (ship.isDead || distance(ship.x, ship.y, storm.x, storm.y) <= storm.radius) continue;
        engine.spawnParticles(ship.x, ship.y, '#8a2be2', 3);
        engine.damage(ship, ship.maxHealth * STORM.damageFraction, STORM_SOURCE, { armor: false });
    }
}
