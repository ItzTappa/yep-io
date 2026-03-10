export const UPGRADE_POOL = [
    // =====================================
    // CORE STATS
    // =====================================
    {
        id: 'health', title: 'Hull Integrity', desc: 'Increases max health by 50.', weight: 100, maxTier: 5,
        apply: (e) => { e.maxHealth += 50; e.health += 50; }
    },
    {
        id: 'speed', title: 'Thrusters', desc: 'Increases movement speed.', weight: 100, maxTier: 5,
        apply: (e) => { e.speed += 0.5; }
    },
    {
        id: 'damage', title: 'Weapon Damage', desc: 'Increases bullet damage.', weight: 100, maxTier: 5,
        apply: (e) => { e.baseDamage += 5; }
    },
    {
        id: 'fireRate', title: 'Auto-Loader', desc: 'Fires weapons faster.', weight: 100, maxTier: 5,
        apply: (e) => { e.fireRate = Math.max(5, e.fireRate - 3); }
    },
    {
        id: 'regen', title: 'Nanobots', desc: 'Slowly regenerates health over time.', weight: 80, maxTier: 5,
        apply: (e) => { e.regen += 0.2; }
    },
    {
        id: 'dash', title: 'Dash Cooldown', desc: 'Dash recharges much faster.', weight: 80, maxTier: 5,
        apply: (e) => { e.dashMaxCooldown = Math.max(30, e.dashMaxCooldown - 15); }
    },

    // =====================================
    // WEAPONS / COMBAT PASSIVES
    // =====================================
    {
        id: 'multiShot', title: 'Multishot', desc: 'Fires additional projectiles.', weight: 40, maxTier: 5,
        apply: (e) => { e.multiShot += 1; }
    },
    {
        id: 'piercing', title: 'Piercing Rounds', desc: 'Bullets pass through targets.', weight: 50, maxTier: 5,
        apply: (e) => { e.pierceAmmo += 1; }
    },
    {
        id: 'spikes', title: 'Ramming Spikes', desc: 'Deals heavy damage on collision.', weight: 60, maxTier: 5, classes: ['square', 'circle'],
        apply: (e) => { e.spikes += 1; }
    },
    {
        id: 'orbiters', title: 'Orbiters', desc: 'Spinning energy blades protect you.', weight: 30, maxTier: 5,
        apply: (e) => { e.orbiters += 1; e.orbiterDamage += 0.5; }
    },
    {
        id: 'missiles', title: 'Homing Missiles', desc: 'Fires auto-tracking missiles.', weight: 30, maxTier: 5,
        apply: (e) => { e.missiles += 1; }
    },
    {
        id: 'shrapnel', title: 'Shrapnel', desc: 'Bullets explode into fragments on hit.', weight: 20, maxTier: 5,
        apply: (e) => { e.shrapnel += 1; }
    },
    {
        id: 'heavyArt', title: 'Heavy Artillery', desc: 'Increases projectile size and damage.', weight: 40, maxTier: 5,
        apply: (e) => { e.heavyArt += 1; e.baseDamage += 3; }
    },
    {
        id: 'rearguard', title: 'Rearguard', desc: 'Shoot backwards while firing forward.', weight: 30, maxTier: 3,
        apply: (e) => { e.rearguard += 1; }
    },
    {
        id: 'sniper', title: 'Sniper Sight', desc: 'Bullets travel much further and faster.', weight: 40, maxTier: 5,
        apply: (e) => { e.sniper += 1; e.bulletSpeed += 1; }
    },

    // =====================================
    // UTILITIES / SURVIVAL PASSIVES
    // =====================================
    {
        id: 'scavenger', title: 'Scavenger', desc: 'Gain more points and XP from orbs.', weight: 60, maxTier: 5,
        apply: (e) => { e.scavenger += 0.2; }
    },
    {
        id: 'medicDrop', title: 'Medic Drop', desc: 'Killed enemies drop health orbs.', weight: 50, maxTier: 5,
        apply: (e) => { e.medicDrop += 1; }
    },
    {
        id: 'vampirism', title: 'Vampirism', desc: 'Heal your ship upon killing enemies.', weight: 40, maxTier: 5,
        apply: (e) => { e.vampirism += 5; }
    },
    {
        id: 'magnet', title: 'Orb Magnet', desc: 'Pulls XP orbs from further away.', weight: 70, maxTier: 5,
        apply: (e) => { e.magnet += 1; }
    },
    {
        id: 'plating', title: 'Armor Plating', desc: 'Reduces all incoming damage.', weight: 50, maxTier: 5,
        apply: (e) => { e.plating += 1; e.maxHealth += 20; e.health += 20; }
    },
    {
        id: 'evasion', title: 'Evasion', desc: 'Adds a chance to completely dodge projectiles.', weight: 30, maxTier: 5,
        apply: (e) => { e.evasion += 0.05; }
    },
    {
        id: 'efficiency', title: 'Dash Efficiency', desc: 'Dashing costs fewer points.', weight: 50, maxTier: 2,
        apply: (e) => { e.efficiency += 1; }
    },
    {
        id: 'extendedDash', title: 'Extended Dash', desc: 'Dash burst travels further.', weight: 50, maxTier: 3,
        apply: (e) => { e.extendedDash += 1; }
    },
    {
        id: 'afterburner', title: 'Afterburner', desc: 'Leave a trail of fire when dashing.', weight: 30, maxTier: 5,
        apply: (e) => { e.afterburner += 1; }
    },
    {
        id: 'ghostDash', title: 'Ghost Dash', desc: 'Become invulnerable while dashing.', weight: 10, maxTier: 1,
        apply: (e) => { e.ghostDash = true; }
    },
    {
        id: 'shockwave', title: 'Shockwave', desc: 'Create a damaging explosion when dashing.', weight: 30, maxTier: 5,
        apply: (e) => { e.shockwave += 1; }
    },
    {
        id: 'executioner', title: 'Executioner', desc: 'Deal massive damage to low health targets.', weight: 30, maxTier: 5,
        apply: (e) => { e.executioner += 0.1; }
    },
    {
        id: 'overclock', title: 'Overclock', desc: 'Orbiters spin much faster.', weight: 30, maxTier: 3,
        apply: (e) => { e.overclock += 0.5; }
    },

    // =====================================
    // ACTIVE ABILITIES (EXTREMELY RARE!)
    // Only 1 Active Ability can be held at a time.
    // =====================================

    // ANY CLASS (Universal) - Weight 5 (Very Rare)
    { id: 'shield', title: 'Dome Shield', desc: 'Active: Blocks all damage briefly.', weight: 5, maxTier: 1, isActiveAbility: true, apply: (e) => { e.activeAbility = 'shield'; } },
    { id: 'overdrive', title: 'Overdrive', desc: 'Active: Boosts speed and fire rate.', weight: 5, maxTier: 1, isActiveAbility: true, apply: (e) => { e.activeAbility = 'overdrive'; } },
    { id: 'bullet_nova', title: 'Bullet Nova', desc: 'Active: Sprays bullets in a 360-degree explosion.', weight: 5, maxTier: 1, isActiveAbility: true, apply: (e) => { e.activeAbility = 'bullet_nova'; } },
    { id: 'blink', title: 'Phase Blink', desc: 'Active: Instantly teleport forward a short distance.', weight: 5, maxTier: 1, isActiveAbility: true, apply: (e) => { e.activeAbility = 'blink'; } },
    { id: 'emp', title: 'EMP Blast', desc: 'Active: Stuns enemies and disables weapons.', weight: 5, maxTier: 1, isActiveAbility: true, apply: (e) => { e.activeAbility = 'emp'; } },
    { id: 'cloak', title: 'Active Camo', desc: 'Active: Become invisible and drop enemy aggro.', weight: 4, maxTier: 1, isActiveAbility: true, apply: (e) => { e.activeAbility = 'cloak'; } },
    { id: 'repulsor', title: 'Repulsor Field', desc: 'Active: Continuously pushes enemies away from you.', weight: 4, maxTier: 1, isActiveAbility: true, apply: (e) => { e.activeAbility = 'repulsor'; } },
    { id: 'railgun', title: 'Plasma Railgun', desc: 'Active: Fires a devastating, infinite-pierce plasma beam.', weight: 5, maxTier: 1, isActiveAbility: true, apply: (e) => { e.activeAbility = 'railgun'; } }, // <--- THE RAILGUN IS HERE

    // TRIANGLE (Jet) EXCLUSIVE - Weight 6
    { id: 'sonic_boom', title: 'Sonic Boom', desc: 'Active: Massive speed boost that damages enemies hit.', weight: 6, maxTier: 1, classes: ['triangle'], isActiveAbility: true, apply: (e) => { e.activeAbility = 'sonic_boom'; } },
    { id: 'phase_strike', title: 'Phase Strike', desc: 'Active: Dash through enemies dealing massive damage.', weight: 6, maxTier: 1, classes: ['triangle'], isActiveAbility: true, apply: (e) => { e.activeAbility = 'phase_strike'; } },
    { id: 'strafe_run', title: 'Strafe Run', desc: 'Active: Fires heavy bullets sideways while flying.', weight: 6, maxTier: 1, classes: ['triangle'], isActiveAbility: true, apply: (e) => { e.activeAbility = 'strafe_run'; } },

    // SQUARE (Tank) EXCLUSIVE - Weight 6
    { id: 'juggernaut', title: 'Juggernaut', desc: 'Active: Grow massive, heal fully, and become invincible.', weight: 6, maxTier: 1, classes: ['square'], isActiveAbility: true, apply: (e) => { e.activeAbility = 'juggernaut'; } },
    { id: 'missile_swarm', title: 'Missile Swarm', desc: 'Active: Instantly fire a massive barrage of trackers.', weight: 6, maxTier: 1, classes: ['square'], isActiveAbility: true, apply: (e) => { e.activeAbility = 'missile_swarm'; } },
    { id: 'earthshatter', title: 'Earthshatter', desc: 'Active: Devastating AoE shockwave slam.', weight: 6, maxTier: 1, classes: ['square'], isActiveAbility: true, apply: (e) => { e.activeAbility = 'earthshatter'; } },

    // CIRCLE (Soldier) EXCLUSIVE - Weight 6
    { id: 'minigun', title: 'Minigun', desc: 'Active: Insane fire rate for 4 seconds.', weight: 6, maxTier: 1, classes: ['circle'], isActiveAbility: true, apply: (e) => { e.activeAbility = 'minigun'; } },
    { id: 'tactical_nuke', title: 'Tactical Nuke', desc: 'Active: Fires a slow, devastating explosive bomb.', weight: 6, maxTier: 1, classes: ['circle'], isActiveAbility: true, apply: (e) => { e.activeAbility = 'tactical_nuke'; } },
    { id: 'blade_ring', title: 'Blade Ring', desc: 'Active: Expand and retract a massive ring of blades.', weight: 6, maxTier: 1, classes: ['circle'], isActiveAbility: true, apply: (e) => { e.activeAbility = 'blade_ring'; } }
];