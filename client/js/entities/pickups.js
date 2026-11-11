// Things lying around the arena: XP/health orbs, the Lucky Slot Machine, and effect particles.
import { settings } from '../core/settings.js';

export class Orb {
    constructor(x, y, type = 'xp', value = 1, scatterRadius = 30) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * scatterRadius;
        this.x = x + Math.cos(angle) * dist;
        this.y = y + Math.sin(angle) * dist;
        this.type = type;
        this.value = value;
        this.collected = false;

        if (type === 'health') {
            const big = Math.random() < 0.25;
            this.size = big ? 10 : 6;
            this.color = big ? '#1F51FF' : '#3b82f6';
            this.healAmount = big ? 70 : 24;
        } else {
            this.size = Math.min(15, 5 + Math.log10(Math.max(1, value)) * 3);
            this.color = '#ffe600';
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        if (settings.highQuality) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
        }
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

export class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.decay = Math.random() * 0.05 + 0.02;
        this.size = Math.random() * 4 + 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        if (settings.highQuality) {
            ctx.shadowBlur = 5;
            ctx.shadowColor = this.color;
        }
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Touch it for a random upgrade. Disappears after 10-30 seconds (flashes for the last 3).
export class LuckySlotMachine {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 30;
        this.time = Math.random() * 100;
        this.lifeTimer = Math.floor(600 + Math.random() * 1200);
    }

    update() {
        this.time += 0.1;
        this.lifeTimer--;
    }

    draw(ctx) {
        if (this.lifeTimer < 180 && Math.floor(this.lifeTimer / 8) % 2 === 0) return;
        ctx.save();
        ctx.translate(this.x, this.y - Math.abs(Math.sin(this.time)) * 15);
        if (settings.highQuality) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ffe600';
        }
        ctx.fillStyle = '#111';
        ctx.fillRect(-15, -20, 30, 40);
        ctx.strokeStyle = '#ffe600';
        ctx.lineWidth = 2;
        ctx.strokeRect(-15, -20, 30, 40);
        ctx.fillStyle = '#222';
        ctx.fillRect(-10, -10, 20, 15);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-8, -8, 4, 11);
        ctx.fillRect(-2, -8, 4, 11);
        ctx.fillRect(4, -8, 4, 11);
        ctx.fillStyle = '#555';
        ctx.fillRect(15, -5, 6, 3);
        ctx.fillStyle = '#ff0044';
        ctx.beginPath();
        ctx.arc(22, -4, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = Math.floor(this.time * 2) % 2 === 0 ? '#ff0044' : '#00ffcc';
        ctx.beginPath();
        ctx.arc(0, -20, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}
