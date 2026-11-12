// Body paint for Color cosmetics. A finish fills the ship body (path already traced by the caller)
// and can add an overlay clipped inside it. Flat colours have no finish.
//   gradient  value -> value2 across the hull          (rare)
//   pulse     flat colour with a breathing glow         (epic)
//   neon      dark core with a bright neon rim          (legendary)
//   metal     brushed metal with a highlight            (legendary)
//   galaxy    drifting nebula colours with tiny stars   (legendary)
//   flare     burning sun                               (legendary)
//   rim       near-black hull with a glowing edge       (legendary)
//   crystal   faceted gem                               (legendary)
//   shimmer   white with a moving sheen                 (legendary)
import { shade, rgba, outlineFor } from './palette.js';

const time = () => performance.now() / 1000;

// Glow colour and strength for the ship (used as the body's shadow).
export function glowFor(color, finish) {
    // Blur cost grows with the radius, so even the showy finishes stay modest.
    if (!finish) return { color, blur: 12 };
    switch (finish.type) {
        case 'pulse': return { color, blur: 9 + 7 * (0.5 + 0.5 * Math.sin(time() * 4)) };
        case 'neon': return { color, blur: 18 };
        case 'rim': return { color: finish.rim, blur: 14 };
        case 'flare': return { color: '#f59e0b', blur: 16 };
        case 'galaxy': return { color: '#8b5cf6', blur: 14 };
        default: return { color, blur: 12 };
    }
}

// Outline colour drawn on top of the body (and any skin).
export function finishOutline(color, finish) {
    if (!finish) return outlineFor(color);
    switch (finish.type) {
        case 'neon': return shade(color, 0.35);
        case 'rim': return finish.rim;
        case 'metal': return shade(color, -0.55);
        case 'gradient': return shade(finish.value2, -0.4);
        default: return outlineFor(color);
    }
}

// Fills the current path. `s` = ship size.
export function paintBody(ctx, color, finish, s) {
    if (!finish) {
        ctx.fillStyle = color;
        ctx.fill();
        return;
    }
    const t = time();
    switch (finish.type) {
        case 'gradient': {
            const g = ctx.createLinearGradient(-s, -s, s, s);
            g.addColorStop(0, color);
            g.addColorStop(1, finish.value2);
            ctx.fillStyle = g;
            break;
        }
        case 'metal': {
            const g = ctx.createLinearGradient(-s, -s, s * 0.8, s);
            g.addColorStop(0, shade(color, 0.6));
            g.addColorStop(0.45, color);
            g.addColorStop(0.75, shade(color, -0.35));
            g.addColorStop(1, shade(color, 0.15));
            ctx.fillStyle = g;
            break;
        }
        case 'neon':
            ctx.fillStyle = shade(color, -0.55);
            break;
        case 'galaxy': {
            const g = ctx.createLinearGradient(-s, -s, s, s);
            const shift = (Math.sin(t * 0.8) + 1) / 2;
            g.addColorStop(0, '#1e1b4b');
            g.addColorStop(0.25 + shift * 0.2, '#7c3aed');
            g.addColorStop(0.55 + shift * 0.15, '#db2777');
            g.addColorStop(1, '#1d4ed8');
            ctx.fillStyle = g;
            break;
        }
        case 'flare': {
            const flicker = 1 + Math.sin(t * 9) * 0.06;
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.1 * flicker);
            g.addColorStop(0, '#fffbe6');
            g.addColorStop(0.35, '#fcd34d');
            g.addColorStop(0.75, '#f59e0b');
            g.addColorStop(1, '#dc2626');
            ctx.fillStyle = g;
            break;
        }
        case 'crystal': {
            const g = ctx.createLinearGradient(-s, -s, s, s);
            g.addColorStop(0, shade(color, 0.45));
            g.addColorStop(0.5, color);
            g.addColorStop(1, shade(color, -0.4));
            ctx.fillStyle = g;
            break;
        }
        default:
            ctx.fillStyle = color;
    }
    ctx.fill();
}

// Extra layer clipped inside the body (sheen, stars, facets, neon rim). Path must still be traced.
export function paintOverlay(ctx, color, finish, s, hq) {
    if (!finish) return;
    const t = time();
    switch (finish.type) {
        case 'shimmer':
        case 'metal': {
            ctx.save();
            ctx.clip();
            ctx.rotate(-Math.PI / 4);
            const speed = finish.type === 'shimmer' ? 0.6 : 0.25;
            const x = (((t * speed) % 1.6) - 0.8) * s * 3;
            const g = ctx.createLinearGradient(x - s * 0.3, 0, x + s * 0.3, 0);
            g.addColorStop(0, 'rgba(255, 255, 255, 0)');
            g.addColorStop(0.5, finish.type === 'shimmer' ? 'rgba(186, 230, 253, 0.85)' : 'rgba(255, 255, 255, 0.5)');
            g.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - s * 0.3, -s * 2, s * 0.6, s * 4);
            ctx.restore();
            break;
        }
        case 'galaxy': {
            ctx.save();
            ctx.clip();
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 9; i++) {
                const a = Math.sin(i * 91.7) * 43758.5;
                const px = ((a - Math.floor(a)) * 2 - 1) * s;
                const b = Math.sin(i * 47.3) * 12345.6;
                const py = ((b - Math.floor(b)) * 2 - 1) * s;
                ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i));
                ctx.fillRect(px, py, 1.3, 1.3);
            }
            ctx.restore();
            break;
        }
        case 'crystal': {
            ctx.save();
            ctx.clip();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 5; i++) {
                const a = (i / 5) * Math.PI * 2 + 0.4;
                ctx.beginPath();
                ctx.moveTo(s * 0.15, -s * 0.1);
                ctx.lineTo(Math.cos(a) * s * 1.5, Math.sin(a) * s * 1.5);
                ctx.stroke();
            }
            ctx.restore();
            break;
        }
        case 'neon': {
            // Glowing tube: a wide faint stroke under the bright one (the hull already blurs).
            ctx.save();
            if (hq) {
                ctx.strokeStyle = rgba(color, 0.3);
                ctx.lineWidth = Math.max(6, s * 0.4);
                ctx.stroke();
            }
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(2.5, s * 0.16);
            ctx.stroke();
            ctx.restore();
            break;
        }
        case 'rim': {
            ctx.save();
            ctx.clip();
            const g = ctx.createRadialGradient(0, 0, s * 0.3, 0, 0, s * 1.2);
            g.addColorStop(0, rgba(finish.rim, 0));
            g.addColorStop(1, rgba(finish.rim, 0.35));
            ctx.fillStyle = g;
            ctx.fillRect(-s * 2, -s * 2, s * 4, s * 4);
            ctx.restore();
            break;
        }
    }
}
