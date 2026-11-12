// Every admin command, shared by the admin console (press /) and the admin menu (press / twice).
//
//   name   typed as /name in the console
//   tab    which menu tab it is in: player | match | fun | progress (console-only commands: other)
//   arg    optional input: { type: 'number' | 'text', default, hint }
//   needs  'match' = you must be playing, 'world' = playing solo (or the host of a multiplayer
//          match, since the host runs the bots), 'solo' = solo matches only
//   on     for toggles: returns whether it is switched on (the menu shows ON / OFF)
//   run    does it and returns the message shown to you
import { STORM } from '../config.js';
import { UPGRADE_POOL, isAbility } from '../data/upgrades.js';
import { CLASS_TYPES, isClassType } from '../data/classes.js';
import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { distance } from '../core/math.js';
import { Orb, LuckySlotMachine } from '../entities/pickups.js';
import { SafeZone } from '../entities/SafeZone.js';
import { devSetLevel, devUnlockAll, devSetHourly, addAccountXP, setTutorialDone } from '../services/profile.js';
import { completeAllQuests, resetQuests } from '../services/quests.js';
import { scheduleSave } from '../services/account.js';

export const TABS = [
    { id: 'all', label: 'ALL' },
    { id: 'player', label: 'PLAYER' },
    { id: 'match', label: 'MATCH' },
    { id: 'fun', label: 'FUN' },
    { id: 'progress', label: 'PROGRESS' }
];

const num = (def, hint) => ({ type: 'number', default: def, hint });
const text = (def, hint) => ({ type: 'text', default: def, hint });

const enemiesOf = (engine) => [...engine.bots].filter(b => !b.isDead && b.team !== engine.player?.team);
const aroundPlayer = (p, min, max) => {
    const a = Math.random() * Math.PI * 2;
    const d = min + Math.random() * (max - min);
    return { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
};
const clampToWorld = (engine, v) => Math.max(50, Math.min(engine.worldSize - 50, v));

// Returns the new bots.
function spawnBotsNear(engine, count, { team = null, name = null, points = 0 } = {}) {
    const p = engine.player;
    const spawned = [];
    for (let i = 0; i < count; i++) {
        const pos = aroundPlayer(p, 300, 900);
        const bot = engine.spawnBot(clampToWorld(engine, pos.x), clampToWorld(engine, pos.y), points);
        if (engine.isMultiplayer) bot.netId = `a${Date.now().toString(36)}${i}`;
        if (team) bot.team = team;
        if (name) bot.name = name;
        bot.metaDirty = true;
        spawned.push(bot);
    }
    engine.hasEnemies = true;
    return spawned;
}

function maxUpgrades(engine, ship) {
    for (const upg of UPGRADE_POOL) {
        if (upg.isActiveAbility) continue;
        while (ship.applyUpgrade(upg.id)) { /* until maxed */ }
    }
    if (ship === engine.player) engine.refreshBadges();
}

export const COMMANDS = [
    // ---------- PLAYER ----------
    { name: 'god', tab: 'player', needs: 'match', desc: 'Take no damage at all.', on: (e) => !!e.player?.adminGod,
        run: (e) => { e.player.adminGod = !e.player.adminGod; return `God mode ${e.player.adminGod ? 'ON' : 'OFF'}.`; } },
    { name: 'heal', tab: 'player', needs: 'match', desc: 'Back to full health.',
        run: (e) => { e.player.health = e.player.maxHealth; return 'Health restored.'; } },
    { name: 'health', tab: 'player', needs: 'match', arg: num(5000, 'max HP'), desc: 'Set your max health (and fill it).',
        run: (e, n) => { e.player.maxHealth = e.player.health = Math.max(1, n); return `Max health set to ${n}.`; } },
    { name: 'speed', tab: 'player', needs: 'match', arg: num(15, 'speed'), desc: 'Set your movement speed (Jet is 9).',
        run: (e, n) => { e.player.speed = n; return `Speed set to ${n}.`; } },
    { name: 'damage', tab: 'player', needs: 'match', arg: num(100, 'damage'), desc: 'Set your bullet damage.',
        run: (e, n) => { e.player.baseDamage = n; return `Damage set to ${n}.`; } },
    { name: 'firerate', tab: 'player', needs: 'match', arg: num(4, 'ticks'), desc: 'Ticks between shots (lower = faster).',
        run: (e, n) => { e.player.fireRate = Math.max(1, n); return `Fire rate set to ${n}.`; } },
    { name: 'multishot', tab: 'player', needs: 'match', arg: num(5, 'barrels'), desc: 'Extra barrels.',
        run: (e, n) => { e.player.multiShot = Math.max(0, Math.min(30, n)); return `Multishot set to ${n}.`; } },
    { name: 'missiles', tab: 'player', needs: 'match', arg: num(5, 'tier'), desc: 'Homing missiles tier.',
        run: (e, n) => { e.player.missiles = n; return `Missiles set to ${n}.`; } },
    { name: 'orbiters', tab: 'player', needs: 'match', arg: num(5, 'blades'), desc: 'Spinning orbiter blades.',
        run: (e, n) => { e.player.orbiters = n; return `Orbiters set to ${n}.`; } },
    { name: 'spikes', tab: 'player', needs: 'match', arg: num(5, 'tier'), desc: 'Ramming spikes tier.',
        run: (e, n) => { e.player.spikes = n; e.player.frontVisual = 'spikes'; return `Spikes set to ${n}.`; } },
    { name: 'regen', tab: 'player', needs: 'match', arg: num(20, 'tier'), desc: 'Health regen tier (each = 0.6%/s).',
        run: (e, n) => { e.player.regen = n; return `Regen set to ${n}.`; } },
    { name: 'magnet', tab: 'player', needs: 'match', arg: num(10, 'tier'), desc: 'Orb magnet range tier.',
        run: (e, n) => { e.player.magnet = n; return `Magnet set to ${n}.`; } },
    { name: 'size', tab: 'player', needs: 'match', arg: num(40, 'size'), desc: 'Set your ship size.',
        run: (e, n) => { e.player.size = e.player.baseSize = Math.max(3, Math.min(300, n)); return `Size set to ${n}.`; } },
    { name: 'tiny', tab: 'player', needs: 'match', desc: 'Become tiny and hard to hit.',
        run: (e) => { e.player.size = e.player.baseSize = 5; return 'You are now tiny.'; } },
    { name: 'giant', tab: 'player', needs: 'match', desc: 'Become a giant boss with +5000 health.',
        run: (e) => { const p = e.player; p.size = p.baseSize = 150; p.maxHealth += 5000; p.health += 5000; return 'You are now a giant boss.'; } },
    { name: 'score', tab: 'player', needs: 'match', arg: num(1000, 'points'), desc: 'Add points (fills your upgrade bar).',
        run: (e, n) => { e.player.points += n; e.player.upgradeProgress += n; return `Added ${n} points.`; } },
    { name: 'upgrade', tab: 'player', needs: 'match', arg: text('orbiters', 'upgrade id'), desc: 'Add one tier of an upgrade (e.g. orbiters, regen, plating).',
        run: (e, id) => {
            if (!UPGRADE_POOL.some(u => u.id === id && !u.isActiveAbility)) throw new Error(`Unknown upgrade. Try: ${UPGRADE_POOL.filter(u => !u.isActiveAbility).map(u => u.id).join(', ')}`);
            if (!e.player.applyUpgrade(id)) throw new Error(`${id} is already maxed.`);
            e.refreshBadges();
            return `${id} is now T${e.player.upgrades[id]}.`;
        } },
    { name: 'maxupgrades', tab: 'player', needs: 'match', desc: 'Every upgrade to its max tier.',
        run: (e) => { maxUpgrades(e, e.player); return 'ALL UPGRADES MAXED!'; } },
    { name: 'ability', tab: 'player', needs: 'match', arg: text('blade_ring', 'ability id'), desc: 'Give yourself an ability (E key).',
        run: (e, id) => {
            if (!isAbility(id)) throw new Error(`Unknown ability. Try: ${UPGRADE_POOL.filter(u => u.isActiveAbility).map(u => u.id).join(', ')}`);
            e.player.applyUpgrade(id);
            e.refreshBadges();
            return `Ability set to ${id}.`;
        } },
    { name: 'cooldown', tab: 'player', needs: 'match', arg: num(0, 'ticks'), desc: 'Dash + ability cooldown (0 = none).',
        run: (e, n) => { e.player.abilityMaxCooldown = e.player.dashMaxCooldown = Math.max(0, n); e.player.abilityCooldown = e.player.dashCooldown = 0; return `Cooldowns set to ${n}.`; } },
    { name: 'invisible', tab: 'player', needs: 'match', desc: 'Bots and homing missiles can\'t see you.', on: (e) => !!e.admin?.invisible,
        run: (e) => { e.admin.invisible = !e.admin.invisible; if (!e.admin.invisible) e.player.isCloaked = false; return `Invisible ${e.admin.invisible ? 'ON' : 'OFF'}.`; } },
    { name: 'onehit', tab: 'player', needs: 'match', desc: 'Every bullet destroys what it hits.', on: (e) => e.player?.baseDamage >= 99999,
        run: (e) => {
            const p = e.player;
            if (p.baseDamage >= 99999) { p.baseDamage = p.adminSavedDamage || p.base.baseDamage; return 'One-hit OFF.'; }
            p.adminSavedDamage = p.baseDamage;
            p.baseDamage = 99999;
            return 'One-hit ON.';
        } },
    { name: 'tp', tab: 'player', needs: 'match', desc: 'Teleport to a random spot on the map.',
        run: (e) => { const s = e.getSafeSpawnPosition(0); Object.assign(e.player, { x: s.x, y: s.y }); return 'Teleported.'; } },
    { name: 'center', tab: 'player', needs: 'match', desc: 'Teleport to the middle of the map.',
        run: (e) => { Object.assign(e.player, { x: e.worldSize / 2, y: e.worldSize / 2 }); return 'Teleported to the center.'; } },
    { name: 'ultimate', tab: 'player', needs: 'match', desc: 'OP: god mode, every upgrade maxed, triple barrels, fast fire.',
        run: (e) => {
            const p = e.player;
            p.adminGod = true;
            maxUpgrades(e, p);
            p.fireRate = 3;
            p.multiShot = Math.max(p.multiShot, 6);
            p.speed = Math.max(p.speed, 12);
            p.missiles = Math.max(p.missiles, 5);
            return 'ULTIMATE MODE. Good luck to everyone else.';
        } },
    { name: 'suicide', tab: 'player', needs: 'match', desc: 'End your run right now.',
        run: (e) => { e.player.adminGod = false; e.kill(e.player, null); return 'Goodbye cruel world.'; } },

    // ---------- MATCH ----------
    { name: 'nuke', tab: 'match', needs: 'world', desc: 'Destroy every enemy bot.',
        run: (e) => { const n = enemiesOf(e).length; for (const b of enemiesOf(e)) e.kill(b, e.player); return `Destroyed ${n} enemies.`; } },
    { name: 'clearnear', tab: 'match', needs: 'world', arg: num(800, 'radius'), desc: 'Destroy every enemy bot near you.',
        run: (e, r) => { const near = enemiesOf(e).filter(b => distance(b.x, b.y, e.player.x, e.player.y) < r); near.forEach(b => e.kill(b, e.player)); return `Destroyed ${near.length} nearby enemies.`; } },
    { name: 'freeze', tab: 'match', needs: 'world', desc: 'Freeze every bot in place.', on: (e) => e.bots.some(b => b.frozenSpeed !== undefined),
        run: (e) => {
            const frozen = e.bots.some(b => b.frozenSpeed !== undefined);
            for (const bot of e.bots) {
                if (frozen) { if (bot.frozenSpeed !== undefined) bot.speed = bot.frozenSpeed; delete bot.frozenSpeed; }
                else { bot.frozenSpeed = bot.speed; bot.speed = 0; bot.vx = bot.vy = 0; }
            }
            return frozen ? 'Bots unfrozen.' : 'Bots frozen.';
        } },
    { name: 'pacifist', tab: 'match', needs: 'match', desc: 'Bots leave you alone.', on: (e) => e.adminPacifist,
        run: (e) => { e.adminPacifist = !e.adminPacifist; return `Pacifist ${e.adminPacifist ? 'ON: bots ignore you' : 'OFF'}.`; } },
    { name: 'bots', tab: 'match', needs: 'world', arg: num(10, 'how many'), desc: 'Spawn bots around you.',
        run: (e, n) => { const bots = spawnBotsNear(e, Math.max(1, Math.min(60, n))); return `Spawned ${bots.length} bots.`; } },
    { name: 'bossbot', tab: 'match', needs: 'world', desc: 'Spawn a giant maxed-out boss bot.',
        run: (e) => {
            const [boss] = spawnBotsNear(e, 1, { name: 'THE BOSS', points: 5000 });
            maxUpgrades(e, boss);
            boss.size = boss.baseSize = 90;
            boss.maxHealth = boss.health = 20000;
            boss.metaDirty = true;
            return 'THE BOSS has entered the arena.';
        } },
    { name: 'clearbots', tab: 'match', needs: 'world', desc: 'Remove every bot (no kills, no loot).',
        run: (e) => { const n = e.bots.length; e.bots.forEach(b => { b.isDead = true; if (b.netId) e.deadBotIds.add(b.netId); }); e.bots = []; return `Removed ${n} bots.`; } },
    { name: 'bringbots', tab: 'match', needs: 'world', desc: 'Teleport every bot close to you.',
        run: (e) => { for (const b of e.bots) { const s = aroundPlayer(e.player, 250, 700); b.x = clampToWorld(e, s.x); b.y = clampToWorld(e, s.y); } return 'All bots are here now.'; } },
    { name: 'giantbots', tab: 'match', needs: 'world', desc: 'Every bot becomes huge.',
        run: (e) => { for (const b of e.bots) { b.size = b.baseSize = b.size * 2.5; b.metaDirty = true; } return 'The bots got big.'; } },
    { name: 'tinybots', tab: 'match', needs: 'world', desc: 'Every bot becomes tiny.',
        run: (e) => { for (const b of e.bots) { b.size = b.baseSize = Math.max(5, b.size * 0.4); b.metaDirty = true; } return 'The bots got tiny.'; } },
    { name: 'orbs', tab: 'match', needs: 'world', arg: num(300, 'how many'), desc: 'Spawn XP orbs around you.',
        run: (e, n) => { for (let i = 0; i < Math.min(2000, n); i++) e.orbs.push(new Orb(e.player.x, e.player.y, 'xp', 1, 500)); return `Spawned ${n} orbs.`; } },
    { name: 'healthorbs', tab: 'match', needs: 'world', arg: num(20, 'how many'), desc: 'Spawn health orbs around you.',
        run: (e, n) => { for (let i = 0; i < Math.min(500, n); i++) e.orbs.push(new Orb(e.player.x, e.player.y, 'health', 1, 400)); return `Spawned ${n} health orbs.`; } },
    { name: 'slot', tab: 'match', needs: 'match', desc: 'Spawn a Lucky Slot Machine next to you.',
        run: (e) => { e.slotMachines = [new LuckySlotMachine(e.player.x + 100, e.player.y)]; return 'Lucky Slot Machine spawned.'; } },
    { name: 'safezone', tab: 'match', needs: 'world', desc: 'Put a safe zone where you are.',
        run: (e) => { e.safeZones.push(new SafeZone(e.player.x, e.player.y, e.safeZones.length + 1)); return 'Safe zone placed.'; } },
    { name: 'storm', tab: 'match', needs: 'world', arg: num(STORM.startRadius, 'radius'), desc: 'Start the storm (map-wide circle).',
        run: (e, r) => {
            Object.assign(e.storm, { active: true, x: e.worldSize / 2, y: e.worldSize / 2, startRadius: r, radius: r, minRadius: 300, shrinkPerSecond: STORM.shrinkPerSecond, startedAt: performance.now(), delaySeconds: 0 });
            return 'Storm triggered.';
        } },
    { name: 'stopstorm', tab: 'match', needs: 'world', desc: 'Turn the storm off.',
        run: (e) => { e.storm.active = false; return 'Storm stopped.'; } },
    { name: 'slowmo', tab: 'match', needs: 'solo', arg: num(0.4, 'speed'), desc: 'Slow motion (1 = normal speed).',
        run: (e, n) => { e.timeScale = Math.max(0.05, Math.min(3, n)); return `Game speed x${e.timeScale}.`; } },
    { name: 'zoom', tab: 'match', needs: 'match', arg: num(0.5, 'zoom'), desc: 'Camera zoom (1 = normal, smaller = see more).',
        run: (e, n) => { e.zoomTarget = Math.max(0.15, Math.min(3, n)); return `Zoom x${e.zoomTarget}.`; } },
    { name: 'shake', tab: 'match', needs: 'match', arg: num(30, 'strength'), desc: 'Shake the screen.',
        run: (e, n) => { e.camera.shake = n; return `Screen shake ${n}.`; } },

    // ---------- FUN ----------
    { name: 'blackhole', tab: 'fun', needs: 'world', desc: 'Pull everything into you for 6 seconds. Whatever touches you is gone.',
        run: (e) => { e.admin.blackHole = 360; e.shake(10); return 'BLACK HOLE.'; } },
    { name: 'meteors', tab: 'fun', needs: 'world', desc: 'Meteor shower around you for 8 seconds.',
        run: (e) => { e.admin.meteors = 480; return 'Incoming meteors!'; } },
    { name: 'strike', tab: 'fun', needs: 'world', desc: 'Orbital strike where your mouse is pointing.',
        run: (e) => {
            const p = e.player;
            const cam = e.camera;
            let x = cam.x + (e.input.mouseX - e.width / 2) / cam.zoom;
            let y = cam.y + (e.input.mouseY - e.height / 2) / cam.zoom;
            if (e.input.isTouchDevice) { x = p.x + Math.cos(p.angle) * 400; y = p.y + Math.sin(p.angle) * 400; }
            e.admin.explode(e, x, y, 320, 1500, '#38bdf8');
            return 'Orbital strike!';
        } },
    { name: 'shockwave', tab: 'fun', needs: 'world', desc: 'Blast every ship near you far away.',
        run: (e) => { e.admin.shockwave(e, 45, 900, 40); return 'BOOM.'; } },
    { name: 'yeet', tab: 'fun', needs: 'world', desc: 'Launch every bot on the map in a random direction.',
        run: (e) => { for (const b of e.bots) { const a = Math.random() * Math.PI * 2; b.vx += Math.cos(a) * 70; b.vy += Math.sin(a) * 70; } return 'YEET.'; } },
    { name: 'army', tab: 'fun', needs: 'world', arg: num(6, 'how many'), desc: 'Spawn clones of you that fight on your side.',
        run: (e, n) => {
            const p = e.player;
            const clones = spawnBotsNear(e, Math.max(1, Math.min(30, n)), { team: p.team, name: 'CLONE', points: Math.max(100, p.points) });
            clones.forEach(b => { b.applyLoadout(p.equipped); b.isTeammate = true; });
            return `${clones.length} clones are fighting for you.`;
        } },
    { name: 'chaos', tab: 'fun', needs: 'world', desc: 'Every bot gets every upgrade and a random ability.',
        run: (e) => {
            const abilities = UPGRADE_POOL.filter(u => u.isActiveAbility).map(u => u.id);
            for (const b of e.bots) { maxUpgrades(e, b); b.applyUpgrade(abilities[Math.floor(Math.random() * abilities.length)]); b.metaDirty = true; }
            return 'CHAOS MODE. Run.';
        } },
    { name: 'bullethell', tab: 'fun', needs: 'match', desc: 'Fire a ring of 16 bullets non-stop.', on: (e) => !!e.admin?.bulletHell,
        run: (e) => { e.admin.bulletHell = !e.admin.bulletHell; return `Bullet hell ${e.admin.bulletHell ? 'ON' : 'OFF'}.`; } },
    { name: 'spin', tab: 'fun', needs: 'match', desc: 'Your ship spins and sprays bullets everywhere.', on: (e) => !!e.admin?.spin,
        run: (e) => { e.admin.spin = !e.admin.spin; return `Spin ${e.admin.spin ? 'ON' : 'OFF'}.`; } },
    { name: 'rainbow', tab: 'fun', needs: 'match', desc: 'Your ship cycles through every colour.', on: (e) => !!e.admin?.rainbow,
        run: (e) => {
            e.admin.rainbow = !e.admin.rainbow;
            if (!e.admin.rainbow) e.player.applyLoadout(e.player.equipped);
            return `Rainbow ${e.admin.rainbow ? 'ON' : 'OFF'}.`;
        } },
    { name: 'disco', tab: 'fun', needs: 'match', desc: 'Every ship changes colour to the beat.', on: (e) => !!e.admin?.disco,
        run: (e) => { e.admin.disco = !e.admin.disco; return `Disco ${e.admin.disco ? 'ON' : 'OFF'}.`; } },
    { name: 'party', tab: 'fun', needs: 'match', desc: '8 seconds of confetti, disco and bass.',
        run: (e) => { e.admin.party = 480; return 'PARTY TIME!'; } },
    { name: 'jackpot', tab: 'fun', needs: 'world', desc: 'Rain 600 orbs and a slot machine on you.',
        run: (e) => {
            for (let i = 0; i < 600; i++) e.orbs.push(new Orb(e.player.x, e.player.y, 'xp', 2, 350));
            e.slotMachines = [new LuckySlotMachine(e.player.x + 120, e.player.y)];
            return 'JACKPOT!';
        } },

    // ---------- PROGRESS (saved to your account) ----------
    { name: 'level', tab: 'progress', arg: num(50, 'level'), desc: 'Set your season level.',
        run: (e, n) => { devSetLevel(n); return `Season level set to ${n}.`; } },
    { name: 'xp', tab: 'progress', arg: num(5000, 'XP'), desc: 'Add season XP.',
        run: (e, n) => { const levels = addAccountXP(n); emit('profile:changed'); scheduleSave(); return `Added ${n} XP${levels.length ? ` (now level ${state.profile.level})` : ''}.`; } },
    { name: 'claimall', tab: 'progress', desc: 'Unlock every cosmetic.',
        run: () => { devUnlockAll(); return 'Unlocked all cosmetics!'; } },
    { name: 'mastery', tab: 'progress', arg: text('all', 'class or all'), desc: 'Give a class (or all) the 500 kills for mastery.',
        run: (e, cls) => {
            const types = cls === 'all' ? CLASS_TYPES : [{ jet: 'triangle', tank: 'square', soldier: 'circle' }[cls] || cls];
            if (!types.every(isClassType)) throw new Error('Use triangle, square, circle (or jet, tank, soldier) or all.');
            for (const t of types) state.profile.classStats[t].kills = Math.max(500, state.profile.classStats[t].kills);
            emit('profile:changed');
            scheduleSave();
            return `Mastery unlocked for ${cls}. Claim it in Quests.`;
        } },
    { name: 'questsdone', tab: 'progress', desc: 'Finish today\'s and this week\'s quests.',
        run: () => {
            const rewards = completeAllQuests();
            addAccountXP(rewards.reduce((sum, r) => sum + (r.xp || 0), 0));
            emit('profile:changed');
            const quests = rewards.filter(r => r.kind === 'quest').length;
            return `Finished ${quests} quests (+${rewards.length - quests} bonus rewards).`;
        } },
    { name: 'questsreset', tab: 'progress', desc: 'Start today\'s and this week\'s quests over.',
        run: () => { resetQuests(); emit('profile:changed'); return 'Quest progress reset.'; } },
    { name: 'tutorial', tab: 'progress', desc: 'Play the tutorial again in your next solo match.',
        run: () => { setTutorialDone(false); return 'The tutorial will play in your next solo match.'; } },
    { name: 'hourlykills', tab: 'progress', arg: num(100, 'kills'), desc: 'Set this hour\'s kills (hourly shop).',
        run: (e, n) => { devSetHourly('kills', n); return `Hourly kills set to ${n}.`; } },
    { name: 'hourlydist', tab: 'progress', arg: num(1000000, 'distance'), desc: 'Set this hour\'s distance (hourly shop).',
        run: (e, n) => { devSetHourly('distance', n); return `Hourly distance set to ${n}.`; } },
    { name: 'hourlytime', tab: 'progress', arg: num(3000, 'seconds'), desc: 'Set this hour\'s time alive (hourly shop).',
        run: (e, n) => { devSetHourly('time', n); return `Hourly time set to ${n}.`; } },
    { name: 'hourlypoints', tab: 'progress', arg: num(30000, 'points'), desc: 'Set this hour\'s points (hourly shop).',
        run: (e, n) => { devSetHourly('points', n); return `Hourly points set to ${n}.`; } },

    // ---------- OTHER ----------
    { name: 'reset', tab: 'match', desc: 'Switch off every admin effect (god, slow motion, zoom, rainbow...).',
        run: (e) => {
            e.admin?.clear();
            e.timeScale = 1;
            e.zoomTarget = 1;
            e.adminPacifist = false;
            for (const b of e.bots) if (b.frozenSpeed !== undefined) { b.speed = b.frozenSpeed; delete b.frozenSpeed; }
            if (e.player) {
                e.player.adminGod = false;
                e.player.isCloaked = false;
                if (!e.isDemo) e.player.applyLoadout(e.player.equipped);
            }
            return 'Admin effects off.';
        } },
    { name: 'help', tab: 'other', desc: 'List every command in the console.', consoleOnly: true,
        run: () => `Commands: ${COMMANDS.map(c => `/${c.name}`).join(', ')}. Press / twice for the menu.` },
    { name: 'close', tab: 'other', desc: 'Close the console.', consoleOnly: true, run: () => '' }
];

// Old names that still work in the console.
const ALIASES = { kills: 'hourlykills', dist: 'hourlydist', time: 'hourlytime', statpoints: 'hourlypoints', exit: 'close', unfreeze: 'freeze' };

export const findCommand = (name) => {
    const key = String(name || '').replace(/^\//, '').toLowerCase();
    return COMMANDS.find(c => c.name === (ALIASES[key] || key)) || null;
};

// Why a command can't run right now (or null if it can).
export function blockedReason(engine, cmd) {
    const playing = !engine.isDemo && !engine.isGameOver && engine.player && !engine.player.isDead;
    if (!cmd.needs) return null;
    if (!playing) return 'Start a match first.';
    if (cmd.needs === 'solo' && engine.mode !== 'solo') return 'Solo matches only.';
    if (cmd.needs === 'world' && !(engine.mode === 'solo' || engine.ownsWorld)) return 'Solo matches only (or as the match host).';
    return null;
}

// Runs a command. Throws an Error with a readable message if it can't.
export function runCommand(engine, cmd, rawArg) {
    const blocked = blockedReason(engine, cmd);
    if (blocked) throw new Error(blocked);
    let value;
    if (cmd.arg) {
        const given = rawArg === undefined || rawArg === null || String(rawArg).trim() === '' ? cmd.arg.default : rawArg;
        if (cmd.arg.type === 'number') {
            value = Number(given);
            if (!Number.isFinite(value)) throw new Error(`/${cmd.name} needs a number (${cmd.arg.hint}).`);
        } else {
            value = String(given).trim().toLowerCase();
        }
    }
    return cmd.run(engine, value);
}
