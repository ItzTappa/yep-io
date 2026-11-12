// Ongoing effects started by admin commands (rainbow ship, black hole, meteor shower...).
// The engine calls update() every tick and draw() inside the world view; everything here is
// switched off when a match ends (clear()).
import { distance } from '../core/math.js';
import { isEnemy } from '../game/combat.js';

export function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0');
    return `#${f(0)}${f(8)}${f(4)}`;
}

const randomColor = () => hslToHex(Math.floor(Math.random() * 360), 85, 58);

export class AdminEffects {
    constructor() {
        this.clear();
    }

    clear() {
        this.tick = 0;
        this.rainbow = false;
        this.disco = false;
        this.invisible = false;
        this.bulletHell = false;
        this.spin = false;
        this.blackHole = 0;      // ticks left
        this.meteors = 0;        // ticks left
        this.party = 0;          // ticks left
        this.rings = [];         // explosion rings to draw: { x, y, r, max, age, color }
    }

    // ---------- one-shot helpers used by the commands ----------

    // A big explosion that hurts your enemies (meteors, orbital strike).
    explode(engine, x, y, radius, damage, color = '#ff7a1a') {
        const p = engine.player;
        engine.spawnParticles(x, y, color, 36);
        engine.spawnParticles(x, y, '#ffd166', 24);
        engine.playSoundAt('enemy_death', x, y, { category: 'heavy' });
        if (p && distance(p.x, p.y, x, y) < 900) engine.shake(14);
        this.rings.push({ x, y, r: 10, max: radius, age: 0, color });
        for (const ship of [...engine.ships]) {
            if (!ship || ship.isDead || !isEnemy(p, ship)) continue;
            if (distance(x, y, ship.x, ship.y) < radius + ship.size) engine.damage(ship, damage, p, { armor: false });
        }
    }

    // Pushes everything near you away (and hurts it a little).
    shockwave(engine, power = 40, radius = 900, damage = 40) {
        const p = engine.player;
        this.rings.push({ x: p.x, y: p.y, r: 20, max: radius, age: 0, color: '#7dd3fc' });
        engine.shake(18);
        for (const ship of [...engine.ships]) {
            if (!ship || ship === p || ship.isDead || ship.isRemotePlayer) continue; // other people move themselves
            const d = distance(p.x, p.y, ship.x, ship.y);
            if (d > radius || d === 0) continue;
            const push = power * (1 - d / radius) + 8;
            ship.vx += ((ship.x - p.x) / d) * push;
            ship.vy += ((ship.y - p.y) / d) * push;
            if (damage && isEnemy(p, ship)) engine.damage(ship, damage, p, { armor: false });
        }
    }

    // ---------- every tick ----------

    update(engine) {
        const p = engine.player;
        if (!p || p.isDead || engine.isDemo || engine.isGameOver) {
            this.rings = [];
            return;
        }
        this.tick++;

        if (this.rainbow) {
            p.color = hslToHex((this.tick * 4) % 360, 90, 60);
            p.colorFinish = null;
        }
        if ((this.disco || this.party > 0) && this.tick % 12 === 0) {
            for (const ship of engine.ships) if (ship && ship !== p) ship.color = randomColor();
            if (this.party > 0) engine.shake(4);
        }
        if (this.invisible) p.isCloaked = true;
        if (this.spin) p.angle += 0.25;
        if (this.bulletHell && this.tick % 6 === 0 && !p.inSafeZone) {
            const offset = this.tick * 0.05;
            for (let i = 0; i < 16; i++) engine.fireProjectile(p, offset + (i / 16) * Math.PI * 2);
        }

        if (this.blackHole > 0) {
            this.blackHole--;
            for (const ship of [...engine.ships]) {
                if (!ship || ship === p || ship.isDead || ship.isRemotePlayer || !isEnemy(p, ship)) continue;
                const d = distance(p.x, p.y, ship.x, ship.y);
                if (d > 1600) continue;
                if (d < p.size + ship.size + 10) {
                    engine.spawnParticles(ship.x, ship.y, '#a855f7', 12);
                    engine.kill(ship, p);
                    continue;
                }
                const pull = 1.6 + (1 - d / 1600) * 3;
                ship.vx += ((p.x - ship.x) / d) * pull;
                ship.vy += ((p.y - ship.y) / d) * pull;
            }
            for (const orb of engine.orbs) {
                const d = distance(p.x, p.y, orb.x, orb.y);
                if (d < 900 && d > 1) {
                    orb.x += ((p.x - orb.x) / d) * 9;
                    orb.y += ((p.y - orb.y) / d) * 9;
                }
            }
        }

        if (this.meteors > 0) {
            this.meteors--;
            if (this.meteors % 7 === 0) {
                const a = Math.random() * Math.PI * 2;
                const d = 150 + Math.random() * 850;
                this.explode(engine, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 170, 220);
            }
        }

        if (this.party > 0) {
            this.party--;
            if (this.tick % 3 === 0) {
                const a = Math.random() * Math.PI * 2;
                const d = Math.random() * 700;
                engine.spawnParticles(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, randomColor(), 6);
            }
        }

        for (let i = this.rings.length - 1; i >= 0; i--) {
            const ring = this.rings[i];
            ring.age++;
            ring.r += (ring.max - ring.r) * 0.2;
            if (ring.age > 28) this.rings.splice(i, 1);
        }
    }

    // Inside the world view (after ships).
    draw(ctx, engine) {
        const p = engine.player;
        if (this.blackHole > 0 && p && !p.isDead) {
            const t = this.tick * 0.08;
            ctx.save();
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 220);
            g.addColorStop(0, 'rgba(10, 0, 20, 0.85)');
            g.addColorStop(0.5, 'rgba(88, 28, 135, 0.35)');
            g.addColorStop(1, 'rgba(88, 28, 135, 0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 220, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(192, 132, 252, 0.6)';
            ctx.lineWidth = 3;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 90 + i * 45, t + i * 2, t + i * 2 + Math.PI * 1.2);
                ctx.stroke();
            }
            ctx.restore();
        }
        if (this.rings.length) {
            ctx.save();
            for (const ring of this.rings) {
                ctx.globalAlpha = Math.max(0, 1 - ring.age / 28);
                ctx.strokeStyle = ring.color;
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();
        }
    }
}
