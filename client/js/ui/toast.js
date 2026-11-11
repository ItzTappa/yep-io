// The message line at the bottom of the menus (errors, class descriptions, lobby messages).
import { $ } from '../core/dom.js';
import { sounds } from '../core/sound.js';

let hideTimer = null;

export function showToast(text, { color = 'var(--accent)', ms = 4000 } = {}) {
    const el = $('menu-toast');
    el.textContent = text;
    el.style.color = color;
    el.classList.remove('hidden', 'fade-out');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => el.classList.add('fade-out'), ms);
}

export function showError(text) {
    sounds.play('ui_error', { category: 'ui' });
    showToast(text, { color: 'red', ms: 2000 });
}

export function hideToast() {
    clearTimeout(hideTimer);
    $('menu-toast').classList.add('fade-out');
}
