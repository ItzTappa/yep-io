// The Lucky Slot spin animation (bottom right of the HUD). The prize itself is rolled in
// game/systems/slotMachines.js once the reels stop.
import { $, setVisible } from '../core/dom.js';
import { sounds } from '../core/sound.js';

const SPIN_MS = 4000;
const SHOW_RESULT_MS = 3000;
let timers = [];

export function playSlotMachine(engine) {
    timers.forEach(clearTimeout);
    timers = [];

    const ui = $('slot-machine-ui');
    const result = $('slot-result');
    const lever = $('slot-lever');
    const reels = ['reel-1', 'reel-2', 'reel-3'].map(id => $(id));

    setVisible(ui, true);
    ui.style.opacity = '1';
    setVisible(result, false);
    lever.classList.remove('pulled');
    void lever.offsetWidth; // restart the CSS animation
    lever.classList.add('pulled');
    sounds.play('slot_spin', { category: 'ui' });

    for (const reel of reels) {
        reel.classList.add('spinning');
        reel.style.background = '';
        reel.style.boxShadow = '';
    }

    timers.push(setTimeout(() => {
        reels.forEach(r => r.classList.remove('spinning'));
        const reward = engine.awardSlotMachine();
        if (!reward) {
            setVisible(ui, false);
            return;
        }
        for (const reel of reels) {
            reel.style.background = reward.color;
            reel.style.boxShadow = `inset 0 0 10px rgba(0,0,0,0.8), 0 0 15px ${reward.color}`;
        }
        result.textContent = reward.text;
        result.style.color = reward.color;
        setVisible(result, true);
        sounds.play('slot_win', { category: 'alert' });

        timers.push(setTimeout(() => {
            ui.style.opacity = '0';
            timers.push(setTimeout(() => setVisible(ui, false), 300));
        }, SHOW_RESULT_MS));
    }, SPIN_MS));
}

export function hideSlotMachine() {
    timers.forEach(clearTimeout);
    timers = [];
    setVisible($('slot-machine-ui'), false);
}
