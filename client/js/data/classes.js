// The three playable classes and their starting stats.
// healthGrowth: Hull Integrity gives this many times the normal +15% (Jet and Tank need more late-game
// health: Jet because its dodging stops working against homing/spread, Tank because of its big hitbox).
export const CLASS_TYPES = ['triangle', 'square', 'circle'];

export const CLASS_STATS = {
    circle:   { speed: 6.3, size: 20, maxHealth: 300, fireRate: 20, baseDamage: 14,  dashMaxCooldown: 95,  bulletSpeed: 17 },
    square:   { speed: 4.5, size: 28, maxHealth: 372, fireRate: 52, baseDamage: 32,  dashMaxCooldown: 130, bulletSpeed: 17, healthGrowth: 1.5 },
    triangle: { speed: 9.0, size: 20, maxHealth: 215, fireRate: 14, baseDamage: 7.5, dashMaxCooldown: 75,  bulletSpeed: 16, healthGrowth: 1.4 }
};

export const CLASS_INFO = {
    triangle: { name: 'Jet', description: 'JET: Fast & agile. Lower health. Good for hit-and-run.' },
    square:   { name: 'Tank', description: 'TANK: High health, slow speed. Excels in close-quarters brawls.' },
    circle:   { name: 'Soldier', description: 'SOLDIER: Balanced speed and health. The perfect all-rounder.' }
};

export const isClassType = (type) => CLASS_TYPES.includes(type);
export const randomClass = (rng = Math.random) => CLASS_TYPES[Math.floor(rng() * CLASS_TYPES.length)];
