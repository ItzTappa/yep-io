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
    // ROTATING SHOP ITEMS
    // ==========================================

    // --- SKINS (25) ---
    'r_skn_1':  { id: 'r_skn_1',  name: 'Ghost',      category: 'Skin', icon: '👻', rarity: 3, value: 'ghost', isRotating: true },
    'r_skn_2':  { id: 'r_skn_2',  name: 'Assassin',   category: 'Skin', icon: '🗡️', rarity: 4, value: 'assassin', isRotating: true },
    'r_skn_3':  { id: 'r_skn_3',  name: 'Paladin',    category: 'Skin', icon: '🛡️', rarity: 2, value: 'paladin', isRotating: true },
    'r_skn_4':  { id: 'r_skn_4',  name: 'Spectre',    category: 'Skin', icon: '👁️', rarity: 5, value: 'spectre', isRotating: true },
    'r_skn_5':  { id: 'r_skn_5',  name: 'Hologram',   category: 'Skin', icon: '🧊', rarity: 4, value: 'hologram', isRotating: true },
    'r_skn_6':  { id: 'r_skn_6',  name: 'Spartan',    category: 'Skin', icon: '🏺', rarity: 3, value: 'spartan', isRotating: true },
    'r_skn_7':  { id: 'r_skn_7',  name: 'Phantom',    category: 'Skin', icon: '🦇', rarity: 4, value: 'phantom', isRotating: true },
    'r_skn_8':  { id: 'r_skn_8',  name: 'Luminescent',category: 'Skin', icon: '💡', rarity: 5, value: 'luminescent', isRotating: true },
    'r_skn_9':  { id: 'r_skn_9',  name: 'Warlord',    category: 'Skin', icon: '🪓', rarity: 5, value: 'warlord', isRotating: true },
    'r_skn_10': { id: 'r_skn_10', name: 'Ninja',      category: 'Skin', icon: '🥷', rarity: 2, value: 'ninja', isRotating: true },
    'r_skn_11': { id: 'r_skn_11', name: 'Inferno',    category: 'Skin', icon: '🔥', rarity: 4, value: 'inferno', isRotating: true },
    'r_skn_12': { id: 'r_skn_12', name: 'Celestial',  category: 'Skin', icon: '✨', rarity: 5, value: 'celestial', isRotating: true },
    'r_skn_13': { id: 'r_skn_13', name: 'Cyborg',     category: 'Skin', icon: '🤖', rarity: 4, value: 'cyborg', isRotating: true },
    'r_skn_14': { id: 'r_skn_14', name: 'Voidwalker', category: 'Skin', icon: '🌌', rarity: 5, value: 'voidwalker', isRotating: true },
    'r_skn_15': { id: 'r_skn_15', name: 'Glitch',     category: 'Skin', icon: '👾', rarity: 4, value: 'glitch', isRotating: true },
    'r_skn_16': { id: 'r_skn_16', name: 'Target',     category: 'Skin', icon: '🎯', rarity: 1, value: 'target', isRotating: true },
    'r_skn_17': { id: 'r_skn_17', name: 'Stripes',    category: 'Skin', icon: '🦓', rarity: 1, value: 'stripes', isRotating: true },
    'r_skn_18': { id: 'r_skn_18', name: 'Checker',    category: 'Skin', icon: '🏁', rarity: 1, value: 'checker', isRotating: true },
    'r_skn_19': { id: 'r_skn_19', name: 'Zebra',      category: 'Skin', icon: '🦓', rarity: 2, value: 'zebra', isRotating: true },
    'r_skn_20': { id: 'r_skn_20', name: 'Camo',       category: 'Skin', icon: '🪖', rarity: 2, value: 'camo', isRotating: true },
    'r_skn_21': { id: 'r_skn_21', name: 'Demon',      category: 'Skin', icon: '👿', rarity: 5, value: 'demon', isRotating: true },
    'r_skn_22': { id: 'r_skn_22', name: 'Angel',      category: 'Skin', icon: '👼', rarity: 5, value: 'angel', isRotating: true },
    'r_skn_23': { id: 'r_skn_23', name: 'Pirate',     category: 'Skin', icon: '🏴‍☠️', rarity: 3, value: 'pirate', isRotating: true },
    'r_skn_24': { id: 'r_skn_24', name: 'Bandit',     category: 'Skin', icon: '🦹', rarity: 3, value: 'bandit', isRotating: true },
    'r_skn_25': { id: 'r_skn_25', name: 'Mecha',      category: 'Skin', icon: '⚙️', rarity: 4, value: 'mecha', isRotating: true },
    
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

    // --- TRAILS (30) ---
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
    'r_trl_21': { id: 'r_trl_21', name: 'Starlight',  category: 'Trail',  icon: '✨', rarity: 3, value: '#fef08a', isRotating: true },
    'r_trl_22': { id: 'r_trl_22', name: 'Bloodline',  category: 'Trail',  icon: '🩸', rarity: 2, value: '#881337', isRotating: true },
    'r_trl_23': { id: 'r_trl_23', name: 'Toxic Sludge',category:'Trail',  icon: '☣️', rarity: 2, value: '#bef264', isRotating: true },
    'r_trl_24': { id: 'r_trl_24', name: 'Dark Magic', category: 'Trail',  icon: '🔮', rarity: 4, value: '#4c1d95', isRotating: true },
    'r_trl_25': { id: 'r_trl_25', name: 'Frost',      category: 'Trail',  icon: '❄️', rarity: 1, value: '#bae6fd', isRotating: true },
    'r_trl_26': { id: 'r_trl_26', name: 'Sunbeam',    category: 'Trail',  icon: '☀️', rarity: 2, value: '#fde047', isRotating: true },
    'r_trl_27': { id: 'r_trl_27', name: 'Rose',       category: 'Trail',  icon: '🌹', rarity: 1, value: '#fecdd3', isRotating: true },
    'r_trl_28': { id: 'r_trl_28', name: 'Copper',     category: 'Trail',  icon: '🪙', rarity: 1, value: '#d97706', isRotating: true },
    'r_trl_29': { id: 'r_trl_29', name: 'Shadow',     category: 'Trail',  icon: '🌘', rarity: 3, value: '#1f2937', isRotating: true },
    'r_trl_30': { id: 'r_trl_30', name: 'Nebula',     category: 'Trail',  icon: '🌌', rarity: 4, value: '#c084fc', isRotating: true },

    // --- COLORS (29) ---
    'r_col_1':  { id: 'r_col_1',  name: 'Red',        category: 'Color',  icon: '🔴', rarity: 1, value: '#ff0000', isRotating: true },
    'r_col_2':  { id: 'r_col_2',  name: 'Blue',       category: 'Color',  icon: '🔵', rarity: 1, value: '#0000ff', isRotating: true },
    'r_col_3':  { id: 'r_col_3',  name: 'Green',      category: 'Color',  icon: '🟢', rarity: 1, value: '#00ff00', isRotating: true },
    'r_col_4':  { id: 'r_col_4',  name: 'Yellow',     category: 'Color',  icon: '🟡', rarity: 1, value: '#ffff00', isRotating: true },
    'r_col_5':  { id: 'r_col_5',  name: 'Orange',     category: 'Color',  icon: '🟠', rarity: 1, value: '#ffa500', isRotating: true },
    'r_col_6':  { id: 'r_col_6',  name: 'Purple',     category: 'Color',  icon: '🟣', rarity: 1, value: '#800080', isRotating: true },
    'r_col_7':  { id: 'r_col_7',  name: 'Pink',       category: 'Color',  icon: '🌸', rarity: 1, value: '#ffc0cb', isRotating: true },
    'r_col_8':  { id: 'r_col_8',  name: 'Brown',      category: 'Color',  icon: '🟤', rarity: 1, value: '#654321', isRotating: true },
    'r_col_9':  { id: 'r_col_9',  name: 'Radiance',   category: 'Color',  icon: '✨', rarity: 5, value: '#ffffff', isRotating: true },

    'r_col_11': { id: 'r_col_11', name: 'Slate Gray', category: 'Color',  icon: '🪨', rarity: 2, value: '#64748b', isRotating: true },
    'r_col_12': { id: 'r_col_12', name: 'Olive',      category: 'Color',  icon: '🫒', rarity: 2, value: '#4d7c0f', isRotating: true },
    'r_col_13': { id: 'r_col_13', name: 'Navy',       category: 'Color',  icon: '⛴️', rarity: 2, value: '#1e3a8a', isRotating: true },
    'r_col_14': { id: 'r_col_14', name: 'Rust',       category: 'Color',  icon: '🧱', rarity: 2, value: '#9a3412', isRotating: true },
    
    'r_col_15': { id: 'r_col_15', name: 'Forest',     category: 'Color',  icon: '🌲', rarity: 3, value: '#15803d', isRotating: true },
    'r_col_16': { id: 'r_col_16', name: 'Deep Blue',  category: 'Color',  icon: '💧', rarity: 3, value: '#1d4ed8', isRotating: true },
    'r_col_17': { id: 'r_col_17', name: 'Blood Red',  category: 'Color',  icon: '🩸', rarity: 3, value: '#b91c1c', isRotating: true },
    'r_col_18': { id: 'r_col_18', name: 'Tangerine',  category: 'Color',  icon: '🍊', rarity: 3, value: '#f97316', isRotating: true },
    
    'r_col_19': { id: 'r_col_19', name: 'Hot Pink',   category: 'Color',  icon: '🌸', rarity: 4, value: '#ec4899', isRotating: true },
    'r_col_20': { id: 'r_col_20', name: 'Royal Plum', category: 'Color',  icon: '🍇', rarity: 4, value: '#7e22ce', isRotating: true },
    'r_col_21': { id: 'r_col_21', name: 'Crimson Glow',category: 'Color', icon: '🔥', rarity: 4, value: '#ef4444', isRotating: true },
    
    'r_col_22': { id: 'r_col_22', name: 'Neon Cyan',  category: 'Color',  icon: '💎', rarity: 5, value: '#00ffff', isRotating: true },
    'r_col_23': { id: 'r_col_23', name: 'Radioactive',category: 'Color',  icon: '☣️', rarity: 5, value: '#84cc16', isRotating: true },
    'r_col_24': { id: 'r_col_24', name: 'Galactic',   category: 'Color',  icon: '🌌', rarity: 5, value: '#8b5cf6', isRotating: true },
    'r_col_25': { id: 'r_col_25', name: 'Titanium',   category: 'Color',  icon: '🛡️', rarity: 5, value: '#d1d5db', isRotating: true },
    
    'r_col_26': { id: 'r_col_26', name: 'Pure Gold',  category: 'Color',  icon: '🏆', rarity: 5, value: '#ffe600', isRotating: true },
    'r_col_27': { id: 'r_col_27', name: 'Vanta Black',category: 'Color',  icon: '🕶️', rarity: 5, value: '#111111', isRotating: true },
    'r_col_28': { id: 'r_col_28', name: 'Solar Flare',category: 'Color',  icon: '☀️', rarity: 5, value: '#fcd34d', isRotating: true },
    'r_col_29': { id: 'r_col_29', name: 'Abyss',      category: 'Color',  icon: '🌊', rarity: 5, value: '#0f172a', isRotating: true },
    'r_col_30': { id: 'r_col_30', name: 'Amethyst',   category: 'Color',  icon: '🔮', rarity: 5, value: '#c084fc', isRotating: true }
};