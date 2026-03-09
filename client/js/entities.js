import { distance } from './utils.js';
import { ITEMS_DB } from './items.js'; 
import { UPGRADE_POOL } from './upgrades.js';

export function getWeightedUpgrades(entity, count = 3) {
    let available = UPGRADE_POOL.filter(upg => {
        if (upg.id === 'shield' || upg.id === 'overdrive') {
            return entity.activeAbility !== upg.id;
        }

        let maxAllowed = upg.maxTier !== undefined ? upg.maxTier : entity.maxUpgradeTier;
        let underMax = entity.upgrades[upg.id] < maxAllowed;
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
        this.x = x; 
        this.y = y; 
        this.type = type;
        this.vx = 0; 
        this.vy = 0; 
        this.angle = 0;
        this.color = `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`;
        this.points = 0;
        this.upgradeProgress = 0; 
        this.kills = 0;
        this.upgradeCount = 0; 
        this.dashCooldown = 0;
        this.dashTimer = 0;
        this.trail = []; 

        if (type === 'circle') {
            this.speed = 6.0; 
            this.size = 20; 
            this.maxHealth = 130;
            this.fireRate = 22; 
            this.baseDamage = 15; 
            this.dashMaxCooldown = 100; 
            this.bulletSpeed = 14;
        } else if (type === 'square') {
            this.speed = 4.2; 
            this.size = 28; 
            this.maxHealth = 250; 
            this.fireRate = 55; 
            this.baseDamage = 35; 
            this.dashMaxCooldown = 150; 
            this.bulletSpeed = 18;
        } else if (type === 'triangle') {
            this.speed = 9.0; 
            this.size = 20; 
            this.maxHealth = 85; 
            this.fireRate = 14; 
            this.baseDamage = 7; 
            this.dashMaxCooldown = 75; 
            this.bulletSpeed = 16;
        }
        
        this.health = this.maxHealth;
        this.fireCooldown = 0;
        this.name = "Entity";
        this.isDead = false;
        this.inSafeZone = false; 
        
        this.upgrades = {};
        UPGRADE_POOL.forEach(upg => this.upgrades[upg.id] = 0);
        
        this.maxUpgradeTier = 5; 
        this.equipped = { Skin: null, Trail: null, Banner: null, Color: null };

        this.multiShot = 0; 
        this.spikes = 0; 
        this.piercing = 0; 
        this.spikeCooldown = 0;
        this.orbiters = 0; 
        this.orbiterDamage = 0.5; 
        this.missiles = 0; 
        this.missileCooldown = 0;

        this.scavenger = 1.0; 
        this.pierceAmmo = 0; 
        this.medicDrop = 0;
        this.overclock = 1.0; 
        this.executioner = 0; 
        this.extendedDash = 0;
        this.afterburner = 0; 
        this.ghostDash = false; 
        this.sniper = 0; 
        this.evasion = 0;
        this.regen = 0; 
        this.wantsShockwave = false; 
        this.shockwave = 0;
        this.heavyArt = 0; 
        this.plating = 0; 
        this.vampirism = 0;
        this.magnet = 0; 
        this.rearguard = 0; 
        this.efficiency = 0; 
        this.shrapnel = 0;
        
        this.frontVisual = null;
        this.bodyVisual = null;
        this.rearVisual = null;
        this.auraVisual = null;
        
        this.activeAbility = null;
        this.abilityCooldown = 0;
        this.abilityTimer = 0;
        this.abilityMaxCooldown = 450; 
    }

    applyUpgrade(upgradeId) {
        const upgradeDef = UPGRADE_POOL.find(u => u.id === upgradeId);
        if (!upgradeDef) return;

        if (upgradeId === 'shield' || upgradeId === 'overdrive') {
            this.activeAbility = upgradeId;
            this.upgrades['shield'] = 0;
            this.upgrades['overdrive'] = 0;
            this.upgrades[upgradeId] = 1;
            return;
        }

        let maxAllowed = upgradeDef.maxTier !== undefined ? upgradeDef.maxTier : this.maxUpgradeTier;
        if (this.upgrades[upgradeId] >= maxAllowed) return; 
        
        if (upgradeId === 'spikes' && !this.frontVisual) this.frontVisual = 'spikes';
        if ((upgradeId === 'fireRate' || upgradeId === 'multiShot' || upgradeId === 'damage') && !this.frontVisual) this.frontVisual = 'gun';
        
        const armorUpgrades = ['maxHealth', 'health', 'plating', 'armor', 'defense'];
        if (armorUpgrades.includes(upgradeId) && !this.bodyVisual) this.bodyVisual = 'armor';
        
        if ((upgradeId === 'speed' || upgradeId === 'dash') && !this.rearVisual) this.rearVisual = 'thrusters';
        if ((upgradeId === 'regen' || upgradeId === 'vampirism') && !this.auraVisual) this.auraVisual = 'regen';

        if (upgradeDef.apply) {
            upgradeDef.apply(this); 
            this.upgrades[upgradeId]++;
        }
    }

    useAbility() {
        if (this.abilityCooldown <= 0 && this.activeAbility) {
            this.abilityCooldown = this.abilityMaxCooldown;
            this.abilityTimer = 180; 
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
                dx = Math.cos(this.angle); 
                dy = Math.sin(this.angle); 
                length = 1;
            }
            let dashForce = 4.0 + this.extendedDash;
            this.vx += (dx / length) * (this.speed * dashForce);
            this.vy += (dy / length) * (this.speed * dashForce);
        }
    }

    update() {
        this.x += this.vx; 
        this.y += this.vy;
        this.vx *= 0.85; 
        this.vy *= 0.85; 
        
        if (this.fireCooldown > 0) {
            this.fireCooldown -= (this.abilityTimer > 0 && this.activeAbility === 'overdrive' ? 2 : 1);
        }
        
        if (this.dashCooldown > 0) this.dashCooldown--;
        if (this.spikeCooldown > 0) this.spikeCooldown--;
        if (this.dashTimer > 0) this.dashTimer--;
        
        if (this.abilityCooldown > 0) this.abilityCooldown--;
        if (this.abilityTimer > 0) this.abilityTimer--;

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
            
            let spawnRadius = this.type === 'square' ? this.size / 2 : this.size * 0.8;
            let spawnX = this.x + Math.cos(backAngle) * spawnRadius;
            let spawnY = this.y + Math.sin(backAngle) * spawnRadius;
            
            let exhaustAngle = backAngle + (Math.random() - 0.5) * 1.2;
            let exhaustSpeed = Math.random() * 2 + (isDashing ? 3 : 1);
            this.trail.push({
                type: 'smoke', 
                x: spawnX + (Math.random() - 0.5) * 8, 
                y: spawnY + (Math.random() - 0.5) * 8, 
                vx: Math.cos(exhaustAngle) * exhaustSpeed, 
                vy: Math.sin(exhaustAngle) * exhaustSpeed,
                angle: this.angle + (Math.random() - 0.5), 
                rotSpeed: (Math.random() - 0.5) * 0.2, 
                alpha: sAlpha, 
                startAlpha: sAlpha, 
                isDashing: isDashing, 
                color: tColor 
            });
        }

        if (this.rearVisual === 'thrusters' && (isDashing || speed > 1.0)) {
            let tTier = Math.max(this.upgrades['speed'] || 0, this.upgrades['dash'] || 0);
            let tLen = 8 + tTier * 3;
            
            let armorTier = Math.max(this.upgrades['maxHealth'] || 0, this.upgrades['plating'] || 0);
            let armorOffset = this.bodyVisual === 'armor' ? (4 + armorTier + (4 + armorTier*1.5)/2) : 0;
            
            let backOffset = this.type === 'circle' ? -this.size : -this.size / 2;
            if (this.bodyVisual === 'armor') backOffset -= armorOffset;
            let vSpread = this.type === 'square' ? this.size * 0.35 : this.size * 0.45;
            
            let px1 = this.x + Math.cos(this.angle) * (backOffset - tLen) - Math.sin(this.angle) * (-vSpread);
            let py1 = this.y + Math.sin(this.angle) * (backOffset - tLen) + Math.cos(this.angle) * (-vSpread);
            
            let px2 = this.x + Math.cos(this.angle) * (backOffset - tLen) - Math.sin(this.angle) * (vSpread);
            let py2 = this.y + Math.sin(this.angle) * (backOffset - tLen) + Math.cos(this.angle) * (vSpread);
            
            let pCount = isDashing ? 3 + tTier : 1 + Math.floor(tTier / 2);
            for (let k = 0; k < pCount; k++) {
                let exAngle1 = this.angle + Math.PI + (Math.random() - 0.5) * 0.6;
                let exAngle2 = this.angle + Math.PI + (Math.random() - 0.5) * 0.6;
                let exSpeed = Math.random() * 3 + (isDashing ? 5 : 2);
                
                this.trail.push({ 
                    type: 'fire', x: px1, y: py1, 
                    vx: Math.cos(exAngle1)*exSpeed, vy: Math.sin(exAngle1)*exSpeed, 
                    alpha: 1.0, color: '#00ffcc', size: 2 + Math.random()*2 
                });
                this.trail.push({ 
                    type: 'fire', x: px2, y: py2, 
                    vx: Math.cos(exAngle2)*exSpeed, vy: Math.sin(exAngle2)*exSpeed, 
                    alpha: 1.0, color: '#00ffcc', size: 2 + Math.random()*2 
                });
            }
        }

        for (let i = this.trail.length - 1; i >= 0; i--) {
            let t = this.trail[i];
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
            if (t.alpha <= 0) {
                this.trail.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        this.trail.forEach(t => {
            if (t.type === 'fire') {
                ctx.save(); 
                ctx.translate(t.x, t.y);
                ctx.fillStyle = t.color; 
                ctx.globalAlpha = Math.max(0, t.alpha);
                if (window.gameSettings.highQuality) { 
                    ctx.shadowBlur = 8; 
                    ctx.shadowColor = t.color; 
                }
                ctx.beginPath(); 
                ctx.arc(0, 0, t.size, 0, Math.PI * 2); 
                ctx.fill();
                ctx.restore();
            } else {
                ctx.save(); 
                ctx.translate(t.x, t.y); 
                ctx.rotate(t.angle);
                if (t.type === 'smoke') {
                    let baseScale = t.isDashing ? 1.5 : 1.0;
                    let scale = Math.max(0.1, (t.alpha / t.startAlpha) * baseScale);
                    ctx.scale(scale, scale);
                }
                ctx.fillStyle = t.color; 
                ctx.globalAlpha = t.alpha;
                ctx.beginPath();
                
                if (this.type === 'circle') { 
                    ctx.arc(0, 0, this.size, 0, Math.PI * 2); 
                    ctx.fill(); 
                } 
                else if (this.type === 'square') { 
                    ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size); 
                } 
                else if (this.type === 'triangle') {
                    ctx.moveTo(this.size, 0); 
                    ctx.lineTo(-this.size / 2, -this.size * 0.866);
                    ctx.lineTo(-this.size / 2, this.size * 0.866); 
                    ctx.closePath(); 
                    ctx.fill();
                }
                ctx.restore();
            }
        });

        if (this.abilityTimer > 0 && this.activeAbility === 'shield') {
            ctx.save(); 
            ctx.translate(this.x, this.y);
            ctx.beginPath(); 
            ctx.arc(0, 0, this.size + 15, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 150, 255, 0.3)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 200, 255, 0.8)';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
        }

        if (this.abilityTimer > 0 && this.activeAbility === 'overdrive') {
            ctx.save(); 
            ctx.translate(this.x, this.y);
            ctx.beginPath(); 
            ctx.arc(0, 0, this.size + 8, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 50, 0, 0.8)';
            ctx.lineWidth = 4;
            ctx.setLineDash([10, 10]);
            ctx.lineDashOffset = Date.now() / 20;
            ctx.stroke();
            ctx.restore();
        }

        if (this.auraVisual === 'regen') {
            ctx.save(); 
            ctx.translate(this.x, this.y);
            ctx.beginPath(); 
            ctx.arc(0, 0, (this.type === 'square' ? this.size / 1.5 : this.size) + 15, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 255, 100, 0.4)';
            ctx.lineWidth = 3;
            ctx.setLineDash([15, 15]);
            ctx.lineDashOffset = -Date.now() / 30;
            ctx.stroke();
            ctx.restore();
        }

        let armorOffset = 0;
        if (this.bodyVisual === 'armor') {
            let armorTier = Math.max(this.upgrades['maxHealth'] || 0, this.upgrades['plating'] || 0);
            armorOffset = 4 + armorTier;
            let armorThickness = 4 + (armorTier * 1.5);
            
            ctx.save(); 
            ctx.translate(this.x, this.y); 
            ctx.rotate(this.angle);
            ctx.strokeStyle = '#9ca3af'; 
            ctx.lineWidth = armorThickness; 
            ctx.beginPath();
            
            if (this.type === 'circle') {
                ctx.arc(0, 0, this.size + armorOffset, 0, Math.PI*2);
            }
            else if (this.type === 'square') {
                ctx.rect(-this.size/2 - armorOffset, -this.size/2 - armorOffset, this.size + armorOffset*2, this.size + armorOffset*2);
            }
            else if (this.type === 'triangle') {
                let S = this.size + armorOffset + 2;
                ctx.moveTo(S, 0); 
                ctx.lineTo(-S / 2, -S * 0.866); 
                ctx.lineTo(-S / 2, S * 0.866); 
                ctx.closePath();
            }
            
            ctx.stroke(); 
            ctx.restore();
            
            armorOffset += (armorThickness / 2);
        }

        if (this.rearVisual === 'thrusters') {
            ctx.save(); 
            ctx.translate(this.x, this.y); 
            ctx.rotate(this.angle);
            let tTier = Math.max(this.upgrades['speed'] || 0, this.upgrades['dash'] || 0);
            let tSize = 6 + tTier * 3;
            let tLen = 8 + tTier * 3;
            
            let backOffset = this.type === 'circle' ? -this.size : -this.size / 2;
            if (this.bodyVisual === 'armor') {
                backOffset -= armorOffset; 
            }
            
            let vSpread = this.type === 'square' ? this.size * 0.35 : this.size * 0.45;
            
            ctx.fillStyle = '#444';
            ctx.fillRect(backOffset - tLen + 2, -vSpread - tSize/2, tLen, tSize);
            ctx.fillRect(backOffset - tLen + 2, vSpread - tSize/2, tLen, tSize);
            ctx.restore();
        }

        if (this.frontVisual === 'gun') {
            ctx.save(); 
            ctx.translate(this.x, this.y); 
            ctx.rotate(this.angle);
            
            let gunCount = this.multiShot + 1;
            let gunTier = Math.max(this.upgrades['fireRate'] || 0, this.upgrades['damage'] || 0, this.upgrades['multiShot'] || 0);
            let gunLen = 12 + (gunTier * 4); 
            let gunThickness = 6 + (gunTier * 2); 
            
            let spreadAngle = 0.2; 
            let startAngle = -(spreadAngle * (gunCount - 1)) / 2;

            for (let s = 0; s < gunCount; s++) {
                let gAngle = startAngle + (s * spreadAngle);
                ctx.save();
                ctx.rotate(gAngle);

                let baseRadius = this.type === 'square' ? this.size / 2 : this.size;
                if (this.type === 'triangle') baseRadius = this.size * 0.8;
                baseRadius += armorOffset;
                
                let offsetDist = baseRadius - 6; 

                ctx.translate(offsetDist, 0);

                ctx.fillStyle = '#555';
                ctx.fillRect(0, -gunThickness/2, gunLen, gunThickness);
                ctx.fillStyle = '#222';
                ctx.fillRect(gunLen - 4, -gunThickness/2 + 1, 4, gunThickness - 2);

                ctx.restore();
            }
            ctx.restore();
        }

        if (this.spikes > 0 && (this.type === 'circle' || this.type === 'square')) {
            ctx.save(); 
            ctx.translate(this.x, this.y); 
            ctx.rotate(this.angle); 
            ctx.fillStyle = '#ff4444';
            
            if (this.type === 'circle') {
                let spikeCount = 3 * this.spikes; 
                let spikeLen = 8 + (this.spikes * 2); 
                let spikeBase = 4 + this.spikes;
                let r = this.size + armorOffset - 2; 
                
                for (let i = 0; i < spikeCount; i++) {
                    let angle = (i / spikeCount) * Math.PI * 2; 
                    let px = Math.cos(angle) * r; 
                    let py = Math.sin(angle) * r;
                    ctx.save(); 
                    ctx.translate(px, py); 
                    ctx.rotate(angle); 
                    ctx.beginPath();
                    ctx.moveTo(-1.5, spikeBase); 
                    ctx.lineTo(-1.5, -spikeBase); 
                    ctx.lineTo(spikeLen, 0); 
                    ctx.fill(); 
                    ctx.restore();
                }
            } else if (this.type === 'square') {
                let spikesPerSide = 3; 
                let spikeLen = 6 + (this.spikes * 2); 
                let spikeBase = (this.size / spikesPerSide) * 0.5; 
                let s2 = this.size / 2 + armorOffset - 2;
                
                for (let side = 0; side < 4; side++) {
                    for (let i = 0; i < spikesPerSide; i++) {
                        let f = (i + 0.5) / spikesPerSide; 
                        let px, py, normalAngle;
                        
                        if (side === 0) { 
                            px = s2; py = -this.size/2 + f * this.size; normalAngle = 0; 
                        } 
                        else if (side === 1) { 
                            px = this.size/2 - f * this.size; py = s2; normalAngle = Math.PI / 2; 
                        } 
                        else if (side === 2) { 
                            px = -s2; py = this.size/2 - f * this.size; normalAngle = Math.PI; 
                        } 
                        else { 
                            px = -this.size/2 + f * this.size; py = -s2; normalAngle = 3 * Math.PI / 2; 
                        }
                        
                        ctx.save(); 
                        ctx.translate(px, py); 
                        ctx.rotate(normalAngle); 
                        ctx.beginPath();
                        ctx.moveTo(-1.5, spikeBase / 2); 
                        ctx.lineTo(-1.5, -spikeBase / 2); 
                        ctx.lineTo(spikeLen, 0); 
                        ctx.fill(); 
                        ctx.restore();
                    }
                }
            }
            ctx.restore();
        }
        
        if (this.type === 'triangle' && this.frontVisual === 'spikes') {
            ctx.save(); 
            ctx.translate(this.x, this.y); 
            ctx.rotate(this.angle); 
            ctx.fillStyle = '#ff4444'; 
            ctx.beginPath();
            let S = this.size + armorOffset; 
            ctx.moveTo(S + 4 + (this.spikes * 4), 0); 
            ctx.lineTo(S * 0.3, -this.size * 0.4); 
            ctx.lineTo(S * 0.3, this.size * 0.4); 
            ctx.fill(); 
            ctx.restore();
        }

        // --- DRAW BASE SHAPE ---
        ctx.save(); 
        ctx.translate(this.x, this.y); 
        ctx.rotate(this.angle);
        ctx.fillStyle = this.color; 
        if (window.gameSettings.highQuality) { 
            ctx.shadowBlur = 15; 
            ctx.shadowColor = this.color; 
        } else { 
            ctx.shadowBlur = 0; 
        }
        
        if (this.color === '#111111' || this.color === '#000000') {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ffffff';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 2;
        }

        ctx.beginPath();
        if (this.type === 'circle') { 
            ctx.arc(0, 0, this.size, 0, Math.PI * 2); 
            ctx.fill(); 
            if (this.color === '#111111') ctx.stroke(); 
        } 
        else if (this.type === 'square') { 
            ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size); 
            if (this.color === '#111111') ctx.strokeRect(-this.size/2, -this.size/2, this.size, this.size); 
        } 
        else if (this.type === 'triangle') {
            ctx.moveTo(this.size, 0); 
            ctx.lineTo(-this.size / 2, -this.size * 0.866);
            ctx.lineTo(-this.size / 2, this.size * 0.866); 
            ctx.closePath(); 
            ctx.fill(); 
            if (this.color === '#111111') ctx.stroke();
        }
        ctx.restore();
        
        // --- DRAW UNIQUE SKINS ---
        if (this.equipped.Skin && ITEMS_DB && ITEMS_DB[this.equipped.Skin]) {
            const skinType = ITEMS_DB[this.equipped.Skin].value;
            ctx.save(); 
            ctx.translate(this.x, this.y); 
            ctx.rotate(this.angle); 
            
            if (['spectre', 'luminescent', 'celestial', 'voidwalker', 'inferno', 'neon', 'dark', 'glitch'].includes(skinType)) {
                if (window.gameSettings.highQuality) { 
                    ctx.shadowBlur = 20; 
                }
            }

            if (skinType === 'ghost') {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; 
                ctx.beginPath();
                if (this.type === 'circle') {
                    ctx.arc(0, 0, this.size, 0, Math.PI*2);
                } else if (this.type === 'square') {
                    ctx.rect(-this.size/2, -this.size/2, this.size, this.size);
                } else { 
                    ctx.moveTo(this.size, 0); 
                    ctx.lineTo(-this.size/2, -this.size*0.866); 
                    ctx.lineTo(-this.size/2, this.size*0.866); 
                    ctx.closePath(); 
                }
                ctx.fill();
                ctx.fillStyle = '#000'; 
                ctx.beginPath(); 
                ctx.arc(this.size*0.4, -this.size*0.3, 3, 0, Math.PI*2); 
                ctx.arc(this.size*0.4, this.size*0.3, 3, 0, Math.PI*2); 
                ctx.fill();
            }
            else if (skinType === 'assassin') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; 
                ctx.beginPath();
                if (this.type === 'circle') {
                    ctx.arc(0, 0, this.size*0.8, 0, Math.PI*2);
                } else if (this.type === 'square') {
                    ctx.rect(-this.size*0.4, -this.size*0.4, this.size*0.8, this.size*0.8);
                } else { 
                    ctx.moveTo(this.size*0.8, 0); 
                    ctx.lineTo(-this.size*0.4, -this.size*0.69); 
                    ctx.lineTo(-this.size*0.4, this.size*0.69); 
                    ctx.closePath(); 
                }
                ctx.fill();
                ctx.fillStyle = '#ff0000'; 
                ctx.shadowColor = '#ff0000'; 
                ctx.shadowBlur = 10;
                ctx.beginPath(); 
                ctx.arc(this.size*0.3, 0, 4, 0, Math.PI*2); 
                ctx.fill();
            }
            else if (skinType === 'paladin') {
                ctx.strokeStyle = '#fbbf24'; 
                ctx.lineWidth = 4;
                ctx.beginPath(); 
                ctx.moveTo(-this.size*0.8, 0); 
                ctx.lineTo(this.size*0.8, 0); 
                ctx.moveTo(0, -this.size*0.8); 
                ctx.lineTo(0, this.size*0.8); 
                ctx.stroke();
            }
            else if (skinType === 'hologram') {
                ctx.fillStyle = 'transparent'; 
                ctx.strokeStyle = '#00ffff'; 
                ctx.lineWidth = 2; 
                ctx.shadowColor = '#00ffff'; 
                ctx.shadowBlur = 10;
                ctx.beginPath();
                if (this.type === 'circle') {
                    ctx.arc(0, 0, this.size*0.6, 0, Math.PI*2);
                } else if (this.type === 'square') {
                    ctx.rect(-this.size*0.3, -this.size*0.3, this.size*0.6, this.size*0.6);
                } else { 
                    ctx.moveTo(this.size*0.6, 0); 
                    ctx.lineTo(-this.size*0.3, -this.size*0.5); 
                    ctx.lineTo(-this.size*0.3, this.size*0.5); 
                    ctx.closePath(); 
                }
                ctx.stroke();
            }
            else if (skinType === 'spartan') {
                ctx.strokeStyle = '#dc2626'; 
                ctx.lineWidth = 6;
                ctx.beginPath(); 
                ctx.moveTo(-this.size*0.5, -this.size*0.8); 
                ctx.lineTo(this.size*0.5, 0); 
                ctx.lineTo(-this.size*0.5, this.size*0.8); 
                ctx.stroke();
            }
            else if (skinType === 'luminescent') {
                const hue = (Date.now() / 15) % 360;
                const rainbowColor = `hsl(${hue}, 100%, 50%)`;
                ctx.fillStyle = rainbowColor; 
                ctx.shadowColor = rainbowColor; 
                ctx.shadowBlur = 25;
                ctx.beginPath(); 
                ctx.arc(0, 0, this.size*0.5, 0, Math.PI*2); 
                ctx.fill();
            }
            else if (skinType === 'ninja') {
                ctx.fillStyle = '#111'; 
                ctx.beginPath(); 
                ctx.fillRect(-this.size, -this.size*0.3, this.size*2, this.size*0.6);
                ctx.fillStyle = '#fff'; 
                ctx.fillRect(-this.size*0.5, -this.size*0.1, this.size, this.size*0.2);
            }
            else if (skinType === 'celestial') {
                ctx.fillStyle = '#fff'; 
                ctx.shadowColor = '#00ffff'; 
                ctx.shadowBlur = 15;
                ctx.beginPath(); 
                ctx.moveTo(0, -this.size*0.6); 
                ctx.lineTo(this.size*0.2, -this.size*0.2); 
                ctx.lineTo(this.size*0.6, 0); 
                ctx.lineTo(this.size*0.2, this.size*0.2); 
                ctx.lineTo(0, this.size*0.6); 
                ctx.lineTo(-this.size*0.2, this.size*0.2); 
                ctx.lineTo(-this.size*0.6, 0); 
                ctx.lineTo(-this.size*0.2, -this.size*0.2); 
                ctx.closePath(); 
                ctx.fill();
            }
            else if (skinType === 'cyborg') {
                ctx.save();
                ctx.beginPath();
                if (this.type === 'circle') {
                    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                } else if (this.type === 'square') {
                    ctx.rect(-this.size/2, -this.size/2, this.size, this.size);
                } else { 
                    ctx.moveTo(this.size, 0); 
                    ctx.lineTo(-this.size / 2, -this.size * 0.866); 
                    ctx.lineTo(-this.size / 2, this.size * 0.866); 
                    ctx.closePath(); 
                }
                ctx.clip();
                ctx.fillStyle = '#9ca3af'; 
                ctx.fillRect(-this.size, -this.size, this.size*2, this.size);
                ctx.fillStyle = '#ff0000'; 
                ctx.shadowColor = '#ff0000'; 
                ctx.shadowBlur = 10; 
                ctx.beginPath(); 
                ctx.arc(this.size*0.4, -this.size*0.4, 5, 0, Math.PI*2); 
                ctx.fill();
                ctx.restore();
            }
            else if (skinType === 'voidwalker') {
                ctx.fillStyle = '#000'; 
                ctx.beginPath(); 
                ctx.arc(0, 0, this.size*0.5, 0, Math.PI*2); 
                ctx.fill(); 
                ctx.strokeStyle = '#a855f7'; 
                ctx.lineWidth = 3; 
                ctx.shadowColor = '#a855f7'; 
                ctx.shadowBlur = 15; 
                ctx.stroke();
            }
            else if (skinType === 'glitch') {
                ctx.fillStyle = 'rgba(0, 255, 255, 0.7)'; 
                ctx.beginPath(); 
                ctx.arc(-3, -3, this.size*0.4, 0, Math.PI*2); 
                ctx.fill();
                
                ctx.fillStyle = 'rgba(255, 0, 255, 0.7)'; 
                ctx.beginPath(); 
                ctx.arc(3, 3, this.size*0.4, 0, Math.PI*2); 
                ctx.fill();
            }
            else if (skinType === 'inferno') {
                ctx.fillStyle = '#fbbf24'; 
                ctx.beginPath(); 
                ctx.arc(0, 0, this.size*0.6, 0, Math.PI*2); 
                ctx.fill();
                
                ctx.fillStyle = '#dc2626'; 
                ctx.shadowColor = '#dc2626'; 
                ctx.shadowBlur = 15;
                ctx.beginPath(); 
                ctx.arc(0, 0, this.size*0.4, 0, Math.PI*2); 
                ctx.fill();
            }
            else if (skinType === 'warlord') {
                ctx.strokeStyle = '#444'; 
                ctx.lineWidth = 4;
                ctx.beginPath(); 
                ctx.moveTo(-this.size*0.5, -this.size*0.5); 
                ctx.lineTo(this.size*0.5, this.size*0.5); 
                ctx.moveTo(this.size*0.5, -this.size*0.5); 
                ctx.lineTo(-this.size*0.5, this.size*0.5); 
                ctx.stroke();
            }
            else if (skinType === 'spectre') {
                ctx.fillStyle = 'rgba(168, 85, 247, 0.8)'; 
                ctx.shadowColor = '#a855f7'; 
                ctx.shadowBlur = 20;
                ctx.beginPath(); 
                ctx.arc(0, 0, this.size*0.7, 0, Math.PI*2); 
                ctx.fill();
            }
            else if (skinType === 'phantom') {
                ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'; 
                ctx.lineWidth = 3; 
                ctx.shadowColor = '#3b82f6'; 
                ctx.shadowBlur = 10;
                ctx.beginPath(); 
                ctx.arc(0, 0, this.size*0.8, 0, Math.PI*2); 
                ctx.stroke();
                ctx.beginPath(); 
                ctx.arc(0, 0, this.size*0.4, 0, Math.PI*2); 
                ctx.stroke();
            }
            else if (skinType === 'target') {
                ctx.save();
                ctx.beginPath();
                if (this.type === 'circle') {
                    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                } else if (this.type === 'square') {
                    ctx.rect(-this.size/2, -this.size/2, this.size, this.size);
                } else { 
                    ctx.moveTo(this.size, 0); 
                    ctx.lineTo(-this.size / 2, -this.size * 0.866); 
                    ctx.lineTo(-this.size / 2, this.size * 0.866); 
                    ctx.closePath(); 
                }
                ctx.clip();
                ctx.strokeStyle = 'rgba(255,255,255,0.6)'; 
                ctx.lineWidth = 4;
                ctx.beginPath(); 
                ctx.arc(0, 0, this.size*0.6, 0, Math.PI*2); 
                ctx.stroke();
                ctx.beginPath(); 
                ctx.arc(0, 0, this.size*0.2, 0, Math.PI*2); 
                ctx.stroke();
                ctx.restore();
            }
            else if (skinType === 'stripes') {
                ctx.save();
                ctx.beginPath();
                if (this.type === 'circle') {
                    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                } else if (this.type === 'square') {
                    ctx.rect(-this.size/2, -this.size/2, this.size, this.size);
                } else { 
                    ctx.moveTo(this.size, 0); 
                    ctx.lineTo(-this.size / 2, -this.size * 0.866); 
                    ctx.lineTo(-this.size / 2, this.size * 0.866); 
                    ctx.closePath(); 
                }
                ctx.clip();
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                for(let i = -this.size; i < this.size; i += 10) { 
                    ctx.fillRect(i, -this.size, 5, this.size*2); 
                }
                ctx.restore();
            }
            else if (skinType === 'checker') {
                ctx.save();
                ctx.beginPath();
                if (this.type === 'circle') {
                    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                } else if (this.type === 'square') {
                    ctx.rect(-this.size/2, -this.size/2, this.size, this.size);
                } else { 
                    ctx.moveTo(this.size, 0); 
                    ctx.lineTo(-this.size / 2, -this.size * 0.866); 
                    ctx.lineTo(-this.size / 2, this.size * 0.866); 
                    ctx.closePath(); 
                }
                ctx.clip();
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                let sq = this.size * 0.25; 
                for(let x = -this.size; x <= this.size; x += sq) {
                    for(let y = -this.size; y <= this.size; y += sq) {
                        if (Math.abs(Math.round(x/sq) + Math.round(y/sq)) % 2 === 0) {
                            ctx.fillRect(x, y, sq, sq);
                        }
                    }
                }
                ctx.restore();
            }
            else if (skinType === 'zebra') {
                ctx.save();
                ctx.beginPath();
                if (this.type === 'circle') {
                    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                } else if (this.type === 'square') {
                    ctx.rect(-this.size/2, -this.size/2, this.size, this.size);
                } else { 
                    ctx.moveTo(this.size, 0); 
                    ctx.lineTo(-this.size / 2, -this.size * 0.866); 
                    ctx.lineTo(-this.size / 2, this.size * 0.866); 
                    ctx.closePath(); 
                }
                ctx.clip();
                ctx.fillStyle = '#111';
                for(let i = -this.size; i < this.size; i += 15) {
                    ctx.beginPath(); 
                    ctx.moveTo(i, -this.size); 
                    ctx.lineTo(i + 5, 0); 
                    ctx.lineTo(i - 2, this.size); 
                    ctx.lineTo(i + 4, this.size); 
                    ctx.lineTo(i + 12, 0); 
                    ctx.lineTo(i + 8, -this.size); 
                    ctx.fill();
                }
                ctx.restore();
            }
            else if (skinType === 'camo') {
                ctx.save();
                ctx.beginPath();
                if (this.type === 'circle') {
                    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                } else if (this.type === 'square') {
                    ctx.rect(-this.size/2, -this.size/2, this.size, this.size);
                } else { 
                    ctx.moveTo(this.size, 0); 
                    ctx.lineTo(-this.size / 2, -this.size * 0.866); 
                    ctx.lineTo(-this.size / 2, this.size * 0.866); 
                    ctx.closePath(); 
                }
                ctx.clip();
                
                ctx.fillStyle = '#4b5320'; 
                ctx.fillRect(-this.size, -this.size, this.size*2, this.size*2);
                
                ctx.fillStyle = '#556b2f'; 
                ctx.beginPath(); 
                ctx.arc(-this.size*0.4, -this.size*0.3, this.size*0.5, 0, Math.PI*2); 
                ctx.arc(this.size*0.3, this.size*0.5, this.size*0.4, 0, Math.PI*2); 
                ctx.fill();
                
                ctx.fillStyle = '#8b7355'; 
                ctx.beginPath(); 
                ctx.arc(this.size*0.5, -this.size*0.4, this.size*0.4, 0, Math.PI*2); 
                ctx.arc(-this.size*0.2, this.size*0.4, this.size*0.5, 0, Math.PI*2); 
                ctx.fill();
                
                ctx.fillStyle = '#2f4f4f'; 
                ctx.beginPath(); 
                ctx.arc(-this.size*0.6, 0.1, this.size*0.3, 0, Math.PI*2); 
                ctx.arc(this.size*0.1, -this.size*0.1, this.size*0.3, 0, Math.PI*2); 
                ctx.fill();
                
                ctx.restore();
            }
            else if (skinType === 'demon') {
                ctx.fillStyle = '#111';
                ctx.beginPath(); 
                ctx.moveTo(-this.size*0.2, -this.size*0.5); 
                ctx.lineTo(-this.size*0.5, -this.size*0.8); 
                ctx.lineTo(0, -this.size*0.6); 
                ctx.fill(); 
                
                ctx.beginPath(); 
                ctx.moveTo(-this.size*0.2, this.size*0.5); 
                ctx.lineTo(-this.size*0.5, this.size*0.8); 
                ctx.lineTo(0, this.size*0.6); 
                ctx.fill(); 
                
                ctx.fillStyle = '#ff0000'; 
                ctx.shadowColor = '#ff0000'; 
                ctx.shadowBlur = 10;
                
                ctx.beginPath(); 
                ctx.moveTo(this.size*0.3, -this.size*0.3); 
                ctx.lineTo(this.size*0.6, -this.size*0.1); 
                ctx.lineTo(this.size*0.3, -this.size*0.1); 
                ctx.fill();
                
                ctx.beginPath(); 
                ctx.moveTo(this.size*0.3, this.size*0.3); 
                ctx.lineTo(this.size*0.6, this.size*0.1); 
                ctx.lineTo(this.size*0.3, this.size*0.1); 
                ctx.fill();
            }
            else if (skinType === 'angel') {
                ctx.strokeStyle = '#ffe600'; 
                ctx.lineWidth = 3; 
                ctx.shadowColor = '#ffe600'; 
                ctx.shadowBlur = 10;
                ctx.beginPath(); 
                ctx.ellipse(-this.size*0.2, 0, this.size*0.2, this.size*0.6, 0, 0, Math.PI*2); 
                ctx.stroke();
            }
            else if (skinType === 'pirate') {
                ctx.save();
                ctx.beginPath();
                if (this.type === 'circle') {
                    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                } else if (this.type === 'square') {
                    ctx.rect(-this.size/2, -this.size/2, this.size, this.size);
                } else { 
                    ctx.moveTo(this.size, 0); 
                    ctx.lineTo(-this.size / 2, -this.size * 0.866); 
                    ctx.lineTo(-this.size / 2, this.size * 0.866); 
                    ctx.closePath(); 
                }
                ctx.clip();
                
                ctx.strokeStyle = '#111'; 
                ctx.lineWidth = 4;
                ctx.beginPath(); 
                ctx.moveTo(-this.size, -this.size); 
                ctx.lineTo(this.size, this.size); 
                ctx.stroke(); 
                
                ctx.fillStyle = '#111';
                ctx.beginPath(); 
                ctx.arc(this.size*0.2, this.size*0.2, this.size*0.3, 0, Math.PI*2); 
                ctx.fill(); 
                
                ctx.restore();
            }
            else if (skinType === 'bandit') {
                ctx.save();
                ctx.beginPath();
                if (this.type === 'circle') {
                    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                } else if (this.type === 'square') {
                    ctx.rect(-this.size/2, -this.size/2, this.size, this.size);
                } else { 
                    ctx.moveTo(this.size, 0); 
                    ctx.lineTo(-this.size / 2, -this.size * 0.866); 
                    ctx.lineTo(-this.size / 2, this.size * 0.866); 
                    ctx.closePath(); 
                }
                ctx.clip();
                
                ctx.fillStyle = '#111'; 
                ctx.fillRect(0, -this.size, this.size*0.6, this.size*2); 
                
                ctx.fillStyle = '#fff';
                ctx.fillRect(this.size*0.2, -this.size*0.4, this.size*0.2, this.size*0.2); 
                ctx.fillRect(this.size*0.2, this.size*0.2, this.size*0.2, this.size*0.2); 
                
                ctx.restore();
            }
            else if (skinType === 'mecha') {
                ctx.save();
                ctx.beginPath();
                if (this.type === 'circle') {
                    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                } else if (this.type === 'square') {
                    ctx.rect(-this.size/2, -this.size/2, this.size, this.size);
                } else { 
                    ctx.moveTo(this.size, 0); 
                    ctx.lineTo(-this.size / 2, -this.size * 0.866); 
                    ctx.lineTo(-this.size / 2, this.size * 0.866); 
                    ctx.closePath(); 
                }
                ctx.clip();
                
                ctx.strokeStyle = '#00ffcc'; 
                ctx.lineWidth = 2; 
                ctx.shadowColor = '#00ffcc'; 
                ctx.shadowBlur = 5;
                ctx.beginPath();
                ctx.moveTo(-this.size*0.8, -this.size*0.2); 
                ctx.lineTo(0, -this.size*0.2); 
                ctx.lineTo(this.size*0.2, -this.size*0.6);
                
                ctx.moveTo(-this.size*0.8, this.size*0.2); 
                ctx.lineTo(0, this.size*0.2); 
                ctx.lineTo(this.size*0.2, this.size*0.6);
                
                ctx.moveTo(this.size*0.4, -this.size*0.8); 
                ctx.lineTo(this.size*0.4, this.size*0.8);
                ctx.stroke();
                
                ctx.fillStyle = '#fff';
                ctx.beginPath(); 
                ctx.arc(0, -this.size*0.2, 3, 0, Math.PI*2); 
                ctx.fill();
                
                ctx.beginPath(); 
                ctx.arc(0, this.size*0.2, 3, 0, Math.PI*2); 
                ctx.fill();
                
                ctx.beginPath(); 
                ctx.arc(this.size*0.4, 0, 3, 0, Math.PI*2); 
                ctx.fill();
                
                ctx.restore();
            }
            else {
                ctx.beginPath();
                const innerSize = this.size * 0.5;
                
                if (this.type === 'circle') { 
                    ctx.arc(0, 0, innerSize, 0, Math.PI * 2); 
                } 
                else if (this.type === 'square') { 
                    ctx.rect(-innerSize/2, -innerSize/2, innerSize, innerSize); 
                } 
                else if (this.type === 'triangle') {
                    ctx.moveTo(innerSize, 0); 
                    ctx.lineTo(-innerSize / 2, -innerSize * 0.866); 
                    ctx.lineTo(-innerSize / 2, innerSize * 0.866); 
                    ctx.closePath();
                }
                
                if (skinType === 'neon') { 
                    ctx.fillStyle = '#ffffff'; 
                    if (window.gameSettings.highQuality) { 
                        ctx.shadowBlur = 15; 
                        ctx.shadowColor = '#ffffff'; 
                    } 
                    ctx.fill(); 
                } 
                else if (skinType === 'dark') { 
                    ctx.fillStyle = '#111111'; 
                    ctx.fill(); 
                    ctx.lineWidth = 3; 
                    ctx.strokeStyle = '#a855f7'; 
                    ctx.stroke(); 
                } 
                else if (skinType === 'gladiator') { 
                    ctx.fillStyle = '#9ca3af'; 
                    ctx.fill(); 
                    ctx.lineWidth = 2; 
                    ctx.strokeStyle = '#ffffff'; 
                    ctx.stroke(); 
                }
            }
            ctx.restore();
        }
        
        let hideArrow = (this.frontVisual !== null);
        if (this.isPlayer && !hideArrow && this.name !== "") {
            ctx.save(); 
            ctx.translate(this.x, this.y); 
            ctx.rotate(this.angle);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            let arrowOffset = (this.type === 'square' ? this.size / 2 : this.size) + armorOffset + 4;
            ctx.moveTo(arrowOffset, -4);
            ctx.lineTo(arrowOffset + 8, 0);
            ctx.lineTo(arrowOffset, 4);
            ctx.fill();
            ctx.restore();
        }

        if (this.orbiters > 0) {
            ctx.fillStyle = '#a855f7';
            if (window.gameSettings.highQuality) { 
                ctx.shadowBlur = 10; 
                ctx.shadowColor = '#a855f7'; 
            }
            let t = (Date.now() / 500) * this.overclock; 
            let selfSpin = (Date.now() / 80) * this.overclock; 
            
            for (let i = 0; i < this.orbiters; i++) {
                let angle = t + (i / this.orbiters) * Math.PI * 2;
                let ox = this.x + Math.cos(angle) * (this.size + 25); 
                let oy = this.y + Math.sin(angle) * (this.size + 25);
                
                ctx.save(); 
                ctx.translate(ox, oy); 
                ctx.rotate(selfSpin); 
                ctx.beginPath();
                let teeth = 8; 
                let outerRadius = 9; 
                let innerRadius = 5;
                
                for (let j = 0; j < teeth * 2; j++) {
                    let r = (j % 2 === 0) ? outerRadius : innerRadius; 
                    let a = (j / (teeth * 2)) * Math.PI * 2;
                    if (j === 0) {
                        ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); 
                    } else {
                        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
                    }
                }
                
                ctx.closePath(); 
                ctx.fill(); 
                ctx.fillStyle = '#111'; 
                ctx.shadowBlur = 0; 
                ctx.beginPath(); 
                ctx.arc(0, 0, 3, 0, Math.PI * 2); 
                ctx.fill(); 
                ctx.restore();
            }
            ctx.shadowBlur = 0; 
        }
        
        let isMenuDummy = (!this.isPlayer && this.name === "");
        if (!isMenuDummy) {
            if (window.gameSettings.showNames && this.name !== "") {
                ctx.fillStyle = 'white'; 
                ctx.font = 'bold 12px sans-serif'; 
                ctx.textAlign = 'center';
                if (window.gameSettings.highQuality) { 
                    ctx.shadowBlur = 2; 
                    ctx.shadowColor = 'black'; 
                }
                let displayName = this.name;
                if (this.equipped.Banner && ITEMS_DB) {
                    displayName = `${ITEMS_DB[this.equipped.Banner].value} ${this.name}`;
                }
                ctx.fillText(displayName, this.x, this.y - this.size - 20 - armorOffset); 
                ctx.shadowBlur = 0; 
            }

            if (this.health < this.maxHealth || this.isPlayer) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.7)'; 
                ctx.fillRect(this.x - 20, this.y + this.size + 15 + armorOffset, 40, 5);
                
                ctx.fillStyle = '#00ffcc'; 
                ctx.fillRect(this.x - 20, this.y + this.size + 15 + armorOffset, 40 * (this.health / this.maxHealth), 5);
            }
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; 
            ctx.fillRect(this.x - 20, this.y + this.size + 22 + armorOffset, 40, 3);
            
            let dashCost = Math.max(0, 2 - this.efficiency); 
            if (this.dashCooldown <= 0) {
                if (this.points >= dashCost) { 
                    ctx.fillStyle = '#ffe600'; 
                    ctx.fillRect(this.x - 20, this.y + this.size + 22 + armorOffset, 40, 3); 
                } else { 
                    ctx.fillStyle = '#888888'; 
                    ctx.fillRect(this.x - 20, this.y + this.size + 22 + armorOffset, 40, 3); 
                }
            } else {
                ctx.fillStyle = '#ffffff'; 
                const pct = Math.max(0, 1 - (this.dashCooldown / this.dashMaxCooldown));
                const visualWidth = Math.min(40 * pct, 38);
                ctx.fillRect(this.x - 20, this.y + this.size + 22 + armorOffset, visualWidth, 3);
            }

            if (this.activeAbility) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; 
                ctx.fillRect(this.x - 20, this.y + this.size + 28 + armorOffset, 40, 3);
                
                if (this.abilityCooldown <= 0) {
                    ctx.fillStyle = '#ff00ff'; 
                    ctx.fillRect(this.x - 20, this.y + this.size + 28 + armorOffset, 40, 3); 
                } else {
                    ctx.fillStyle = '#ffffff'; 
                    const aPct = Math.max(0, 1 - (this.abilityCooldown / this.abilityMaxCooldown));
                    ctx.fillRect(this.x - 20, this.y + this.size + 28 + armorOffset, Math.min(40 * aPct, 38), 3);
                }
            }
        }
    }
}

export class Bot extends Entity {
    constructor(x, y, type, startingPoints = 0) {
        super(x, y, type); 
        this.targetX = x; 
        this.targetY = y; 
        this.changeTargetTimer = 0;
        this.isTeammate = false; 

        const names = ['OrbHunter', 'NovaStrike', 'PixelSlayer', 'GhostBlade', 'RogueBot', 'Vanguard', 'Titan', 'Apex'];
        this.name = names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 99);
        this.points = startingPoints; 
        this.upgradeProgress = startingPoints; 
        
        this.botPointsToNextUpgrade = 10;
        this.dashTendency = Math.random();
        this.strafeDir = Math.random() > 0.5 ? 1 : -1; 
        this.personality = Math.random(); 
        
        while (this.upgradeProgress >= this.botPointsToNextUpgrade) {
            this.upgradeProgress -= this.botPointsToNextUpgrade;
            this.upgradeCount++; 
            this.botPointsToNextUpgrade = Math.floor(this.botPointsToNextUpgrade * 1.25) + 15;
            let choices = getWeightedUpgrades(this, 1); 
            if (choices.length > 0) {
                this.applyUpgrade(choices[0].id);
            }
        }
        
        if (ITEMS_DB && Math.random() < 0.15) {
            const items = Object.values(ITEMS_DB);
            if (Math.random() < 0.2) {
                let skins = items.filter(i => i.category === 'Skin'); 
                if (skins.length) this.equipped.Skin = skins[Math.floor(Math.random()*skins.length)].id;
            }
            if (Math.random() < 0.2) {
                let trails = items.filter(i => i.category === 'Trail'); 
                if (trails.length) this.equipped.Trail = trails[Math.floor(Math.random()*trails.length)].id;
            }
        }
    }
    
    updateBot(allPlayers, isCinematicIntro = false) {
        if (isCinematicIntro && (this.isTeammate || this.isPlayer)) {
            this.angle = -Math.PI / 2; 
            super.update(); 
            return;
        }

        this.changeTargetTimer--; 
        let nearestEnemy = null; 
        let minDist = 800;
        
        let highestScore = 0;

        allPlayers.forEach(p => { 
            if (p.points > highestScore) {
                highestScore = p.points;
            }

            if (p === this || p.isDead) return; 
            if (this.isTeammate && (p.isPlayer || p.isTeammate)) return;
            if (p.inSafeZone) return; 

            const dist = distance(this.x, this.y, p.x, p.y); 
            let randomizedDist = dist + (Math.random() * 100); 
            
            if (randomizedDist < minDist) { 
                minDist = randomizedDist; 
                nearestEnemy = p; 
            } 
        });

        let catchUpGain = (highestScore > this.points) ? (highestScore - this.points) * 0.002 : 0;
        let passiveGain = 0.5 + catchUpGain; 
        
        this.points += passiveGain; 
        this.upgradeProgress += passiveGain;
        
        while (this.upgradeProgress >= this.botPointsToNextUpgrade) {
            this.upgradeProgress -= this.botPointsToNextUpgrade; 
            this.upgradeCount++; 
            this.botPointsToNextUpgrade = Math.floor(this.botPointsToNextUpgrade * 1.25) + 15;
            let choices = getWeightedUpgrades(this, 1); 
            if (choices.length > 0) {
                this.applyUpgrade(choices[0].id);
            }
        }

        if (this.isTeammate && !nearestEnemy) {
            const player = allPlayers.find(p => p.isPlayer);
            if (player && !player.isDead) {
                const distToPlayer = distance(this.x, this.y, player.x, player.y);
                if (distToPlayer > 200) {
                    this.angle = Math.atan2(player.y - this.y, player.x - this.x);
                    const dx = player.x - this.x; 
                    const dy = player.y - this.y;
                    
                    let currentSpeed = this.speed * (this.abilityTimer > 0 && this.activeAbility === 'overdrive' ? 1.8 : 1.0);
                    this.vx += (dx / distToPlayer) * (currentSpeed * 0.12);
                    this.vy += (dy / distToPlayer) * (currentSpeed * 0.12);
                } else {
                    this.vx *= 0.9; 
                    this.vy *= 0.9;
                }
            }
        } else if (nearestEnemy) {
            const trueDist = distance(this.x, this.y, nearestEnemy.x, nearestEnemy.y);
            const dx = nearestEnemy.x - this.x; 
            const dy = nearestEnemy.y - this.y;
            
            let currentSpeed = this.speed * (this.abilityTimer > 0 && this.activeAbility === 'overdrive' ? 1.8 : 1.0);
            let fleeThreshold = 0.15 + (this.personality * 0.25); 
            
            if (this.activeAbility && this.abilityCooldown <= 0) {
                if (this.health < this.maxHealth * 0.3 || (this.activeAbility === 'overdrive' && trueDist < 300)) {
                    this.useAbility();
                }
            }

            if (this.health < this.maxHealth * fleeThreshold) {
                this.angle = Math.atan2(-dy, -dx);
                this.vx += Math.cos(this.angle) * (currentSpeed * 0.14);
                this.vy += Math.sin(this.angle) * (currentSpeed * 0.14);
                
                if (this.dashCooldown <= 0 && Math.random() < 0.03) {
                    this.dash(-dx, -dy);
                }
            } else {
                this.angle = Math.atan2(dy, dx);
                if (trueDist > 150 && trueDist < 400 && Math.random() < (0.002 + this.dashTendency * 0.005)) {
                    this.dash(dx, dy);
                }
                let optimalDist = this.type === 'square' ? 100 : (this.type === 'triangle' ? 300 : 200);
                if (Math.random() < 0.01) {
                    this.strafeDir *= -1; 
                }
                
                if (trueDist > optimalDist + 50) { 
                    this.vx += (dx / trueDist) * (currentSpeed * 0.12); 
                    this.vy += (dy / trueDist) * (currentSpeed * 0.12); 
                } else if (trueDist < optimalDist - 50) { 
                    this.vx -= (dx / trueDist) * (currentSpeed * 0.12); 
                    this.vy -= (dy / trueDist) * (currentSpeed * 0.12); 
                } else {
                    this.vx += (-dy / trueDist) * (currentSpeed * 0.08) * this.strafeDir;
                    this.vy += (dx / trueDist) * (currentSpeed * 0.08) * this.strafeDir;
                }
            }
        } else {
            if (this.changeTargetTimer <= 0) {
                this.targetX = this.x + (Math.random() - 0.5) * 800; 
                this.targetY = this.y + (Math.random() - 0.5) * 800; 
                this.changeTargetTimer = 60 + Math.random() * 60; 
            }
            this.angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);
            const dx = this.targetX - this.x; 
            const dy = this.targetY - this.y; 
            const dist = Math.hypot(dx, dy);
            
            let currentSpeed = this.speed * (this.abilityTimer > 0 && this.activeAbility === 'overdrive' ? 1.8 : 1.0);
            
            if (dist > 10) { 
                this.vx += (dx / dist) * (currentSpeed * 0.10); 
                this.vy += (dy / dist) * (currentSpeed * 0.10); 
            }
        }
        super.update();
    }
}

export class SafeZone {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 250; 
        this.state = 'idle'; 
        this.triggerTimer = 180; 
        this.lifeTimer = 0;
        this.maxLifeTimer = 0;
    }
    
    update(player) {
        let dist = distance(this.x, this.y, player.x, player.y);
        let isInside = dist < this.radius;

        if (this.state === 'idle') {
            if (isInside) {
                this.state = 'triggering';
                this.triggerTimer = 180;
            }
        } else if (this.state === 'triggering') {
            if (isInside) {
                this.triggerTimer--;
                if (this.triggerTimer <= 0) {
                    this.state = 'active';
                    this.maxLifeTimer = Math.floor((Math.random() * 15 + 5) * 60); 
                    this.lifeTimer = this.maxLifeTimer;
                }
            } else {
                this.state = 'idle';
                this.triggerTimer = 180;
            }
        } else if (this.state === 'active') {
            this.lifeTimer--;
        }
        
        return isInside;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        
        if (this.state === 'active') {
            ctx.fillStyle = 'rgba(0, 255, 204, 0.25)'; 
        } else {
            ctx.fillStyle = 'rgba(0, 255, 204, 0.1)';
        }
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(0, 255, 204, 0.6)';
        ctx.lineWidth = 4;
        ctx.setLineDash([20, 20]);
        ctx.lineDashOffset = -Date.now() / 20;
        ctx.stroke();

        if (this.state === 'triggering') {
            ctx.fillStyle = 'white';
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'center';
            if (window.gameSettings.highQuality) { 
                ctx.shadowBlur = 5; 
                ctx.shadowColor = 'black'; 
            }
            let secs = Math.ceil(this.triggerTimer / 60);
            ctx.fillText(`ACTIVATING IN ${secs}`, 0, -this.radius - 20);
        } else if (this.state === 'active') {
            ctx.fillStyle = '#ffe600';
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'center';
            if (window.gameSettings.highQuality) { 
                ctx.shadowBlur = 5; 
                ctx.shadowColor = 'black'; 
            }
            let secs = Math.ceil(this.lifeTimer / 60);
            ctx.fillText(`SAFE: ${secs}s`, 0, -this.radius - 20);
        }

        ctx.restore();
    }
}

export class Projectile {
    constructor(x, y, angle, owner, isMissile = false) {
        this.x = x + Math.cos(angle) * (owner.size + 5); 
        this.y = y + Math.sin(angle) * (owner.size + 5); 
        this.angle = angle; 
        this.owner = owner; 
        this.isMissile = isMissile;
        this.pierce = owner.pierceAmmo || 0; 
        this.hitTargets = []; 
        this.sizeScale = 1 + (owner.heavyArt * 0.5);
        
        if (isMissile) {
            this.speed = (owner.bulletSpeed || 15) * 0.45; 
            this.damage = 10 + (owner.baseDamage * 0.5); 
            this.turnSpeed = 0.05 + (owner.missiles * 0.02); 
            this.color = '#ff0044'; 
            this.life = 80; 
        } else {
            this.speed = owner.bulletSpeed || 15; 
            this.damage = owner.baseDamage; 
            this.color = owner.color;
            this.life = 60 + (owner.sniper * 20); 
        }
    }
    
    update(targets) { 
        if (this.isMissile && targets) {
            let nearest = null; 
            let minDist = Infinity;
            
            targets.forEach(t => { 
                if (t === this.owner || t.isDead || t.inSafeZone) return; 
                let d = distance(this.x, this.y, t.x, t.y); 
                if (d < minDist && d < 600) { 
                    minDist = d; 
                    nearest = t; 
                } 
            });
            
            if (nearest) {
                let targetAngle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
                let diff = targetAngle - this.angle; 
                
                while (diff < -Math.PI) diff += Math.PI * 2; 
                while (diff > Math.PI) diff -= Math.PI * 2;
                
                if (diff > 0) {
                    this.angle += Math.min(this.turnSpeed, diff); 
                } else {
                    this.angle += Math.max(-this.turnSpeed, diff);
                }
            }
        } 
        else if (!this.isMissile && this.owner.isPlayer && targets) {
            let nearest = null; 
            let minDist = 350; 
            
            targets.forEach(t => { 
                if (t === this.owner || t.isDead || t.isTeammate || t.inSafeZone) return; 
                let d = distance(this.x, this.y, t.x, t.y); 
                if (d < minDist) { 
                    minDist = d; 
                    nearest = t; 
                } 
            });
            
            if (nearest) {
                let targetAngle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
                let diff = targetAngle - this.angle; 
                
                while (diff < -Math.PI) diff += Math.PI * 2; 
                while (diff > Math.PI) diff -= Math.PI * 2;
                
                if (Math.abs(diff) < 0.4) {
                    this.angle += diff * 0.05; 
                }
            }
        }

        this.x += Math.cos(this.angle) * this.speed; 
        this.y += Math.sin(this.angle) * this.speed; 
        this.life--; 
    }
    
    draw(ctx) {
        ctx.save(); 
        ctx.translate(this.x, this.y); 
        ctx.rotate(this.angle);
        ctx.scale(this.sizeScale, this.sizeScale);
        
        if (window.gameSettings.highQuality) { 
            ctx.shadowBlur = 10; 
            ctx.shadowColor = this.color; 
        } else { 
            ctx.shadowBlur = 0; 
        }
        
        if (this.isMissile) {
            ctx.fillStyle = this.color; 
            ctx.beginPath(); 
            ctx.moveTo(12, 0); 
            ctx.lineTo(-8, 6);