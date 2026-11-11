// Spinning ship previews in the menus: the locker, the full-screen item preview, and the
// multiplayer lobby slots. One animation loop draws whichever of them is visible.
import { $, setVisible, setupHiDpiCanvas } from '../core/dom.js';
import { state } from '../core/state.js';
import { getItem, bodyColorFor, loadoutForClass } from '../data/items.js';
import { Player } from '../entities/Player.js';
import { TICK_MS } from '../config.js';
import { activeTab } from './menu.js';

let previewItemId = null;
let lockerCategory = () => null;
const dummy = new Player(0, 0, 'triangle', '');
let angle = 0;

export function initPreviews({ getLockerCategory }) {
    lockerCategory = getLockerCategory;
    $('close-preview-btn').addEventListener('click', closePreview);
    let last = performance.now();
    let acc = 0;
    const loop = (now) => {
        requestAnimationFrame(loop);
        acc += Math.min(250, Math.max(0, now - last));
        last = now;
        while (acc >= TICK_MS) {
            step();
            acc -= TICK_MS;
        }
        draw();
    };
    requestAnimationFrame(loop);
}

export function openPreview(itemId) {
    const item = getItem(itemId);
    if (!item || item.category === 'Banner') return;
    previewItemId = itemId;
    $('preview-screen-title').textContent = `PREVIEW: ${item.name}`;
    $('preview-screen-category').textContent = item.category;
    setVisible($('item-preview-screen'), true);
}

export function closePreview() {
    previewItemId = null;
    setVisible($('item-preview-screen'), false);
}

export const isPreviewOpen = () => previewItemId !== null;

// Trails only show while moving, so the preview ship circles when a trail is on display.
function step() {
    angle += 0.015;
    const showingTrail = (activeTab() === 'locker' && lockerCategory() === 'Trail') || getItem(previewItemId)?.category === 'Trail';
    if (showingTrail) {
        dummy.vx = Math.cos(angle) * 4;
        dummy.vy = Math.sin(angle) * 4;
    } else {
        dummy.vx = 0;
        dummy.vy = 0;
        dummy.trail = [];
    }
    // The dummy lives at (0, 0); drawDummy() shifts it (and its trail) to each canvas centre.
    dummy.x = 0;
    dummy.y = 0;
    dummy.update();
}

function drawDummy(canvas, cssSize, type, equipped, shipSize) {
    const ctx = setupHiDpiCanvas(canvas, cssSize, cssSize);
    ctx.clearRect(0, 0, cssSize, cssSize);
    dummy.type = type;
    dummy.equipped = loadoutForClass(equipped, type);
    dummy.color = bodyColorFor(dummy.equipped);
    dummy.angle = angle;
    dummy.size = shipSize;
    const center = cssSize / 2;
    const baseX = dummy.x;
    const baseY = dummy.y;
    dummy.x = center;
    dummy.y = center;
    for (const t of dummy.trail) { t.x += center; t.y += center; }
    dummy.draw(ctx, { preview: true });
    for (const t of dummy.trail) { t.x -= center; t.y -= center; }
    dummy.x = baseX;
    dummy.y = baseY;
}

function draw() {
    if ($('main-menu').classList.contains('hidden')) return;
    const myClass = state.selectedClass || 'triangle';

    if (activeTab() === 'locker') {
        drawDummy($('lockerPreviewCanvas'), 300, myClass, state.profile.equipped, 60);
    }

    if (previewItemId) {
        const item = getItem(previewItemId);
        const equipped = { ...state.profile.equipped, [item.category]: item.id };
        // Mastery skins preview on their own class.
        drawDummy($('fullscreenPreviewCanvas'), 350, item.masteryClass || myClass, equipped, 70);
    }

    if (activeTab() === 'multiplayer' && state.lobby) {
        state.lobby.players.forEach((p, i) => {
            const canvas = $(`lobby-canvas-${i}`);
            if (!canvas) return;
            const equipped = p.id === state.myNetId ? state.profile.equipped : p.equipped;
            const type = p.id === state.myNetId ? myClass : p.classType;
            drawDummy(canvas, 140, type, equipped, 35);
        });
    }
}
