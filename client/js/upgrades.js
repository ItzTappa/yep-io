// ==========================================
// YEP.IO - UPGRADE DATABASE & LOGIC
// ==========================================

export const UPGRADE_POOL = [
    // --- SPECIAL ACTIVE ABILITIES (RARE / LEGENDARY DROPS) ---
    { 
        id: 'shield', title: 'Active: Dome Shield', desc: 'Press E (or tap Ability) to become invincible for 3s', weight: 12, maxTier: 1,
        apply: (e) => { e.activeAbility = 'shield'; } 
    },
    { 
        id: 'overdrive', title: 'Active: Overdrive', desc: 'Press E (or tap Ability) to double speed & fire rate for 3s', weight: 12, maxTier: 1,
        apply: (e) => { e.activeAbility = 'overdrive'; } 
    },

    // --- UNIVERSAL UPGRADES ---
    { 
        id: 'speed', title: 'Thrusters', desc: '+Movement Speed', weight: 100,
        apply: (e) => { e.speed += (e.type === 'square' ? 0.4 : e.type === 'triangle' ? 1.0 : 0.7); }
    },
    { 
        id: 'damage', title: 'Heavy Caliber', desc: '+Base Damage', weight: 100,
        apply: (e) => { e.baseDamage += (e.type === 'square' ? 8 : e.type === 'triangle' ? 2 : 4); }
    },
    { 
        id: 'fireRate', title: 'Rapid Loader', desc: '+Fire Rate', weight: 100,
        apply: (e) => { e.fireRate = Math.max(4, e.fireRate - (e.type === 'square' ? 6 : e.type === 'triangle' ? 2 : 3)); }
    },
    { 
        id: 'health', title: 'Reinforced Hull', desc: '+Max Health', weight: 100,
        apply: (e) => { let hp = (e.type === 'square' ? 50 : e.type === 'triangle' ? 15 : 25); e.maxHealth += hp; e.health += hp; }
    },
    { 
        id: 'bulletSpeed', title: 'High Velocity', desc: '+Bullet Speed', weight: 100,
        apply: (e) => { e.bulletSpeed += (e.type === 'square' ? 4 : 3); }
    },
    { 
        id: 'multiShot', title: 'Twin Link', desc: '+Extra Projectile', weight: 50,
        apply: (e) => { e.multiShot += 1; }
    },
    { 
        id: 'orbiters', title: 'Defense Drones', desc: '+1 Orbital Chainsaw', weight: 25,
        apply: (e) => { e.orbiters += 1; e.orbiterDamage += 0.2; }
    },
    { 
        id: 'missiles', title: 'Seeker Missiles', desc: 'Auto-Homing Missiles', weight: 15,
        apply: (e) => { e.missiles += 1; }
    },
    { 
        id: 'scavenger', title: 'Scavenger', desc: 'Orbs give more points', weight: 60,
        apply: (e) => { e.scavenger += 0.3; }
    },
    { 
        id: 'pierceAmmo', title: 'Piercing Ammo', desc: 'Bullets pierce enemies', weight: 40,
        apply: (e) => { e.pierceAmmo += 1; }
    },
    { 
        id: 'medicDrop', title: 'Medic Drop', desc: 'Enemies drop more HP', weight: 50,
        apply: (e) => { e.medicDrop += 1; }
    },
    { 
        id: 'overclock', title: 'Overclock', desc: 'Orbiters spin faster', weight: 30,
        apply: (e) => { e.overclock += 0.5; }
    },
    { 
        id: 'executioner', title: 'Executioner', desc: '+Dmg to targets below 50% HP', weight: 40,
        apply: (e) => { e.executioner += 0.2; }
    },
    { 
        id: 'extendedDash', title: 'Extended Dash', desc: 'Dash travels further', weight: 70,
        apply: (e) => { e.extendedDash += 1.5; }
    },

    // --- JET (Triangle) EXCLUSIVES ---
    { 
        id: 'piercing', title: 'Piercing Tip', desc: 'Frontal Ram Damage', classes: ['triangle'], weight: 50,
        apply: (e) => { e.piercing += 1; }
    },
    { 
        id: 'afterburner', title: 'Afterburners', desc: 'Dash leaves fire trail', classes: ['triangle'], weight: 40,
        apply: (e) => { e.afterburner += 1; }
    },
    { 
        id: 'ghostDash', title: 'Ghost Dash', desc: 'Invincible while dash', classes: ['triangle'], weight: 25,
        apply: (e) => { e.ghostDash = true; }
    },
    { 
        id: 'quickCharge', title: 'Quick Charge', desc: 'Dash cools down faster', classes: ['triangle'], weight: 50,
        apply: (e) => { e.dashMaxCooldown = Math.max(20, e.dashMaxCooldown - 10); }
    },
    { 
        id: 'sniper', title: 'Sniper Caliber', desc: 'Fast, long-range shots', classes: ['triangle'], weight: 40,
        apply: (e) => { e.bulletSpeed += 5; e.baseDamage += 5; e.sniper += 1; }
    },
    { 
        id: 'evasion', title: 'Evasion', desc: 'Chance to dodge shots', classes: ['triangle'], weight: 30,
        apply: (e) => { e.evasion += 0.05; }
    },

    // --- TANK (Square) EXCLUSIVES ---
    { 
        id: 'spikes', title: 'Spiked Armor', desc: 'Ramming Damage', classes: ['square'], weight: 50,
        apply: (e) => { e.spikes += 1; }
    },
    { 
        id: 'juggernaut', title: 'Juggernaut', desc: 'Massive HP, bigger size', classes: ['square'], weight: 30,
        apply: (e) => { e.maxHealth += 100; e.health += 100; e.size += 2; e.speed -= 0.1; }
    },
    { 
        id: 'regen', title: 'Regeneration', desc: 'Passively heal over time', classes: ['square'], weight: 40,
        apply: (e) => { e.regen += 1; }
    },
    { 
        id: 'shockwave', title: 'Shockwave', desc: 'Dashing creates a blast', classes: ['square'], weight: 25,
        apply: (e) => { e.shockwave += 1; }
    },
    { 
        id: 'heavyArt', title: 'Heavy Artillery', desc: 'Massive, heavy bullets', classes: ['square'], weight: 40,
        apply: (e) => { e.heavyArt += 1; e.baseDamage += 10; e.fireRate += 5; e.bulletSpeed -= 2; }
    },
    { 
        id: 'plating', title: 'Plating', desc: 'Flat damage reduction', classes: ['square'], weight: 50,
        apply: (e) => { e.plating += 2; }
    },

    // --- SOLDIER (Circle) EXCLUSIVES ---
    { 
        id: 'spikes', title: 'Spiked Armor', desc: 'Ramming Damage', classes: ['circle'], weight: 50,
        apply: (e) => { e.spikes += 1; }
    },
    { 
        id: 'vampirism', title: 'Vampirism', desc: 'Kills restore Health', classes: ['circle'], weight: 30,
        apply: (e) => { e.vampirism += 10; }
    },
    { 
        id: 'magnet', title: 'Magnetic Field', desc: 'Pull orbs from afar', classes: ['circle'], weight: 50,
        apply: (e) => { e.magnet += 1; }
    },
    { 
        id: 'rearguard', title: 'Rearguard', desc: 'Shoot backwards too', classes: ['circle'], weight: 40,
        apply: (e) => { e.rearguard += 1; }
    },
    { 
        id: 'efficiency', title: 'Efficiency', desc: 'Dash costs less points', classes: ['circle'], weight: 50,
        apply: (e) => { e.efficiency += 1; }
    },
    { 
        id: 'shrapnel', title: 'Shrapnel Rounds', desc: 'Bullets deal AoE damage', classes: ['circle'], weight: 25,
        apply: (e) => { e.shrapnel += 1; }
    }
];