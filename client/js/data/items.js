// Every cosmetic in the game: season rewards, the hourly shop pool and class mastery skins.
// To add an item, add an entry here. Rotating items (isRotating) can appear in the hourly shop.
// Never delete or rename an id that players may own; retire it from the shop instead (isRotating: false).
//
//   Skin   value = skin design in entities/render/skins.js
//   Trail  value = main colour, style = particle style in entities/render/trails.js (color2 = 2nd colour)
//   Color  value = body colour, finish = special paint in entities/render/finishes.js
//   Banner value = emoji shown before your name
//   icon = emoji used only for Banners and as a fallback (Skins/Trails/Colors show a rendered preview)

export const RARITY_COLORS = {
    1: '#a0a0a0', // Common (Gray)
    2: '#22c55e', // Uncommon (Green)
    3: '#3b82f6', // Rare (Blue)
    4: '#a855f7', // Epic (Purple)
    5: '#f97316'  // Legendary (Orange)
};

const skin = (id, name, rarity, value, icon) => ({ id, name, category: 'Skin', icon, rarity, value, isRotating: true });
const trail = (id, name, rarity, value, style, icon, extra = {}) => ({ id, name, category: 'Trail', icon, rarity, value, style, isRotating: true, ...extra });
const color = (id, name, rarity, value, icon, extra = {}) => ({ id, name, category: 'Color', icon, rarity, value, isRotating: true, ...extra });

export const ITEMS_DB = {
    // ==========================================
    // SEASON STORE ITEMS (Static - Unlocked by Level)
    // ==========================================
    's_banner': { id: 's_banner', name: 'Veteran', category: 'Banner', icon: '🏴', rarity: 2, color: RARITY_COLORS[2], req: 10, value: '🏴' },
    's_trail':  { id: 's_trail',  name: 'Plasma',  category: 'Trail',  icon: '☄️', rarity: 3, color: RARITY_COLORS[3], req: 25, value: '#22e3ff', style: 'laser' },
    's_skin1':  { id: 's_skin1',  name: 'Neon Striker', category: 'Skin', icon: '✨', rarity: 4, color: RARITY_COLORS[4], req: 35, value: 'neon' },
    's_skin2':  { id: 's_skin2',  name: 'Dark Matter',  category: 'Skin', icon: '🌌', rarity: 5, color: RARITY_COLORS[5], req: 50, value: 'dark' },

    // ==========================================
    // ROTATING SHOP ITEMS
    // ==========================================

    // --- SKINS (30) ---
    'r_skn_1':  skin('r_skn_1',  'Ghost',       3, 'ghost',       '👻'),
    'r_skn_2':  skin('r_skn_2',  'Assassin',    4, 'assassin',    '🗡️'),
    'r_skn_3':  skin('r_skn_3',  'Paladin',     2, 'paladin',     '🛡️'),
    'r_skn_4':  skin('r_skn_4',  'Spectre',     5, 'spectre',     '👁️'),
    'r_skn_5':  skin('r_skn_5',  'Hologram',    4, 'hologram',    '🧊'),
    'r_skn_6':  skin('r_skn_6',  'Spartan',     3, 'spartan',     '🏺'),
    'r_skn_7':  skin('r_skn_7',  'Phantom',     4, 'phantom',     '🦇'),
    'r_skn_8':  skin('r_skn_8',  'Luminescent', 5, 'luminescent', '💡'),
    'r_skn_9':  skin('r_skn_9',  'Warlord',     5, 'warlord',     '🪓'),
    'r_skn_10': skin('r_skn_10', 'Ninja',       2, 'ninja',       '🥷'),
    'r_skn_11': skin('r_skn_11', 'Inferno',     4, 'inferno',     '🔥'),
    'r_skn_12': skin('r_skn_12', 'Celestial',   5, 'celestial',   '✨'),
    'r_skn_13': skin('r_skn_13', 'Cyborg',      4, 'cyborg',      '🤖'),
    'r_skn_14': skin('r_skn_14', 'Voidwalker',  5, 'voidwalker',  '🌌'),
    'r_skn_15': skin('r_skn_15', 'Glitch',      4, 'glitch',      '👾'),
    'r_skn_16': skin('r_skn_16', 'Target',      1, 'target',      '🎯'),
    'r_skn_17': skin('r_skn_17', 'Stripes',     1, 'stripes',     '🦓'),
    'r_skn_18': skin('r_skn_18', 'Checker',     1, 'checker',     '🏁'),
    'r_skn_19': skin('r_skn_19', 'Zebra',       2, 'zebra',       '🦓'),
    'r_skn_20': skin('r_skn_20', 'Camo',        2, 'camo',        '🪖'),
    'r_skn_21': skin('r_skn_21', 'Demon',       5, 'demon',       '👿'),
    'r_skn_22': skin('r_skn_22', 'Angel',       5, 'angel',       '👼'),
    'r_skn_23': skin('r_skn_23', 'Pirate',      3, 'pirate',      '🏴‍☠️'),
    'r_skn_24': skin('r_skn_24', 'Bandit',      3, 'bandit',      '🦹'),
    'r_skn_25': skin('r_skn_25', 'Mecha',       4, 'mecha',       '⚙️'),
    'r_skn_26': skin('r_skn_26', 'Racer',       2, 'racer',       '🏎️'),
    'r_skn_27': skin('r_skn_27', 'Carbon',      3, 'carbon',      '⬛'),
    'r_skn_28': skin('r_skn_28', 'Hazard',      2, 'hazard',      '⚠️'),
    'r_skn_29': skin('r_skn_29', 'Crystal',     4, 'crystal',     '💎'),
    'r_skn_30': skin('r_skn_30', 'Aurora',      5, 'aurora',      '🌈'),

    // --- BANNERS (30) ---
    'r_ban_1':  { id: 'r_ban_1',  name: 'Kingpin',    category: 'Banner', icon: '👑', rarity: 5, value: '👑', isRotating: true },
    'r_ban_2':  { id: 'r_ban_2',  name: 'Scorcher',   category: 'Banner', icon: '🔥', rarity: 2, value: '🔥', isRotating: true },
    'r_ban_3':  { id: 'r_ban_3',  name: 'Voltage',    category: 'Banner', icon: '⚡', rarity: 3, value: '⚡', isRotating: true },
    'r_ban_4':  { id: 'r_ban_4',  name: 'Flawless',   category: 'Banner', icon: '💎', rarity: 4, value: '💎', isRotating: true },
    'r_ban_5':  { id: 'r_ban_5',  name: 'Predator',   category: 'Banner', icon: '💀', rarity: 3, value: '💀', isRotating: true },
    'r_ban_6':  { id: 'r_ban_6',  name: 'Bullseye',   category: 'Banner', icon: '🎯', rarity: 2, value: '🎯', isRotating: true },
    'r_ban_7':  { id: 'r_ban_7',  name: 'Rocket',     category: 'Banner', icon: '🚀', rarity: 3, value: '🚀', isRotating: true },
    'r_ban_8':  { id: 'r_ban_8',  name: 'Champion',   category: 'Banner', icon: '🏆', rarity: 4, value: '🏆', isRotating: true },
    'r_ban_9':  { id: 'r_ban_9',  name: 'Toxic',      category: 'Banner', icon: '☣️', rarity: 2, value: '☣️', isRotating: true },
    'r_ban_10': { id: 'r_ban_10', name: 'Nuclear',    category: 'Banner', icon: '☢️', rarity: 4, value: '☢️', isRotating: true },
    'r_ban_11': { id: 'r_ban_11', name: 'Gladiator',  category: 'Banner', icon: '⚔️', rarity: 3, value: '⚔️', isRotating: true },
    'r_ban_12': { id: 'r_ban_12', name: 'Guardian',   category: 'Banner', icon: '🛡️', rarity: 2, value: '🛡️', isRotating: true },
    'r_ban_13': { id: 'r_ban_13', name: 'Phantom',    category: 'Banner', icon: '👻', rarity: 4, value: '👻', isRotating: true },
    'r_ban_14': { id: 'r_ban_14', name: 'Serpent',    category: 'Banner', icon: '🐍', rarity: 3, value: '🐍', isRotating: true },
    'r_ban_15': { id: 'r_ban_15', name: 'Apex',       category: 'Banner', icon: '🦅', rarity: 5, value: '🦅', isRotating: true },
    'r_ban_16': { id: 'r_ban_16', name: 'Abyssal',    category: 'Banner', icon: '🦑', rarity: 4, value: '🦑', isRotating: true },
    'r_ban_17': { id: 'r_ban_17', name: 'Medic',      category: 'Banner', icon: '❤️', rarity: 1, value: '❤️', isRotating: true },
    'r_ban_18': { id: 'r_ban_18', name: 'Lucky',      category: 'Banner', icon: '🍀', rarity: 2, value: '🍀', isRotating: true },
    'r_ban_19': { id: 'r_ban_19', name: 'Cosmic',     category: 'Banner', icon: '👽', rarity: 5, value: '👽', isRotating: true },
    'r_ban_20': { id: 'r_ban_20', name: 'Frostbite',  category: 'Banner', icon: '❄️', rarity: 3, value: '❄️', isRotating: true },
    'r_ban_21': { id: 'r_ban_21', name: 'Sniper',     category: 'Banner', icon: '🔭', rarity: 3, value: '🔭', isRotating: true },
    'r_ban_22': { id: 'r_ban_22', name: 'Brawler',    category: 'Banner', icon: '🥊', rarity: 2, value: '🥊', isRotating: true },
    'r_ban_23': { id: 'r_ban_23', name: 'Assassin',   category: 'Banner', icon: '🥷', rarity: 4, value: '🥷', isRotating: true },
    'r_ban_24': { id: 'r_ban_24', name: 'Pirate',     category: 'Banner', icon: '🏴‍☠️', rarity: 3, value: '🏴‍☠️', isRotating: true },
    'r_ban_25': { id: 'r_ban_25', name: 'Cyborg',     category: 'Banner', icon: '🦾', rarity: 4, value: '🦾', isRotating: true },
    'r_ban_26': { id: 'r_ban_26', name: 'Invader',    category: 'Banner', icon: '🛸', rarity: 5, value: '🛸', isRotating: true },
    'r_ban_27': { id: 'r_ban_27', name: 'Demonic',    category: 'Banner', icon: '👿', rarity: 4, value: '👿', isRotating: true },
    'r_ban_28': { id: 'r_ban_28', name: 'Angelic',    category: 'Banner', icon: '👼', rarity: 4, value: '👼', isRotating: true },
    'r_ban_29': { id: 'r_ban_29', name: 'Royal',      category: 'Banner', icon: '🤴', rarity: 3, value: '🤴', isRotating: true },
    'r_ban_30': { id: 'r_ban_30', name: 'Empress',    category: 'Banner', icon: '👸', rarity: 3, value: '👸', isRotating: true },

    // --- TRAILS (32) ---
    'r_trl_1':  trail('r_trl_1',  'Crimson',      2, '#ef4444', 'puff',     '🔴'),
    'r_trl_2':  trail('r_trl_2',  'Emerald',      2, '#22c55e', 'puff',     '🟢'),
    'r_trl_3':  trail('r_trl_3',  'Sapphire',     2, '#3b82f6', 'puff',     '🔵'),
    'r_trl_4':  trail('r_trl_4',  'Gold Dust',    4, '#fbbf24', 'spark',    '⭐', { color2: '#fff7cc' }),
    'r_trl_5':  trail('r_trl_5',  'Amethyst',     3, '#a855f7', 'ribbon',   '🟣'),
    'r_trl_6':  trail('r_trl_6',  'Snowblind',    1, '#f1f5f9', 'puff',     '⚪'),
    'r_trl_7':  trail('r_trl_7',  'Void',         5, '#0b0612', 'void',     '⚫', { color2: '#a855f7' }),
    'r_trl_8':  trail('r_trl_8',  'Sunset',       3, '#fb923c', 'puff',     '🌇', { color2: '#ec4899' }),
    'r_trl_9':  trail('r_trl_9',  'Mint',         1, '#86efac', 'puff',     '🌿'),
    'r_trl_10': trail('r_trl_10', 'Cyanide',      3, '#06b6d4', 'bubble',   '🧪'),
    'r_trl_11': trail('r_trl_11', 'Cherry',       2, '#fb7185', 'ribbon',   '🍒'),
    'r_trl_12': trail('r_trl_12', 'Electric',     4, '#fde047', 'electric', '⚡'),
    'r_trl_13': trail('r_trl_13', 'Bubblegum',    2, '#f472b6', 'bubble',   '🍬'),
    'r_trl_14': trail('r_trl_14', 'Silver',       3, '#cbd5e1', 'ribbon',   '⚙️'),
    'r_trl_15': trail('r_trl_15', 'Bronze',       1, '#c2773a', 'puff',     '🥉'),
    'r_trl_16': trail('r_trl_16', 'Laser',        4, '#ff2d55', 'laser',    '🖍️'),
    'r_trl_17': trail('r_trl_17', 'Abyss',        4, '#0b1a3a', 'void',     '🌊', { color2: '#3b82f6' }),
    'r_trl_18': trail('r_trl_18', 'Acid',         3, '#84cc16', 'bubble',   '🔋'),
    'r_trl_19': trail('r_trl_19', 'Magma',        5, '#ef4444', 'ember',    '🌋', { color2: '#fbbf24' }),
    'r_trl_20': trail('r_trl_20', 'Ghost',        5, '#e5e7eb', 'echo',     '🌫️'),
    'r_trl_21': trail('r_trl_21', 'Starlight',    3, '#fef08a', 'spark',    '✨'),
    'r_trl_22': trail('r_trl_22', 'Bloodline',    2, '#be123c', 'puff',     '🩸'),
    'r_trl_23': trail('r_trl_23', 'Toxic Sludge', 2, '#a3e635', 'puff',     '☣️', { color2: '#3f6212' }),
    'r_trl_24': trail('r_trl_24', 'Dark Magic',   4, '#7c3aed', 'spark',    '🔮', { color2: '#e879f9' }),
    'r_trl_25': trail('r_trl_25', 'Frost',        1, '#bae6fd', 'frost',    '❄️'),
    'r_trl_26': trail('r_trl_26', 'Sunbeam',      2, '#facc15', 'ribbon',   '☀️'),
    'r_trl_27': trail('r_trl_27', 'Rose',         1, '#fecdd3', 'puff',     '🌹'),
    'r_trl_28': trail('r_trl_28', 'Copper',       1, '#d97706', 'puff',     '🪙', { color2: '#14b8a6' }),
    'r_trl_29': trail('r_trl_29', 'Shadow',       3, '#111827', 'void',     '🌘', { color2: '#9ca3af' }),
    'r_trl_30': trail('r_trl_30', 'Nebula',       4, '#a855f7', 'nebula',   '🌌', { color2: '#ec4899' }),
    'r_trl_31': trail('r_trl_31', 'Comet',        4, '#7dd3fc', 'comet',    '☄️'),
    'r_trl_32': trail('r_trl_32', 'Prism',        5, '#ffffff', 'rainbow',  '🌈'),

    // --- COLORS (32) ---
    'r_col_1':  color('r_col_1',  'Red',          1, '#ef4444', '🔴'),
    'r_col_2':  color('r_col_2',  'Blue',         1, '#3b82f6', '🔵'),
    'r_col_3':  color('r_col_3',  'Green',        1, '#22c55e', '🟢'),
    'r_col_4':  color('r_col_4',  'Yellow',       1, '#facc15', '🟡'),
    'r_col_5':  color('r_col_5',  'Orange',       1, '#f97316', '🟠'),
    'r_col_6':  color('r_col_6',  'Purple',       1, '#a855f7', '🟣'),
    'r_col_7':  color('r_col_7',  'Pink',         1, '#f9a8d4', '🌸'),
    'r_col_8':  color('r_col_8',  'Brown',        1, '#a16207', '🟤'),
    'r_col_31': color('r_col_31', 'Teal',         1, '#14b8a6', '🩵'),
    'r_col_11': color('r_col_11', 'Slate Gray',   2, '#64748b', '🪨'),
    'r_col_12': color('r_col_12', 'Olive',        2, '#84a33a', '🫒'),
    'r_col_13': color('r_col_13', 'Navy',         2, '#2547a8', '⛴️'),
    'r_col_14': color('r_col_14', 'Rust',         2, '#c2410c', '🧱'),
    'r_col_32': color('r_col_32', 'Lavender',     2, '#c4b5fd', '💜'),
    'r_col_33': color('r_col_33', 'Coral',        2, '#fb7185', '🪸'),
    'r_col_15': color('r_col_15', 'Forest',       3, '#22c55e', '🌲', { finish: 'gradient', value2: '#14532d' }),
    'r_col_16': color('r_col_16', 'Deep Blue',    3, '#60a5fa', '💧', { finish: 'gradient', value2: '#1e3a8a' }),
    'r_col_17': color('r_col_17', 'Blood Red',    3, '#f87171', '🩸', { finish: 'gradient', value2: '#7f1d1d' }),
    'r_col_18': color('r_col_18', 'Tangerine',    3, '#fdba74', '🍊', { finish: 'gradient', value2: '#c2410c' }),
    'r_col_19': color('r_col_19', 'Hot Pink',     4, '#ec4899', '🌸', { finish: 'pulse' }),
    'r_col_20': color('r_col_20', 'Royal Plum',   4, '#c026d3', '🍇', { finish: 'gradient', value2: '#4c1d95' }),
    'r_col_21': color('r_col_21', 'Crimson Glow', 4, '#ef4444', '🔥', { finish: 'pulse' }),
    'r_col_22': color('r_col_22', 'Neon Cyan',    5, '#22d3ee', '💎', { finish: 'neon' }),
    'r_col_23': color('r_col_23', 'Radioactive',  5, '#a3e635', '☣️', { finish: 'neon' }),
    'r_col_24': color('r_col_24', 'Galactic',     5, '#7c3aed', '🌌', { finish: 'galaxy' }),
    'r_col_25': color('r_col_25', 'Titanium',     5, '#cbd5e1', '🛡️', { finish: 'metal' }),
    'r_col_26': color('r_col_26', 'Pure Gold',    5, '#facc15', '🏆', { finish: 'metal' }),
    'r_col_27': color('r_col_27', 'Vanta Black',  5, '#0a0a0f', '🕶️', { finish: 'rim', rim: '#ffffff' }),
    'r_col_28': color('r_col_28', 'Solar Flare',  5, '#f59e0b', '☀️', { finish: 'flare' }),
    'r_col_29': color('r_col_29', 'Abyss',        5, '#0b1530', '🌊', { finish: 'rim', rim: '#38bdf8' }),
    'r_col_30': color('r_col_30', 'Amethyst',     5, '#a855f7', '🔮', { finish: 'crystal' }),
    'r_col_9':  color('r_col_9',  'Radiance',     5, '#ffffff', '✨', { finish: 'shimmer' }),

    // ==========================================
    // CLASS MASTERY SKINS (500 kills with a class)
    // ==========================================
    'skin_mastery_triangle': { id: 'skin_mastery_triangle', category: 'Skin', icon: '🏆', value: 'golden', name: 'Golden Jet', rarity: 5, hideFromStore: true, masteryClass: 'triangle' },
    'skin_mastery_square':   { id: 'skin_mastery_square',   category: 'Skin', icon: '🏆', value: 'golden', name: 'Golden Tank', rarity: 5, hideFromStore: true, masteryClass: 'square' },
    'skin_mastery_circle':   { id: 'skin_mastery_circle',   category: 'Skin', icon: '🏆', value: 'golden', name: 'Golden Soldier', rarity: 5, hideFromStore: true, masteryClass: 'circle' }
};

export const CATEGORIES = ['Skin', 'Trail', 'Banner', 'Color'];
export const SEASON_ITEM_IDS = ['s_banner', 's_trail', 's_skin1', 's_skin2'];
export const SEASON_MAX_LEVEL = 50;
export const MASTERY_KILLS = 500;
export const DEFAULT_BODY_COLOR = '#d6dbe3';

export const emptyLoadout = () => ({ Skin: null, Trail: null, Banner: null, Color: null });
export const getItem = (id) => (id && ITEMS_DB[id]) || null;
export const itemColor = (item) => item ? (item.color || RARITY_COLORS[item.rarity] || '#fff') : '#888';
export const masterySkinId = (classType) => `skin_mastery_${classType}`;
export const isMasterySkin = (id) => !!getItem(id)?.masteryClass;

// Body colour for a loadout (the "Color" slot).
export function bodyColorFor(equipped) {
    return getItem(equipped?.Color)?.value || DEFAULT_BODY_COLOR;
}

// Special paint for the "Color" slot (gradient, metal, neon...), or null for a flat colour.
export function bodyFinishFor(equipped) {
    const item = getItem(equipped?.Color);
    return item?.finish ? { type: item.finish, value2: item.value2, rim: item.rim } : null;
}

// A loadout safe to render for a class: drops unknown items and other classes' mastery skins.
export function loadoutForClass(equipped, classType) {
    const out = emptyLoadout();
    for (const cat of CATEGORIES) {
        const item = getItem(equipped?.[cat]);
        if (!item || item.category !== cat) continue;
        if (item.masteryClass && item.masteryClass !== classType) continue;
        out[cat] = item.id;
    }
    return out;
}