// The game engine: starts matches, runs the 60 Hz simulation, draws every frame, and decides
// deaths, kills and match results. The actual rules live in ./systems, ./abilities.js and ./combat.js.
//
// Modes:
//   demo  - the arena behind the main menu (bots only)
//   solo  - PLAY button: you vs 49 bots, bots respawn, ends when you die
//   br    - multiplayer battle royale: your team vs bots, shrinking storm, last team standing
//   duel  - multiplayer 1v1 on a small map, no bots or orbs
//   tutorial - the training arena (first PLAY, or Settings > Play Tutorial): small empty map, you
//          can't die, game/tutorial.js spawns what each step teaches. No XP, quests or history.
import { TICK_MS, WORLD, MATCH, STORM } from '../config.js';
import { BALANCE } from '../data/balance.js';
import { settings, saveSettings } from '../core/settings.js';
import { sounds } from '../core/sound.js';
import { distance, createRng } from '../core/math.js';
import { setVisible, $ } from '../core/dom.js';
import { randomClass } from '../data/classes.js';
import { bannerFor } from '../data/items.js';
import { Player } from '../entities/Player.js';
import { Bot } from '../entities/Bot.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { Projectile } from '../entities/Projectile.js';
import { Orb, Particle } from '../entities/pickups.js';
import { SafeZone } from '../entities/SafeZone.js';
import { getWeightedUpgrades, availableUpgrades } from '../entities/upgradePicker.js';
import { Input } from './input.js';
import { isEnemy, isImmune, killXp, FORFEIT_SOURCE } from './combat.js';
import { updateAbilities } from './abilities.js';
import { updateLocalPlayer } from './systems/playerControl.js';
import { updateBots } from './systems/bots.js';
import { updateCollisions } from './systems/collisions.js';
import { updateProjectiles } from './systems/projectiles.js';
import { updateOrbs } from './systems/orbs.js';
import { updateSafeZones, updateStorm } from './systems/zones.js';
import { updateSlotMachines, rollSlotReward } from './systems/slotMachines.js';
import { MatchSync } from './net/matchSync.js';
import { drawWorld } from './render/worldRenderer.js';
import { drawMinimap } from './render/minimap.js';
import { drawTeammatePointers, clearTeammatePointers } from './render/teammatePointers.js';
import * as hud from './hud/hud.js';
import { showUpgradeCards, hideUpgradeCards } from './hud/upgradeCards.js';
import { showGameOver, hideGameOver } from './hud/gameOver.js';
import { DamageNumbers } from './render/damageNumbers.js';
import { Tutorial } from './tutorial.js';

const ZOOM_MIN = 0.7;   // how far out / in players can zoom during a match
const ZOOM_MAX = 1.4;

const nextUpgradeCost = (count) => Math.floor(15 + count * 12 + Math.pow(count, 1.7) * 1.5);

export class GameEngine {
    // hooks:
    //   addAccountXP(amount) -> [new levels]
    //   onMatchStart({ mode, classType }), onMatchEnd(summary), onSlotMachine(), onTutorialDone()
    //   Quests: onStat(stat, amount), onStatBest(stat, value), onMatchQuests(summary)
    //           each return a list of finished quest rewards (see services/quests.js)
    constructor(canvas, hooks = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.hooks = hooks;
        this.damageNumbers = new DamageNumbers();
        this.tutorial = null;
        this.admin = null;              // admin command effects (set by the admin console, see admin/effects.js)

        this.mode = 'demo';
        this.resetWorld(WORLD.demo);
        this.camera = { x: this.worldSize / 2, y: this.worldSize / 2, zoom: 1, shake: 0 };
        this.intro = { active: false, timer: 0, x: 0, y: 0, startZoom: 1 };

        this.input = new Input(this);
        this.upgrades = new UpgradeFlow(this);

        this.isRunning = false;
        this.animationId = null;
        this.lastTime = 0;
        this.accumulator = 0;
        this.fps = { frames: 0, since: performance.now() };

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    keybinds() {
        return settings.keybinds;
    }

    get isDemo() {
        return this.mode === 'demo';
    }

    get isMultiplayer() {
        return this.mode === 'br' || this.mode === 'duel';
    }

    get isTutorial() {
        return this.mode === 'tutorial';
    }

    // Bots leave you alone with the admin "pacifist" command.
    get botsIgnorePlayer() {
        return this.adminPacifist;
    }

    // ==========================================
    // MATCH SETUP
    // ==========================================

    resetWorld(worldSize) {
        this.net?.stop();
        this.net = null;
        this.worldSize = worldSize;
        this.frame = 0;
        this.player = null;
        this.bots = [];
        this.remotes = [];
        this.orbs = [];
        this.projectiles = [];
        this.particles = [];
        this.safeZones = [];
        this.slotMachines = [];
        this.ships = [];
        this.deadBotIds = new Set();
        this.safeZoneRespawnTimer = 0;
        this.ownsWorld = true;          // false = a mirror of the match host's bots and zones
        this.hasEnemies = false;
        this.isGameOver = false;
        this.spectateTarget = null;
        this.storm = { active: false, x: worldSize / 2, y: worldSize / 2, radius: 0, startRadius: STORM.startRadius, minRadius: 0, shrinkPerSecond: STORM.shrinkPerSecond, startedAt: 0, delaySeconds: 0 };
        this.matchStats = { startTime: Date.now(), deathTime: null, xpEarned: 0, distance: 0, lastX: 0, lastY: 0, totalPlayers: 1 };
        this.forfeitArmedUntil = 0;
        this.leaderboardTick = 0;
        this.matchQuests = [];          // quests finished this match (listed on the game over screen)
        this.minimapGhosts = [];        // where enemies just died: their minimap dots fade out
        this.timeScale = 1;             // admin slow motion
        this.zoomTarget = 1;            // camera zoom: mouse wheel / + - in a match (and admin /zoom)
        this.adminPacifist = false;     // admin: bots ignore you
        this.admin?.clear();
        this.damageNumbers.clear();
        this.tutorial?.end();
        this.tutorial = null;
        if (this.upgrades) this.upgrades.reset();
        if (this.input) this.input.clear();
        clearTeammatePointers();
    }

    startDemo() {
        this.mode = 'demo';
        this.resetWorld(WORLD.demo);
        this.config = { orbCount: MATCH.demoOrbs };
        this.player = new Player(-10000, -10000, 'circle', '');
        this.player.health = 999999;
        for (let i = 0; i < MATCH.demoBots; i++) this.spawnBot(Math.random() * this.worldSize, Math.random() * this.worldSize, Math.random() * 5000);
        for (let i = 0; i < MATCH.demoOrbs; i++) this.orbs.push(new Orb(Math.random() * this.worldSize, Math.random() * this.worldSize, 'xp', 1, 0));
        this.camera.x = this.worldSize / 2;
        this.camera.y = this.worldSize / 2;
        this.camera.zoom = 1;
        this.intro.active = false;
        this.showMatchUi(false);
        this.startLoop();
    }

    startSolo(playerClass, { name = '', equipped = null } = {}) {
        this.mode = 'solo';
        this.resetWorld(WORLD.solo);
        this.config = { orbCount: MATCH.xpOrbs };
        this.spawnSafeZones(Math.random);

        this.player = new Player(this.worldSize / 2, this.worldSize / 2, playerClass, name, equipped);

        // Some matches start with a few strong bots, some with an all-rookie lobby.
        const seed = Math.random();
        for (let i = 0; i < MATCH.soloBots; i++) {
            let pts;
            if (seed > 0.9) pts = Math.random() < 0.2 ? Math.random() * BALANCE.bots.soloStackedMaxPoints : Math.random() * 500;
            else if (seed < 0.4) pts = Math.random() * 80;
            else pts = Math.random() < 0.1 ? Math.random() * 1000 : Math.random() * 100;
            const spawn = this.getSafeSpawnPosition();
            this.spawnBot(spawn.x, spawn.y, pts);
        }
        this.hasEnemies = true;
        this.spawnOrbs();
        this.matchStats.totalPlayers = this.bots.length + 1;
        this.beginMatch({ intro: false });
    }

    // The training arena. hooks.onTutorialDone(completed) when it's finished or skipped,
    // hooks.onTutorialExit('play' | 'menu') when the player chooses what to do next.
    startTutorial(playerClass, { name = '', equipped = null } = {}) {
        this.mode = 'tutorial';
        this.resetWorld(WORLD.tutorial);
        this.config = { orbCount: 0 };
        this.player = new Player(this.worldSize / 2, this.worldSize / 2, playerClass, name, equipped);
        this.matchStats.totalPlayers = 1;
        this.beginMatch({ intro: false });
        hud.setLeaderboardVisible(false);
        this.tutorial = new Tutorial(this, {
            onDone: (completed) => this.hooks.onTutorialDone?.(completed),
            onExit: (choice) => this.hooks.onTutorialExit?.(choice)
        });
    }

    // match: { mode: 'br' | 'duel', hostId, seed, players: [{ id, name, classType, equipped }] }
    startMultiplayer(match, network, { equipped = null } = {}) {
        const duel = match.mode === 'duel';
        this.mode = duel ? 'duel' : 'br';
        this.resetWorld(duel ? WORLD.duel : WORLD.br);
        this.config = { orbCount: duel ? 0 : MATCH.xpOrbs };
        const rng = createRng(match.seed >>> 0);

        // Layout comes from the shared seed, so every player sees the same spawn and zones.
        if (!duel) this.spawnSafeZones(rng);
        const center = duel
            ? { x: this.worldSize / 2, y: this.worldSize / 2 }
            : { x: 1000 + rng() * (this.worldSize - 2000), y: 1000 + rng() * (this.worldSize - 2000) };
        const spacing = duel ? 1000 : 120;
        const startX = center.x - ((match.players.length - 1) * spacing) / 2;

        match.players.forEach((info, i) => {
            const x = startX + i * spacing;
            if (info.id === network.id) {
                this.player = new Player(x, center.y, info.classType, info.name, equipped || info.equipped);
                this.player.netId = info.id;
            } else {
                const remote = new RemotePlayer(x, center.y, info);
                remote.team = duel ? `remote:${info.id}` : 'players';
                remote.isTeammate = !duel;
                this.remotes.push(remote);
            }
        });

        this.ownsWorld = match.hostId === network.id;
        if (!duel && this.ownsWorld) {
            const botCount = Math.max(0, MATCH.brTotalPlayers - match.players.length);
            for (let i = 0; i < botCount; i++) {
                const spawn = this.getSafeSpawnPosition();
                this.spawnBot(spawn.x, spawn.y, 0).netId = `b${i}`;
            }
            this.hasEnemies = this.bots.length > 0;
        }
        if (!duel) this.spawnOrbs();

        // Battle royale storm stops at a final circle; duels get a small storm so nobody can kite forever.
        const S = BALANCE.storm;
        this.storm = {
            ...this.storm,
            active: true,
            startRadius: duel ? S.duelStartRadius : STORM.startRadius,
            radius: duel ? S.duelStartRadius : STORM.startRadius,
            minRadius: duel ? S.duelMinRadius : S.minRadius,
            shrinkPerSecond: duel ? S.duelShrinkPerSecond : STORM.shrinkPerSecond,
            startedAt: performance.now(),
            delaySeconds: MATCH.introTicks / 60 + (duel ? S.duelDelaySeconds : 0)
        };
        this.matchStats.totalPlayers = duel ? 2 : MATCH.brTotalPlayers;

        this.net = new MatchSync(this, network, match);
        this.intro = { active: true, timer: 0, x: center.x, y: center.y, startZoom: duel ? 0.8 : 0.5 };
        this.beginMatch({ intro: true });
        this.net.start();
        if (this.ownsWorld && this.bots.length) this.net.sendBotMeta(true);
    }

    beginMatch({ intro }) {
        const p = this.player;
        this.matchStats.lastX = p.x;
        this.matchStats.lastY = p.y;
        this.matchStats.startTime = Date.now();
        this.camera.x = intro ? this.intro.x : p.x;
        this.camera.y = intro ? this.intro.y : p.y;
        this.camera.zoom = intro ? this.intro.startZoom : 1;
        this.camera.shake = 0;
        if (!intro) this.intro.active = false;
        this.upgrades.reset();
        hud.resetHud();
        hideGameOver();
        this.showMatchUi(true);
        this.zoomTarget = settings.zoom || 1;
        this.hooks.onMatchStart?.({ mode: this.mode, classType: p.type });
        this.startLoop();
    }

    showMatchUi(visible) {
        setVisible($('game-ui'), visible);
        setVisible($('br-ui'), visible);
        const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        setVisible($('mobile-controls'), visible && touch);
        if (!visible) {
            hud.setSpectating(null);
            hud.hideMatchToast();
            hideUpgradeCards();
        }
    }

    spawnBot(x, y, points) {
        const bot = new Bot(x, y, randomClass(), points);
        this.bots.push(bot);
        return bot;
    }

    spawnOrbs() {
        for (let i = 0; i < MATCH.xpOrbs; i++) this.orbs.push(new Orb(Math.random() * this.worldSize, Math.random() * this.worldSize, 'xp', 1, 0));
        for (let i = 0; i < MATCH.healthOrbs; i++) {
            const pos = this.getSafeOrbPosition(500);
            this.orbs.push(new Orb(pos.x, pos.y, 'health', 1, 0));
        }
    }

    spawnSafeZones(rng) {
        for (let i = 0; i < MATCH.safeZones; i++) {
            const pos = this.getSafeSpawnPosition(4000, rng, false);
            this.safeZones.push(new SafeZone(pos.x, pos.y, i + 1));
        }
    }

    // A random spot away from the player (and at least `minDistFromZones` from every safe zone).
    getSafeSpawnPosition(minDistFromZones = 0, rng = Math.random, avoidPlayer = true) {
        let x = 0;
        let y = 0;
        for (let attempt = 0; attempt < 100; attempt++) {
            x = 500 + rng() * (this.worldSize - 1000);
            y = 500 + rng() * (this.worldSize - 1000);
            if (avoidPlayer && this.player && distance(x, y, this.player.x, this.player.y) < 1000) continue;
            if (minDistFromZones > 0 && this.safeZones.some(z => distance(x, y, z.x, z.y) < minDistFromZones)) continue;
            break;
        }
        return { x, y };
    }

    getSafeOrbPosition(minDist) {
        let x = 0;
        let y = 0;
        for (let attempt = 0; attempt < 50; attempt++) {
            x = 100 + Math.random() * (this.worldSize - 200);
            y = 100 + Math.random() * (this.worldSize - 200);
            if (!this.orbs.some(o => o.type === 'health' && distance(x, y, o.x, o.y) < minDist)) break;
        }
        return { x, y };
    }

    // ==========================================
    // SHARED HELPERS FOR SYSTEMS
    // ==========================================

    isEnemy(a, b) {
        return isEnemy(a, b);
    }

    findByNetId(id) {
        if (!id) return null;
        if (this.player && this.player.netId === id) return this.player;
        return this.remotes.find(r => r.netId === id) || this.bots.find(b => b.netId === id) || null;
    }

    // Ships whose position this computer decides (others follow network updates).
    controlsMovement(ship) {
        return ship === this.player || (ship.isBot && !ship.isReplica);
    }

    addProjectile(projectile) {
        this.projectiles.push(projectile);
    }

    // damageScale < 1 for Multishot volleys (see combat.volleyDamageScale).
    fireProjectile(owner, angle, damageScale = 1) {
        const shot = new Projectile(owner.x, owner.y, angle, owner);
        shot.damage *= damageScale;
        this.projectiles.push(shot);
        if (owner.rearguard > 0) {
            const rear = new Projectile(owner.x, owner.y, angle + Math.PI, owner);
            rear.damage *= damageScale * BALANCE.upgrades.rearguardDamage[Math.min(3, owner.rearguard)];
            this.projectiles.push(rear);
        }
    }

    spawnParticles(x, y, color, amount) {
        if (!settings.particles) return;
        for (let i = 0; i < amount; i++) this.particles.push(new Particle(x, y, color));
    }

    // Mouse wheel / + - keys. steps > 0 zooms in.
    zoomBy(steps) {
        if (this.isDemo || this.isGameOver) return;
        this.zoomTarget = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.zoomTarget * Math.pow(1.1, steps)));
        settings.zoom = Math.round(this.zoomTarget * 100) / 100;
        clearTimeout(this.zoomSaveTimer);
        this.zoomSaveTimer = setTimeout(saveSettings, 600);
    }

    shake(amount) {
        if (!this.isDemo) this.camera.shake = Math.max(this.camera.shake, amount);
    }

    // Plays a sound that gets quieter the further it is from the camera.
    playSoundAt(name, x, y, { category = 'combat', volume = 1 } = {}) {
        const dist = distance(this.camera.x, this.camera.y, x, y);
        if (dist >= 2000) return;
        const falloff = 1 - dist / 2000;
        sounds.play(name, { category, volume: volume * falloff * falloff });
    }

    // ==========================================
    // DAMAGE, DEATH & MATCH RESULTS
    // ==========================================

    // Multiplayer rule: only the computer that owns a ship changes its health.
    //   'apply'  - change health here (your own ship, or bots when you run them)
    //   'report' - tell the host (you hit one of the host's bots)
    //   'ignore' - just show the hit; the owner applies it on their side
    damageAuthority(target, attacker) {
        if (target === this.player) return 'apply';
        if (target.isRemotePlayer) return 'ignore';
        if (attacker === this.player) return this.ownsWorld ? 'apply' : 'report';
        if (attacker && attacker.isRemotePlayer) return 'ignore';
        return this.ownsWorld ? 'apply' : 'ignore';
    }

    // Returns false if the target was immune.
    damage(target, amount, attacker, { armor = true, hitSound = 0, shake = 0, particles = null } = {}) {
        if (!target || target.isDead || amount <= 0) return false;
        if (target.adminGod) return false; // admin god mode
        if (isImmune(target)) {
            this.spawnParticles(target.x, target.y, '#0096ff', 3);
            if (hitSound) this.playSoundAt('take_damage', target.x, target.y, { volume: 0.1 });
            if (attacker === this.player && settings.damageNumbers) this.damageNumbers.addWord(target, 'IMMUNE', '#7dd3fc');
            return false;
        }
        const final = armor ? Math.max(1, amount * (1 - BALANCE.upgrades.platingReduction * target.plating)) : amount;

        // Hit feedback: white flash on the ship, your damage as a number, a red edge when you're hit.
        target.hitFlashAt = performance.now();
        if (attacker === this.player && target !== this.player) {
            if (settings.damageNumbers) {
                this.damageNumbers.add(target, final, { big: final >= this.player.baseDamage * 2.2 });
                this.damageNumbers.marker(particles ? particles.x : target.x, particles ? particles.y : target.y);
            }
            this.stat('damage', final);
        }
        if (target === this.player && !this.isDemo) hud.flashHit(final / target.maxHealth);

        // Vampirism: heal a share of the damage you deal (the attacker's own computer applies it).
        if (attacker && attacker.vampirism > 0 && (attacker === this.player || (attacker.isBot && !attacker.isReplica)) && !attacker.isDead) {
            attacker.health = Math.min(attacker.maxHealth, attacker.health + final * BALANCE.upgrades.lifestealPct * attacker.vampirism);
        }

        if (particles) this.spawnParticles(particles.x, particles.y, particles.color, particles.count);
        if (hitSound) {
            this.playSoundAt('take_damage', target.x, target.y, { category: 'heavy', volume: hitSound });
            if (attacker === this.player) sounds.play('hit_marker', { category: 'combat' });
        }
        if (shake && target === this.player) this.shake(shake);

        const authority = this.damageAuthority(target, attacker);
        if (target === this.player && this.isTutorial) {
            target.health = Math.max(1, target.health - final); // can't die in the training arena
        } else if (authority === 'apply') {
            target.health -= final;
            if (target.health <= 0) this.kill(target, attacker);
        } else if (authority === 'report') {
            target.health = Math.max(1, target.health - final); // predicted until the host confirms
            this.net?.reportBotHit(target, final);
        }
        return true;
    }

    // Host: another player's hit on one of our bots (armour already applied by the shooter).
    applyReportedHit(bot, amount, shooter) {
        if (isImmune(bot)) return;
        bot.health -= amount;
        if (bot.health <= 0) this.kill(bot, shooter);
    }

    kill(victim, killer) {
        if (!victim || victim.isDead) return;
        victim.isDead = true;
        const isLocal = victim === this.player;

        this.playSoundAt(isLocal ? 'player_death' : 'enemy_death', victim.x, victim.y, { category: 'heavy', volume: isLocal ? 1 : 0.7 });
        this.spawnParticles(victim.x, victim.y, victim.color, 30);
        if (this.player && distance(this.player.x, this.player.y, victim.x, victim.y) < 500) this.shake(isLocal ? 25 : 15);

        if (killer === this.player && !this.isGameOver && !isLocal) {
            this.player.kills++;
            this.addXP(killXp(this.player.points, victim.points || 0));
            sounds.play('kill_confirm', { category: 'alert' });
            if (settings.damageNumbers) this.damageNumbers.marker(victim.x, victim.y, true);
            this.stat('kills');
        }
        this.reportKill(victim, killer);
        this.siphonHeal(killer);
        if (!isLocal && !victim.isTeammate && !this.isDemo) {
            this.minimapGhosts.push({ x: victim.x, y: victim.y, at: performance.now() });
            if (this.minimapGhosts.length > 60) this.minimapGhosts.shift();
        }
        this.dropLoot(victim, killer);

        if (isLocal) {
            this.matchStats.deathTime = Date.now();
            this.upgrades.reset();
            this.net?.sendDied(killer);
        } else if (victim.isBot) {
            const index = this.bots.indexOf(victim);
            if (index !== -1) this.bots.splice(index, 1);
            if (victim.netId) this.deadBotIds.add(victim.netId);
            if (this.isMultiplayer && this.ownsWorld) this.net?.broadcastBotDied(victim, killer);
            if (this.mode === 'solo' || this.isDemo) this.scheduleRespawn();
        }

        if (this.spectateTarget === victim) this.spectateTarget = null;
        this.checkMatchOutcome(killer);
    }

    // Soul Siphon: the killer heals (on the computer that controls the killer, like Vampirism).
    siphonHeal(killer) {
        if (!killer || !(killer.siphon > 0) || killer.isDead) return;
        if (killer !== this.player && !(killer.isBot && !killer.isReplica)) return;
        const heal = Math.min(killer.maxHealth - killer.health, killer.maxHealth * BALANCE.upgrades.siphonPctPerTier * killer.siphon);
        if (heal <= 0) return;
        killer.health += heal;
        this.spawnParticles(killer.x, killer.y, '#22c55e', 10);
        if (killer === this.player && settings.damageNumbers) this.damageNumbers.addWord(killer, `+${Math.round(heal)} HP`, '#4ade80');
    }

    // Kill feed: every kill by or of a real player, plus bot kills close enough to see.
    reportKill(victim, killer) {
        const p = this.player;
        if (this.isDemo || !p || killer?.isForfeit) return;
        const isPerson = (s) => !!s && (s === p || s.isRemotePlayer);
        const nearby = distance(this.camera.x, this.camera.y, victim.x, victim.y) < 1400;
        if (!isPerson(victim) && !isPerson(killer) && !nearby) return;
        const tone = (s) => (s === p ? 'you' : s.isStorm ? 'storm' : s.isTeammate ? 'mate' : 'enemy');
        const label = (s) => (s === p ? 'YOU' : s.name || 'PLAYER');
        const hasKiller = killer && killer !== victim;
        hud.addKillFeed({
            killer: hasKiller ? label(killer) : null,
            killerTone: hasKiller ? tone(killer) : null,
            victim: label(victim),
            victimTone: tone(victim)
        });
    }

    removeRemote(remote) {
        remote.isDead = true;
        this.remotes = this.remotes.filter(r => r !== remote);
        if (this.spectateTarget === remote) this.spectateTarget = null;
        this.checkMatchOutcome(null);
    }

    dropLoot(victim, killer) {
        if (this.mode !== 'duel') {
            const reward = Math.floor((victim.points || 0) * 0.35);
            const count = Math.min(reward, 100);
            if (count > 0) {
                const value = Math.max(1, Math.floor(reward / count));
                for (let i = 0; i < count; i++) this.orbs.push(new Orb(victim.x, victim.y, 'xp', value, 180));
            } else if ((victim.points || 0) < 3) {
                this.orbs.push(new Orb(victim.x, victim.y, 'xp', 1, 100));
            }
        }
        if (killer && killer.medicDrop > 0 && Math.random() < killer.medicDrop * 0.15) this.orbs.push(new Orb(victim.x, victim.y, 'health'));
        if (Math.random() < BALANCE.healthOrbs.dropChance) this.orbs.push(new Orb(victim.x, victim.y, 'health'));
    }

    scheduleRespawn() {
        const mode = this.mode;
        setTimeout(() => {
            if (this.mode !== mode || this.isGameOver) return;
            const pos = this.getSafeSpawnPosition(1500);
            this.spawnBot(pos.x, pos.y, 0);
        }, MATCH.botRespawnDelayMs);
    }

    teammatesAlive() {
        return this.remotes.filter(r => r.isTeammate && !r.isDead);
    }

    checkMatchOutcome(killer) {
        if (this.isDemo || this.isTutorial || this.isGameOver || !this.player) return;
        const p = this.player;

        if (this.mode === 'solo') {
            if (p.isDead) this.finishMatch({ result: 'eliminated', killer });
            return;
        }

        if (this.mode === 'duel') {
            const opponentsAlive = this.remotes.filter(r => !r.isDead).length;
            if (p.isDead) this.finishMatch({ result: 'defeat', placement: 2, killer });
            else if (opponentsAlive === 0) this.finishMatch({ result: 'victory', placement: 1 });
            return;
        }

        // Battle royale: your team wins when every enemy is gone.
        const mates = this.teammatesAlive();
        const enemiesAlive = this.bots.filter(b => !b.isDead).length + this.remotes.filter(r => !r.isTeammate && !r.isDead).length;
        if (p.isDead && mates.length === 0) {
            this.finishMatch({ result: 'eliminated', placement: enemiesAlive + 1, killer });
        } else if (this.hasEnemies && enemiesAlive === 0 && this.frame > MATCH.introTicks) {
            this.finishMatch({ result: 'victory', placement: 1 });
        } else if (p.isDead && (!this.spectateTarget || this.spectateTarget.isDead)) {
            this.spectateTarget = mates[0];
            hud.setSpectating(mates[0].name);
        }
    }

    finishMatch({ result, placement = null, killer = null }) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        const p = this.player;
        hideUpgradeCards();
        hud.setSpectating(null);
        hud.setSafeZoneIndicator(false);
        hud.setLowHealth(false);
        this.tutorial?.end();
        setVisible($('mobile-controls'), false);

        const timeAlive = Math.floor(((this.matchStats.deathTime || Date.now()) - this.matchStats.startTime) / 1000);
        const X = BALANCE.xp;
        let xp = timeAlive * X.perSecondAlive;
        if (result === 'victory') xp += this.mode === 'duel' ? X.duelVictory : X.brVictory;
        if (this.mode === 'br' && placement) xp += Math.max(0, this.matchStats.totalPlayers - placement) * X.brPerPlacement;
        this.addXP(xp);

        if (placement === null) {
            // Solo: your place on the leaderboard when you died.
            const ranked = [p, ...this.bots.filter(b => !b.isDead)].sort((a, b) => b.points - a.points);
            placement = ranked.indexOf(p) + 1;
            this.matchStats.totalPlayers = ranked.length;
        }

        const isShip = killer && typeof killer.x === 'number' && !killer.isDead;
        this.spectateTarget = isShip ? killer : null;

        const summary = {
            mode: this.mode,
            result,
            placement,
            totalPlayers: this.matchStats.totalPlayers,
            points: Math.floor(p.points),
            kills: p.kills,
            time: timeAlive,
            distance: Math.floor(this.matchStats.distance),
            playerClass: p.type,
            upgrades: p.upgradeTiers(),
            xpEarned: 0
        };
        // Quests finished by the match itself (matches played, placement) give their XP here too.
        for (const reward of this.hooks.onMatchQuests?.(summary) || []) this.completeQuest(reward);
        summary.xpEarned = this.matchStats.xpEarned;
        showGameOver(summary, this.matchQuests);
        this.hooks.onMatchEnd?.(summary);
    }

    // A quest stat happened (kills, damage, dashes...): moves the tutorial and your quests along.
    stat(name, amount = 1) {
        if (this.isDemo || this.isGameOver || !this.player || !(amount > 0)) return;
        this.tutorial?.onStat(name);
        if (this.isTutorial) return; // practice doesn't count for quests
        for (const reward of this.hooks.onStat?.(name, amount) || []) this.completeQuest(reward);
    }

    // Your best value this match (points) for "in one match" quests.
    statBest(name, value) {
        if (this.isDemo || this.isTutorial || this.isGameOver || !this.player) return;
        for (const reward of this.hooks.onStatBest?.(name, value) || []) this.completeQuest(reward);
    }

    completeQuest(reward) {
        this.addXP(reward.xp || 0);
        this.matchQuests.push(reward);
        if (!this.isGameOver) hud.showQuestComplete(reward);
    }

    addXP(amount) {
        if (this.isDemo || this.isTutorial || amount <= 0) return;
        amount = Math.floor(amount);
        this.matchStats.xpEarned += amount;
        const levels = this.hooks.addAccountXP?.(amount) || [];
        if (levels.length) hud.showAccountLevelNotif(levels[levels.length - 1]);
    }

    // Esc once shows a warning, Esc again within 2.5 seconds leaves the match.
    requestForfeit() {
        if (this.isDemo || this.isGameOver || !this.player) return;
        const now = performance.now();
        if (now > this.forfeitArmedUntil) {
            this.forfeitArmedUntil = now + 2500;
            hud.showMatchToast(this.isTutorial ? 'PRESS ESC AGAIN TO LEAVE THE TUTORIAL'
                : this.player.isDead ? 'PRESS ESC AGAIN TO STOP SPECTATING' : 'PRESS ESC AGAIN TO LEAVE THE MATCH');
            return;
        }
        this.forfeitArmedUntil = 0;
        hud.hideMatchToast();
        if (this.isTutorial) {
            this.tutorial?.leave();
            return;
        }
        if (!this.player.isDead) {
            this.kill(this.player, FORFEIT_SOURCE);
        }
        // Still spectating a teammate: stop now. Your result is your team's place right now.
        if (!this.isGameOver) {
            const enemiesAlive = this.bots.filter(b => !b.isDead).length + this.remotes.filter(r => !r.isTeammate && !r.isDead).length;
            this.finishMatch({ result: this.mode === 'duel' ? 'defeat' : 'eliminated', placement: this.mode === 'duel' ? 2 : enemiesAlive + 1 });
        }
    }

    // Lost the connection to the server mid-match: end it (no free win for dropping out).
    onConnectionLost() {
        if (!this.isMultiplayer || this.isGameOver || !this.player) return;
        this.net?.stop();
        this.net = null;
        hud.showMatchToast('CONNECTION TO SERVER LOST', 4000);
        const enemiesAlive = this.bots.filter(b => !b.isDead).length + this.remotes.filter(r => !r.isTeammate && !r.isDead).length;
        this.finishMatch({ result: this.mode === 'duel' ? 'defeat' : 'eliminated', placement: this.mode === 'duel' ? 2 : enemiesAlive + 1 });
    }

    // We became the match host (the previous host left): start running the bots ourselves.
    takeOverWorld() {
        this.ownsWorld = true;
        for (const bot of this.bots) {
            bot.isReplica = false;
            bot.upgradeProgress = 0;
            bot.netTarget = null;
        }
        this.hasEnemies = this.hasEnemies || this.bots.length > 0;
    }

    awardSlotMachine() {
        const p = this.player;
        if (!p || p.isDead || this.isGameOver || this.isDemo) return null;
        const reward = rollSlotReward(p);
        this.refreshBadges();
        return reward;
    }

    // Call after the player's upgrades change: redraws the badges and tells other players.
    refreshBadges() {
        hud.renderUpgradeBadges(this.player, this.input.isTouchDevice);
        this.net?.sendUpgrades();
        this.upgrades.revalidate();
    }

    // ==========================================
    // MAIN LOOP
    // ==========================================

    startLoop() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.accumulator = 0;
        const loop = (time) => {
            if (!this.isRunning) return;
            this.animationId = requestAnimationFrame(loop);
            this.tick(time);
        };
        this.animationId = requestAnimationFrame(loop);
    }

    stopLoop() {
        this.isRunning = false;
        cancelAnimationFrame(this.animationId);
    }

    // Fixed 60 Hz simulation: the game runs at the same speed on 30, 60 and 144 Hz screens.
    tick(time) {
        let dt = (time - this.lastTime) * this.timeScale;
        this.lastTime = time;
        if (dt > 250) dt = 250;
        this.accumulator += dt;

        let steps = 0;
        while (this.accumulator >= TICK_MS - 0.5 && steps < 5) {
            this.update();
            this.accumulator -= TICK_MS;
            steps++;
        }
        if (steps === 5) this.accumulator = 0; // too far behind (tab was hidden): skip ahead
        if (steps > 0) this.draw();

        this.fps.frames += steps > 0 ? 1 : 0;
        if (time - this.fps.since >= 1000) {
            hud.setFps(settings.adminFps && !this.isDemo ? this.fps.frames : null);
            this.fps.frames = 0;
            this.fps.since = time;
        }
    }

    update() {
        this.frame++;
        if (this.camera.shake > 0) {
            this.camera.shake *= 0.9;
            if (this.camera.shake < 0.5) this.camera.shake = 0;
        }
        this.ships = this.isDemo ? [...this.bots] : [this.player, ...this.bots, ...this.remotes];

        const p = this.player;
        const playing = !this.isDemo && !this.isGameOver && p && !p.isDead;

        if (this.mode === 'duel' && playing && !this.intro.active) {
            p.points += MATCH.duelPassivePointsPerTick;
            p.upgradeProgress += MATCH.duelPassivePointsPerTick;
        }

        updateSafeZones(this);
        updateSlotMachines(this);
        updateAbilities(this);
        updateStorm(this);
        updateLocalPlayer(this);
        for (const r of this.remotes) if (!r.isDead) r.update();
        updateBots(this);

        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update();
            if (this.particles[i].life <= 0) this.particles.splice(i, 1);
        }

        updateCollisions(this);
        updateProjectiles(this);
        updateOrbs(this);

        if (playing) {
            this.upgrades.checkProgress();
            hud.updatePointsBar(p.points, p.upgradeProgress, this.upgrades.pointsToNext, p.kills);
            hud.setSafeZoneIndicator(p.inSafeZone);
            if (!this.intro.active && this.frame % 60 === 0) {
                this.stat('time', 1);
                this.statBest('points', p.points);
            }
        }
        if (!this.isDemo && this.frame % 10 === 0) hud.setLowHealth(playing && p.health / p.maxHealth < 0.25);
        this.tutorial?.update();
        this.damageNumbers.update();

        if (this.frame % 30 === 0) {
            this.refreshLeaderboard();
            this.checkMatchOutcome(null);
        }
        this.net?.tick(this.frame);
        this.admin?.update(this);
        this.updateCamera();
    }

    refreshLeaderboard() {
        if (this.isDemo) return;
        const p = this.player;
        const ships = this.isGameOver ? [...this.bots, ...this.remotes] : [p, ...this.bots, ...this.remotes];
        const rows = ships
            .filter(s => s && !s.isDead)
            .sort((a, b) => b.points - a.points)
            .map(s => ({
                name: s === p ? 'YOU' : s.name,
                points: s.points,
                highlight: s === p || s.isTeammate,
                // your own banner checks your account name (your ship has no name tag in solo)
                banner: bannerFor(s.equipped, s === p ? s.name || this.hooks.localName?.() : s.name)
            }));
        hud.renderLeaderboard(rows);
    }

    updateCamera() {
        const cam = this.camera;
        const p = this.player;
        let target = { x: cam.x, y: cam.y };
        let glide = 0.15;

        if (this.isDemo) {
            target = { x: this.worldSize / 2, y: this.worldSize / 2 };
            cam.zoom += (1 - cam.zoom) * 0.05;
        } else if (this.isGameOver) {
            if (!this.spectateTarget || this.spectateTarget.isDead) {
                const alive = [...this.bots, ...this.remotes].filter(s => !s.isDead);
                this.spectateTarget = alive.length ? alive.reduce((a, b) => (a.points > b.points ? a : b)) : null;
            }
            if (this.spectateTarget) target = this.spectateTarget;
            glide = 0.02;
            cam.zoom += (1 - cam.zoom) * 0.05;
        } else if (p && p.isDead && this.spectateTarget) {
            target = this.spectateTarget;
            cam.zoom += (1 - cam.zoom) * 0.1;
        } else if (this.intro.active) {
            const intro = this.intro;
            intro.timer++;
            if (intro.timer < 60) {
                target = intro;
                glide = 1;
                cam.zoom = intro.startZoom;
            } else if (intro.timer < MATCH.introTicks) {
                const t = (intro.timer - 60) / (MATCH.introTicks - 60);
                const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
                target = p || intro;
                glide = 0.05 + ease * 0.1;
                cam.zoom = intro.startZoom + (1 - intro.startZoom) * ease;
            } else {
                intro.active = false;
                target = p || intro;
                cam.zoom = 1;
            }
        } else if (p) {
            target = p;
            cam.zoom += (this.zoomTarget - cam.zoom) * 0.1;
        }

        cam.x += (target.x - cam.x) * glide;
        cam.y += (target.y - cam.y) * glide;
    }

    draw() {
        drawWorld(this);
        if (this.isDemo) return;
        if (settings.showMinimap) drawMinimap(this);
        drawTeammatePointers(this);
    }
}

// The upgrade bar and the "choose 1 of 3" cards during a match.
class UpgradeFlow {
    constructor(engine) {
        this.engine = engine;
        this.reset();
    }

    reset() {
        this.pending = 0;
        this.choices = [];
        this.choosing = false;
        this.pointsToNext = 15;
        hideUpgradeCards();
    }

    checkProgress() {
        const p = this.engine.player;
        while (p.upgradeProgress >= this.pointsToNext) {
            p.upgradeProgress -= this.pointsToNext;
            p.upgradeCount++;
            this.pointsToNext = nextUpgradeCost(p.upgradeCount);
            this.queue();
        }
    }

    queue() {
        hud.flashPointsBar();
        hud.showUpgradeReadyNotif();
        this.pending++;
        if (!this.choosing) this.showNext();
    }

    showNext() {
        const engine = this.engine;
        const p = engine.player;
        if (this.pending <= 0 || engine.isGameOver || !p || p.isDead) return;
        this.choices = getWeightedUpgrades(p, 3);
        if (this.choices.length === 0) {
            // Everything is maxed: nothing left to offer.
            this.pending = 0;
            this.choosing = false;
            hideUpgradeCards();
            return;
        }
        this.choosing = true;
        showUpgradeCards(this.choices, p);
    }

    // Re-rolls the open cards if one of them can no longer be taken.
    revalidate() {
        if (!this.choosing) return;
        const available = new Set(availableUpgrades(this.engine.player).map(u => u.id));
        if (this.choices.some(c => !available.has(c.id))) this.showNext();
    }

    pick(index) {
        const engine = this.engine;
        const p = engine.player;
        const choice = this.choices[index];
        if (!this.choosing || !choice || engine.isGameOver || !p || p.isDead) return;

        if (!p.applyUpgrade(choice.id)) {
            // Became maxed while the cards were open (e.g. from a slot machine): offer new ones.
            this.showNext();
            return;
        }
        engine.addXP(BALANCE.xp.perUpgrade);
        engine.refreshBadges();
        engine.stat('upgrades');

        hideUpgradeCards();
        this.choosing = false;
        this.choices = [];
        this.pending--;
        if (this.pending > 0) setTimeout(() => this.showNext(), 200);
    }
}
