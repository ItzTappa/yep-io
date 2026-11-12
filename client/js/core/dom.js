// DOM helpers used by the menus and HUD.
export const $ = (id) => document.getElementById(id);

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
// Always run text that came from another player (names, etc.) through this before using innerHTML.
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

export function setVisible(el, visible) {
    if (el) el.classList.toggle('hidden', !visible);
}

export function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
}

// Slide-in notification boxes (.notif-box): show now, hide after `ms`. Returns a hide function.
// Showing a box again cancels its earlier timers (otherwise the old "finish hiding" timer would
// switch the new message off a moment after it appeared).
export function slideIn(box, ms, { removeWhenDone = false } = {}) {
    clearTimeout(box.slideHideTimer);
    clearTimeout(box.slideRemoveTimer);
    box.classList.remove('hidden', 'show');
    box.classList.add('active');
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('show')));

    const hide = () => {
        clearTimeout(box.slideHideTimer);
        box.classList.remove('show');
        box.slideRemoveTimer = setTimeout(() => {
            box.classList.remove('active');
            if (removeWhenDone) box.remove();
        }, 400);
    };
    if (ms) box.slideHideTimer = setTimeout(hide, ms);
    box.hideNotif = hide;
    return hide;
}

// Sizes a canvas for crisp drawing on high-DPI screens. Draw in CSS pixels afterwards.
export function setupHiDpiCanvas(canvas, width, height) {
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
}
