// Base class for every ship in the arena: your player, bots and other online players.
// Holds stats, upgrades, cooldowns and movement. Drawing lives in render/entityRenderer.js.
import { CLASS_STATS } from '../data/classes.js';
import { UPGRADE_POOL, getUpgrade, maxTierOf } from '../data/upgrades.js';
import { BALANCE } from '../data/balance.js';
import { emptyLoadout, getItem, bodyColorFor, bodyFinishFor, loadoutForClass } from '../data/items.js';
import { drawEntity } from './render/entityRenderer.js';
import { spawnTrail, spawnDashEcho, spawnThrusterFlame, updateTrailParticles } from './render/trails.js';
import { SHIP_PALETTE } from './render/palette.js';
import { armorTierOf } from './geometry.js';

// Thruster flame colour per tier (T1..T5).
const FLAME_COLORS = [null, '#ffb347', '#ff8a3d', '#ffd166', '#5eead4', '#f0abfc'];

let nextUid = 1;

const ARMOR_UPGRADES = ['health', 'plating'];

export class Entity {
    constructor(x, y, type) {
        this.uid = nextUid++;          // unique on this computer
        this.netId = null;             // id shared with other players (bots: 'b12', players: socket id)
        this.type = CLASS_STATS[type] ? type : 'circle';
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.color = SHIP_PALETTE[Math.floor(Math.random() * SHIP_PALETTE.length)];
        this.colorFinish = null;           // special paint from a Color cosmetic (render/finishes.js)
        this.name = 'Entity';
        this.team = null;              // ships with the same team never hurt each other

        this.isPlayer = false;         // the local player
        this.isBot = false;
        this.isRemotePlayer = false;   // another person, controlled from their computer
        this.isTeammate = false;       // on the local player's team (drawn cyan in the UI)
        this.isDead = false;
        this.inSafeZone = false;

        this.points = 0;
        this.upgradeProgress = 0;
        this.kills = 0;
        this.upgradeCount = 0;

        Object.assign(this, CLASS_STATS[this.type]); // speed, size, maxHealth, fireRate, baseDamage, dashMaxCooldown, bulletSpeed
        this.base = { ...CLASS_STATS[this.type] };  // percentage upgrades are based on these
        this.baseSize = this.size;
        this.health = this.maxHealth;
        this.fireCooldown = 0;
        this.dashCooldown = 0;
        this.dashTimer = 0;
        this.spikeCooldown = 0;
        this.missileCooldown = 0;
        this.trail = [];

        this.upgrades = {};
        for (const upg of UPGRADE_POOL) this.upgrades[upg.id] = 0;
        this.maxUpgradeTier = 5;
        this.equipped = emptyLoadout();

        // Upgrade stats (see data/upgrades.js)
        this.multiShot = 0;
        this.spikes = 0;
        this.orbiters = 0;
        this.orbiterDamage = 0.5;
        this.overclock = 1.0;
        this.missiles = 0;
        this.scavenger = 1.0;
        this.pierceAmmo = 0;
        this.medicDrop = 0;
        this.executioner = 0;
        this.extendedDash = 0;
        this.afterburner = 0;
        this.ghostDash = false;
        this.sniper = 0;
        this.evasion = 0;
        this.regen = 0;
        this.shockwave = 0;
        this.heavyArt = 0;
        this.plating = 0;
        this.vampirism = 0;
        this.siphon = 0;
        this.magnet = 0;
        this.rearguard = 0;
        this.efficiency = 0;
        this.shrapnel = 0;
        this.wantsShockwave = false;
        this.orbiterHitTicks = new Map(); // target uid -> tick of next allowed orbiter hit
        this.shockwaveCooldown = 0;

        // Visual add-ons unlocked by upgrades
        this.frontVisual = null;
        this.bodyVisual = null;
        this.rearVisual = null;
        this.auraVisual = null;

        // Active ability (E key)
        this.activeAbility = null;
        this.abilityCooldown = 0;
        this.abilityTimer = 0;
        this.abilityMaxCooldown = 450;
        this.abilityTriggered = false;
        this.isCloaked = false;
    }

    // ---------- upgrades ----------

    // Applies one tier of an upgrade. Returns false if it is unknown or already maxed.
    applyUpgrade(upgradeId) {
        const def = getUpgrade(upgradeId);
        if (!def) return false;

        if (def.isActiveAbility) {
            if (this.activeAbility === upgradeId) return false;
            this.activeAbility = upgradeId;
            this.abilityMaxCooldown = def.cooldown ?? 450;
            this.upgrades[upgradeId] = 1;
            return true;
        }

        const tier = this.upgrades[upgradeId] || 0;
        if (tier >= maxTierOf(def, this)) return false;

        if (upgradeId === 'spikes' && !this.frontVisual) this.frontVisual = 'spikes';
        if (['fireRate', 'multiShot', 'damage'].includes(upgradeId) && !this.frontVisual) this.frontVisual = 'gun';
        if (ARMOR_UPGRADES.includes(upgradeId) && !this.bodyVisual) this.bodyVisual = 'armor';
        if ((upgradeId === 'speed' || upgradeId === 'dash') && !this.rearVisual) this.rearVisual = 'thrusters';
        if (['regen', 'vampirism', 'siphon'].includes(upgradeId) && !this.auraVisual) this.auraVisual = 'regen';

        def.apply(this);
        this.upgrades[upgradeId] = tier + 1;
        return true;
    }

    // Brings this ship up to the given tiers (used to mirror other players' and bots' upgrades).
    syncUpgradeTiers(tiers) {
        for (const id in tiers) {
            const target = tiers[id] | 0;
            let guard = 10;
            while ((this.upgrades[id] || 0) < target && guard-- > 0) {
                if (!this.applyUpgrade(id)) break;
            }
        }
    }

    // Only the tiers that are above zero, e.g. { speed: 2, shield: 1 }.
    upgradeTiers() {
        const out = {};
        for (const id in this.upgrades) if (this.upgrades[id] > 0) out[id] = this.upgrades[id];
        return out;
    }

    // ---------- actions ----------

    useAbility({ ignoreCooldown = false } = {}) {
        if (!this.activeAbility || (!ignoreCooldown && this.abilityCooldown > 0)) return false;
        const def = getUpgrade(this.activeAbility);
        this.abilityCooldown = this.abilityMaxCooldown;
        this.abilityTimer = def?.duration ?? 120;
        if (this.activeAbility === 'juggernaut') {
            this.size = this.baseSize * 1.5;
            this.health = Math.min(this.maxHealth, this.health + this.maxHealth * 0.15);
        }
        this.abilityTriggered = true;
        return true;
    }

    dashCost() {
        return Math.max(0, 2 - this.efficiency);
    }

    // Dashing costs a couple of points. Returns true if the dash happened.
    dash(dx, dy) {
        const cost = this.dashCost();
        if (this.dashCooldown > 0 || this.points < cost) return false;

        this.points -= cost;
        this.upgradeProgress = Math.max(0, this.upgradeProgress - cost);
        this.dashCooldown = this.dashMaxCooldown;
        this.dashTimer = 10;
        if (this.shockwave > 0 && this.shockwaveCooldown <= 0) {
            this.wantsShockwave = true;
            this.shockwaveCooldown = BALANCE.upgrades.shockwaveCooldownTicks;
        }

        let length = Math.hypot(dx, dy);
        if (length === 0) {
            dx = Math.cos(this.angle);
            dy = Math.sin(this.angle);
            length = 1;
        }
        const force = 4.0 + this.extendedDash;
        this.vx += (dx / length) * this.speed * force;
        this.vy += (dy / length) * this.speed * force;
        return true;
    }

    // ---------- per-tick update ----------

    update() {
        this.updatePhysics();
        this.updateTimers();
        this.updateTrail();
    }

    updatePhysics() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.85;
        this.vy *= 0.85;
    }

    updateTimers({ regen = true } = {}) {
        const abilityOn = this.abilityTimer > 0;
        const fireRateMultiplier = abilityOn && this.activeAbility === 'minigun' ? 3
            : abilityOn && this.activeAbility === 'overdrive' ? 2 : 1;
        if (this.fireCooldown > 0) this.fireCooldown -= fireRateMultiplier;
        if (this.dashCooldown > 0) this.dashCooldown--;
        if (this.spikeCooldown > 0) this.spikeCooldown--;
        if (this.shockwaveCooldown > 0) this.shockwaveCooldown--;
        if (this.dashTimer > 0) this.dashTimer--;
        if (this.abilityCooldown > 0) this.abilityCooldown--;

        if (this.abilityTimer > 0) {
            this.abilityTimer--;
            this.isCloaked = this.activeAbility === 'cloak';
            if (this.abilityTimer === 0 && this.activeAbility === 'juggernaut') this.size = this.baseSize;
        } else {
            this.isCloaked = false;
        }

        if (regen && this.regen > 0 && this.health < this.maxHealth) {
            this.health = Math.min(this.maxHealth, this.health + this.maxHealth * BALANCE.upgrades.regenPctPerSec * this.regen / 60);
        }
    }

    isDashing() {
        return this.dashTimer > 0 || (this.abilityTimer > 0 && this.activeAbility === 'phase_strike');
    }

    // Trail particles: dash afterimages, the equipped Trail, and thruster flames (see render/trails.js).
    updateTrail() {
        const moving = Math.hypot(this.vx, this.vy) > 1.0;
        const trailItem = getItem(this.equipped.Trail);
        const dashing = this.isDashing();

        if (trailItem && (dashing || moving)) spawnTrail(this, trailItem, dashing);
        else if (dashing) spawnDashEcho(this);
        if (this.rearVisual === 'thrusters' && (dashing || moving)) this.spawnThrusterFlames(dashing);
        updateTrailParticles(this);
    }

    // Flames from the two thruster nozzles (positions match the drawn nozzles).
    spawnThrusterFlames(dashing) {
        const tier = Math.max(1, Math.max(this.upgrades.speed || 0, this.upgrades.dash || 0));
        const armor = this.bodyVisual === 'armor' ? 3 + Math.max(1, armorTierOf(this)) * 1.4 : 0;
        const exitX = -(this.type === 'circle' ? this.size : this.size / 2) - armor + 3 - (7 + tier * 2) - 1;
        const spread = this.type === 'square' ? this.size * 0.3 : this.size * 0.42;
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        // Higher tiers get bigger flames rather than more of them (keeps the particle count low).
        const count = dashing ? 2 : 1;
        const color = FLAME_COLORS[tier];
        const size = 2.2 + tier * 0.45;
        for (let k = 0; k < count; k++) {
            for (const side of [-1, 1]) {
                const x = this.x + cos * exitX - sin * side * spread;
                const y = this.y + sin * exitX + cos * side * spread;
                const a = this.angle + Math.PI + (Math.random() - 0.5) * 0.5;
                spawnThrusterFlame(this, x, y, a, Math.random() * 2.5 + (dashing ? 4.5 : 2), color, size);
            }
        }
    }

    // Puts on a set of cosmetics (keeps only valid items for this class).
    applyLoadout(equipped) {
        this.equipped = loadoutForClass(equipped, this.type);
        this.color = getItem(this.equipped.Color) ? bodyColorFor(this.equipped) : this.color;
        this.colorFinish = bodyFinishFor(this.equipped);
    }

    draw(ctx, options) {
        drawEntity(ctx, this, options);
    }
}
