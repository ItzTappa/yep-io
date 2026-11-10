// The Locker tab: four slots (Skin, Trail, Banner, Color); pick one to see and equip what you own.
import { $, escapeHtml, setVisible } from '../core/dom.js';
import { state } from '../core/state.js';
import { on } from '../core/events.js';
import { CATEGORIES, getItem, itemColor, isOwnerName } from '../data/items.js';
import { toggleEquip } from '../services/profile.js';
import { openPreview } from './previews.js';
import { itemIconHtml } from './itemThumbnails.js';

let category = null;

export const lockerCategory = () => category;

export function initLocker() {
    const root = $('locker');
    root.addEventListener('click', (e) => {
        const target = e.target instanceof Element ? e.target : null;
        if (!target) return;
        const slot = target.closest('.locker-slot');
        const equip = target.closest('.btn-equip');
        const icon = target.closest('.item-icon[data-id]');
        if (slot) {
            category = slot.dataset.category;
            renderLocker();
        } else if (target.closest('#locker-back-btn')) {
            category = null;
            renderLocker();
        } else if (equip) {
            toggleEquip(category, equip.dataset.id || null);
        } else if (icon) {
            openPreview(icon.dataset.id);
        }
    });
    on('profile:changed', renderLocker);
    on('class:changed', renderLocker);
    on('tab:changed', (tab) => { if (tab === 'locker') renderLocker(); });
    renderLocker();
}

function renderLocker() {
    const equipped = state.profile.equipped;
    setVisible($('locker-slots-view'), category === null);
    setVisible($('locker-items-view'), category !== null);

    if (category === null) {
        $('locker-slots-view').innerHTML = CATEGORIES.map(cat => {
            const item = getItem(equipped[cat]);
            return `
                <div class="locker-slot" data-category="${cat}" style="--slot-color: ${itemColor(item)};">
                    <div class="slot-header">${cat}</div>
                    <div class="slot-icon">${item ? itemIconHtml(item) : '✖'}</div>
                    <div class="slot-name">${escapeHtml(item?.name || 'Default')}</div>
                </div>`;
        }).join('');
        return;
    }

    $('locker-category-title').textContent = `CHOOSE ${category}`;
    const isDefault = !equipped[category];
    const owned = Object.keys(state.profile.unlocked)
        .map(getItem)
        .filter(item => item && item.category === category && (!item.masteryClass || item.masteryClass === state.selectedClass))
        .filter(item => !item.ownerOnly || isOwnerName(state.account.username))
        .sort((a, b) => (b.rarity || 1) - (a.rarity || 1));

    $('locker-item-grid').innerHTML = `
        <div class="store-item unlocked" style="--rarity-color: #888;">
            <div class="item-icon">✖</div>
            <div class="item-category">DEFAULT</div>
            <div class="item-name">None</div>
            <button class="btn-equip ${isDefault ? 'equipped' : ''}" data-id="">${isDefault ? '✓ EQUIPPED' : 'EQUIP'}</button>
        </div>` + owned.map(item => {
        const isEquipped = equipped[category] === item.id;
        return `
            <div class="store-item unlocked" style="--rarity-color: ${itemColor(item)};">
                <div class="item-icon" data-id="${item.id}" title="Click to Preview">${itemIconHtml(item)}</div>
                <div class="item-category">${item.category}</div>
                <div class="item-name">${escapeHtml(item.name)}</div>
                <button class="btn-equip ${isEquipped ? 'equipped' : ''}" data-id="${item.id}">${isEquipped ? '✓ EQUIPPED' : 'EQUIP'}</button>
            </div>`;
    }).join('');
}
