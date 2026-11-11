// Season Store (unlock by account level) and the Hourly Rotation shop (unlock by this hour's stats).
// Unlocked items are claimed by holding the HOLD TO CLAIM button for one second.
import { $, escapeHtml } from '../core/dom.js';
import { state } from '../core/state.js';
import { on } from '../core/events.js';
import { sounds } from '../core/sound.js';
import { ITEMS_DB, SEASON_ITEM_IDS, SEASON_MAX_LEVEL, getItem, itemColor } from '../data/items.js';
import { canClaim, claimItem, isClaimed, toggleEquip } from '../services/profile.js';
import { getShop, hourlyProgress, msUntilRotation } from '../services/shop.js';
import { openPreview } from './previews.js';

const HOLD_MS = 1000;

export function initStores() {
    for (const id of ['season', 'store']) {
        const root = $(id);
        root.addEventListener('click', (e) => {
            const target = e.target instanceof Element ? e.target : null;
            const equip = target?.closest('.btn-equip');
            const icon = target?.closest('.item-icon[data-id]');
            if (equip) {
                const item = getItem(equip.dataset.id);
                if (item) toggleEquip(item.category, item.id);
            } else if (icon && getItem(icon.dataset.id)?.category !== 'Banner') {
                openPreview(icon.dataset.id);
            }
        });
        root.addEventListener('pointerdown', startHold);
    }
    window.addEventListener('pointerup', cancelHold);
    window.addEventListener('pointercancel', cancelHold);

    on('profile:changed', renderStores);
    on('shop:rotated', renderStores);
    on('tab:changed', (tab) => { if (tab === 'season' || tab === 'store') renderStores(); });

    updateTimer();
    setInterval(updateTimer, 1000);
    renderStores();
}

export function renderStores() {
    renderSeason();
    renderShop();
}

function updateTimer() {
    const secs = Math.floor(msUntilRotation() / 1000);
    $('shop-timer').textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

function itemCard(item, color, { unlocked, reqText, footer }) {
    const previewable = item.category !== 'Banner';
    return `
        <div class="store-item ${unlocked ? 'unlocked' : 'locked'}" style="--rarity-color: ${color};">
            <div class="item-icon ${previewable ? '' : 'not-previewable'}" data-id="${item.id}" ${previewable ? 'title="Click to Preview"' : ''}>${item.icon}</div>
            <div class="item-category">${item.category}</div>
            <div class="item-name">${escapeHtml(item.name)}</div>
            <div class="item-req">${reqText}</div>
            ${footer}
        </div>`;
}

function actionButton(item, unlocked) {
    if (isClaimed(item.id)) {
        const equipped = state.profile.equipped[item.category] === item.id;
        return `<button class="btn-equip ${equipped ? 'equipped' : ''}" data-id="${item.id}">${equipped ? '✓ EQUIPPED' : 'EQUIP'}</button>`;
    }
    if (unlocked) return `<button class="btn-claim" data-id="${item.id}"><div class="fill"></div><span>HOLD TO CLAIM</span></button>`;
    return '';
}

function renderSeason() {
    const level = state.profile.level;
    $('season-progress-bar').style.width = `${Math.min(100, (level / SEASON_MAX_LEVEL) * 100)}%`;
    $('season-grid').innerHTML = SEASON_ITEM_IDS.map(id => {
        const item = ITEMS_DB[id];
        const unlocked = level >= item.req;
        const reqText = isClaimed(id) ? '✓ CLAIMED' : unlocked ? 'UNLOCKED!' : `Requires Level ${item.req}`;
        return itemCard(item, item.color, { unlocked, reqText, footer: actionButton(item, unlocked) });
    }).join('');
}

function renderShop() {
    const progress = hourlyProgress();
    const entries = [...getShop()].sort((a, b) => (ITEMS_DB[b.id].rarity || 1) - (ITEMS_DB[a.id].rarity || 1));
    $('main-store-grid').innerHTML = entries.map(entry => {
        const item = ITEMS_DB[entry.id];
        const color = itemColor(item);
        const value = progress[entry.type] || 0;
        const unlocked = value >= entry.req;
        const reqText = isClaimed(item.id) ? '✓ CLAIMED' : unlocked ? 'UNLOCKED!' : `${Math.floor(value)} / ${entry.req} ${entry.label}`;
        const footer = actionButton(item, unlocked) || `
            <div class="item-progress-bg">
                <div class="item-progress-fill" style="width: ${Math.min(100, (value / entry.req) * 100)}%;"></div>
            </div>`;
        return itemCard(item, color, { unlocked, reqText, footer });
    }).join('');
}

// ---------- hold to claim ----------

let hold = null;

function startHold(e) {
    const btn = e.target instanceof Element ? e.target.closest('.btn-claim') : null;
    if (!btn) return;
    e.preventDefault();
    cancelHold();
    const card = btn.closest('.store-item');
    btn.classList.add('holding');
    card?.classList.add('shaking');
    hold = {
        btn,
        card,
        timer: setTimeout(() => {
            const id = btn.dataset.id;
            hold = null;
            btn.classList.remove('holding');
            card?.classList.remove('shaking');
            if (!canClaim(id)) return;
            card?.classList.add('claimed-pop');
            sounds.play('ui_claim', { category: 'ui' });
            setTimeout(() => claimItem(id), 300);
        }, HOLD_MS)
    };
}

function cancelHold() {
    if (!hold) return;
    clearTimeout(hold.timer);
    hold.btn.classList.remove('holding');
    hold.card?.classList.remove('shaking');
    hold = null;
}
