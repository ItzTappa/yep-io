// Skin artwork. Skins are decals painted inside the ship's outline (so they fit all three shapes),
// plus an optional `behind` layer drawn under the body (wings, horns).
//
// Each skin gets k = { ctx, s (ship size), t (shape type), r (shape's inner radius), time (seconds),
// color (body colour), hq (high quality) }. The canvas is centred on the ship, facing +x.
// `outline` overrides the ship outline colour for skins that repaint the whole body.
import { traceBody } from './shapes.js';
import { shade, rgba } from './palette.js';

// Clips to the body shape, pulled in by `inset` pixels so the outline stays crisp on top.
function clip(k, inset = 1.5) {
    const size = k.t === 'circle' ? k.s - inset : k.s - inset * 2;
    k.ctx.save();
    traceBody(k.ctx, k.t, Math.max(1, size));
    k.ctx.clip();
}

function glow(k, color, blur) {
    if (!k.hq) return;
    k.ctx.shadowColor = color;
    k.ctx.shadowBlur = blur;
}

function noGlow(k) {
    k.ctx.shadowBlur = 0;
}

function fillAll(k, style) {
    k.ctx.fillStyle = style;
    k.ctx.fillRect(-k.s * 2, -k.s * 2, k.s * 4, k.s * 4);
}

function circle(ctx, x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.5, radius), 0, Math.PI * 2);
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * 2);
}

// Stripes at an angle, across the whole (clipped) body.
function stripes(k, angle, step, width, style) {
    const { ctx, s } = k;
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = style;
    for (let x = -s * 2; x < s * 2; x += step) ctx.fillRect(x, -s * 2, width, s * 4);
    ctx.restore();
}

// Small deterministic pseudo-random numbers (same every frame unless `seed` changes).
const rand = (seed) => {
    const x = Math.sin(seed * 127.1) * 43758.5453;
    return x - Math.floor(x);
};

export const SKINS = {
    // ---------- common / uncommon ----------
    target: {
        draw(k) {
            const { ctx, r } = k;
            clip(k);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = Math.max(1.6, r * 0.13);
            circle(ctx, 0, 0, r * 0.72); ctx.stroke();
            circle(ctx, 0, 0, r * 0.4); ctx.stroke();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            circle(ctx, 0, 0, r * 0.13); ctx.fill();
            ctx.restore();
        }
    },

    stripes: {
        draw(k) {
            clip(k);
            stripes(k, -Math.PI / 4, Math.max(7, k.r * 0.55), Math.max(3, k.r * 0.24), 'rgba(255, 255, 255, 0.3)');
            k.ctx.restore();
        }
    },

    checker: {
        draw(k) {
            const { ctx, s, r } = k;
            clip(k);
            const sq = Math.max(4, r * 0.42);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            for (let ix = -Math.ceil(s / sq) - 1; ix <= Math.ceil(s / sq); ix++) {
                for (let iy = -Math.ceil(s / sq) - 1; iy <= Math.ceil(s / sq); iy++) {
                    if ((ix + iy) % 2 === 0) ctx.fillRect(ix * sq, iy * sq, sq, sq);
                }
            }
            ctx.restore();
        }
    },

    paladin: {
        draw(k) {
            const { ctx, s, r } = k;
            clip(k);
            const w = r * 0.32;
            ctx.fillStyle = '#f5c542';
            ctx.fillRect(-s * 2, -w / 2, s * 4, w);
            ctx.fillRect(-w / 2, -s * 2, w, s * 4);
            ctx.strokeStyle = '#a16207';
            ctx.lineWidth = 1.2;
            ctx.strokeRect(-s * 2, -w / 2, s * 4, w);
            ctx.strokeRect(-w / 2, -s * 2, w, s * 4);
            // centre gem
            glow(k, '#ffffff', 8);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(r * 0.2, 0); ctx.lineTo(0, -r * 0.2); ctx.lineTo(-r * 0.2, 0); ctx.lineTo(0, r * 0.2);
            ctx.closePath(); ctx.fill();
            ctx.restore();
        }
    },

    ninja: {
        draw(k) {
            const { ctx, s, r } = k;
            clip(k);
            ctx.fillStyle = '#121419';
            ctx.fillRect(r * 0.02, -s * 2, r * 0.6, s * 4);
            ctx.fillStyle = '#ffffff';
            ellipse(ctx, r * 0.34, -r * 0.3, r * 0.1, r * 0.18, 0.45); ctx.fill();
            ellipse(ctx, r * 0.34, r * 0.3, r * 0.1, r * 0.18, -0.45); ctx.fill();
            ctx.restore();
        }
    },

    zebra: {
        draw(k) {
            const { ctx, s, r } = k;
            clip(k);
            ctx.fillStyle = '#111111';
            const step = r * 0.55;
            for (let x0 = -s * 1.5; x0 < s * 1.5; x0 += step) {
                ctx.beginPath();
                for (let y = -s * 1.2; y <= s * 1.2; y += 2) ctx.lineTo(x0 + Math.sin(y / (r * 0.35)) * r * 0.12, y);
                for (let y = s * 1.2; y >= -s * 1.2; y -= 2) ctx.lineTo(x0 + r * 0.2 + Math.sin(y / (r * 0.35) + 0.8) * r * 0.12, y);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }
    },

    camo: {
        outline: '#28331a',
        draw(k) {
            const { ctx, r } = k;
            clip(k);
            fillAll(k, '#5a6b33');
            const blobs = [
                ['#3e4c22', [[-0.55, -0.35, 0.45], [0.45, 0.5, 0.42], [0.7, -0.7, 0.32]]],
                ['#7d6e46', [[0.25, -0.25, 0.36], [-0.35, 0.6, 0.34], [-0.9, 0.05, 0.25]]],
                ['#2a3517', [[-0.1, 0.1, 0.2], [0.75, 0.15, 0.2], [-0.6, -0.85, 0.22]]]
            ];
            for (const [color, list] of blobs) {
                ctx.fillStyle = color;
                for (const [x, y, rad] of list) { ellipse(ctx, x * r, y * r, rad * r * 1.15, rad * r * 0.85, x + y); ctx.fill(); }
            }
            ctx.restore();
        }
    },

    racer: {
        draw(k) {
            const { ctx, s, r } = k;
            clip(k);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
            ctx.fillRect(-s * 2, -r * 0.36, s * 4, r * 0.18);
            ctx.fillRect(-s * 2, r * 0.18, s * 4, r * 0.18);
            ctx.fillStyle = shade(k.color, -0.5);
            ctx.fillRect(-s * 2, -r * 0.06, s * 4, r * 0.12);
            ctx.restore();
        }
    },

    hazard: {
        draw(k) {
            const { ctx, s, r } = k;
            clip(k);
            ctx.save();
            ctx.beginPath();
            ctx.rect(r * 0.05, -s * 2, r * 0.6, s * 4);
            ctx.clip();
            fillAll(k, '#facc15');
            stripes(k, Math.PI / 4, Math.max(8, r * 0.45), Math.max(4, r * 0.22), '#111111');
            ctx.restore();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.fillRect(r * 0.05 - 1, -s * 2, 1.5, s * 4);
            ctx.fillRect(r * 0.65, -s * 2, 1.5, s * 4);
            ctx.restore();
        }
    },

    // ---------- rare ----------
    ghost: {
        draw(k) {
            const { ctx, r } = k;
            clip(k);
            const g = ctx.createRadialGradient(r * 0.2, 0, 0, 0, 0, r * 1.3);
            g.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
            g.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
            fillAll(k, g);
            ctx.restore();
            ctx.fillStyle = '#1e1b2e';
            ellipse(ctx, r * 0.4, -r * 0.32, r * 0.12, r * 0.17); ctx.fill();
            ellipse(ctx, r * 0.4, r * 0.32, r * 0.12, r * 0.17); ctx.fill();
            ctx.fillStyle = '#ffffff';
            circle(ctx, r * 0.44, -r * 0.36, r * 0.045); ctx.fill();
            circle(ctx, r * 0.44, r * 0.28, r * 0.045); ctx.fill();
        }
    },

    spartan: {
        draw(k) {
            const { ctx, s, r } = k;
            clip(k);
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(-s * 2, -r * 0.17, s * 4, r * 0.34);
            ctx.fillStyle = '#7f1d1d';
            ctx.fillRect(-s * 2, -r * 0.17, s * 4, 1.2);
            ctx.fillRect(-s * 2, r * 0.17 - 1.2, s * 4, 1.2);
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = Math.max(2, r * 0.16);
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(r * 0.12, -r * 0.5); ctx.lineTo(r * 0.55, 0); ctx.lineTo(r * 0.12, r * 0.5);
            ctx.stroke();
            ctx.restore();
        }
    },

    pirate: {
        draw(k) {
            const { ctx, s, r } = k;
            clip(k);
            // red bandana over the back
            ctx.fillStyle = '#b91c1c';
            ctx.fillRect(-s * 2, -s * 2, s * 2 - r * 0.15, s * 4);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
                const x = -r * 0.35 - Math.abs(i) * r * 0.3;
                if ((i + j) % 2 === 0) { circle(ctx, x, j * r * 0.32, r * 0.05); ctx.fill(); }
            }
            // eye patch
            ctx.strokeStyle = '#111111';
            ctx.lineWidth = Math.max(1.5, r * 0.09);
            ctx.beginPath(); ctx.moveTo(r * 0.75, -r * 0.6); ctx.lineTo(-r * 0.1, r * 0.75); ctx.stroke();
            ctx.restore();
            ctx.fillStyle = '#111111';
            ellipse(ctx, r * 0.38, r * 0.24, r * 0.2, r * 0.17); ctx.fill();
            ctx.fillStyle = '#ffffff';
            circle(ctx, r * 0.38, -r * 0.26, r * 0.12); ctx.fill();
            ctx.fillStyle = '#111111';
            circle(ctx, r * 0.42, -r * 0.26, r * 0.06); ctx.fill();
        }
    },

    bandit: {
        draw(k) {
            const { ctx, s, r } = k;
            clip(k);
            // striped shirt on the back half
            ctx.save();
            ctx.beginPath(); ctx.rect(-s * 2, -s * 2, s * 2 - r * 0.05, s * 4); ctx.clip();
            for (let y = -s * 2; y < s * 2; y += r * 0.36) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.fillRect(-s * 2, y, s * 4, r * 0.18);
            }
            ctx.restore();
            // domino mask
            ctx.fillStyle = '#16181d';
            ctx.beginPath();
            ctx.ellipse(r * 0.38, 0, r * 0.24, r * 0.62, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            circle(ctx, r * 0.42, -r * 0.3, r * 0.11); ctx.fill();
            circle(ctx, r * 0.42, r * 0.3, r * 0.11); ctx.fill();
            ctx.fillStyle = '#16181d';
            circle(ctx, r * 0.46, -r * 0.3, r * 0.05); ctx.fill();
            circle(ctx, r * 0.46, r * 0.3, r * 0.05); ctx.fill();
            ctx.restore();
        }
    },

    carbon: {
        outline: '#0b0d10',
        draw(k) {
            const { ctx, s, r } = k;
            clip(k);
            fillAll(k, '#1c2026');
            const cell = Math.max(3, r * 0.22);
            ctx.save();
            ctx.rotate(Math.PI / 4);
            for (let x = -s * 2; x < s * 2; x += cell) {
                for (let y = -s * 2; y < s * 2; y += cell) {
                    ctx.fillStyle = (Math.round(x / cell) + Math.round(y / cell)) % 2 === 0 ? '#2b313a' : '#14171b';
                    ctx.fillRect(x, y, cell, cell);
                }
            }
            ctx.restore();
            ctx.fillStyle = k.color;
            ctx.fillRect(-s * 2, -r * 0.07, s * 4, r * 0.14);
            const g = ctx.createLinearGradient(0, -s, 0, s);
            g.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
            g.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
            fillAll(k, g);
            ctx.restore();
        }
    },

    // ---------- epic ----------
    assassin: {
        draw(k) {
            const { ctx, r } = k;
            ctx.fillStyle = 'rgba(12, 12, 18, 0.85)';
            traceBody(ctx, k.t, k.s * 0.8);
            ctx.fill();
            glow(k, '#ff2a2a', 10);
            ctx.fillStyle = '#ff3b3b';
            const vx = r * 0.32;
            ctx.beginPath();
            ctx.moveTo(vx, -r * 0.42); ctx.lineTo(vx + r * 0.14, -r * 0.36);
            ctx.lineTo(vx + r * 0.14, r * 0.36); ctx.lineTo(vx, r * 0.42);
            ctx.closePath(); ctx.fill();
            noGlow(k);
        }
    },

    hologram: {
        draw(k) {
            const { ctx, s, r, time } = k;
            clip(k);
            fillAll(k, 'rgba(34, 211, 238, 0.16)');
            ctx.fillStyle = 'rgba(165, 243, 252, 0.38)';
            const offset = (time * 18) % 4;
            for (let y = -s * 1.2; y < s * 1.2; y += 4) ctx.fillRect(-s * 2, y + offset, s * 4, 1.2);
            ctx.restore();
            glow(k, '#22d3ee', 8);
            ctx.strokeStyle = '#67e8f9';
            ctx.lineWidth = 1.8;
            traceBody(ctx, k.t, k.s * 0.58);
            ctx.stroke();
            noGlow(k);
            ctx.fillStyle = '#cffafe';
            circle(ctx, 0, 0, r * 0.1); ctx.fill();
        }
    },

    phantom: {
        draw(k) {
            const { ctx, r, time } = k;
            ctx.fillStyle = 'rgba(96, 165, 250, 0.16)';
            circle(ctx, 0, 0, r * 0.74); ctx.fill();
            glow(k, '#3b82f6', 8);
            ctx.strokeStyle = '#93c5fd';
            ctx.lineWidth = 2;
            ctx.setLineDash([r * 0.35, r * 0.18]);
            ctx.lineDashOffset = time * 20;
            circle(ctx, 0, 0, r * 0.72); ctx.stroke();
            ctx.lineDashOffset = -time * 28;
            ctx.setLineDash([r * 0.2, r * 0.14]);
            circle(ctx, 0, 0, r * 0.4); ctx.stroke();
            ctx.setLineDash([]);
            noGlow(k);
        }
    },

    inferno: {
        outline: '#7c1d0f',
        draw(k) {
            const { ctx, r, time } = k;
            clip(k);
            const flicker = 1 + Math.sin(time * 11) * 0.05 + Math.sin(time * 23) * 0.03;
            const g = ctx.createRadialGradient(r * 0.15, 0, 0, 0, 0, r * 1.25 * flicker);
            g.addColorStop(0, '#fff7cc');
            g.addColorStop(0.3, '#fcd34d');
            g.addColorStop(0.62, '#f97316');
            g.addColorStop(1, '#b91c1c');
            fillAll(k, g);
            ctx.restore();
        }
    },

    cyborg: {
        draw(k) {
            const { ctx, s, r } = k;
            clip(k);
            const g = ctx.createLinearGradient(0, -s, 0, 0);
            g.addColorStop(0, '#d1d5db');
            g.addColorStop(1, '#8b949e');
            ctx.fillStyle = g;
            ctx.fillRect(-s * 2, -s * 2, s * 4, s * 2);
            ctx.fillStyle = '#4b5563';
            ctx.fillRect(-s * 2, -1, s * 4, 2);
            ctx.fillRect(-r * 0.35, -s * 2, 1.5, s * 2);
            ctx.fillStyle = '#e5e7eb';
            for (const [x, y] of [[-0.62, -0.38], [-0.1, -0.62], [0.05, -0.2]]) { circle(ctx, x * r, y * r, r * 0.06); ctx.fill(); }
            ctx.restore();
            glow(k, '#ef4444', 10);
            ctx.fillStyle = '#ef4444';
            circle(ctx, r * 0.45, -r * 0.3, r * 0.15); ctx.fill();
            noGlow(k);
            ctx.fillStyle = '#fee2e2';
            circle(ctx, r * 0.49, -r * 0.34, r * 0.05); ctx.fill();
        }
    },

    glitch: {
        draw(k) {
            const { ctx, s, r, time } = k;
            const jitter = Math.floor(time * 10);
            const dx = 1.5 + rand(jitter) * 2;
            ctx.lineWidth = 2.2;
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
            ctx.save(); ctx.translate(-dx, 0); traceBody(ctx, k.t, k.s * 0.62); ctx.stroke(); ctx.restore();
            ctx.strokeStyle = 'rgba(236, 72, 153, 0.9)';
            ctx.save(); ctx.translate(dx, 0); traceBody(ctx, k.t, k.s * 0.62); ctx.stroke(); ctx.restore();
            ctx.globalCompositeOperation = 'source-over';
            clip(k);
            for (let i = 0; i < 3; i++) {
                if (rand(jitter * 3 + i) < 0.4) continue;
                const y = (rand(jitter * 7 + i) * 2 - 1) * r * 0.8;
                ctx.fillStyle = i % 2 ? 'rgba(255, 255, 255, 0.65)' : 'rgba(34, 211, 238, 0.6)';
                ctx.fillRect(-s + rand(jitter + i * 11) * r * 0.4, y, s * 1.6, 1.5 + rand(jitter + i) * 2.5);
            }
            ctx.restore();
        }
    },

    mecha: {
        draw(k) {
            const { ctx, r, time } = k;
            clip(k);
            fillAll(k, 'rgba(15, 23, 42, 0.38)');
            const traces = [
                [[-1.1, -0.32], [-0.35, -0.32], [-0.05, -0.62], [0.2, -0.62]],
                [[-1.1, 0.32], [-0.35, 0.32], [-0.05, 0.62], [0.2, 0.62]],
                [[-0.18, 0], [0.75, 0]]
            ];
            glow(k, '#22d3ee', 6);
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 1.5;
            ctx.lineJoin = 'round';
            for (const pts of traces) {
                ctx.beginPath();
                pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r)));
                ctx.stroke();
            }
            ctx.fillStyle = '#a5f3fc';
            for (const pts of traces) { const [x, y] = pts[pts.length - 1]; circle(ctx, x * r, y * r, 1.8); ctx.fill(); }
            // a pulse running along the centre trace
            const p = (time * 0.9) % 1;
            ctx.fillStyle = '#ffffff';
            circle(ctx, (-0.18 + 0.93 * p) * r, 0, 2.2); ctx.fill();
            noGlow(k);
            ctx.fillStyle = '#0e7490';
            ctx.strokeStyle = '#67e8f9';
            ctx.lineWidth = 1.2;
            ctx.fillRect(-r * 0.32, -r * 0.18, r * 0.3, r * 0.36);
            ctx.strokeRect(-r * 0.32, -r * 0.18, r * 0.3, r * 0.36);
            ctx.restore();
        }
    },

    crystal: {
        draw(k) {
            const { ctx, s, r, color } = k;
            clip(k);
            const n = 6;
            for (let i = 0; i < n; i++) {
                const a0 = (i / n) * Math.PI * 2 + 0.3;
                const a1 = ((i + 1) / n) * Math.PI * 2 + 0.3;
                ctx.fillStyle = i % 2 ? rgba(shade(color, 0.45), 0.55) : rgba(shade(color, -0.3), 0.55);
                ctx.beginPath();
                ctx.moveTo(r * 0.12, -r * 0.05);
                ctx.lineTo(Math.cos(a0) * s * 1.6, Math.sin(a0) * s * 1.6);
                ctx.lineTo(Math.cos(a1) * s * 1.6, Math.sin(a1) * s * 1.6);
                ctx.closePath();
                ctx.fill();
            }
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.lineWidth = 1;
            for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * 2 + 0.3;
                ctx.beginPath(); ctx.moveTo(r * 0.12, -r * 0.05); ctx.lineTo(Math.cos(a) * s * 1.6, Math.sin(a) * s * 1.6); ctx.stroke();
            }
            ctx.restore();
            glow(k, '#ffffff', 8);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.moveTo(r * 0.12 + r * 0.16, -r * 0.05); ctx.lineTo(r * 0.12, -r * 0.05 - r * 0.16);
            ctx.lineTo(r * 0.12 - r * 0.16, -r * 0.05); ctx.lineTo(r * 0.12, -r * 0.05 + r * 0.16);
            ctx.closePath(); ctx.fill();
            noGlow(k);
        }
    },

    // ---------- legendary (animated) ----------
    spectre: {
        draw(k) {
            const { ctx, r, time } = k;
            clip(k);
            const pulse = 1 + Math.sin(time * 3) * 0.08;
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.15 * pulse);
            g.addColorStop(0, 'rgba(243, 232, 255, 0.95)');
            g.addColorStop(0.4, 'rgba(192, 132, 252, 0.8)');
            g.addColorStop(1, 'rgba(88, 28, 135, 0.15)');
            fillAll(k, g);
            ctx.restore();
            glow(k, '#c084fc', 10);
            ctx.strokeStyle = 'rgba(243, 232, 255, 0.9)';
            ctx.lineWidth = 1.8;
            ctx.lineCap = 'round';
            for (const off of [0, Math.PI]) {
                ctx.beginPath();
                ctx.arc(0, 0, r * 0.62, time * 2 + off, time * 2 + off + 1.1);
                ctx.stroke();
            }
            noGlow(k);
        }
    },

    luminescent: {
        draw(k) {
            const { ctx, r, time } = k;
            const hue = (time * 70) % 360;
            let fill;
            if (ctx.createConicGradient) {
                fill = ctx.createConicGradient(time * 1.5, 0, 0);
                for (let i = 0; i <= 6; i++) fill.addColorStop(i / 6, `hsl(${(hue + i * 60) % 360}, 95%, 60%)`);
            } else {
                fill = `hsl(${hue}, 95%, 60%)`;
            }
            glow(k, `hsl(${hue}, 95%, 60%)`, 16);
            ctx.fillStyle = fill;
            traceBody(ctx, k.t, k.s * 0.62);
            ctx.fill();
            noGlow(k);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            circle(ctx, 0, 0, r * 0.15); ctx.fill();
        }
    },

    warlord: {
        outline: '#1f2329',
        draw(k) {
            const { ctx, s, r } = k;
            clip(k);
            fillAll(k, rgba(shade(k.color, -0.55), 0.55));
            ctx.save();
            for (const rot of [Math.PI / 4, -Math.PI / 4]) {
                ctx.save();
                ctx.rotate(rot);
                ctx.fillStyle = '#3a414d';
                ctx.fillRect(-s * 2, -r * 0.2, s * 4, r * 0.4);
                ctx.fillStyle = '#16191e';
                ctx.fillRect(-s * 2, -r * 0.2, s * 4, 1.2);
                ctx.fillRect(-s * 2, r * 0.2 - 1.2, s * 4, 1.2);
                ctx.fillStyle = '#fbbf24';
                for (const d of [-0.62, 0.62]) { circle(ctx, d * r, 0, r * 0.06); ctx.fill(); }
                ctx.restore();
            }
            ctx.restore();
            ctx.restore();
            glow(k, '#ef4444', 12);
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(r * 0.24, 0); ctx.lineTo(0, -r * 0.24); ctx.lineTo(-r * 0.24, 0); ctx.lineTo(0, r * 0.24);
            ctx.closePath(); ctx.fill();
            noGlow(k);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.beginPath(); ctx.moveTo(0, -r * 0.16); ctx.lineTo(r * 0.08, -r * 0.04); ctx.lineTo(-r * 0.04, -r * 0.04); ctx.closePath(); ctx.fill();
        }
    },

    celestial: {
        draw(k) {
            const { ctx, r, time } = k;
            clip(k);
            fillAll(k, 'rgba(15, 23, 42, 0.35)');
            ctx.restore();
            ctx.save();
            ctx.rotate(time * 0.6);
            glow(k, '#67e8f9', 14);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const rad = i % 2 === 0 ? r * 0.62 : r * 0.18;
                const a = (i / 8) * Math.PI * 2;
                ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
            }
            ctx.closePath(); ctx.fill();
            ctx.restore();
            noGlow(k);
            for (let i = 0; i < 3; i++) {
                const a = -time * 1.3 + (i / 3) * Math.PI * 2;
                ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + 0.5 * Math.sin(time * 5 + i)})`;
                circle(ctx, Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, 1.4); ctx.fill();
            }
        }
    },

    voidwalker: {
        outline: '#3b0764',
        draw(k) {
            const { ctx, r, time } = k;
            clip(k);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.3);
            g.addColorStop(0, '#000000');
            g.addColorStop(0.55, '#0d0518');
            g.addColorStop(1, '#3b0764');
            fillAll(k, g);
            glow(k, '#a855f7', 8);
            ctx.strokeStyle = '#a855f7';
            ctx.lineWidth = 1.6;
            ctx.lineCap = 'round';
            [0.3, 0.52, 0.74].forEach((rad, i) => {
                const a = time * (1.6 - i * 0.4) * (i % 2 ? -1 : 1) + i * 2;
                ctx.beginPath(); ctx.arc(0, 0, r * rad, a, a + 1.4); ctx.stroke();
            });
            noGlow(k);
            ctx.restore();
        }
    },

    demon: {
        behind(k) {
            // Two thick horns sweeping forward from the sides, dark at the base, red at the tip.
            const { ctx, r } = k;
            for (const side of [-1, 1]) {
                const g = ctx.createLinearGradient(0, side * r * 0.5, r * 1.2, side * r * 1.05);
                g.addColorStop(0, '#2a0b0b');
                g.addColorStop(1, '#b91c1c');
                ctx.fillStyle = g;
                ctx.strokeStyle = '#0f0303';
                ctx.lineWidth = 1.5;
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(-r * 0.25, side * r * 0.72);
                ctx.quadraticCurveTo(r * 0.35, side * r * 1.35, r * 1.2, side * r * 1.05);
                ctx.quadraticCurveTo(r * 0.55, side * r * 0.95, r * 0.35, side * r * 0.4);
                ctx.closePath();
                ctx.fill(); ctx.stroke();
            }
        },
        draw(k) {
            const { ctx, r } = k;
            clip(k);
            const g = ctx.createRadialGradient(r * 0.2, 0, r * 0.2, 0, 0, r * 1.3);
            g.addColorStop(0, 'rgba(127, 29, 29, 0)');
            g.addColorStop(1, 'rgba(69, 10, 10, 0.65)');
            fillAll(k, g);
            ctx.restore();
            glow(k, '#ff1f1f', 10);
            ctx.fillStyle = '#ff2d2d';
            for (const side of [-1, 1]) {
                ctx.beginPath();
                ctx.moveTo(r * 0.2, side * r * 0.42);
                ctx.lineTo(r * 0.62, side * r * 0.16);
                ctx.lineTo(r * 0.28, side * r * 0.16);
                ctx.closePath(); ctx.fill();
            }
            noGlow(k);
        }
    },

    angel: {
        behind(k) {
            const { ctx, r, time } = k;
            const flap = Math.sin(time * 4) * 0.12;
            // Three layered feathers per wing, longest at the back, gently flapping.
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1.2;
            for (const side of [-1, 1]) {
                ctx.save();
                ctx.translate(-r * 0.1, side * r * 0.5);
                ctx.rotate(side * flap);
                [[1.25, 0.95, '#e2e8f0'], [1.0, 0.6, '#f1f5f9'], [0.75, 0.25, '#ffffff']].forEach(([len, spread, fill]) => {
                    ctx.save();
                    ctx.rotate(side * (Math.PI / 2 + spread));
                    ctx.fillStyle = fill;
                    ellipse(ctx, r * len * 0.5, 0, r * len * 0.55, r * 0.2);
                    ctx.fill(); ctx.stroke();
                    ctx.restore();
                });
                ctx.restore();
            }
        },
        draw(k) {
            const { ctx, r, time } = k;
            clip(k);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.2);
            g.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
            g.addColorStop(1, 'rgba(255, 255, 255, 0)');
            fillAll(k, g);
            ctx.restore();
            glow(k, '#fde047', 12);
            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = Math.max(2, r * 0.14);
            circle(ctx, 0, 0, r * (0.48 + Math.sin(time * 2.5) * 0.04)); ctx.stroke();
            noGlow(k);
        }
    },

    aurora: {
        draw(k) {
            const { ctx, s, r, time } = k;
            clip(k);
            fillAll(k, 'rgba(6, 12, 30, 0.45)');
            ctx.globalCompositeOperation = 'lighter';
            const bands = ['rgba(52, 211, 153, 0.5)', 'rgba(34, 211, 238, 0.45)', 'rgba(167, 139, 250, 0.5)'];
            bands.forEach((color, i) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                for (let x = -s * 1.2; x <= s * 1.2; x += 2) {
                    ctx.lineTo(x, Math.sin(x / (r * 0.5) + time * 1.6 + i * 2) * r * 0.3 + (i - 1) * r * 0.38);
                }
                for (let x = s * 1.2; x >= -s * 1.2; x -= 2) {
                    ctx.lineTo(x, Math.sin(x / (r * 0.5) + time * 1.6 + i * 2) * r * 0.3 + (i - 1) * r * 0.38 + r * 0.32);
                }
                ctx.closePath();
                ctx.fill();
            });
            ctx.globalCompositeOperation = 'source-over';
            ctx.restore();
        }
    },

    // ---------- season ----------
    neon: {
        draw(k) {
            const { ctx, time, color } = k;
            const pulse = 0.75 + 0.25 * Math.sin(time * 4);
            glow(k, '#ffffff', 14);
            ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
            ctx.lineWidth = 2.4;
            traceBody(ctx, k.t, k.s * 0.64);
            ctx.stroke();
            glow(k, color, 10);
            ctx.strokeStyle = shade(color, 0.5);
            ctx.lineWidth = 1.6;
            traceBody(ctx, k.t, k.s * 0.36);
            ctx.stroke();
            noGlow(k);
        }
    },

    dark: {
        outline: '#2e1065',
        draw(k) {
            const { ctx, r, time } = k;
            clip(k);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.25);
            g.addColorStop(0, '#000000');
            g.addColorStop(0.6, 'rgba(20, 0, 40, 0.96)');
            g.addColorStop(1, 'rgba(76, 29, 149, 0.6)');
            fillAll(k, g);
            ctx.restore();
            glow(k, '#c084fc', 8);
            for (let i = 0; i < 5; i++) {
                const a = time * (0.9 + i * 0.15) + i * 1.25;
                const rad = r * (0.32 + (i % 3) * 0.16);
                ctx.fillStyle = i % 2 ? '#c084fc' : '#e9d5ff';
                circle(ctx, Math.cos(a) * rad, Math.sin(a) * rad, 1.2 + (i % 2)); ctx.fill();
            }
            noGlow(k);
        }
    },

    // ---------- class mastery ----------
    golden: {
        outline: '#7a4b00',
        draw(k) {
            const { ctx, s, r, time } = k;
            clip(k);
            const g = ctx.createLinearGradient(-s, -s, s, s);
            g.addColorStop(0, '#fff3b0');
            g.addColorStop(0.35, '#f5c542');
            g.addColorStop(0.7, '#b7791f');
            g.addColorStop(1, '#fde68a');
            fillAll(k, g);
            ctx.save();
            ctx.rotate(-Math.PI / 4);
            const sweep = (((time * 0.5) % 1.6) - 0.8) * s * 3;
            const shine = ctx.createLinearGradient(sweep - r * 0.4, 0, sweep + r * 0.4, 0);
            shine.addColorStop(0, 'rgba(255, 255, 255, 0)');
            shine.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)');
            shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = shine;
            ctx.fillRect(sweep - r * 0.4, -s * 2, r * 0.8, s * 4);
            ctx.restore();
            ctx.fillStyle = 'rgba(122, 75, 0, 0.55)';
            ctx.beginPath();
            for (let i = 0; i < 10; i++) {
                const rad = i % 2 === 0 ? r * 0.36 : r * 0.15;
                const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
                ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
            }
            ctx.closePath(); ctx.fill();
            ctx.restore();
        }
    }
};

// Radius of the largest circle inside the shape (so decals fit every class).
export const innerRadius = (type, size) => (type === 'circle' ? size : size / 2);

export function skinContext(ctx, entity, highQuality) {
    return {
        ctx,
        s: entity.size,
        t: entity.type,
        r: innerRadius(entity.type, entity.size),
        time: performance.now() / 1000,
        color: entity.color,
        hq: highQuality
    };
}
