// Skin artwork. Each skin draws on top of the ship body.
// The canvas is already translated to the ship and rotated to its facing; `s` is the ship size.
import { traceBody, clipToBody } from './shapes.js';

function glow(ctx, color, blur) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
}

const SKINS = {
    ghost(ctx, s, type) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        traceBody(ctx, type, s);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(s * 0.4, -s * 0.3, 3, 0, Math.PI * 2);
        ctx.arc(s * 0.4, s * 0.3, 3, 0, Math.PI * 2);
        ctx.fill();
    },

    assassin(ctx, s, type) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        traceBody(ctx, type, s * 0.8);
        ctx.fill();
        ctx.fillStyle = '#ff0000';
        glow(ctx, '#ff0000', 10);
        ctx.beginPath();
        ctx.arc(s * 0.3, 0, 4, 0, Math.PI * 2);
        ctx.fill();
    },

    paladin(ctx, s) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-s * 0.8, 0); ctx.lineTo(s * 0.8, 0);
        ctx.moveTo(0, -s * 0.8); ctx.lineTo(0, s * 0.8);
        ctx.stroke();
    },

    hologram(ctx, s, type) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        glow(ctx, '#00ffff', 10);
        traceBody(ctx, type, s * 0.6);
        ctx.stroke();
    },

    spartan(ctx, s) {
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, -s * 0.8);
        ctx.lineTo(s * 0.5, 0);
        ctx.lineTo(-s * 0.5, s * 0.8);
        ctx.stroke();
    },

    luminescent(ctx, s) {
        const color = `hsl(${(Date.now() / 15) % 360}, 100%, 50%)`;
        ctx.fillStyle = color;
        glow(ctx, color, 25);
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
        ctx.fill();
    },

    ninja(ctx, s) {
        ctx.fillStyle = '#111';
        ctx.fillRect(-s, -s * 0.3, s * 2, s * 0.6);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-s * 0.5, -s * 0.1, s, s * 0.2);
    },

    celestial(ctx, s) {
        ctx.fillStyle = '#fff';
        glow(ctx, '#00ffff', 15);
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.6);
        ctx.lineTo(s * 0.2, -s * 0.2);
        ctx.lineTo(s * 0.6, 0);
        ctx.lineTo(s * 0.2, s * 0.2);
        ctx.lineTo(0, s * 0.6);
        ctx.lineTo(-s * 0.2, s * 0.2);
        ctx.lineTo(-s * 0.6, 0);
        ctx.lineTo(-s * 0.2, -s * 0.2);
        ctx.closePath();
        ctx.fill();
    },

    cyborg(ctx, s, type) {
        ctx.save();
        clipToBody(ctx, type, s);
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(-s, -s, s * 2, s);
        ctx.fillStyle = '#ff0000';
        glow(ctx, '#ff0000', 10);
        ctx.beginPath();
        ctx.arc(s * 0.4, -s * 0.4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    voidwalker(ctx, s) {
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 3;
        glow(ctx, '#a855f7', 15);
        ctx.stroke();
    },

    glitch(ctx, s) {
        ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(-3, -3, s * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 0, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(3, 3, s * 0.4, 0, Math.PI * 2);
        ctx.fill();
    },

    inferno(ctx, s) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#dc2626';
        glow(ctx, '#dc2626', 15);
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
        ctx.fill();
    },

    warlord(ctx, s) {
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, -s * 0.5); ctx.lineTo(s * 0.5, s * 0.5);
        ctx.moveTo(s * 0.5, -s * 0.5); ctx.lineTo(-s * 0.5, s * 0.5);
        ctx.stroke();
    },

    spectre(ctx, s) {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.8)';
        glow(ctx, '#a855f7', 20);
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2);
        ctx.fill();
    },

    phantom(ctx, s) {
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
        ctx.lineWidth = 3;
        glow(ctx, '#3b82f6', 10);
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
        ctx.stroke();
    },

    target(ctx, s, type) {
        ctx.save();
        clipToBody(ctx, type, s);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    },

    stripes(ctx, s, type) {
        ctx.save();
        clipToBody(ctx, type, s);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        for (let i = -s; i < s; i += 10) ctx.fillRect(i, -s, 5, s * 2);
        ctx.restore();
    },

    checker(ctx, s, type) {
        ctx.save();
        clipToBody(ctx, type, s);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        const sq = s * 0.25;
        for (let x = -s; x <= s; x += sq) {
            for (let y = -s; y <= s; y += sq) {
                if (Math.abs(Math.round(x / sq) + Math.round(y / sq)) % 2 === 0) ctx.fillRect(x, y, sq, sq);
            }
        }
        ctx.restore();
    },

    zebra(ctx, s, type) {
        ctx.save();
        clipToBody(ctx, type, s);
        ctx.fillStyle = '#111';
        for (let i = -s; i < s; i += 15) {
            ctx.beginPath();
            ctx.moveTo(i, -s);
            ctx.lineTo(i + 5, 0);
            ctx.lineTo(i - 2, s);
            ctx.lineTo(i + 4, s);
            ctx.lineTo(i + 12, 0);
            ctx.lineTo(i + 8, -s);
            ctx.fill();
        }
        ctx.restore();
    },

    camo(ctx, s, type) {
        ctx.save();
        clipToBody(ctx, type, s);
        ctx.fillStyle = '#4b5320';
        ctx.fillRect(-s, -s, s * 2, s * 2);
        const blobs = [
            ['#556b2f', [[-0.4, -0.3, 0.5], [0.3, 0.5, 0.4]]],
            ['#8b7355', [[0.5, -0.4, 0.4], [-0.2, 0.4, 0.5]]],
            ['#2f4f4f', [[-0.6, 0, 0.3], [0.1, -0.1, 0.3]]]
        ];
        for (const [color, circles] of blobs) {
            ctx.fillStyle = color;
            ctx.beginPath();
            for (const [cx, cy, r] of circles) ctx.arc(s * cx, s * cy, s * r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    demon(ctx, s) {
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.moveTo(-s * 0.2, -s * 0.5); ctx.lineTo(-s * 0.5, -s * 0.8); ctx.lineTo(0, -s * 0.6);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-s * 0.2, s * 0.5); ctx.lineTo(-s * 0.5, s * 0.8); ctx.lineTo(0, s * 0.6);
        ctx.fill();
        ctx.fillStyle = '#ff0000';
        glow(ctx, '#ff0000', 10);
        ctx.beginPath();
        ctx.moveTo(s * 0.3, -s * 0.3); ctx.lineTo(s * 0.6, -s * 0.1); ctx.lineTo(s * 0.3, -s * 0.1);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(s * 0.3, s * 0.3); ctx.lineTo(s * 0.6, s * 0.1); ctx.lineTo(s * 0.3, s * 0.1);
        ctx.fill();
    },

    angel(ctx, s) {
        ctx.strokeStyle = '#ffe600';
        ctx.lineWidth = 3;
        glow(ctx, '#ffe600', 10);
        ctx.beginPath();
        ctx.ellipse(-s * 0.2, 0, s * 0.2, s * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
    },

    pirate(ctx, s, type) {
        ctx.save();
        clipToBody(ctx, type, s);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-s, -s);
        ctx.lineTo(s, s);
        ctx.stroke();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(s * 0.2, s * 0.2, s * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    bandit(ctx, s, type) {
        ctx.save();
        clipToBody(ctx, type, s);
        ctx.fillStyle = '#111';
        ctx.fillRect(0, -s, s * 0.6, s * 2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(s * 0.2, -s * 0.4, s * 0.2, s * 0.2);
        ctx.fillRect(s * 0.2, s * 0.2, s * 0.2, s * 0.2);
        ctx.restore();
    },

    mecha(ctx, s, type) {
        ctx.save();
        clipToBody(ctx, type, s);
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 2;
        glow(ctx, '#00ffcc', 5);
        ctx.beginPath();
        ctx.moveTo(-s * 0.8, -s * 0.2); ctx.lineTo(0, -s * 0.2); ctx.lineTo(s * 0.2, -s * 0.6);
        ctx.moveTo(-s * 0.8, s * 0.2); ctx.lineTo(0, s * 0.2); ctx.lineTo(s * 0.2, s * 0.6);
        ctx.moveTo(s * 0.4, -s * 0.8); ctx.lineTo(s * 0.4, s * 0.8);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        for (const [x, y] of [[0, -0.2], [0, 0.2], [0.4, 0]]) {
            ctx.beginPath();
            ctx.arc(s * x, s * y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    golden(ctx, s, type) {
        ctx.save();
        clipToBody(ctx, type, s);
        const grad = ctx.createLinearGradient(-s, -s, s, s);
        grad.addColorStop(0, '#ffdf00');
        grad.addColorStop(0.5, '#d4af37');
        grad.addColorStop(1, '#996515');
        ctx.fillStyle = grad;
        ctx.fillRect(-s, -s, s * 2, s * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        glow(ctx, '#ffe600', 20);
        ctx.stroke();
        ctx.restore();
    },

    // Season skins: a smaller copy of the ship shape in the middle.
    neon(ctx, s, type, hq) {
        traceBody(ctx, type, s * 0.5);
        ctx.fillStyle = '#ffffff';
        if (hq) glow(ctx, '#ffffff', 15);
        ctx.fill();
    },

    dark(ctx, s, type) {
        traceBody(ctx, type, s * 0.5);
        ctx.fillStyle = '#111111';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#a855f7';
        ctx.stroke();
    }
};

export function drawSkin(ctx, entity, skinValue, highQuality) {
    const draw = SKINS[skinValue];
    if (draw) draw(ctx, entity.size, entity.type, highQuality);
}
