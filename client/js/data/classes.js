// The three playable classes and their starting stats.
export const CLASS_TYPES = ['triangle', 'square', 'circle'];

export const CLASS_STATS = {
    circle:   { speed: 6.0, size: 20, maxHealth: 260, fireRate: 22, baseDamage: 15, dashMaxCooldown: 100, bulletSpeed: 14 },
    square:   { speed: 4.2, size: 28, maxHealth: 380, fireRate: 55, baseDamage: 35, dashMaxCooldown: 150, bulletSpeed: 18 },
    triangle: { speed: 9.0, size: 20, maxHealth: 170, fireRate: 14, baseDamage: 7,  dashMaxCooldown: 75,  bulletSpeed: 16 }
};

export const CLASS_INFO = {
    triangle: { name: 'Jet', description: 'JET: Fast & agile. Lower health. Good for hit-and-run.' },
    square:   { name: 'Tank', description: 'TANK: High health, slow speed. Excels in close-quarters brawls.' },
    circle:   { name: 'Soldier', description: 'SOLDIER: Balanced speed and health. The perfect all-rounder.' }
};

export const isClassType = (type) => CLASS_TYPES.includes(type);
export const randomClass = (rng = Math.random) => CLASS_TYPES[Math.floor(rng() * CLASS_TYPES.length)];
