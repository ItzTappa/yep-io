import { distance } from './utils.js';
import { ITEMS_DB } from './items.js'; 
import { UPGRADE_POOL } from './upgrades.js';

export function getWeightedUpgrades(entity, count = 3) {
    let available = UPGRADE_POOL.filter(upg => {
        let underMax = entity.upgrades[upg.id] < entity.maxUpgradeTier;
        let classAllowed = !upg.classes || upg.classes.includes(entity.type);
        return underMax && classAllowed;
    });

    if (available.length === 0) return [];

    let weightedList = available.map(upg => {
        let currentTier = entity.upgrades[upg.id];
        let dynamicWeight = upg.weight * Math.pow(0.5, currentTier); 
        return { ...upg, dynamicWeight };
    });

    let choices = [];
    for (let i = 0; i < count; i++) {
        if (weightedList.length === 0) break;
        let totalWeight = weightedList.reduce((sum, item) => sum + item.dynamicWeight, 0);
        let r = Math.random() * totalWeight;
        let cumulative = 0;
        for (let j = 0; j < weightedList.length; j++) {
            cumulative += weightedList[j].dynamicWeight;
            if (r <= cumulative) {
                choices.push(weightedList[j]);
                weightedList.splice(j, 1); 
                break;
            }
        }
    }
    return choices;
}

export class Entity {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.vx = 0; this.vy = 0; this.angle = 0;
        this.color = `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`;
        this.points = 0;
        this.upgradeProgress = 0; 
        this.kills = 0;
        this.upgradeCount = 0; 
        this.dashCooldown = 0;
        this.dashTimer = 0;
        this.trail = []; 

        if (type === 'circle') {
            this.speed = 6.0; this.size = 20; this.maxHealth = 130;
            this.fireRate = 22; this.baseDamage = 15; 
            this.dashMaxCooldown = 100; this.bulletSpeed = 14;
        } else if (type === 'square') {
            this.speed = 4.2; this.size = 28; this.maxHealth = 250; 
            this.fireRate = 55; this.baseDamage = 35; 
            this.dashMaxCooldown = 150; this.bulletSpeed = 18;
        } else if (type === 'triangle') {
            this.speed = 9.0; this.size = 20; this.maxHealth = 85; 
            this.fireRate = 14; this.baseDamage = 7; 
            this.dashMaxCooldown = 75; this.bulletSpeed = 16;
        }
        
        this.health = this.maxHealth;
        this.fireCooldown = 0;
        this.name = "Entity";
        this.isDead = false;
        
        this.upgrades = {};
        UPGRADE_POOL.forEach(upg => this.upgrades[upg.id] = 0);
        
        this.maxUpgradeTier = 5; 
        this.equipped = { Skin: null, Trail: null, Banner: null, Color: null };

        this.multiShot = 0; this.spikes = 0; this.piercing = 0; this.spikeCooldown = 0;
        this.orbiters = 0; this.orbiterDamage = 0.5; this.missiles = 0; this.missileCooldown = 0;

        this.scavenger = 1.0; this.pierceAmmo = 0; this.medicDrop = 0;
        this.overclock = 1.0; this.executioner = 0; this.extendedDash = 0;
        this.afterburner = 0; this.ghostDash = false; this.sniper = 0; this.evasion = 0;
        this.regen = 0; this.wantsShockwave = false; this.shockwave = 0;
        this.heavyArt = 0; this.plating = 0; this.vampirism = 0;
        this.magnet = 0; this.rearguard = 0; this.efficiency = 0; this.shrapnel = 0;
        
        // VISUAL UPGRADE TRACKERS
        this.frontVisual = null;
        this.bodyVisual = null;
        this.rearVisual = null;
        this.auraVisual = null;
    }

    applyUpgrade(upgradeId) {
        if (this.upgrades[upgradeId] >= this.maxUpgradeTier) return; 
        
        // Permanently sets physical visuals. The first picked in that slot stays forever.
        if (upgradeId === 'spikes' && !this.frontVisual) this.frontVisual = 'spikes';
        if ((upgradeId === 'fireRate' || upgradeId === 'multiShot' || upgradeId === 'damage') && !this.frontVisual) this.frontVisual = 'gun';
        if ((upgradeId === 'maxHealth' || upgradeId === 'plating') && !this.bodyVisual) this.bodyVisual = 'armor';
        if ((upgradeId === 'speed' || upgradeId === 'dash') && !this.rearVisual) this.rearVisual = 'thrusters';
        if ((upgradeId === 'regen' || upgradeId === 'vampirism') && !this.auraVisual) this.auraVisual = 'regen';

        const upgradeDef = UPGRADE_POOL.find(u => u.id === upgradeId);
        if (upgradeDef && upgradeDef.apply) {
            upgradeDef.apply(this); 
            this.upgrades[upgradeId]++;
        }
    }

    dash(dx, dy) {
        let dashCost = Math.max(0, 2 - this.efficiency); 
        if (this.dashCooldown <= 0 && this.points >= dashCost) {
            this.points -= dashCost;
            this.upgradeProgress = Math.max(0, this.upgradeProgress - dashCost); 
            this.dashCooldown = this.dashMaxCooldown;
            this.dashTimer = 10; 
            if (this.shockwave > 0) this.wantsShockwave = true; 
            let length = Math.hypot(dx, dy);
            if (length === 0) {
                dx = Math.cos(this.angle); dy = Math.sin(this.angle); length = 1;
            }
            let dashForce = 4.0 + this.extendedDash;
            this.vx += (dx / length) * (this.speed * dashForce);
            this.vy += (dy / length) * (this.speed * dashForce);
        }
    }

    update() {
        this.x += this.vx; this.y += this.vy;
        this.vx *= 0.85; this.vy *= 0.85; 
        if (this.fireCooldown > 0) this.fireCooldown--;
        if (this.dashCooldown > 0) this.dashCooldown--;
        if (this.spikeCooldown > 0) this.spikeCooldown--;
        if (this.dashTimer > 0) this.dashTimer--;
        if (this.regen > 0 && Math.random() < 0.05) { 
            this.health = Math.min(this.maxHealth, this.health + this.regen); 
        }
        let speed = Math.hypot(this.vx, this.vy);
        let hasCustomTrail = this.equipped && this.equipped.Trail !== null && ITEMS_DB[this.equipped.Trail];
        let isDashing = this.dashTimer > 0;
        if (isDashing && !hasCustomTrail) {
            this.trail.push({ type: 'ghost', x: this.x, y: this.y, angle: this.angle, alpha: 0.25, color: this.color });
        } 
        else if (hasCustomTrail && (isDashing || speed > 1.0)) {
            let tColor = ITEMS_DB[this.equipped.Trail].value;
            let sAlpha = isDashing ? 0.7 : 0.5;
            let movementAngle = Math.atan2(this.vy, this.vx);
            let backAngle = movementAngle + Math.PI;
            let spawnX = this.x + Math.cos(backAngle) * (this.size * 0.8);
            let spawnY = this.y + Math.sin(backAngle) * (this.size * 0.8);
            let exhaustAngle = backAngle + (Math.random() - 0.5) * 1.2;
            let exhaustSpeed = Math.random() * 2 + (isDashing ? 3 : 1);
            this.trail.push({
                type: 'smoke', x: spawnX + (Math.random() - 0.5) * 8, y: spawnY + (Math.random() - 0.5) * 8, 
                vx: Math.cos(exhaustAngle) * exhaustSpeed, vy: Math.sin(exhaustAngle) * exhaustSpeed,
                angle: this.angle + (Math.random() - 0.5), rotSpeed: (Math.random() - 0.5) * 0.2, 
                alpha: sAlpha, startAlpha: sAlpha, isDashing: isDashing, color: tColor 
            });
        }
        for (let i = this.trail.length - 1; i >= 0; i--) {
            let t = this.trail[i];
            if (t.type === 'smoke') {
                t.x += t.vx; t.y += t.vy; t.angle += t.rotSpeed; 
                t.vx *= 0.9; t.vy *= 0.9; t.alpha -= 0.03; 
            } else { t.alpha -= 0.05; }
            if (t.alpha <= 0) this.trail.splice(i, 1);
        }
    }

    draw(ctx) {
        this.trail.forEach(t => {
            ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.angle);
            if (t.type === 'smoke') {
                let baseScale = t.isDashing ? 1.5 : 1.0;
                let scale = Math.max(0.1, (t.alpha / t.startAlpha) * baseScale);
                ctx.scale(scale, scale);
            }
            ctx.fillStyle = t.color; ctx.globalAlpha = t.alpha;
            ctx.beginPath();
            if (this.type === 'circle') { ctx.arc(0, 0, this.size, 0, Math.PI * 2); ctx.fill(); } 
            else if (this.type === 'square') { ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size); } 
            else if (this.type === 'triangle') {
                ctx.moveTo(this.size, 0); ctx.lineTo(-this.size / 2, -this.size * 0.866);
                ctx.lineTo(-this.size / 2, this.size * 0.866); ctx.closePath(); ctx.fill();
            }
            ctx.restore();
        });

        // VISUAL REGEN AURA
        if (this.auraVisual === 'regen') {
            ctx.save(); ctx.translate(this.x, this.y);
            ctx.beginPath(); ctx.arc(0, 0, this.size + 15, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 255, 100, 0.4)';
            ctx.lineWidth = 3;
            ctx.setLineDash([15, 15]);
            ctx.lineDashOffset = -Date.now() / 30;
            ctx.stroke();
            ctx.restore();
        }

        // VISUAL SPEED THRUSTERS ON THE BACK
        if (this.rearVisual === 'thrusters') {
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
            let tTier = Math.max(this.upgrades['speed'] || 0, this.upgrades['dash'] || 0);
            let tSize = 6 + tTier * 2;
            let tLen = 8 + tTier * 2;
            ctx.fillStyle = '#444';
            let backOffset = -this.size - 2;
            if (this.type === 'triangle') backOffset = -this.size / 2 - 2;
            ctx.fillRect(backOffset - tLen, -this.size*0.4 - tSize/2, tLen, tSize);
            ctx.fillRect(backOffset - tLen, this.size*0.4 - tSize/2, tLen, tSize);
            ctx.restore();
        }

        // VISUAL ARMOR BODY PLATING
        if (this.bodyVisual === 'armor') {
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
            ctx.strokeStyle = '#888'; ctx.lineWidth = 4;
            ctx.beginPath();
            if (this.type === 'circle') ctx.arc(0, 0, this.size + 4, 0, Math.PI*2);
            else if (this.type === 'square') ctx.rect(-this.size/2-4, -this.size/2-4, this.size+8, this.size+8);
            else if (this.type === 'triangle') {
                let S = this.size + 6;
                ctx.moveTo(S, 0); ctx.lineTo(-S / 2, -S * 0.866); ctx.lineTo(-S / 2, S * 0.866); ctx.closePath();
            }
            ctx.stroke(); ctx.restore();
        }

        // VISUAL GUN BARRELS ON THE FRONT (SCALES WITH TIERS AND MULTISHOT)
        if (this.frontVisual === 'gun') {
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
            
            let gunCount = this.multiShot + 1;
            let gunTier = Math.max(this.upgrades['fireRate'] || 0, this.upgrades['damage'] || 0, this.upgrades['multiShot'] || 0);
            let gunLen = 12 + (gunTier * 3); 
            let gunThickness = 6 + (gunTier * 1.5); 
            let offsetDist = this.size - 2;

            ctx.fillStyle = '#555';
            if (gunCount === 1) {
                ctx.fillRect(offsetDist, -gunThickness/2, gunLen, gunThickness);
                ctx.fillStyle = '#222'; ctx.fillRect(offsetDist + gunLen - 4, -gunThickness/2 + 1, 4, gunThickness - 2);
            } else if (gunCount === 2) {
                let spread = this.size * 0.4;
                ctx.fillRect(offsetDist, -gunThickness/2 - spread, gunLen, gunThickness);
                ctx.fillRect(offsetDist, -gunThickness/2 + spread, gunLen, gunThickness);
                ctx.fillStyle = '#222';
                ctx.fillRect(offsetDist + gunLen - 4, -gunThickness/2 - spread + 1, 4, gunThickness - 2);
                ctx.fillRect(offsetDist + gunLen - 4, -gunThickness/2 + spread + 1, 4, gunThickness - 2);
            } else {
                // 3 or more guns! (1 Center + 2 sides)
                let spread = this.size * 0.5;
                ctx.fillRect(offsetDist, -gunThickness/2, gunLen + 4, gunThickness); 
                ctx.fillRect(offsetDist - 4, -gunThickness/2 - spread, gunLen, gunThickness);
                ctx.fillRect(offsetDist - 4, -gunThickness/2 + spread, gunLen, gunThickness);
                ctx.fillStyle = '#222';
                ctx.fillRect(offsetDist + gunLen, -gunThickness/2 + 1, 4, gunThickness - 2);
                ctx.fillRect(offsetDist + gunLen - 8, -gunThickness/2 - spread + 1, 4, gunThickness - 2);
                ctx.fillRect(offsetDist + gunLen - 8, -gunThickness/2 + spread + 1, 4, gunThickness - 2);
            }
            ctx.restore();
        }

        if (this.spikes > 0 && (this.type === 'circle' || this.type === 'square')) {
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle); ctx.fillStyle = '#ff4444';
            if (this.type === 'circle') {
                let spikeCount = 3 * this.spikes; let spikeLen = 8 + (this.spikes * 2); let spikeBase = 4 + this.spikes;
                for (let i = 0; i < spikeCount; i++) {
                    let angle = (i / spikeCount) * Math.PI * 2; let px = Math.cos(angle) * this.size; let py = Math.sin(angle) * this.size;
                    ctx.save(); ctx.translate(px, py); ctx.rotate(angle); ctx.beginPath();
                    ctx.moveTo(-1.5, spikeBase); ctx.lineTo(-1.5, -spikeBase); ctx.lineTo(spikeLen, 0); ctx.fill(); ctx.restore();
                }
            } else if (this.type === 'square') {
                let spikesPerSide = 3; let spikeLen = 6 + (this.spikes * 2); let spikeBase = (this.size / spikesPerSide) * 0.5; let s2 = this.size / 2;
                for (let side = 0; side < 4; side++) {
                    for (let i = 0; i < spikesPerSide; i++) {
                        let f = (i + 0.5) / spikesPerSide; let px, py, normalAngle;
                        if (side === 0) { px = s2; py = -s2 + f * this.size; normalAngle = 0; } else if (side === 1) { px = s2 - f * this.size; py = s2; normalAngle = Math.PI / 2; } 
                        else if (side === 2) { px = -s2; py = s2 - f * this.size; normalAngle = Math.PI; } else { px = -s2 + f * this.size; py = -s2; normalAngle = 3 * Math.PI / 2; }
                        ctx.save(); ctx.translate(px, py); ctx.rotate(normalAngle); ctx.beginPath();
                        ctx.moveTo(-1.5, spikeBase / 2); ctx.lineTo(-1.5, -spikeBase / 2); ctx.lineTo(spikeLen, 0); ctx.fill(); ctx.restore();
                    }
                }
            }
            ctx.restore();
        }
        if (this.type === 'triangle' && this.frontVisual === 'spikes') {
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle); ctx.fillStyle = '#ff4444'; ctx.beginPath();
            let S = this.size; ctx.moveTo(S + 4 + (this.spikes * 4), 0); ctx.lineTo(S * 0.3, -S * 0.4); ctx.lineTo(S * 0.3, S * 0.4); ctx.fill(); ctx.restore();
        }

        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        ctx.fillStyle = this.color; 
        if (window.gameSettings.highQuality) { ctx.shadowBlur = 15; ctx.shadowColor = this.color; } else { ctx.shadowBlur = 0; }
        ctx.beginPath();
        if (this.type === 'circle') { ctx.arc(0, 0, this.size, 0, Math.PI * 2); ctx.fill(); } 
        else if (this.type === 'square') { ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size); } 
        else if (this.type === 'triangle') {
            ctx.moveTo(this.size, 0); ctx.lineTo(-this.size / 2, -this.size * 0.866);
            ctx.lineTo(-this.size / 2, this.size * 0.866); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        if (this.equipped.Skin && ITEMS_DB) {
            const skinType = ITEMS_DB[this.equipped.Skin].value;
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle); ctx.beginPath();
            const innerSize = this.size * 0.5; 
            if (this.type === 'circle') { ctx.arc(0, 0, innerSize, 0, Math.PI * 2); } 
            else if (this.type === 'square') { ctx.rect(-innerSize/2, -innerSize/2, innerSize, innerSize); } 
            else if (this.type === 'triangle') {
                ctx.moveTo(innerSize, 0); ctx.lineTo(-innerSize / 2, -innerSize * 0.866); ctx.lineTo(-innerSize / 2, innerSize * 0.866); ctx.closePath();
            }
            if (skinType === 'neon') { ctx.fillStyle = '#ffffff'; if (window.gameSettings.highQuality) { ctx.shadowBlur = 15; ctx.shadowColor = '#ffffff'; } ctx.fill(); } 
            else if (skinType === 'dark') { ctx.fillStyle = '#111111'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#a855f7'; ctx.stroke(); } 
            else if (skinType === 'gladiator') { ctx.fillStyle = '#9ca3af'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke(); }
            ctx.restore();
        }
        
        // HIDES ARROW IF ANY FRONT VISUAL (GUN/SPIKES) IS ON THE SHAPE
        let hideArrow = (this.frontVisual !== null);
        
        if (this.isPlayer && !hideArrow && this.name !== "") {
            ctx.save(); 
            ctx.translate(this.x, this.y); 
            ctx.rotate(this.angle);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            let offset = this.size + 4;
            ctx.moveTo(offset, -4);
            ctx.lineTo(offset + 8, 0);
            ctx.lineTo(offset, 4);
            ctx.fill();
            ctx.restore();
        }

        if (this.orbiters > 0) {
            ctx.fillStyle = '#a855f7';
            if (window.gameSettings.highQuality) { ctx.shadowBlur = 10; ctx.shadowColor = '#a855f7'; }
            let t = (Date.now() / 500) * this.overclock; let selfSpin = (Date.now() / 80) * this.overclock; 
            for (let i = 0; i < this.orbiters; i++) {
                let angle = t + (i / this.orbiters) * Math.PI * 2;
                let ox = this.x + Math.cos(angle) * (this.size + 25); let oy = this.y + Math.sin(angle) * (this.size + 25);
                ctx.save(); ctx.translate(ox, oy); ctx.rotate(selfSpin); ctx.beginPath();
                let teeth = 8; let outerRadius = 9; let innerRadius = 5;
                for (let j = 0; j < teeth * 2; j++) {
                    let r = (j % 2 === 0) ? outerRadius : innerRadius; let a = (j / (teeth * 2)) * Math.PI * 2;
                    if (j === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
                }
                ctx.closePath(); ctx.fill(); ctx.fillStyle = '#111'; ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            }
            ctx.shadowBlur = 0; 
        }
        if (window.gameSettings.showNames && this.name !== "") {
            ctx.fillStyle = 'white'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
            if (window.gameSettings.highQuality) { ctx.shadowBlur = 2; ctx.shadowColor = 'black'; }
            let displayName = this.name;
            if (this.equipped.Banner && ITEMS_DB) displayName = `${ITEMS_DB[this.equipped.Banner].value} ${this.name}`;
            ctx.fillText(displayName, this.x, this.y - this.size - 20); ctx.shadowBlur = 0; 
        }
        if (this.name !== "") {
            if (this.health < this.maxHealth) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.7)'; ctx.fillRect(this.x - 20, this.y + this.size + 15, 40, 5);
                ctx.fillStyle = '#00ffcc'; ctx.fillRect(this.x - 20, this.y + this.size + 15, 40 * (this.health / this.maxHealth), 5);
            }
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; ctx.fillRect(this.x - 20, this.y + this.size + 22, 40, 3);
            let dashCost = Math.max(0, 2 - this.efficiency); 
            if (this.dashCooldown <= 0) {
                if (this.points >= dashCost) { ctx.fillStyle = '#ffe600'; ctx.fillRect(this.x - 20, this.y + this.size + 22, 40, 3); } 
                else { ctx.fillStyle = '#888888'; ctx.fillRect(this.x - 20, this.y + this.size + 22, 40, 3); }
            } else {
                ctx.fillStyle = '#ffffff'; 
                const pct = Math.max(0, 1 - (this.dashCooldown / this.dashMaxCooldown));
                const visualWidth = Math.min(40 * pct, 38);
                ctx.fillRect(this.x - 20, this.y + this.size + 22, visualWidth, 3);
            }
        }
    }
}

export class Player extends Entity {
    constructor(x, y, type, name = "") {
        super(x, y, type); 
        this.name = name; 
        this.isPlayer = true; 
        this.equipped = window.equippedItems || { Skin: null, Trail: null, Banner: null, Color: null };
        if (this.equipped.Color && ITEMS_DB && ITEMS_DB[this.equipped.Color]) {
            this.color = ITEMS_DB[this.equipped.Color].value; 
        } else { this.color = '#d3d3d3'; }
    }
}

export class Bot extends Entity {
    constructor(x, y, type, startingPoints = 0) {
        super(x, y, type); 
        this.targetX = x; this.targetY = y; this.changeTargetTimer = 0;
        this.isTeammate = false; 

        const names = ['OrbHunter', 'NovaStrike', 'PixelSlayer', 'GhostBlade', 'RogueBot', 'Vanguard', 'Titan', 'Apex'];
        this.name = names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 99);
        this.points = startingPoints; this.upgradeProgress = startingPoints; this.botPointsToNextUpgrade = 10;
        this.dashTendency = Math.random();
        this.strafeDir = Math.random() > 0.5 ? 1 : -1; 
        this.personality = Math.random(); 
        
        while (this.upgradeProgress >= this.botPointsToNextUpgrade) {
            this.upgradeProgress -= this.botPointsToNextUpgrade;
            this.upgradeCount++; this.botPointsToNextUpgrade = Math.floor(this.botPointsToNextUpgrade * 1.5);
            let choices = getWeightedUpgrades(this, 1); if (choices.length > 0) this.applyUpgrade(choices[0].id);
        }
        
        if (ITEMS_DB && Math.random() < 0.15) {
            const items = Object.values(ITEMS_DB);
            if (Math.random() < 0.2) {
                let skins = items.filter(i => i.category === 'Skin'); if (skins.length) this.equipped.Skin = skins[Math.floor(Math.random()*skins.length)].id;
            }
            if (Math.random() < 0.2) {
                let trails = items.filter(i => i.category === 'Trail'); if (trails.length) this.equipped.Trail = trails[Math.floor(Math.random()*trails.length)].id;
            }
        }
    }
    
    updateBot(allPlayers, isCinematicIntro = false) {
        if (isCinematicIntro && (this.isTeammate || this.isPlayer)) {
            this.angle = -Math.PI / 2; 
            super.update(); 
            return;
        }

        this.changeTargetTimer--; let nearestEnemy = null; let minDist = 800;
        
        allPlayers.forEach(p => { 
            if (p === this || p.isDead) return; 
            if (this.isTeammate && (p.isPlayer || p.isTeammate)) return;

            const dist = distance(this.x, this.y, p.x, p.y); 
            let randomizedDist = dist + (Math.random() * 100); 
            
            if (randomizedDist < minDist) { minDist = randomizedDist; nearestEnemy = p; } 
        });

        let passiveGain = 0.15; this.points += passiveGain; this.upgradeProgress += passiveGain;
        while (this.upgradeProgress >= this.botPointsToNextUpgrade) {
            this.upgradeProgress -= this.botPointsToNextUpgrade; this.upgradeCount++; this.botPointsToNextUpgrade = Math.floor(this.botPointsToNextUpgrade * 1.5);
            let choices = getWeightedUpgrades(this, 1); if (choices.length > 0) this.applyUpgrade(choices[0].id);
        }

        if (this.isTeammate && !nearestEnemy) {
            const player = allPlayers.find(p => p.isPlayer);
            if (player && !player.isDead) {
                const distToPlayer = distance(this.x, this.y, player.x, player.y);
                if (distToPlayer > 200) {
                    this.angle = Math.atan2(player.y - this.y, player.x - this.x);
                    const dx = player.x - this.x; const dy = player.y - this.y;
                    this.vx += (dx / distToPlayer) * (this.speed * 0.12);
                    this.vy += (dy / distToPlayer) * (this.speed * 0.12);
                } else {
                    this.vx *= 0.9; this.vy *= 0.9;
                }
            }
        } else if (nearestEnemy) {
            const trueDist = distance(this.x, this.y, nearestEnemy.x, nearestEnemy.y);
            const dx = nearestEnemy.x - this.x; 
            const dy = nearestEnemy.y - this.y;
            
            let fleeThreshold = 0.15 + (this.personality * 0.25); 

            if (this.health < this.maxHealth * fleeThreshold) {
                this.angle = Math.atan2(-dy, -dx);
                this.vx += Math.cos(this.angle) * (this.speed * 0.14);
                this.vy += Math.sin(this.angle) * (this.speed * 0.14);
                
                if (this.dashCooldown <= 0 && Math.random() < 0.03) {
                    this.dash(-dx, -dy);
                }
            } else {
                this.angle = Math.atan2(dy, dx);
                if (trueDist > 150 && trueDist < 400 && Math.random() < (0.002 + this.dashTendency * 0.005)) {
                    this.dash(dx, dy);
                }
                let optimalDist = this.type === 'square' ? 100 : (this.type === 'triangle' ? 300 : 200);
                if (Math.random() < 0.01) this.strafeDir *= -1; 
                
                if (trueDist > optimalDist + 50) { 
                    this.vx += (dx / trueDist) * (this.speed * 0.12); 
                    this.vy += (dy / trueDist) * (this.speed * 0.12); 
                } else if (trueDist < optimalDist - 50) { 
                    this.vx -= (dx / trueDist) * (this.speed * 0.12); 
                    this.vy -= (dy / trueDist) * (this.speed * 0.12); 
                } else {
                    this.vx += (-dy / trueDist) * (this.speed * 0.08) * this.strafeDir;
                    this.vy += (dx / trueDist) * (this.speed * 0.08) * this.strafeDir;
                }
            }
        } else {
            if (this.changeTargetTimer <= 0) {
                this.targetX = this.x + (Math.random() - 0.5) * 800; this.targetY = this.y + (Math.random() - 0.5) * 800; this.changeTargetTimer = 60 + Math.random() * 60; 
            }
            this.angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);
            const dx = this.targetX - this.x; const dy = this.targetY - this.y; const dist = Math.hypot(dx, dy);
            if (dist > 10) { this.vx += (dx / dist) * (this.speed * 0.10); this.vy += (dy / dist) * (this.speed * 0.10); }
        }
        super.update();
    }
}

export class Projectile {
    constructor(x, y, angle, owner, isMissile = false) {
        this.x = x + Math.cos(angle) * (owner.size + 5); this.y = y + Math.sin(angle) * (owner.size + 5); 
        this.angle = angle; this.owner = owner; this.isMissile = isMissile;
        this.pierce = owner.pierceAmmo || 0; this.hitTargets = []; 
        this.sizeScale = 1 + (owner.heavyArt * 0.5);
        if (isMissile) {
            this.speed = (owner.bulletSpeed || 15) * 0.7; this.damage = 10 + (owner.baseDamage * 0.5); 
            this.turnSpeed = 0.05 + (owner.missiles * 0.02); this.color = '#ff0044'; this.life = 120; 
        } else {
            this.speed = owner.bulletSpeed || 15; this.damage = owner.baseDamage; this.color = owner.color;
            this.life = 60 + (owner.sniper * 20); 
        }
    }
    update(targets) { 
        if (this.isMissile && targets) {
            let nearest = null; let minDist = Infinity;
            targets.forEach(t => { if (t === this.owner || t.isDead) return; let d = distance(this.x, this.y, t.x, t.y); if (d < minDist && d < 600) { minDist = d; nearest = t; } });
            if (nearest) {
                let targetAngle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
                let diff = targetAngle - this.angle; while (diff < -Math.PI) diff += Math.PI * 2; while (diff > Math.PI) diff -= Math.PI * 2;
                if (diff > 0) this.angle += Math.min(this.turnSpeed, diff); else this.angle += Math.max(-this.turnSpeed, diff);
            }
        } 
        // PERFECT AIM ASSIST FOR THE LOCAL PLAYER
        else if (!this.isMissile && this.owner.isPlayer && targets) {
            let nearest = null; let minDist = 350; 
            targets.forEach(t => { 
                if (t === this.owner || t.isDead || t.isTeammate) return; 
                let d = distance(this.x, this.y, t.x, t.y); 
                if (d < minDist) { minDist = d; nearest = t; } 
            });
            if (nearest) {
                let targetAngle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
                let diff = targetAngle - this.angle; 
                while (diff < -Math.PI) diff += Math.PI * 2; 
                while (diff > Math.PI) diff -= Math.PI * 2;
                
                // Only slightly curve the bullet if you are already aiming somewhat closely to them
                if (Math.abs(diff) < 0.4) {
                    this.angle += diff * 0.05; 
                }
            }
        }

        this.x += Math.cos(this.angle) * this.speed; this.y += Math.sin(this.angle) * this.speed; this.life--; 
    }
    draw(ctx) {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        ctx.scale(this.sizeScale, this.sizeScale);
        if (window.gameSettings.highQuality) { ctx.shadowBlur = 10; ctx.shadowColor = this.color; } else { ctx.shadowBlur = 0; }
        if (this.isMissile) {
            ctx.fillStyle = this.color; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, 6); ctx.lineTo(-8, -6); ctx.fill();
        } else { ctx.fillStyle = '#fff'; ctx.fillRect(-10, -3, 20, 6); }
        ctx.restore();
    }
}

export class Orb {
    constructor(x, y, type = 'xp', value = 1, lockedOwner = null, scatterRadius = 30) {
        const angle = Math.random() * Math.PI * 2; const dist = Math.random() * scatterRadius;
        this.x = x + Math.cos(angle) * dist; this.y = y + Math.sin(angle) * dist;
        this.type = type; this.value = value; this.lockedOwner = lockedOwner; this.lockoutTimer = lockedOwner ? 600 : 0; 
        if (this.type === 'health') {
            if (Math.random() < 0.25) { this.size = 10; this.color = '#1F51FF'; this.healAmount = 45; } 
            else { this.size = 6; this.color = '#3b82f6'; this.healAmount = 15; }
        } else { this.size = Math.min(15, 5 + Math.log10(value) * 3); this.color = '#ffe600'; }
    }
    draw(ctx) {
        ctx.save(); ctx.translate(this.x, this.y); ctx.fillStyle = this.color;
        if (this.lockoutTimer > 0) ctx.globalAlpha = 0.6;
        if (window.gameSettings.highQuality && this.lockoutTimer <= 0) { ctx.shadowBlur = 10; ctx.shadowColor = this.color; } else { ctx.shadowBlur = 0; }
        ctx.beginPath(); ctx.arc(0, 0, this.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
}

export class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 4 + 1;
        this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
        this.life = 1.0; this.decay = Math.random() * 0.05 + 0.02; this.size = Math.random() * 4 + 2;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life -= this.decay; }
    draw(ctx) {
        ctx.save(); ctx.globalAlpha = Math.max(0, this.life); ctx.fillStyle = this.color;
        if (window.gameSettings.highQuality) { ctx.shadowBlur = 5; ctx.shadowColor = this.color; }
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
}