// Main menu shell: the tab bar, class selection, the PLAY button, the season level box,
// and the hover/click sounds for every button.
import { $, setVisible } from '../core/dom.js';
import { state } from '../core/state.js';
import { on, emit } from '../core/events.js';
import { sounds } from '../core/sound.js';
import { CLASS_INFO } from '../data/classes.js';
import { onClassChanged, xpForNextLevel } from '../services/profile.js';
import { network } from '../services/network.js';
import { showToast, showError, hideToast } from './toast.js';
import { openMasteryModal } from './masteryModal.js';
import { setModeListOpen } from './lobbyScreen.js';

let currentTab = 'lobby';
const FOOTER_TABS = ['lobby', 'multiplayer', 'season', 'store'];

export const activeTab = () => currentTab;
export const isMenuOpen = () => !$('main-menu').classList.contains('hidden');

export function requireClass() {
    if (state.selectedClass) return true;
    showError('PLEASE SELECT A CLASS FIRST!');
    return false;
}

export function initMenu({ onPlay }) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.target));
    });

    document.querySelectorAll('.class-btn').forEach(btn => {
        btn.addEventListener('click', () => selectClass(btn.dataset.class));
    });

    $('play-btn').addEventListener('click', () => {
        if (requireClass()) onPlay(state.selectedClass);
    });

    // UI sounds for anything clickable in the menus.
    const isClickable = (el) => el.closest('button, .tab-btn, .item-icon, .locker-slot');
    document.addEventListener('mouseover', (e) => {
        if (e.target instanceof Element && isClickable(e.target) && !isClickable(e.relatedTarget instanceof Element ? e.relatedTarget : document.body)) {
            sounds.play('ui_hover', { category: 'ui' });
        }
    });
    document.addEventListener('click', (e) => {
        if (e.target instanceof Element && isClickable(e.target)) sounds.play('ui_click', { category: 'ui' });
    });

    on('profile:changed', renderLevelBox);
    renderLevelBox();
}

function selectClass(classType) {
    // Clicking your current class opens its mastery progress.
    if (state.selectedClass === classType) {
        openMasteryModal(classType);
        return;
    }
    chooseClass(classType);
}

// Makes `classType` the selected class (also used by the Quests tab to equip a mastery skin).
export function chooseClass(classType) {
    state.selectedClass = classType;
    document.querySelectorAll('.class-btn').forEach(b => b.classList.toggle('active', b.dataset.class === classType));
    onClassChanged(classType);
    network.updateLoadout({ classType });
    emit('class:changed', classType);
    showToast(CLASS_INFO[classType].description);
}

export function switchTab(target) {
    if (target === 'multiplayer' && !requireClass()) return false;
    currentTab = target;
    hideToast();
    // On the Multiplayer tab the message sits above the LEAVE / READY buttons.
    $('menu-toast').classList.toggle('raised', target === 'multiplayer');

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.target === target));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === target));

    // Season level, profile and settings only on the play and shop tabs.
    setVisible(document.querySelector('.menu-footer'), FOOTER_TABS.includes(target));
    const multiplayer = target === 'multiplayer';
    setVisible($('mode-picker'), multiplayer);
    if (!multiplayer) setModeListOpen(false);
    setVisible($('footer-center-lobby-controls'), multiplayer);

    emit('tab:changed', target);
    return true;
}

function renderLevelBox() {
    const { level, xp } = state.profile;
    $('menu-level').textContent = level;
    $('menu-xp-bar').style.width = `${Math.min(100, (xp / xpForNextLevel(level)) * 100)}%`;
}
