// The tutorial: a training arena of its own (the first time you press PLAY, or Settings > Play
// Tutorial). You can't die here (GameEngine keeps you above 0 health). Each step spawns what it
// teaches (a marker to fly to, targets, orbs, a safe zone, a Lucky Slot, a training bot), points an
// arrow at it, and clears it away once the step is done.
import { settings, keyLabel } from '../core/settings.js';
import { sounds } from '../core/sound.js';
import { distance } from '../core/math.js';
import { abilityName } from '../data/upgrades.js';
import { Orb, LuckySlotMachine } from '../entities/pickups.js';
import { SafeZone } from '../entities/SafeZone.js';
import { showTutorialStep, markTutorialStepDone, hideTutorial, onTutorialAction } from './hud/tutorialPanel.js';

const DONE_PAUSE_TICKS = 55;      // the green check before the next step
const INFO_AUTO_TICKS = 60 * 12;  // info steps move on by themselves after this long
const ARROW_MIN_DISTANCE = 230;   // no arrow when the thing is already close
const STARTER_ABILITY = 'bullet_nova';

const kbd = (key) => `<kbd>${keyLabel(key)}</kbd>`;

const STEPS = [
    {
        id: 'welcome',
        info: true,
        title: 'WELCOME TO THE TRAINING ARENA',
        text: () => 'This is a practice map just for you, and <b>you can\'t die here</b>. '
            + 'Each step shows you one part of the game.'
    },
    {
        id: 'move',
        title: 'MOVE',
        text: (touch, k) => `${touch ? 'Drag on the left side of the screen' : `Use ${kbd(k.up)} ${kbd(k.left)} ${kbd(k.down)} ${kbd(k.right)}`} to fly. Reach the glowing markers.`,
        start: (t) => t.placeWaypoints(),
        objective: (t) => t.waypoints[0] || null,
        done: (t) => t.waypoints.length === 0
    },
    {
        id: 'shoot',
        title: 'AIM & SHOOT',
        text: (touch) => `Your ship shoots by itself, ${touch ? 'wherever you drag on the right side of the screen' : 'wherever your mouse points'}. Destroy the 3 targets.`,
        start: (t) => t.spawnTargets(3),
        objective: (t) => t.nearest(t.targets),
        done: (t) => t.alive(t.targets).length === 0
    },
    {
        id: 'orbs',
        title: 'COLLECT ORBS',
        text: () => 'Orbs give you points. Points fill the bar at the top, and a full bar means an upgrade. Fly through the orbs.',
        start: (t) => t.spawnOrbs('xp', 45, 320, 140),
        objective: (t) => t.nearest(t.liveOrbs()),
        done: (t) => t.player.upgradeCount > 0,
        cleanup: (t) => t.clearOrbs()
    },
    {
        id: 'upgrade',
        title: 'PICK AN UPGRADE',
        text: (touch) => (touch ? 'Your bar is full! Tap one of the cards at the bottom to upgrade your ship.'
            : `Your bar is full! Press ${kbd('1')}, ${kbd('2')} or ${kbd('3')} to pick one of the upgrade cards.`),
        done: (t) => t.counts.upgrades > 0
    },
    {
        id: 'dash',
        title: 'DASH',
        text: (touch, k) => `${touch ? 'Tap DASH' : `Press ${kbd(k.dash)}`} for a quick burst of speed. It costs 2 points, so save it for dodging and escaping.`,
        start: (t) => { t.player.points = Math.max(t.player.points, 6); },
        done: (t) => t.counts.dashes > t.stepStart.dashes
    },
    {
        id: 'heal',
        title: 'HEALTH ORBS',
        text: () => 'Ouch, you took damage! Your health is the bar under your ship. <b>Blue orbs heal you</b>, so grab them.',
        start: (t) => {
            t.player.health = t.player.maxHealth * 0.35;
            t.player.hitFlashAt = performance.now();
            t.spawnOrbs('health', 8, 300, 110);
        },
        objective: (t) => t.nearest(t.liveOrbs()),
        done: (t) => t.player.health >= t.player.maxHealth * 0.85 || t.counts.healthOrbs - t.stepStart.healthOrbs >= 5,
        cleanup: (t) => t.clearOrbs()
    },
    {
        id: 'zone',
        title: 'SAFE ZONES',
        text: () => 'Safe zones heal you and keep enemies out, but <b>your guns don\'t work inside</b>. '
            + 'Stand in this one for 3 seconds to switch it on.',
        start: (t) => {
            t.player.health = Math.min(t.player.health, t.player.maxHealth * 0.6);
            const at = t.spotAhead(480);
            t.zone = new SafeZone(at.x, at.y);
            t.engine.safeZones.push(t.zone);
        },
        objective: (t) => t.zone,
        done: (t) => t.zone?.state === 'active' && t.zoneTicks > 90,
        cleanup: (t) => {
            if (t.zone) t.engine.spawnParticles(t.zone.x, t.zone.y, '#00ffcc', 30);
            t.engine.safeZones = t.engine.safeZones.filter(z => z !== t.zone);
            t.zone = null;
        }
    },
    {
        id: 'slot',
        title: 'LUCKY SLOT MACHINE',
        text: () => 'Lucky Slots pop up at random spots during a match. <b>Touch one for a free upgrade!</b>',
        start: (t) => {
            const at = t.spotAhead(450);
            t.slot = new LuckySlotMachine(at.x, at.y);
            t.slot.lifeTimer = Infinity; // never runs out in the tutorial
            t.engine.slotMachines = [t.slot];
        },
        objective: (t) => (t.counts.slots > 0 ? null : t.slot),
        // wait for the reels to stop and show the prize
        done: (t) => t.counts.slots > 0 && t.ticksSince('slots') > 60 * 5.5,
        cleanup: (t) => { t.engine.slotMachines = []; }
    },
    {
        id: 'ability',
        title: 'ABILITIES',
        text: (touch, k, t) => `Some upgrade cards are <b>⭐ abilities</b>. You have <b>${abilityName(t.player.activeAbility || STARTER_ABILITY)}</b>: `
            + `${touch ? 'tap ABILITY' : `press ${kbd(k.ability)}`} to use it. Abilities recharge after each use.`,
        start: (t) => {
            const p = t.player;
            if (!p.activeAbility) {
                p.applyUpgrade(STARTER_ABILITY);
                t.engine.refreshBadges();
            }
            p.abilityCooldown = 0;
        },
        done: (t) => t.counts.abilities > t.stepStart.abilities && t.ticksSince('abilities') > 50
    },
    {
        id: 'fight',
        title: 'FIGHT',
        text: () => 'This training bot <b>fights back</b>. Shoot it until its health bar is empty, and dash to dodge its bullets.',
        start: (t) => t.spawnTrainingBot(),
        objective: (t) => (t.trainingBot && !t.trainingBot.isDead ? t.trainingBot : null),
        done: (t) => !!t.trainingBot && t.trainingBot.isDead
    },
    {
        id: 'complete',
        last: true,
        title: 'TUTORIAL COMPLETE!',
        text: () => 'In a real match you\'ll face 49 other ships. Collect orbs, pick upgrades and be the last one standing. '
            + 'You earned the <b>🎓 Graduate</b> banner!'
    }
];

export class Tutorial {
    // onDone(completed): finished (true) or skipped / left (false). onExit('play' | 'menu').
    constructor(engine, { onDone, onExit }) {
        this.engine = engine;
        this.onDone = onDone;
        this.onExit = onExit;
        this.index = 0;
        this.counts = { upgrades: 0, dashes: 0, healthOrbs: 0, slots: 0, abilities: 0, kills: 0 };
        this.lastStatTick = {};
        this.tick = 0;
        this.waypoints = [];
        this.targets = [];
        this.spawnedOrbs = [];
        this.zone = null;
        this.slot = null;
        this.trainingBot = null;
        this.zoneTicks = 0;
        this.finished = false;
        onTutorialAction((action) => this.onAction(action));
        this.startStep();
    }

    get player() {
        return this.engine.player;
    }

    get step() {
        return STEPS[this.index];
    }

    get touch() {
        return this.engine.input.isTouchDevice || window.matchMedia?.('(pointer: coarse)').matches;
    }

    // ---------- steps ----------

    startStep() {
        const step = this.step;
        this.stepTicks = 0;
        this.doneTicks = 0;
        this.stepStart = { ...this.counts };
        step.start?.(this);
        showTutorialStep({
            step: this.index + 1,
            total: STEPS.length - 1,
            title: step.title,
            html: step.text(this.touch, settings.keybinds, this),
            info: !!step.info,
            last: !!step.last
        });
        if (step.last) this.finish();
    }

    update() {
        const p = this.player;
        if (!p || this.finished) return;
        this.tick++;
        this.stepTicks++;
        const step = this.step;

        if (this.waypoints.length && distance(p.x, p.y, this.waypoints[0].x, this.waypoints[0].y) < 70) {
            this.waypoints.shift();
            sounds.play('xp_pickup', { category: 'ui' });
            this.engine.spawnParticles(p.x, p.y, '#ffe600', 14);
        }
        this.zoneTicks = this.zone && this.zone.contains(p.x, p.y) && this.zone.state === 'active' ? this.zoneTicks + 1 : 0;

        if (this.doneTicks > 0) {
            if (--this.doneTicks === 0) this.next();
            return;
        }
        if (step.info ? this.stepTicks > INFO_AUTO_TICKS : step.done?.(this)) this.completeStep();
    }

    completeStep() {
        this.doneTicks = DONE_PAUSE_TICKS;
        markTutorialStepDone();
        sounds.play('ui_claim', { category: 'ui' });
    }

    next() {
        this.step.cleanup?.(this);
        this.index = Math.min(this.index + 1, STEPS.length - 1);
        this.startStep();
    }

    // The last step: reward and the "what next" buttons.
    finish() {
        this.finished = true;
        this.onDone?.(true);
    }

    onStat(stat) {
        if (stat in this.counts) {
            this.counts[stat]++;
            this.lastStatTick[stat] = this.tick;
        }
    }

    ticksSince(stat) {
        return this.lastStatTick[stat] === undefined ? 0 : this.tick - this.lastStatTick[stat];
    }

    // Buttons in the tutorial box.
    onAction(action) {
        if (action === 'next' && this.step.info && this.doneTicks === 0) this.completeStep();
        else if (action === 'skip') this.leave('play');
        else if (action === 'play' || action === 'menu') this.exit(action);
    }

    // Skip (straight into a real match) or Esc twice (back to the menu).
    leave(choice = 'menu') {
        if (!this.finished) {
            this.finished = true;
            this.onDone?.(false);
        }
        this.exit(choice);
    }

    exit(choice) {
        hideTutorial();
        // Let the click / key handler finish before the engine swaps the world out.
        setTimeout(() => this.onExit?.(choice), 0);
    }

    end() {
        onTutorialAction(null);
        hideTutorial();
    }

    // ---------- spawning what each step teaches ----------

    // A spot `dist` ahead of the player in a direction that stays inside the map.
    spotAhead(dist) {
        const p = this.player;
        const size = this.engine.worldSize;
        const toCenter = Math.atan2(size / 2 - p.y, size / 2 - p.x);
        const away = distance(p.x, p.y, size / 2, size / 2) > size * 0.25;
        const angle = away ? toCenter : (this.tick * 0.37 + this.index) % (Math.PI * 2);
        const clamp = (v) => Math.max(200, Math.min(size - 200, v));
        return { x: clamp(p.x + Math.cos(angle) * dist), y: clamp(p.y + Math.sin(angle) * dist) };
    }

    placeWaypoints() {
        const first = this.spotAhead(520);
        const p = this.player;
        const side = Math.atan2(first.y - p.y, first.x - p.x) + Math.PI / 2;
        const size = this.engine.worldSize;
        const clamp = (v) => Math.max(200, Math.min(size - 200, v));
        this.waypoints = [first, { x: clamp(first.x + Math.cos(side) * 420), y: clamp(first.y + Math.sin(side) * 420) }];
    }

    spawnTargets(count) {
        const center = this.spotAhead(420);
        const p = this.player;
        const facing = Math.atan2(center.y - p.y, center.x - p.x);
        for (let i = 0; i < count; i++) {
            const a = facing + (i - (count - 1) / 2) * 0.5;
            const bot = this.makeDummy(p.x + Math.cos(a) * 420, p.y + Math.sin(a) * 420, 'TARGET');
            bot.maxHealth = bot.health = 45;
            bot.speed = 0;
            bot.fireCooldown = Infinity;   // targets never shoot
            this.targets.push(bot);
        }
    }

    spawnTrainingBot() {
        const at = this.spotAhead(560);
        const bot = this.makeDummy(at.x, at.y, 'TRAINING BOT');
        bot.maxHealth = bot.health = 420;
        bot.baseDamage = 4;
        bot.speed = 3.6;
        bot.fireRate = 32;
        this.trainingBot = bot;
    }

    makeDummy(x, y, name) {
        const bot = this.engine.spawnBot(x, y, 0);
        bot.trainingDummy = true;
        bot.name = name;
        bot.activeAbility = null;
        bot.dashCooldown = Infinity;
        this.engine.hasEnemies = true;
        return bot;
    }

    spawnOrbs(type, count, dist, spread) {
        const at = this.spotAhead(dist);
        for (let i = 0; i < count; i++) {
            const orb = new Orb(at.x, at.y, type, 1, spread);
            if (type === 'health') orb.healPct = 0.1;
            this.engine.orbs.push(orb);
            this.spawnedOrbs.push(orb);
        }
    }

    liveOrbs() {
        return this.spawnedOrbs.filter(o => !o.collected && this.engine.orbs.includes(o));
    }

    clearOrbs() {
        const gone = new Set(this.spawnedOrbs);
        this.engine.orbs = this.engine.orbs.filter(o => !gone.has(o));
        this.spawnedOrbs = [];
    }

    alive(list) {
        return list.filter(b => !b.isDead);
    }

    nearest(list) {
        const p = this.player;
        let best = null;
        let bestD = Infinity;
        for (const thing of list) {
            if (!thing || thing.isDead || thing.collected) continue;
            const d = distance(p.x, p.y, thing.x, thing.y);
            if (d < bestD) {
                bestD = d;
                best = thing;
            }
        }
        return best;
    }

    // ---------- drawing (in the world view) ----------

    draw(ctx) {
        const p = this.player;
        if (!p || this.finished) return;
        const time = performance.now() / 1000;

        for (const [i, wp] of this.waypoints.entries()) {
            const pulse = 1 + Math.sin(time * 4) * 0.08;
            ctx.save();
            ctx.globalAlpha = i === 0 ? 1 : 0.35;
            ctx.strokeStyle = '#ffe600';
            ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(wp.x, wp.y, 46 * pulse, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(255, 230, 0, 0.15)';
            ctx.beginPath(); ctx.arc(wp.x, wp.y, 46 * pulse, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffe600';
            ctx.beginPath(); ctx.arc(wp.x, wp.y, 7, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        // Rings under the targets so they read as "shoot these".
        for (const bot of this.alive(this.targets)) {
            ctx.save();
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 6]);
            ctx.lineDashOffset = -time * 20;
            ctx.beginPath(); ctx.arc(bot.x, bot.y, bot.size + 14, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }

        // An arrow near your ship pointing at what this step is about.
        const goal = this.doneTicks > 0 ? null : this.step.objective?.(this);
        if (goal && distance(p.x, p.y, goal.x, goal.y) > ARROW_MIN_DISTANCE) {
            const a = Math.atan2(goal.y - p.y, goal.x - p.x);
            const r = p.size + 46 + Math.sin(time * 6) * 4;
            ctx.save();
            ctx.translate(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
            ctx.rotate(a);
            ctx.fillStyle = '#ffe600';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(14, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11);
            ctx.closePath();
            ctx.stroke(); ctx.fill();
            ctx.restore();
        }
    }
}
