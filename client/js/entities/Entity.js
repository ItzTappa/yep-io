// Base class for every ship in the arena: your player, bots and other online players.
// Holds stats, upgrades, cooldowns and movement. Drawing lives in render/entityRenderer.js.
import { CLASS_STATS } from '../data/classes.js';
import { UPGRADE_POOL, getUpgrade, maxTierOf } from '../data/upgrades.js';
import { emptyLoadout, getItem } from '../data/items.js';
import { drawEntity } from './render/entityRenderer.js';
import { ABILITY_DURATION, DEFAULT_ABILITY_DURATION, armorTierOf } from './geometry.js';

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
        this.color = `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`;
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
        this.magnet = 0;
        this.rearguard = 0;
        this.efficiency = 0;
        this.shrapnel = 0;
        this.wantsShockwave = false;
        this.orbiterHitTicks = new Map(); // target uid -> tick of next allowed orbiter hit

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
            this.upgrades[upgradeId] = 1;
            return true;
        }

        const tier = this.upgrades[upgradeId] || 0;
        if (tier >= maxTierOf(def, this)) return false;

        if (upgradeId === 'spikes' && !this.frontVisual) this.frontVisual = 'spikes';
        if (['fireRate', 'multiShot', 'damage'].includes(upgradeId) && !this.frontVisual) this.frontVisual = 'gun';
        if (ARMOR_UPGRADES.includes(upgradeId) && !this.bodyVisual) this.bodyVisual = 'armor';
        if ((upgradeId === 'speed' || upgradeId === 'dash') && !this.rearVisual) this.rearVisual = 'thrusters';
        if ((upgradeId === 'regen' || upgradeId === 'vampirism') && !this.auraVisual) this.auraVisual = 'regen';

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
        this.abilityCooldown = this.abilityMaxCooldown;
        this.abilityTimer = ABILITY_DURATION[this.activeAbility] ?? DEFAULT_ABILITY_DURATION;
        if (this.activeAbility === 'juggernaut') {
            this.size = this.baseSize * 1.5;
            this.health = this.maxHealth;
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
        if (this.shockwave > 0) this.wantsShockwave = true;

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
        if (this.dashTimer > 0) this.dashTimer--;
        if (this.abilityCooldown > 0) this.abilityCooldown--;

        if (this.abilityTimer > 0) {
            this.abilityTimer--;
            this.isCloaked = this.activeAbility === 'cloak';
            if (this.abilityTimer === 0 && this.activeAbility === 'juggernaut') this.size = this.baseSize;
        } else {
            this.isCloaked = false;
        }

        if (regen && this.regen > 0 && Math.random() < 0.05) {
            this.health = Math.min(this.maxHealth, this.health + this.regen);
        }
    }

    isDashing() {
        return this.dashTimer > 0 || (this.abilityTimer > 0 && this.activeAbility === 'phase_strike');
    }

    // Trail particles: dash afterimages, equipped Trail smoke, and thruster flames.
    updateTrail() {
        const speed = Math.hypot(this.vx, this.vy);
        const trailItem = getItem(this.equipped.Trail);
        const dashing = this.isDashing();

        if (dashing && !trailItem) {
            this.trail.push({ type: 'ghost', x: this.x, y: this.y, angle: this.angle, alpha: 0.25, color: this.color });
        } else if (trailItem && (dashing || speed > 1.0)) {
            const alpha = dashing ? 0.7 : 0.5;
            const backAngle = Math.atan2(this.vy, this.vx) + Math.PI;
            const spawnRadius = this.type === 'square' ? this.size / 2 : this.size * 0.8;
            const exhaustAngle = backAngle + (Math.random() - 0.5) * 1.2;
            const exhaustSpeed = Math.random() * 2 + (dashing ? 3 : 1);
            this.trail.push({
                type: 'smoke',
                x: this.x + Math.cos(backAngle) * spawnRadius + (Math.random() - 0.5) * 8,
                y: this.y + Math.sin(backAngle) * spawnRadius + (Math.random() - 0.5) * 8,
                vx: Math.cos(exhaustAngle) * exhaustSpeed,
                vy: Math.sin(exhaustAngle) * exhaustSpeed,
                angle: this.angle + (Math.random() - 0.5),
                rotSpeed: (Math.random() - 0.5) * 0.2,
                alpha,
                startAlpha: alpha,
                isDashing: dashing,
                color: trailItem.value
            });
        }

        if (this.rearVisual === 'thrusters' && (dashing || speed > 1.0)) this.spawnThrusterFlames(dashing);

        for (let i = this.trail.length - 1; i >= 0; i--) {
            const t = this.trail[i];
            if (t.type === 'smoke') {
                t.x += t.vx;
                t.y += t.vy;
                t.angle += t.rotSpeed;
                t.vx *= 0.9;
                t.vy *= 0.9;
                t.alpha -= 0.03;
            } else if (t.type === 'fire') {
                t.x += t.vx;
                t.y += t.vy;
                t.alpha -= 0.12;
            } else {
                t.alpha -= 0.05;
            }
            if (t.alpha <= 0) this.trail.splice(i, 1);
        }
    }

    spawnThrusterFlames(dashing) {
        const tier = Math.max(this.upgrades.speed || 0, this.upgrades.dash || 0);
        const len = 8 + tier * 3;
        const armorTier = armorTierOf(this);
        let back = this.type === 'circle' ? -this.size : -this.size / 2;
        if (this.bodyVisual === 'armor') back -= 4 + armorTier + (4 + armorTier * 1.5) / 2;
        const spread = this.type === 'square' ? this.size * 0.35 : this.size * 0.45;
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        const nozzles = [-spread, spread].map(side => ({
            x: this.x + cos * (back - len) - sin * side,
            y: this.y + sin * (back - len) + cos * side
        }));
        const count = dashing ? 3 + tier : 1 + Math.floor(tier / 2);
        const color = tier >= 5 ? '#ff00ff' : tier === 4 ? '#00ffcc' : tier === 3 ? '#ffd700' : tier === 2 ? '#ff2200' : '#ffaa00';

        for (let k = 0; k < count; k++) {
            const flameSpeed = Math.random() * 3 + (dashing ? 5 : 2);
            for (const n of nozzles) {
                const a = this.angle + Math.PI + (Math.random() - 0.5) * 0.6;
                this.trail.push({
                    type: 'fire', x: n.x, y: n.y,
                    vx: Math.cos(a) * flameSpeed, vy: Math.sin(a) * flameSpeed,
                    alpha: 1.0, color, size: 2 + Math.random() * 2
                });
            }
        }
    }

    draw(ctx, options) {
        drawEntity(ctx, this, options);
    }
}
