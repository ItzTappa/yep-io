// Bullets, homing missiles, shrapnel fragments, the tactical nuke and the railgun beam.
import { angleDiff, distance } from '../core/math.js';
import { settings } from '../core/settings.js';
import { BALANCE } from '../data/balance.js';
import { rgba } from './render/palette.js';

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
        this.sizeScale = 1 + owner.heavyArt * BALANCE.upgrades.heavyArtSize;

        if (isNuke) {
            this.speed = (owner.bulletSpeed || 15) * 0.55;
            this.damage = 170 + owner.baseDamage * 2.5;
            this.turnSpeed = 0;
            this.color = '#ff00ff';
            this.life = 150;
            this.sizeScale = 3.5;
        } else if (isMissile) {
            this.speed = (owner.bulletSpeed || 15) * 0.45;
            this.damage = BALANCE.upgrades.missileDamage.flat + owner.baseDamage * BALANCE.upgrades.missileDamage.ofBase;
            this.turnSpeed = 0.05 + owner.missiles * 0.02;
            this.color = '#ff0044';
            this.life = 80;
        } else {
            this.speed = owner.bulletSpeed || 15;
            this.damage = owner.baseDamage;
            this.color = owner.color;
            this.life = 60 + owner.sniper * BALANCE.upgrades.sniperLifeTicks;
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
        const hq = settings.highQuality;
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.isFire) {
            // Afterburner: a flickering flame patch that fades out.
            const a = Math.max(0, Math.min(1, this.life / 30));
            const r = 7 + (1 - a) * 4 + Math.sin(this.life * 1.7) * 1.2;
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
            g.addColorStop(0, `rgba(255, 244, 200, ${0.9 * a})`);
            g.addColorStop(0.45, `rgba(251, 146, 60, ${0.75 * a})`);
            g.addColorStop(1, 'rgba(220, 38, 38, 0)');
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            return;
        }

        ctx.rotate(this.angle);
        ctx.scale(this.sizeScale, this.sizeScale);
        // Real blur only on the rare special shots; ordinary bullets (there can be hundreds on
        // screen) get a cheap soft halo instead.
        const special = this.isNuke || this.isMissile || this.isRailgun;
        if (this.haloFor !== this.color) {
            this.haloFor = this.color;   // colour changes when a Repulsor reflects the shot
            this.halo = rgba(this.color, 0.22);
        }
        if (hq && special) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = this.isRailgun ? 20 : 10;
        }

        if (this.isNuke) {
            ctx.rotate(-this.angle);
            const pulse = 1 + Math.sin(performance.now() / 90) * 0.12;
            ctx.fillStyle = '#f0abfc';
            ctx.beginPath(); ctx.arc(0, 0, 6 * pulse, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(232, 121, 249, 0.85)';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([3, 3]);
            ctx.lineDashOffset = -performance.now() / 40;
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
        } else if (this.isMissile) {
            // a small rocket with fins and an exhaust glow
            ctx.fillStyle = 'rgba(251, 146, 60, 0.9)';
            ctx.beginPath(); ctx.arc(-9, 0, 2.6 + Math.random() * 1.2, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.moveTo(11, 0); ctx.lineTo(4, -3.5); ctx.lineTo(-6, -3.5); ctx.lineTo(-9, -7);
            ctx.lineTo(-8, 0); ctx.lineTo(-9, 7); ctx.lineTo(-6, 3.5); ctx.lineTo(4, 3.5);
            ctx.closePath();
            ctx.fillStyle = '#fb7185';
            ctx.fill();
            ctx.strokeStyle = '#4c0519';
            ctx.lineWidth = 1.2;
            ctx.stroke();
        } else if (this.isRailgun) {
            const g = ctx.createLinearGradient(-15, 0, 35, 0);
            g.addColorStop(0, 'rgba(240, 171, 252, 0)');
            g.addColorStop(0.3, this.color);
            g.addColorStop(1, '#ffffff');
            ctx.fillStyle = g;
            ctx.fillRect(-15, -4, 50, 8);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-6, -1.5, 40, 3);
        } else if (this.isFragment) {
            if (hq) {
                ctx.fillStyle = this.halo;
                ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
            }
            ctx.fillStyle = this.color;
            ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(0, -2.5); ctx.lineTo(-4, 0); ctx.lineTo(0, 2.5); ctx.closePath(); ctx.fill();
        } else {
            // standard bullet: a capsule in the shooter's colour with a white-hot core
            if (hq) {
                capsule(ctx, -12, -6, 24, 12);
                ctx.fillStyle = this.halo;
                ctx.fill();
            }
            capsule(ctx, -9, -3.5, 18, 7);
            ctx.fillStyle = this.color;
            ctx.fill();
            capsule(ctx, -6, -1.6, 13, 3.2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fill();
        }
        ctx.restore();
    }
}

function capsule(ctx, x, y, w, h) {
    const r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x + r, y + h);
    ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
}
