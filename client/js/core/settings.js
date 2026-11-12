// Player settings, stored in this browser.
import { emit } from './events.js';

const STORAGE_KEY = 'yepio_settings';

export const DEFAULT_KEYBINDS = { up: 'w', down: 's', left: 'a', right: 'd', dash: ' ', ability: 'e' };

export const DEFAULT_SETTINGS = {
    highQuality: true,
    particles: true,
    showNames: true,
    showFps: false,
    volume: 1.0,
    showLeaderboard: true,
    showBadges: true,
    showNotifs: true,
    showMinimap: true,
    damageNumbers: true,
    keybinds: { ...DEFAULT_KEYBINDS }
};

function loadSettings() {
    let saved = {};
    try {
        saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
        saved = {};
    }
    // Merge over the defaults so settings added in newer versions get a value.
    return {
        ...DEFAULT_SETTINGS,
        ...saved,
        keybinds: { ...DEFAULT_KEYBINDS, ...(saved.keybinds || {}) }
    };
}

export const settings = loadSettings();

export function saveSettings() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // Storage can be blocked (private mode); settings still work for this session.
    }
    emit('settings:changed', settings);
}

export const keyLabel = (key) => (key === ' ' ? 'SPACE' : String(key).toUpperCase());
