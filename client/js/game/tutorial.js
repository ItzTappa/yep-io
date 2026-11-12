// The first-match tutorial: short steps at the top of the screen (move, aim, orbs, upgrade, dash,
// fight). Runs in your first solo match, or the next one after Settings > Replay Tutorial.
// Bots leave you alone until the FIGHT step so new players have time to learn the controls.
import { settings, keyLabel } from '../core/settings.js';
import { sounds } from '../core/sound.js';
import { angleDiff } from '../core/math.js';
import { showTutorialStep, markTutorialStepDone, hideTutorial, onTutorialSkip } from './hud/tutorialPanel.js';

const DONE_PAUSE_TICKS = 50;     // the green "done" flash before the next step
const FINAL_MESSAGE_TICKS = 540;
const FIGHT_TIMEOUT_TICKS = 60 * 90;

const kbd = (key) => `<kbd>${keyLabel(key)}</kbd>`;

const STEPS = [
    {
        id: 'move',
        title: 'MOVE',
        text: (touch, k) => (touch
            ? 'Drag on the left side of the screen to fly around.'
            : `Use ${kbd(k.up)} ${kbd(k.left)} ${kbd(k.down)} ${kbd(k.right)} to fly around.`),
        done: (t) => t.engine.matchStats.distance - t.stepStart.distance > 600
    },
    {
        id: 'aim',
        title: 'AIM',
        text: (touch) => (touch
            ? 'Your ship shoots on its own. Drag on the right side of the screen to aim.'
            : 'Your ship shoots on its own. Move your mouse to aim.'),
        done: (t) => t.turned > 5 || t.ticks > 60 * 8
    },
    {
        id: 'orbs',
        title: 'COLLECT ORBS',
        text: () => 'Fly through the glowing orbs to earn points. They fill the bar at the top.',
        done: (t) => t.engine.player.upgradeCount > 0
    },
    {
        id: 'upgrade',
        title: 'PICK AN UPGRADE',
        text: (touch) => (touch
            ? 'Your bar is full! Tap one of the cards to upgrade your ship.'
            : `Your bar is full! Press ${kbd('1')}, ${kbd('2')} or ${kbd('3')} to pick an upgrade.`),
        done: (t) => t.counts.upgrades > 0
    },
    {
        id: 'dash',
        title: 'DASH',
        text: (touch, k) => (touch
            ? 'Tap DASH for a quick burst of speed. Each dash costs 2 points.'
            : `Press ${kbd(k.dash)} to dash. Each dash costs 2 points.`),
        done: (t) => t.counts.dashes > t.stepStart.dashes
    },
    {
        id: 'fight',
        title: 'FIGHT',
        text: () => 'Shoot other ships to destroy them and take their points. Destroy one!',
        done: (t) => t.counts.kills > 0 || t.ticks > FIGHT_TIMEOUT_TICKS
    }
];

const FINAL = {
    title: "YOU'RE READY!",
    text: (touch, k) => `Some upgrade cards give a <b>⭐ ability</b>: use it with ${touch ? 'the ABILITY button' : kbd(k.ability)}. `
        + 'Safe zones heal you, but your weapons are off inside. Good luck!'
};

export class Tutorial {
    // onDone(): finished or skipped (saved so it doesn't show again).
    constructor(engine, { onDone }) {
        this.engine = engine;
        this.onDone = onDone;
        this.index = 0;
        this.counts = { upgrades: 0, dashes: 0, kills: 0 };
        this.finished = false;
        this.finalTicks = 0;
        onTutorialSkip(() => this.skip());
        this.startStep();
    }

    get touch() {
        return this.engine.input.isTouchDevice || window.matchMedia?.('(pointer: coarse)').matches;
    }

    // Bots ignore you until the FIGHT step.
    get calm() {
        return !this.finished && this.index < STEPS.findIndex(s => s.id === 'fight');
    }

    startStep() {
        const step = STEPS[this.index];
        this.ticks = 0;
        this.turned = 0;
        this.doneTicks = 0;
        this.lastAngle = this.engine.player.angle;
        this.stepStart = { distance: this.engine.matchStats.distance, dashes: this.counts.dashes };
        showTutorialStep({
            step: this.index + 1,
            total: STEPS.length,
            title: step.title,
            html: step.text(this.touch, settings.keybinds)
        });
    }

    onStat(stat) {
        if (stat in this.counts) this.counts[stat]++;
    }

    update() {
        const p = this.engine.player;
        if (!p || p.isDead) return;
        if (this.finished) {
            if (this.finalTicks > 0 && --this.finalTicks === 0) hideTutorial();
            return;
        }
        this.ticks++;
        this.turned += Math.abs(angleDiff(p.angle, this.lastAngle));
        this.lastAngle = p.angle;

        if (this.doneTicks > 0) {
            if (--this.doneTicks === 0) this.next();
            return;
        }
        if (STEPS[this.index].done(this)) {
            this.doneTicks = DONE_PAUSE_TICKS;
            markTutorialStepDone();
            sounds.play('ui_claim', { category: 'ui' });
        }
    }

    next() {
        this.index++;
        if (this.index < STEPS.length) {
            this.startStep();
            return;
        }
        this.finished = true;
        this.finalTicks = FINAL_MESSAGE_TICKS;
        showTutorialStep({ title: FINAL.title, html: FINAL.text(this.touch, settings.keybinds), last: true });
        this.onDone?.();
    }

    skip() {
        if (this.finished) return;
        this.finished = true;
        hideTutorial();
        this.onDone?.();
    }

    // The match ended (or you left): take the box away.
    end() {
        onTutorialSkip(null);
        hideTutorial();
    }
}
