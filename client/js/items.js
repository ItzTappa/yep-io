// ==========================================
// YEP.IO - ITEM & COSMETIC DATABASE
// ==========================================

export const RARITY_COLORS = { 
    1: '#a0a0a0', // Common (Gray)
    2: '#22c55e', // Uncommon (Green)
    3: '#3b82f6', // Rare (Blue)
    4: '#a855f7', // Epic (Purple)
    5: '#f97316'  // Legendary (Orange)
};

export const ITEMS_DB = {
// ==========================================
    // SEASON STORE ITEMS (Static - Unlocked by Level)
    // ==========================================
    's_banner': { id: 's_banner', name: 'Veteran', category: 'Banner', icon: '🏴', rarity: 2, color: RARITY_COLORS[2], req: 10, value: '🏴' },
    's_trail':  { id: 's_trail',  name: 'Plasma',  category: 'Trail',  icon: '☄️', rarity: 3, color: RARITY_COLORS[3], req: 25, value: '#00ffff' },
    's_skin1':  { id: 's_skin1',  name: 'Neon Striker', category: 'Skin', icon: '✨', rarity: 4, color: RARITY_COLORS[4], req: 35, value: 'neon' },
    's_skin2':  { id: 's_skin2',  name: 'Dark Matter',  category: 'Skin', icon: '🌌', rarity: 5, color: RARITY_COLORS[5], req: 50, value: 'dark' },

    // ==========================================
    // ROTATING SHOP ITEMS (50 ITEMS)
    // ==========================================

// --- SKINS (10) ---
    'r_skn_1':  { id: 'r_skn_1',  name: 'Ghost',      category: 'Skin', icon: '👻', rarity: 3, value: 'special', isRotating: true },
    'r_skn_2':  { id: 'r_skn_2',  name: 'Assassin',   category: 'Skin', icon: '🗡️', rarity: 4, value: 'special', isRotating: true },
    'r_skn_3':  { id: 'r_skn_3',  name: 'Paladin',    category: 'Skin', icon: '🛡️', rarity: 2, value: 'special', isRotating: true },
    'r_skn_4':  { id: 'r_skn_4',  name: 'Spectre',    category: 'Skin', icon: '👁️', rarity: 5, value: 'special', isRotating: true },
    'r_skn_5':  { id: 'r_skn_5',  name: 'Hologram',   category: 'Skin', icon: '🧊', rarity: 4, value: 'special', isRotating: true },
    'r_skn_6':  { id: 'r_skn_6',  name: 'Spartan',    category: 'Skin', icon: '🏺', rarity: 3, value: 'special', isRotating: true },
    'r_skn_7':  { id: 'r_skn_7',  name: 'Phantom',    category: 'Skin', icon: '🦇', rarity: 4, value: 'special', isRotating: true },
    'r_skn_8':  { id: 'r_skn_8',  name: 'Luminescent',category: 'Skin', icon: '💡', rarity: 3, value: 'special', isRotating: true },
    'r_skn_9':  { id: 'r_skn_9',  name: 'Warlord',    category: 'Skin', icon: '🪓', rarity: 5, value: 'special', isRotating: true },
    'r_skn_10': { id: 'r_skn_10', name: 'Ninja',      category: 'Skin', icon: '🥷', rarity: 2, value: 'special', isRotating: true },
    
    // --- BANNERS (20) ---
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

    // --- TRAILS (20) ---
    'r_trl_1':  { id: 'r_trl_1',  name: 'Crimson',    category: 'Trail',  icon: '🔴', rarity: 2, value: '#ef4444', isRotating: true },
    'r_trl_2':  { id: 'r_trl_2',  name: 'Emerald',    category: 'Trail',  icon: '🟢', rarity: 2, value: '#22c55e', isRotating: true },
    'r_trl_3':  { id: 'r_trl_3',  name: 'Sapphire',   category: 'Trail',  icon: '🔵', rarity: 2, value: '#3b82f6', isRotating: true },
    'r_trl_4':  { id: 'r_trl_4',  name: 'Gold Dust',  category: 'Trail',  icon: '⭐', rarity: 4, value: '#fbbf24', isRotating: true },
    'r_trl_5':  { id: 'r_trl_5',  name: 'Amethyst',   category: 'Trail',  icon: '🟣', rarity: 3, value: '#a855f7', isRotating: true },
    'r_trl_6':  { id: 'r_trl_6',  name: 'Snowblind',  category: 'Trail',  icon: '⚪', rarity: 1, value: '#ffffff', isRotating: true },
    'r_trl_7':  { id: 'r_trl_7',  name: 'Void',       category: 'Trail',  icon: '⚫', rarity: 5, value: '#000000', isRotating: true },
    'r_trl_8':  { id: 'r_trl_8',  name: 'Sunset',     category: 'Trail',  icon: '🌇', rarity: 3, value: '#f97316', isRotating: true },
    'r_trl_9':  { id: 'r_trl_9',  name: 'Mint',       category: 'Trail',  icon: '🌿', rarity: 1, value: '#86efac', isRotating: true },
    'r_trl_10': { id: 'r_trl_10', name: 'Cyanide',    category: 'Trail',  icon: '🧪', rarity: 3, value: '#06b6d4', isRotating: true },
    'r_trl_11': { id: 'r_trl_11', name: 'Cherry',     category: 'Trail',  icon: '🍒', rarity: 2, value: '#e11d48', isRotating: true },
    'r_trl_12': { id: 'r_trl_12', name: 'Electric',   category: 'Trail',  icon: '⚡', rarity: 4, value: '#fde047', isRotating: true },
    'r_trl_13': { id: 'r_trl_13', name: 'Bubblegum',  category: 'Trail',  icon: '🍬', rarity: 2, value: '#f472b6', isRotating: true },
    'r_trl_14': { id: 'r_trl_14', name: 'Silver',     category: 'Trail',  icon: '⚙️', rarity: 3, value: '#9ca3af', isRotating: true },
    'r_trl_15': { id: 'r_trl_15', name: 'Bronze',     category: 'Trail',  icon: '🥉', rarity: 1, value: '#b45309', isRotating: true },
    'r_trl_16': { id: 'r_trl_16', name: 'Laser',      category: 'Trail',  icon: '🖍️', rarity: 4, value: '#ff0055', isRotating: true },
    'r_trl_17': { id: 'r_trl_17', name: 'Abyss',      category: 'Trail',  icon: '🌊', rarity: 4, value: '#1e3a8a', isRotating: true },
    'r_trl_18': { id: 'r_trl_18', name: 'Acid',       category: 'Trail',  icon: '🔋', rarity: 3, value: '#84cc16', isRotating: true },
    'r_trl_19': { id: 'r_trl_19', name: 'Magma',      category: 'Trail',  icon: '🌋', rarity: 5, value: '#dc2626', isRotating: true },
    'r_trl_20': { id: 'r_trl_20', name: 'Ghost',      category: 'Trail',  icon: '🌫️', rarity: 5, value: '#e5e7eb', isRotating: true },

    // --- COLORS (10) ---
    'r_col_1':  { id: 'r_col_1',  name: 'Blood Red',  category: 'Color',  icon: '🩸', rarity: 2, value: '#b91c1c', isRotating: true },
    'r_col_2':  { id: 'r_col_2',  name: 'Deep Blue',  category: 'Color',  icon: '💧', rarity: 2, value: '#1d4ed8', isRotating: true },
    'r_col_3':  { id: 'r_col_3',  name: 'Forest',     category: 'Color',  icon: '🌲', rarity: 2, value: '#15803d', isRotating: true },
    'r_col_4':  { id: 'r_col_4',  name: 'Pure Gold',  category: 'Color',  icon: '🏆', rarity: 5, value: '#ffe600', isRotating: true },
    'r_col_5':  { id: 'r_col_5',  name: 'Vanta Black',category: 'Color',  icon: '🕶️', rarity: 5, value: '#111111', isRotating: true },
    'r_col_6':  { id: 'r_col_6',  name: 'Hot Pink',   category: 'Color',  icon: '🌸', rarity: 3, value: '#ec4899', isRotating: true },
    'r_col_7':  { id: 'r_col_7',  name: 'Neon Cyan',  category: 'Color',  icon: '💎', rarity: 4, value: '#00ffff', isRotating: true },
    'r_col_8':  { id: 'r_col_8',  name: 'Tangerine',  category: 'Color',  icon: '🍊', rarity: 1, value: '#f97316', isRotating: true },
    'r_col_9':  { id: 'r_col_9',  name: 'Royal Plum', category: 'Color',  icon: '🍇', rarity: 3, value: '#7e22ce', isRotating: true },
    'r_col_10': { id: 'r_col_10', name: 'Titanium',   category: 'Color',  icon: '🛡️', rarity: 4, value: '#d1d5db', isRotating: true }
};