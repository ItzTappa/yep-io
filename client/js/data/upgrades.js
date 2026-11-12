// Every in-match upgrade. `apply` changes the ship's stats; the effects themselves live in
// game/systems (combat, projectiles, collisions) and game/abilities.js.
//   weight   - how often it is offered (halved for every tier you already own)
//   maxTier  - how many times it can be taken
//   classes  - only offered to these classes (omit for all)
//   isActiveAbility - an E-key ability; you can only hold one at a time
import { BALANCE } from './balance.js';

const U = BALANCE.upgrades;
const pctOfBase = (e, stat, pct) => e.base[stat] * pct;

export const UPGRADE_POOL = [
    // =====================================
    // CORE STATS
    // =====================================
    {
        id: 'health', title: 'Hull Integrity', desc: 'Increases max health by 15%.', weight: 100, maxTier: 5,
        apply: (e) => { const hp = pctOfBase(e, 'maxHealth', U.healthPct * (e.base.healthGrowth || 1)); e.maxHealth += hp; e.health += hp; }
    },
    {
        id: 'speed', title: 'Thrusters', desc: 'Increases movement speed.', weight: 100, maxTier: 5,
        apply: (e) => { e.speed += 0.5; }
    },
    {
        id: 'damage', title: 'Weapon Damage', desc: 'Increases bullet damage by 15%.', weight: 100, maxTier: 5,
        apply: (e) => { e.baseDamage += pctOfBase(e, 'baseDamage', U.damagePct); }
    },
    {
        id: 'fireRate', title: 'Auto-Loader', desc: 'Fires weapons 14% faster.', weight: 100, maxTier: 5,
        apply: (e) => { e.fireRate = Math.max(U.fireRateMinTicks, e.fireRate * U.fireRateMult); }
    },
    {
        id: 'regen', title: 'Nanobots', desc: 'Regenerates 0.6% of max health per second.', weight: 80, maxTier: 5,
        apply: (e) => { e.regen += 1; }
    },
    {
        id: 'dash', title: 'Dash Cooldown', desc: 'Dash recharges 15% faster.', weight: 80, maxTier: 5,
        apply: (e) => { e.dashMaxCooldown = Math.max(U.dashCooldownMinTicks, Math.round(e.dashMaxCooldown * U.dashCooldownMult)); }
    },

    // =====================================
    // WEAPONS / COMBAT PASSIVES
    // =====================================
    {
        id: 'multiShot', title: 'Multishot', desc: 'Fires an extra projectile (spread across your barrels).', weight: 40, maxTier: 5,
        apply: (e) => { e.multiShot += 1; }
    },
    {
        id: 'piercing', title: 'Piercing Rounds', desc: 'Bullets pass through one more target.', weight: 50, maxTier: 5,
        apply: (e) => { e.pierceAmmo += 1; }
    },
    {
        id: 'spikes', title: 'Ramming Spikes', desc: 'Deals heavy damage on collision.', weight: 60, maxTier: 5, classes: ['square', 'circle'],
        apply: (e) => { e.spikes += 1; }
    },
    {
        id: 'orbiters', title: 'Orbiters', desc: 'Spinning blades hit nearby enemies and block bullets.', weight: 30, maxTier: 5,
        apply: (e) => { e.orbiters += 1; e.orbiterDamage += 0.5; }
    },
    {
        id: 'missiles', title: 'Homing Missiles', desc: 'Fires auto-tracking missiles.', weight: 30, maxTier: 5,
        apply: (e) => { e.missiles += 1; }
    },
    {
        id: 'shrapnel', title: 'Shrapnel', desc: 'Bullets burst into fragments that hit nearby enemies.', weight: 20, maxTier: 5,
        apply: (e) => { e.shrapnel += 1; }
    },
    {
        id: 'heavyArt', title: 'Heavy Artillery', desc: 'Bigger bullets with 8% more damage.', weight: 40, maxTier: 5,
        apply: (e) => { e.heavyArt += 1; e.baseDamage += pctOfBase(e, 'baseDamage', U.heavyArtDamagePct); }
    },
    {
        id: 'rearguard', title: 'Rearguard', desc: 'Also shoots backwards (50% / 75% / 100% damage).', weight: 30, maxTier: 3,
        apply: (e) => { e.rearguard += 1; }
    },
    {
        id: 'sniper', title: 'Sniper Sight', desc: 'Faster bullets with longer range.', weight: 40, maxTier: 5,
        apply: (e) => { e.sniper += 1; e.bulletSpeed += U.sniperSpeed; }
    },

    // =====================================
    // UTILITIES / SURVIVAL PASSIVES
    // =====================================
    {
        id: 'scavenger', title: 'Scavenger', desc: 'Orbs give 20% more points.', weight: 60, maxTier: 5,
        apply: (e) => { e.scavenger += 0.2; }
    },
    {
        id: 'medicDrop', title: 'Medic Drop', desc: 'Killed enemies drop health orbs.', weight: 50, maxTier: 5,
        apply: (e) => { e.medicDrop += 1; }
    },
    {
        id: 'vampirism', title: 'Vampirism', desc: 'Heal for 5% of the damage you deal.', weight: 40, maxTier: 5,
        apply: (e) => { e.vampirism += 1; }
    },
    {
        id: 'magnet', title: 'Orb Magnet', desc: 'Pulls orbs from further away.', weight: 70, maxTier: 5,
        apply: (e) => { e.magnet += 1; }
    },
    {
        id: 'plating', title: 'Armor Plating', desc: 'Take 6% less damage.', weight: 50, maxTier: 5,
        apply: (e) => { e.plating += 1; const hp = pctOfBase(e, 'maxHealth', U.platingHealthPct); e.maxHealth += hp; e.health += hp; }
    },
    {
        id: 'evasion', title: 'Evasion', desc: '6% chance to dodge each projectile.', weight: 30, maxTier: 5,
        apply: (e) => { e.evasion += U.evasionPerTier; }
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
        id: 'shockwave', title: 'Shockwave', desc: 'Dashing creates a damaging blast (max once per 1.5s).', weight: 30, maxTier: 5,
        apply: (e) => { e.shockwave += 1; }
    },
    {
        id: 'executioner', title: 'Executioner', desc: '+15% damage to targets under half health.', weight: 30, maxTier: 5,
        apply: (e) => { e.executioner += U.executionerPerTier; }
    },
    {
        id: 'overclock', title: 'Overclock', desc: 'Orbiters spin and strike faster.', weight: 30, maxTier: 3, requires: 'orbiters',
        apply: (e) => { e.overclock += 0.5; }
    },

    // =====================================
    // ACTIVE ABILITIES (EXTREMELY RARE!)
    // Only 1 Active Ability can be held at a time.
    // duration / cooldown are in ticks (60 = 1 second).
    // =====================================

    // ANY CLASS (Universal) - Weight 5 (Very Rare)
    { id: 'shield', title: 'Dome Shield', desc: 'Active: Blocks all damage briefly.', weight: 5, maxTier: 1, isActiveAbility: true, duration: 150, cooldown: 420, apply: (e) => { e.activeAbility = 'shield'; } },
    { id: 'overdrive', title: 'Overdrive', desc: 'Active: Boosts speed and fire rate.', weight: 5, maxTier: 1, isActiveAbility: true, duration: 120, cooldown: 450, apply: (e) => { e.activeAbility = 'overdrive'; } },
    { id: 'bullet_nova', title: 'Bullet Nova', desc: 'Active: Sprays bullets in a 360-degree explosion.', weight: 5, maxTier: 1, isActiveAbility: true, cooldown: 360, apply: (e) => { e.activeAbility = 'bullet_nova'; } },
    { id: 'blink', title: 'Phase Blink', desc: 'Active: Instantly teleport forward a short distance.', weight: 5, maxTier: 1, isActiveAbility: true, cooldown: 240, apply: (e) => { e.activeAbility = 'blink'; } },
    { id: 'emp', title: 'EMP Blast', desc: 'Active: Stuns enemies and disables weapons.', weight: 5, maxTier: 1, isActiveAbility: true, cooldown: 540, apply: (e) => { e.activeAbility = 'emp'; } },
    { id: 'cloak', title: 'Active Camo', desc: 'Active: Become invisible and drop enemy aggro.', weight: 4, maxTier: 1, isActiveAbility: true, duration: 210, cooldown: 600, apply: (e) => { e.activeAbility = 'cloak'; } },
    { id: 'repulsor', title: 'Repulsor Field', desc: 'Active: Pushes enemies away and reflects their bullets.', weight: 4, maxTier: 1, isActiveAbility: true, duration: 120, cooldown: 600, apply: (e) => { e.activeAbility = 'repulsor'; } },
    { id: 'railgun', title: 'Plasma Railgun', desc: 'Active: Fires a devastating, infinite-pierce plasma beam.', weight: 5, maxTier: 1, isActiveAbility: true, cooldown: 450, apply: (e) => { e.activeAbility = 'railgun'; } },

    // TRIANGLE (Jet) EXCLUSIVE - Weight 6
    { id: 'sonic_boom', title: 'Sonic Boom', desc: 'Active: Massive speed boost that damages enemies hit.', weight: 6, maxTier: 1, classes: ['triangle'], isActiveAbility: true, duration: 180, cooldown: 450, apply: (e) => { e.activeAbility = 'sonic_boom'; } },
    { id: 'phase_strike', title: 'Phase Strike', desc: 'Active: Dash through enemies dealing massive damage.', weight: 6, maxTier: 1, classes: ['triangle'], isActiveAbility: true, duration: 30, cooldown: 360, apply: (e) => { e.activeAbility = 'phase_strike'; } },
    { id: 'strafe_run', title: 'Strafe Run', desc: 'Active: Side cannons fire extra bursts while you fly.', weight: 6, maxTier: 1, classes: ['triangle'], isActiveAbility: true, duration: 180, cooldown: 480, apply: (e) => { e.activeAbility = 'strafe_run'; } },

    // SQUARE (Tank) EXCLUSIVE - Weight 6
    { id: 'juggernaut', title: 'Juggernaut', desc: 'Active: Grow huge, heal 15% and become invincible briefly.', weight: 6, maxTier: 1, classes: ['square'], isActiveAbility: true, duration: 100, cooldown: 660, apply: (e) => { e.activeAbility = 'juggernaut'; } },
    { id: 'missile_swarm', title: 'Missile Swarm', desc: 'Active: Instantly fire a barrage of trackers.', weight: 6, maxTier: 1, classes: ['square'], isActiveAbility: true, cooldown: 600, apply: (e) => { e.activeAbility = 'missile_swarm'; } },
    { id: 'earthshatter', title: 'Earthshatter', desc: 'Active: Devastating AoE shockwave slam.', weight: 6, maxTier: 1, classes: ['square'], isActiveAbility: true, cooldown: 540, apply: (e) => { e.activeAbility = 'earthshatter'; } },

    // CIRCLE (Soldier) EXCLUSIVE - Weight 6
    { id: 'minigun', title: 'Minigun', desc: 'Active: Insane fire rate for 4 seconds.', weight: 6, maxTier: 1, classes: ['circle'], isActiveAbility: true, duration: 240, cooldown: 480, apply: (e) => { e.activeAbility = 'minigun'; } },
    { id: 'tactical_nuke', title: 'Tactical Nuke', desc: 'Active: Fires a slow, devastating explosive bomb.', weight: 6, maxTier: 1, classes: ['circle'], isActiveAbility: true, cooldown: 480, apply: (e) => { e.activeAbility = 'tactical_nuke'; } },
    { id: 'blade_ring', title: 'Blade Ring', desc: 'Active: Expand and retract a massive ring of blades.', weight: 6, maxTier: 1, classes: ['circle'], isActiveAbility: true, duration: 240, cooldown: 540, apply: (e) => { e.activeAbility = 'blade_ring'; } }
];

const BY_ID = new Map(UPGRADE_POOL.map(u => [u.id, u]));
export const getUpgrade = (id) => BY_ID.get(id) || null;
export const maxTierOf = (upgrade, entity) => upgrade.maxTier !== undefined ? upgrade.maxTier : entity.maxUpgradeTier;
export const isAbility = (id) => !!getUpgrade(id)?.isActiveAbility;
export const abilityName = (id) => (getUpgrade(id)?.title || id || '').replace('Active: ', '');

// Badge / card colours per tier.
export const TIER_COLORS = { 1: '#cd7f32', 2: '#c0c0c0', 3: '#ffd700', 4: '#00ffcc', 5: '#ff00ff' };

// Abilities that deal damage or push enemies. These are disabled while standing in a safe zone.
export const OFFENSIVE_ABILITIES = new Set([
    'bullet_nova', 'emp', 'repulsor', 'railgun', 'sonic_boom', 'phase_strike', 'strafe_run',
    'missile_swarm', 'earthshatter', 'minigun', 'tactical_nuke', 'blade_ring'
]);