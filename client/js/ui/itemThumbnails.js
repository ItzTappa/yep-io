// Little rendered previews for store and locker cards: your ship (in your selected class and
// colour) wearing the item. Banners are emoji, so they keep their emoji icon. Images are cached
// per item, class and colour.
import { escapeHtml } from '../core/dom.js';
import { state } from '../core/state.js';
import { getItem, DEFAULT_BODY_COLOR } from '../data/items.js';
import { Player } from '../entities/Player.js';

const SIZE = 72;          // CSS pixels
const SCALE = 2;          // rendered at 2x for sharp edges
const cache = new Map();

// Ship sizes that fill the card icon without clipping the outline.
const SHIP_SIZE = { circle: 23, square: 33, triangle: 27 };

function render(item, classType, colorId) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE * SCALE;
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);

    const ship = new Player(0, 0, classType, '');
    ship.isPlayer = false;
    ship.color = DEFAULT_BODY_COLOR;
    // Colour items show just the colour; skins and trails are shown on your current colour.
    ship.applyLoadout(item.category === 'Color' ? { Color: item.id } : { Color: colorId, [item.category]: item.id });
    ship.angle = -Math.PI / 4;

    let anchor = 0.5;
    if (item.category === 'Trail') {
        // Fly up-right for a moment so the trail streams out behind (down-left), with a smaller
        // ship so there is room for it.
        ship.size = SHIP_SIZE[classType] * 0.75;
        for (let i = 0; i < 24; i++) {
            ship.vx = 3.2;
            ship.vy = -3.2;
            ship.update();
        }
        anchor = 0.64;
    } else {
        ship.size = SHIP_SIZE[classType];
    }
    // Keep the camera on the ship: the trail stays where it was left behind.
    ctx.translate(SIZE * anchor - ship.x, SIZE * (1 - anchor) - ship.y);
    ship.draw(ctx, { preview: true });
    return canvas.toDataURL();
}

export function thumbnailUrl(itemId, classType = state.selectedClass || 'triangle') {
    const colorId = state.profile.equipped.Color || '';
    const key = `${itemId}|${classType}|${colorId}`;
    if (!cache.has(key)) {
        const item = getItem(itemId);
        cache.set(key, item ? render(item, item.masteryClass || classType, colorId) : '');
    }
    return cache.get(key);
}

// HTML for an item's icon: a rendered preview, or the emoji for banners.
export function itemIconHtml(item) {
    if (!item) return '✖';
    if (item.category === 'Banner') return escapeHtml(item.icon);
    return `<img class="item-thumb" src="${thumbnailUrl(item.id)}" alt="${escapeHtml(item.name)}" draggable="false">`;
}
