// Keeps a multiplayer match in sync between players.
//
// Who controls what:
//   - Every player controls their own ship and decides when they take damage or die.
//   - The match host (normally the lobby leader) runs the bots and safe zones and sends them to
//     everyone. If the host leaves, the server picks a new host and they take over seamlessly.
//   - Your hits on bots are reported to the host, who applies them and announces kills.
//
// Message types (all relayed by the server to the other players in the match):
//   m:state      20/s   your position, health, points
//   m:shoot             a trigger pull (angles), so others see your bullets
//   m:upgrades          your upgrade tiers (others mirror them so your guns/stats match)
//   m:action            dash / ability use
//   m:died              you died (and who killed you)
//   m:world      10/s   host -> bot positions/health + safe zones
//   m:botMeta           host -> bot details (class, look, upgrades); full list every 3s
//   m:botDied / m:botAction   host -> bot events
//   m:botHit            non-host -> host: "my shot hit bot X for N damage"
//   m:requestWorld      non-host -> host: "send me everything" (on join / host change)
import { NET } from '../../config.js';
import { Bot } from '../../entities/Bot.js';
import { isAbility } from '../../data/upgrades.js';
import { Projectile } from '../../entities/Projectile.js';
import { applyNetZones } from '../systems/zones.js';

const round = (n, digits = 0) => {
    const f = 10 ** digits;
    return Math.round(n * f) / f;
};
const finite = (n) => typeof n === 'number' && Number.isFinite(n);

export class MatchSync {
    constructor(engine, network, match) {
        this.engine = engine;
        this.network = network;
        this.hostId = match.hostId;
        this.unsubscribers = [];
        this.lastUpgradeKey = '';
    }

    get myId() {
        return this.network.id;
    }

    get isHost() {
        return this.hostId === this.myId;
    }

    start() {
        const handlers = {
            'm:state': (d) => this.remote(d)?.applyNetState(d),
            'm:shoot': (d) => this.onShoot(d),
            'm:upgrades': (d) => this.onUpgrades(d),
            'm:action': (d) => this.onAction(d),
            'm:died': (d) => this.onDied(d),
            'm:world': (d) => this.onWorld(d),
            'm:botMeta': (d) => this.onBotMeta(d),
            'm:botDied': (d) => this.onBotDied(d),
            'm:botAction': (d) => this.onBotAction(d),
            'm:botHit': (d) => this.onBotHit(d),
            'm:requestWorld': () => { if (this.isHost) this.sendBotMeta(true); }
        };
        for (const [event, fn] of Object.entries(handlers)) {
            this.unsubscribers.push(this.network.onMatch(event, (data) => {
                if (data && typeof data === 'object') fn(data);
            }));
        }
        if (!this.isHost) this.network.send('m:requestWorld', {});
        this.sendUpgrades(true);
    }

    stop() {
        for (const off of this.unsubscribers) off();
        this.unsubscribers = [];
    }

    remote(data) {
        return this.engine.remotes.find(r => r.netId === data.from) || null;
    }

    // ---------- outgoing ----------

    tick(frame) {
        const p = this.engine.player;
        if (p && !p.isDead && frame % NET.stateEveryTicks === 0) {
            this.network.send('m:state', {
                x: round(p.x), y: round(p.y), vx: round(p.vx, 2), vy: round(p.vy, 2), a: round(p.angle, 3),
                h: round(p.health, 1), mh: round(p.maxHealth), pts: round(p.points), sz: round(p.size, 1)
            });
        }
        if (!this.isHost) return;
        if (frame % NET.worldEveryTicks === 0) {
            this.sendWorld();
            const dirty = this.engine.bots.filter(b => b.metaDirty && !b.isDead);
            if (dirty.length) this.sendBotMetaFor(dirty, false);
        }
        if (frame % NET.botMetaEveryTicks === 0) this.sendBotMeta(true);
    }

    sendShoot(angles, kind) {
        this.network.send('m:shoot', { a: angles.map(a => round(a, 3)), k: kind });
    }

    sendUpgrades(force = false) {
        const p = this.engine.player;
        if (!p) return;
        const tiers = p.upgradeTiers();
        const key = JSON.stringify(tiers);
        if (!force && key === this.lastUpgradeKey) return;
        this.lastUpgradeKey = key;
        this.network.send('m:upgrades', { u: tiers });
    }

    sendAction(action) {
        this.network.send('m:action', action);
    }

    sendDied(killer) {
        this.network.send('m:died', { k: killer?.netId || null });
    }

    sendWorld() {
        const bots = this.engine.bots.filter(b => !b.isDead).map(b => [
            b.netId, round(b.x), round(b.y), round(b.angle, 2), round(b.health, 1), round(b.maxHealth), round(b.points)
        ]);
        this.network.send('m:world', { b: bots, z: this.engine.safeZones.map(z => z.toNet()) });
    }

    sendBotMeta(full) {
        this.sendBotMetaFor(this.engine.bots.filter(b => !b.isDead), full);
    }

    sendBotMetaFor(bots, full) {
        for (const b of bots) b.metaDirty = false;
        this.network.send('m:botMeta', { full, bots: bots.map(b => b.netMeta()) });
        if (full) this.engine.hasEnemies = this.engine.hasEnemies || bots.length > 0;
    }

    broadcastBotDied(bot, killer) {
        if (this.isHost) this.network.send('m:botDied', { id: bot.netId, k: killer?.netId || null });
    }

    broadcastBotAction(bot, action) {
        if (this.isHost) this.network.send('m:botAction', { id: bot.netId, ...action });
    }

    reportBotHit(bot, damage) {
        this.network.send('m:botHit', { id: bot.netId, d: round(damage, 2) });
    }

    // ---------- incoming ----------

    onShoot(d) {
        const shooter = this.remote(d);
        if (!shooter || shooter.isDead || !Array.isArray(d.a)) return;
        for (const angle of d.a.slice(0, 12)) {
            if (!finite(angle)) continue;
            if (d.k === 'm') this.engine.addProjectile(new Projectile(shooter.x, shooter.y, angle, shooter, { isMissile: true }));
            else this.engine.fireProjectile(shooter, angle);
        }
    }

    onUpgrades(d) {
        const r = this.remote(d);
        if (r && d.u && typeof d.u === 'object') r.syncUpgradeTiers(d.u);
    }

    onAction(d) {
        const r = this.remote(d);
        if (!r || r.isDead) return;
        if (d.t === 'dash') {
            r.dashTimer = 10;
            if (r.shockwave > 0) r.wantsShockwave = true;
        } else if (d.t === 'ability' && isAbility(d.ab)) {
            r.activeAbility = d.ab;
            if (finite(d.a)) r.angle = d.a;
            r.useAbility({ ignoreCooldown: true });
        }
    }

    onDied(d) {
        const r = this.remote(d);
        if (r && !r.isDead) this.engine.kill(r, this.engine.findByNetId(d.k));
    }

    onWorld(d) {
        if (this.isHost) return;
        if (Array.isArray(d.b)) {
            const byId = new Map(this.engine.bots.map(b => [b.netId, b]));
            for (const row of d.b) {
                const bot = Array.isArray(row) && byId.get(row[0]);
                if (!bot || bot.isDead) continue;
                const [, x, y, angle, health, maxHealth, points] = row;
                if (!finite(x) || !finite(y)) continue;
                bot.netTarget = { x, y, angle: finite(angle) ? angle : bot.angle };
                if (finite(maxHealth) && maxHealth > 0) bot.maxHealth = maxHealth;
                if (finite(health)) bot.health = Math.min(bot.maxHealth, health);
                if (finite(points)) bot.points = points;
            }
        }
        if (Array.isArray(d.z)) applyNetZones(this.engine, d.z.filter(z => Array.isArray(z) && z.length >= 7));
    }

    onBotMeta(d) {
        if (this.isHost || !Array.isArray(d.bots)) return;
        const engine = this.engine;
        const byId = new Map(engine.bots.map(b => [b.netId, b]));
        const listed = new Set();
        for (const meta of d.bots) {
            if (!meta || typeof meta.id !== 'string' || !finite(meta.x) || !finite(meta.y)) continue;
            listed.add(meta.id);
            const existing = byId.get(meta.id);
            if (existing) existing.applyNetMeta(meta);
            else if (!engine.deadBotIds.has(meta.id)) engine.bots.push(Bot.fromNetMeta(meta));
        }
        // A full list is the truth: drop bots we missed the death message for.
        if (d.full) engine.bots = engine.bots.filter(b => listed.has(b.netId));
        if (engine.bots.length > 0) engine.hasEnemies = true;
    }

    onBotDied(d) {
        if (this.isHost) return;
        const bot = this.engine.bots.find(b => b.netId === d.id);
        this.engine.deadBotIds.add(d.id);
        if (bot && !bot.isDead) this.engine.kill(bot, this.engine.findByNetId(d.k));
    }

    onBotAction(d) {
        if (this.isHost) return;
        const bot = this.engine.bots.find(b => b.netId === d.id);
        if (!bot || bot.isDead) return;
        if (d.t === 'dash') {
            bot.dashTimer = 10;
            if (bot.shockwave > 0) bot.wantsShockwave = true;
        } else if (d.t === 'ability' && isAbility(d.ab)) {
            bot.activeAbility = d.ab;
            if (finite(d.a)) bot.angle = d.a;
            bot.useAbility({ ignoreCooldown: true });
        }
    }

    // Host only: another player's shot hit one of our bots.
    onBotHit(d) {
        if (!this.isHost || !finite(d.d) || d.d <= 0 || d.d > 5000) return;
        const bot = this.engine.bots.find(b => b.netId === d.id);
        const shooter = this.remote(d);
        if (bot && !bot.isDead && shooter) this.engine.applyReportedHit(bot, d.d, shooter);
    }

    // ---------- server events ----------

    onHostChanged(hostId) {
        const wasHost = this.isHost;
        this.hostId = hostId;
        if (!wasHost && this.isHost) {
            this.engine.takeOverWorld();
            this.sendBotMeta(true);
        }
    }

    onPlayerLeft(id) {
        const r = this.engine.remotes.find(x => x.netId === id);
        if (r) this.engine.removeRemote(r);
    }
}
