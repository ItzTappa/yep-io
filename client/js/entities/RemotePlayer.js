// Another person in a multiplayer match. Their computer controls them; we only mirror
// what they send (position, health, upgrades, shots) and draw them smoothly.
import { Entity } from './Entity.js';
import { bodyColorFor, loadoutForClass } from '../data/items.js';
import { NET } from '../config.js';

export class RemotePlayer extends Entity {
    constructor(x, y, { id, name, classType, equipped }) {
        super(x, y, classType);
        this.netId = id;
        this.name = name || 'PLAYER';
        this.isRemotePlayer = true;
        this.equipped = loadoutForClass(equipped, this.type);
        this.color = bodyColorFor(this.equipped);
        this.target = { x, y, vx: 0, vy: 0, angle: 0, receivedAt: performance.now() };
    }

    applyNetState(s) {
        if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) return;
        this.target = {
            x: s.x, y: s.y,
            vx: Number.isFinite(s.vx) ? s.vx : 0,
            vy: Number.isFinite(s.vy) ? s.vy : 0,
            angle: Number.isFinite(s.a) ? s.a : this.angle,
            receivedAt: performance.now()
        };
        if (Number.isFinite(s.mh) && s.mh > 0) this.maxHealth = s.mh;
        if (Number.isFinite(s.h)) this.health = Math.min(this.maxHealth, Math.max(0, s.h));
        if (Number.isFinite(s.pts)) this.points = s.pts;
        if (Number.isFinite(s.sz) && s.sz > 0) this.size = s.sz;
    }

    update() {
        // Predict forward from the last update, then ease toward it so movement looks smooth.
        const ticksSince = Math.min(4, (performance.now() - this.target.receivedAt) / (1000 / 60));
        const px = this.target.x + this.target.vx * ticksSince;
        const py = this.target.y + this.target.vy * ticksSince;
        this.vx = this.target.vx;
        this.vy = this.target.vy;
        this.x += (px - this.x) * NET.remoteLerp;
        this.y += (py - this.y) * NET.remoteLerp;
        if (Math.hypot(px - this.x, py - this.y) > 600) {
            this.x = px;   // big jumps (blink, lag spike): snap instead of sliding across the map
            this.y = py;
        }
        this.angle = this.target.angle;

        this.updateTimers({ regen: false });
        this.updateTrail();
    }
}
