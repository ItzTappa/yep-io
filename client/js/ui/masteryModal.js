// Class mastery popup (click your selected class again): 500 kills with a class unlocks its Golden skin.
// The Quests tab shows the same progress (ui/quests.js).
import { $, setVisible } from '../core/dom.js';
import { state } from '../core/state.js';
import { sounds } from '../core/sound.js';
import { MASTERY_KILLS } from '../data/items.js';
import { CLASS_INFO } from '../data/classes.js';
import { claimAndEquipMastery } from '../services/profile.js';

let masteryClass = null;

export function initMasteryModal() {
    $('close-mastery-btn').addEventListener('click', closeMasteryModal);
    $('mastery-equip-btn').addEventListener('click', () => {
        if (masteryClass && claimAndEquipMastery(masteryClass)) {
            sounds.play('mastery_unlock', { category: 'ui' });
            closeMasteryModal();
        }
    });
}

export function openMasteryModal(classType) {
    masteryClass = classType;
    const stats = state.profile.classStats[classType] || { kills: 0, matches: 0 };
    const unlocked = stats.kills >= MASTERY_KILLS;

    $('mastery-class-title').textContent = `${CLASS_INFO[classType].name.toUpperCase()} MASTERY`;
    $('mastery-kills').textContent = stats.kills;
    $('mastery-matches').textContent = stats.matches;
    $('mastery-progress-bar').style.width = `${Math.min(100, (stats.kills / MASTERY_KILLS) * 100)}%`;

    const req = $('mastery-req-text');
    req.textContent = unlocked ? 'MASTERY UNLOCKED!' : `Requires ${MASTERY_KILLS} Kills (${stats.kills}/${MASTERY_KILLS})`;
    req.classList.toggle('unlocked', unlocked);

    const btn = $('mastery-equip-btn');
    btn.disabled = !unlocked;
    btn.textContent = unlocked ? 'EQUIP GOLDEN SKIN' : 'LOCKED';
    setVisible($('mastery-modal'), true);
}

export function closeMasteryModal() {
    setVisible($('mastery-modal'), false);
}
