// Bullets, homing missiles, shrapnel fragments, the tactical nuke and the railgun beam.
import { angleDiff, distance } from '../core/math.js';
import { settings } from '../core/settings.js';

export class Projectile {
    constructor(x, y, angle, owner, { isMissile = false, isNuke = false } = {}) {
        this.x = x + Math.cos(angle) * (owner.size + 5);
        this.y = y + Math.sin(angle) * (owner.size + 5);
        this.angle = angle;
        this.owner = owner;
        this.isMissile = isMissile;
        this.isNuke = isNuke;
        this.isRailgun = false;
        this.isFragment = false;
        this.pierce = owner.pierceAmmo || 0;
        this.hitTargets = [];
        this.sizeScale = 1 + owner.heavyArt * 0.5;

        if (isNuke) {
            this.speed = (owner.bulletSpeed || 15) * 0.25;
            this.damage = 150 + owner.baseDamage * 2;
            this.turnSpeed = 0;
            this.color = '#ff00ff';
            this.life = 150;
            this.sizeScale = 3.5;
        } else if (isMissile) {
            this.speed = (owner.bulletSpeed || 15) * 0.45;
            this.damage = 10 + owner.baseDamage * 0.5;
            this.turnSpeed = 0.05 + owner.missiles * 0.02;
            this.color = '#ff0044';
            this.life = 80;
        } else {
            this.speed = owner.bulletSpeed || 15;
            this.damage = owner.baseDamage;
            this.color = owner.color;
            this.life = 60 + owner.sniper * 20;
        }
    }

    // Extra hit radius from bigger projectiles (Heavy Artillery, nukes, railgun).
    get hitRadius() {
        return 4 * Math.max(0, this.sizeScale - 1);
    }

    // `canTarget(t)` says whether a ship is a valid enemy of this projectile's owner.
    update(targets, canTarget) {
        if (this.isMissile) {
            this.steerToward(this.nearestTarget(targets, canTarget, 600), this.turnSpeed, false);
        } else if (!this.isNuke && !this.isRailgun && !this.isFragment && (this.owner.isPlayer || this.owner.isRemotePlayer)) {
            // Light aim assist for player bullets.
            this.steerToward(this.nearestTarget(targets, canTarget, 350), 0, true);
        }
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        this.life--;
    }

    nearestTarget(targets, canTarget, range) {
        let nearest = null;
        let best = range;
        for (const t of targets) {
            if (t === this.owner || t.isDead || t.isCloaked || t.inSafeZone || !canTarget(t)) continue;
            const d = distance(this.x, this.y, t.x, t.y);
            if (d < best) {
                best = d;
                nearest = t;
            }
        }
        return nearest;
    }

    steerToward(target, turnSpeed, gentle) {
        if (!target) return;
        const diff = angleDiff(Math.atan2(target.y - this.y, target.x - this.x), this.angle);
        if (gentle) {
            if (Math.abs(diff) < 0.4) this.angle += diff * 0.05;
        } else {
            this.angle += diff > 0 ? Math.min(turnSpeed, diff) : Math.max(-turnSpeed, diff);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(this.sizeScale, this.sizeScale);
        if (settings.highQuality) {
            ctx.shadowBlur = this.isRailgun ? 20 : 10;
            ctx.shadowColor = this.color;
        }
        if (this.isMissile || this.isNuke) {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.moveTo(12, 0);
            ctx.lineTo(-8, 6);
            ctx.lineTo(-8, -6);
            ctx.fill();
        } else if (this.isRailgun) {
            ctx.fillStyle = this.color;
            ctx.fillRect(-15, -4, 50, 8);
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 0;
            ctx.fillRect(-10, -1.5, 40, 3);
        } else {
            ctx.fillStyle = this.isFragment ? this.color : '#fff';
            ctx.fillRect(-10, -3, 20, 6);
        }
        ctx.restore();
    }
}
