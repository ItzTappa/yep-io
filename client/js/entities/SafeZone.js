// Safe zones: standing inside one protects you (no bullets get in, bots ignore you) and heals you,
// but your weapons are offline. Stand in an idle zone for 3 seconds to activate it; an active zone
// lasts 5-20 seconds and then disappears. Untouched zones vanish after 60 seconds.
import { settings } from '../core/settings.js';

const STATE_CODES = ['idle', 'triggering', 'active'];
// Starting zones use ids 1-3 (same on every computer); zones made later count up from here.
let nextZoneId = 1000;

export class SafeZone {
    constructor(x, y, id = null) {
        this.id = id ?? nextZoneId++;
        this.x = x;
        this.y = y;
        this.radius = 250;
        this.state = 'idle';
        this.triggerTimer = 180;
        this.lifeTimer = 0;
        this.maxLifeTimer = 0;
        this.idleTimer = 3600;
    }

    contains(x, y) {
        return Math.hypot(x - this.x, y - this.y) < this.radius;
    }

    get expired() {
        return this.state === 'active' && this.lifeTimer <= 0;
    }

    // Advances the zone's state. `occupied` = one of the zone's users is standing inside.
    update(occupied) {
        if (this.state === 'idle') {
            this.idleTimer--;
            if (occupied) {
                this.state = 'triggering';
                this.triggerTimer = 180;
            }
            if (this.idleTimer <= 0) {
                this.state = 'active';
                this.lifeTimer = 0;
            }
        } else if (this.state === 'triggering') {
            if (occupied) {
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
        } else {
            this.lifeTimer--;
        }
    }

    // Compact form for multiplayer: [id, x, y, state, triggerTimer, lifeTimer, maxLifeTimer]
    toNet() {
        return [this.id, Math.round(this.x), Math.round(this.y), STATE_CODES.indexOf(this.state), this.triggerTimer, this.lifeTimer, this.maxLifeTimer];
    }

    applyNet([, x, y, stateCode, triggerTimer, lifeTimer, maxLifeTimer]) {
        this.x = x;
        this.y = y;
        this.state = STATE_CODES[stateCode] || 'idle';
        this.triggerTimer = triggerTimer;
        this.lifeTimer = lifeTimer;
        this.maxLifeTimer = maxLifeTimer;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.state === 'active' ? 'rgba(0, 255, 204, 0.25)' : 'rgba(0, 255, 204, 0.1)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 255, 204, 0.6)';
        ctx.lineWidth = 4;
        ctx.setLineDash([20, 20]);
        ctx.lineDashOffset = -Date.now() / 20;
        ctx.stroke();

        let label = null;
        if (this.state === 'triggering') {
            ctx.fillStyle = 'white';
            label = `ACTIVATING IN ${Math.ceil(this.triggerTimer / 60)}`;
        } else if (this.state === 'active' && this.maxLifeTimer > 0) {
            ctx.fillStyle = '#ffe600';
            label = `SAFE: ${Math.ceil(this.lifeTimer / 60)}s`;
        }
        if (label) {
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'center';
            if (settings.highQuality) {
                ctx.shadowBlur = 5;
                ctx.shadowColor = 'black';
            }
            ctx.fillText(label, 0, -this.radius - 20);
        }
        ctx.restore();
    }
}
