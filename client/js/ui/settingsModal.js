// The ⚙️ settings popup: graphics/HUD toggles, master volume and key bindings.
import { $, setVisible } from '../core/dom.js';
import { settings, saveSettings, keyLabel, DEFAULT_KEYBINDS } from '../core/settings.js';
import { sounds } from '../core/sound.js';
import { setTutorialDone } from '../services/profile.js';

let listeningFor = null;   // action waiting for a key press
let onApplyHook = null;
const RESERVED_KEYS = ['escape', '/', '`', '1', '2', '3', '=', '+', '-', '_'];

export function initSettingsModal({ onApply }) {
    onApplyHook = onApply;
    $('settings-btn').addEventListener('click', openSettings);
    $('close-settings-btn').addEventListener('click', applyAndClose);
    $('set-volume').addEventListener('input', (e) => sounds.setVolume(Number(e.target.value) / 100));

    document.querySelectorAll('.keybind-btn').forEach(btn => btn.addEventListener('click', () => {
        stopListening();
        listeningFor = btn.dataset.action;
        btn.classList.add('listening');
        btn.textContent = 'PRESS KEY';
    }));
    $('reset-keybinds-btn').addEventListener('click', () => {
        settings.keybinds = { ...DEFAULT_KEYBINDS };
        stopListening();
    });
    $('replay-tutorial-btn').addEventListener('click', () => {
        setTutorialDone(false);
        $('replay-tutorial-btn').textContent = '✔ TUTORIAL IN YOUR NEXT SOLO MATCH';
    });

    // Capture phase so the key never reaches the game or the dev console.
    window.addEventListener('keydown', (e) => {
        if (!listeningFor) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const key = e.key.toLowerCase();
        if (key !== 'escape' && !RESERVED_KEYS.includes(key)) {
            // If another action already uses this key, swap them.
            const clash = Object.keys(settings.keybinds).find(a => a !== listeningFor && settings.keybinds[a] === key);
            if (clash) settings.keybinds[clash] = settings.keybinds[listeningFor];
            settings.keybinds[listeningFor] = key;
        }
        stopListening();
    }, true);
}

export function openSettings() {
    for (const input of document.querySelectorAll('#settings-modal input[data-setting]')) {
        input.checked = !!settings[input.dataset.setting];
    }
    $('set-volume').value = Math.round(settings.volume * 100);
    $('replay-tutorial-btn').textContent = 'REPLAY TUTORIAL';
    stopListening();
    setVisible($('settings-modal'), true);
}

// Saves everything on screen and closes (the button, or Esc).
export function applyAndClose() {
    applyControls();
    saveSettings();
    onApplyHook?.();
    stopListening();
    setVisible($('settings-modal'), false);
}

export const isSettingsOpen = () => !$('settings-modal').classList.contains('hidden');
export const isBindingKey = () => listeningFor !== null;

function applyControls() {
    for (const input of document.querySelectorAll('#settings-modal input[data-setting]')) {
        settings[input.dataset.setting] = input.checked;
    }
    settings.volume = Number($('set-volume').value) / 100;
    sounds.setVolume(settings.volume);
}

function stopListening() {
    listeningFor = null;
    document.querySelectorAll('.keybind-btn').forEach(btn => {
        btn.classList.remove('listening');
        btn.textContent = keyLabel(settings.keybinds[btn.dataset.action]);
    });
}
