// Movement trails. Every Trail cosmetic has a style; each style spawns its own particles behind the
// ship and knows how to draw them. Also handles the plain dash afterimage and thruster flames.
//
// Styles: puff, spark, ribbon, laser, bubble, void, ember, echo, frost, electric, nebula, comet, rainbow,
//         hearts, pixel, petals, smoke, shards
import { traceBody } from './shapes.js';
import { rgba, mix, outlineFor } from './palette.js';

const MAX_PARTICLES = 160;

// Where trail particles leave the ship: just behind it, opposite the direction of travel.
function exhaustPoint(e) {
    const back = Math.atan2(e.vy, e.vx) + Math.PI;
    const dist = e.type === 'square' ? e.size / 2 : e.size * 0.8;
    return { x: e.x + Math.cos(back) * dist, y: e.y + Math.sin(back) * dist, back };
}

function push(e, p) {
    if (e.trail.length < MAX_PARTICLES) e.trail.push(p);
}

const jitter = (amount) => (Math.random() - 0.5) * amount;

// Called every tick while the ship is moving (or dashing). `item` is the Trail cosmetic.
export function spawnTrail(e, item, dashing) {
    const { x, y, back } = exhaustPoint(e);
    const base = { type: 'trail', style: item.style || 'puff', color: item.value, color2: item.color2, life: 1 };
    const out = (speed, spread = 1.0) => {
        const a = back + jitter(spread);
        return { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
    };
    const rate = dashing ? 2 : 1;
    e.trailTick = (e.trailTick || 0) + 1;

    switch (base.style) {
        case 'spark':
            for (let i = 0; i < rate + 1; i++) {
                push(e, { ...base, x: x + jitter(10), y: y + jitter(10), ...out(Math.random() * 2.5 + 0.5, 2), size: 1.2 + Math.random() * 1.8, decay: 0.045, twinkle: Math.random() * 6 });
            }
            break;
        case 'ribbon':
        case 'laser':
        case 'comet':
            push(e, { ...base, x, y, vx: 0, vy: 0, size: e.size * (base.style === 'laser' ? 0.24 : 0.42), decay: dashing ? 0.03 : 0.04 });
            if (base.style === 'comet' && Math.random() < 0.6) {
                push(e, { ...base, style: 'spark', x: x + jitter(8), y: y + jitter(8), ...out(Math.random() * 2 + 1, 1.6), size: 1.2 + Math.random(), decay: 0.06, twinkle: 0 });
            }
            break;
        case 'bubble':
            if (e.trailTick % 2 === 0 || dashing) {
                push(e, { ...base, x: x + jitter(8), y: y + jitter(8), ...out(1 + Math.random(), 1.4), size: 2 + Math.random() * 2.5, decay: 0.03 });
            }
            break;
        case 'ember':
            // A rolling flame (white-hot, cooling to red) with glowing embers thrown off it.
            push(e, { ...base, x: x + jitter(5), y: y + jitter(5), ...out(Math.random() + 0.8, 0.8), size: e.size * (0.32 + Math.random() * 0.12), decay: 0.045, flame: true });
            for (let i = 0; i < rate; i++) {
                if (Math.random() < 0.7) {
                    push(e, { ...base, x: x + jitter(10), y: y + jitter(10), ...out(Math.random() * 2.5 + 1, 2), size: 1.2 + Math.random() * 1.6, decay: 0.03 + Math.random() * 0.02, color: Math.random() < 0.5 ? (base.color2 || '#fbbf24') : '#fff1a6', twinkle: Math.random() * 6 });
                }
            }
            break;
        case 'echo':
            if (e.trailTick % 3 === 0) push(e, { ...base, x: e.x, y: e.y, vx: 0, vy: 0, angle: e.angle, shipType: e.type, size: e.size, decay: 0.06 });
            break;
        case 'frost':
            push(e, { ...base, x: x + jitter(10), y: y + jitter(10), ...out(Math.random() * 1.5 + 0.5, 1.6), size: 2.5 + Math.random() * 2, decay: 0.03, rot: Math.random() * Math.PI, spin: jitter(0.2) });
            break;
        case 'hearts':
            if (e.trailTick % 3 === 0 || dashing) {
                push(e, { ...base, x: x + jitter(10), y: y + jitter(10), ...out(Math.random() * 1.2 + 0.4, 1.4), size: 3 + Math.random() * 2.5, decay: 0.025, rot: jitter(0.6), alt: Math.random() < 0.35 });
                if (item.rarity >= 5 && Math.random() < 0.5) {
                    push(e, { ...base, style: 'spark', color: base.color2 || '#ffffff', x: x + jitter(12), y: y + jitter(12), ...out(Math.random() * 2 + 0.5, 2), size: 1.2 + Math.random(), decay: 0.05, twinkle: Math.random() * 6 });
                }
            }
            break;
        case 'pixel':
            if (e.trailTick % 2 === 0 || dashing) {
                push(e, { ...base, x: x + jitter(12), y: y + jitter(12), ...out(Math.random() * 1.2 + 0.3, 1.2), size: e.size * (0.18 + Math.random() * 0.12), decay: 0.035, alt: Math.random() < 0.4 });
            }
            break;
        case 'petals':
            if (e.trailTick % 2 === 0 || dashing) {
                push(e, { ...base, x: x + jitter(10), y: y + jitter(10), ...out(Math.random() * 1.6 + 0.4, 1.8), size: 3 + Math.random() * 2, decay: 0.022, rot: Math.random() * Math.PI, spin: jitter(0.16), alt: Math.random() < 0.4 });
            }
            break;
        case 'smoke':
            push(e, { ...base, x: x + jitter(6), y: y + jitter(6), ...out(Math.random() * 1 + 0.4, 1.2), size: e.size * (0.3 + Math.random() * 0.12), decay: 0.02 });
            if (base.color2 && Math.random() < 0.45) {
                push(e, { ...base, style: 'ember', color: base.color2, x: x + jitter(10), y: y + jitter(10), ...out(Math.random() * 2 + 1, 2), size: 1 + Math.random() * 1.3, decay: 0.035, twinkle: Math.random() * 6 });
            }
            break;
        case 'shards':
            for (let i = 0; i < rate; i++) {
                push(e, { ...base, x: x + jitter(10), y: y + jitter(10), ...out(Math.random() * 2.2 + 0.6, 1.8), size: 2.5 + Math.random() * 2.5, decay: 0.035, rot: Math.random() * Math.PI * 2, spin: jitter(0.3) });
            }
            break;
        case 'electric':
            // A fresh crackling bolt every other tick, plus the odd spark.
            if (e.trailTick % 2 === 0) {
                const pts = [];
                let px = x;
                let py = y;
                for (let i = 0; i < 8; i++) {
                    pts.push([px, py]);
                    px += Math.cos(back) * 9 + jitter(12);
                    py += Math.sin(back) * 9 + jitter(12);
                }
                push(e, { ...base, x, y, vx: 0, vy: 0, pts, size: 2, decay: 0.12 });
            }
            if (Math.random() < 0.35) {
                push(e, { ...base, style: 'spark', x: x + jitter(14), y: y + jitter(14), ...out(Math.random() * 2 + 1, 2.4), size: 1 + Math.random(), decay: 0.07, twinkle: 0 });
            }
            break;
        default: // puff, void, nebula, rainbow
            if (base.style === 'void' && item.rarity >= 5 && Math.random() < 0.3) {
                push(e, { ...base, style: 'spark', color: base.color2, x: x + jitter(12), y: y + jitter(12), ...out(Math.random() * 1.5 + 0.5, 2), size: 1.2 + Math.random(), decay: 0.04, twinkle: 0 });
            }
            for (let i = 0; i < rate; i++) {
                push(e, {
                    ...base, x: x + jitter(6), y: y + jitter(6), ...out(Math.random() * 1.5 + 0.6, 1.0),
                    size: e.size * (0.28 + Math.random() * 0.14) * (base.style === 'nebula' ? 1.25 : 1),
                    decay: base.style === 'nebula' ? 0.022 : 0.032,
                    hue: (e.trailTick * 9 + Math.random() * 20) % 360
                });
            }
    }
}

// The plain afterimage left while dashing with no Trail equipped.
export function spawnDashEcho(e) {
    push(e, { type: 'ghost', x: e.x, y: e.y, angle: e.angle, life: 1, decay: 0.08, color: e.color, shipType: e.type, size: e.size });
}

export function spawnThrusterFlame(e, x, y, angle, speed, color, size) {
    push(e, { type: 'fire', x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, decay: 0.12, color, size: size * (0.8 + Math.random() * 0.4) });
}

export function updateTrailParticles(e) {
    for (let i = e.trail.length - 1; i >= 0; i--) {
        const p = e.trail[i];
        if (p.vx) { p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92; }
        if (p.spin) p.rot += p.spin;
        p.life -= p.decay;
        if (p.life <= 0) e.trail.splice(i, 1);
    }
}

// Glow here is faked with wide, faint strokes and additive blending: real canvas blur
// (shadowBlur) on every particle costs too much with a screen full of ships.
export function drawTrail(ctx, e, hq) {
    if (!e.trail.length) return;
    // Ribbons are drawn as one connected streak.
    drawRibbons(ctx, e, hq);

    // Thruster flames all share one additive pass.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of e.trail) {
        if (p.type !== 'fire') continue;
        const a = Math.max(0, p.life);
        ctx.fillStyle = rgba(p.color, a);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.6 + a * 0.6), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    for (const p of e.trail) {
        const a = Math.max(0, p.life);
        if (p.type === 'fire') continue;
        if (p.type === 'ghost') {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.globalAlpha = a * 0.35;
            ctx.fillStyle = p.color;
            traceBody(ctx, p.shipType, p.size);
            ctx.fill();
            ctx.globalAlpha = a * 0.5;
            ctx.strokeStyle = outlineFor(p.color);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
            continue;
        }
        drawTrailParticle(ctx, p, a, hq);
    }
}

function drawTrailParticle(ctx, p, a, hq) {
    ctx.save();
    switch (p.style) {
        case 'ribbon':
        case 'laser':
        case 'comet':
            break; // drawn by drawRibbons
        case 'spark': {
            const tw = 0.55 + 0.45 * Math.sin(p.life * 18 + (p.twinkle || 0));
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = rgba(p.color2 && p.twinkle > 3 ? p.color2 : p.color, a * tw);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            if (p.size > 2.4) {
                ctx.strokeStyle = rgba('#ffffff', a * tw * 0.7);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(p.x - p.size * 2, p.y); ctx.lineTo(p.x + p.size * 2, p.y);
                ctx.moveTo(p.x, p.y - p.size * 2); ctx.lineTo(p.x, p.y + p.size * 2);
                ctx.stroke();
            }
            break;
        }
        case 'bubble':
            ctx.strokeStyle = rgba(p.color, a * 0.9);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (1 + (1 - a) * 1.6), 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = rgba('#ffffff', a * 0.5);
            ctx.beginPath();
            ctx.arc(p.x - p.size * 0.4, p.y - p.size * 0.4, Math.max(0.6, p.size * 0.3), 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'ember': {
            ctx.globalCompositeOperation = 'lighter';
            if (p.flame) {
                // Hot yellow when fresh, cooling to the trail's red as it fades.
                const color = a > 0.75 ? mix('#fff1a6', p.color2 || '#fbbf24', (1 - a) * 4) : mix(p.color2 || '#fbbf24', p.color, (0.75 - a) / 0.75);
                ctx.fillStyle = rgba(color, a * 0.4);
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * (0.35 + a * 0.65), 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            const flicker = 0.6 + 0.4 * Math.sin(p.life * 25 + p.twinkle);
            ctx.fillStyle = rgba(p.color, a * flicker);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case 'echo':
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            traceBody(ctx, p.shipType, p.size * (1 + (1 - a) * 0.25));
            if (hq) {
                ctx.strokeStyle = rgba(p.color, a * 0.18);
                ctx.lineWidth = 5;
                ctx.stroke();
            }
            ctx.strokeStyle = rgba(p.color, a * 0.7);
            ctx.lineWidth = 1.5;
            ctx.stroke();
            break;
        case 'hearts': {
            ctx.translate(p.x, p.y - (1 - a) * 6);   // float up a little as they fade
            ctx.rotate(p.rot);
            const sz = p.size * (0.7 + a * 0.3);
            ctx.fillStyle = rgba(p.alt && p.color2 ? p.color2 : p.color, a * 0.95);
            ctx.beginPath();
            ctx.moveTo(0, sz * 0.9);
            ctx.bezierCurveTo(-sz * 1.4, -sz * 0.1, -sz * 0.6, -sz * 1.2, 0, -sz * 0.45);
            ctx.bezierCurveTo(sz * 0.6, -sz * 1.2, sz * 1.4, -sz * 0.1, 0, sz * 0.9);
            ctx.fill();
            break;
        }
        case 'pixel': {
            const sz = Math.max(2, Math.round(p.size * (0.4 + a * 0.6)));
            ctx.fillStyle = rgba(p.alt && p.color2 ? p.color2 : p.color, a > 0.5 ? 1 : a * 2);
            ctx.fillRect(Math.round(p.x - sz / 2), Math.round(p.y - sz / 2), sz, sz);
            break;
        }
        case 'petals':
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = rgba(p.alt && p.color2 ? p.color2 : p.color, a * 0.9);
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = rgba('#ffffff', a * 0.35);
            ctx.beginPath();
            ctx.ellipse(-p.size * 0.25, 0, p.size * 0.4, p.size * 0.18, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'smoke':
            ctx.fillStyle = rgba(p.color, a * 0.32);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (0.6 + (1 - a) * 1.1), 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'shards':
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = rgba(p.color, a * 0.8);
            ctx.beginPath();
            ctx.moveTo(p.size, 0); ctx.lineTo(-p.size * 0.6, -p.size * 0.5); ctx.lineTo(-p.size * 0.3, p.size * 0.6);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = rgba(p.color2 || '#ffffff', a);
            ctx.lineWidth = 1;
            ctx.stroke();
            break;
        case 'frost':
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.strokeStyle = rgba(p.color, a);
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                const ang = (i / 3) * Math.PI;
                ctx.moveTo(-Math.cos(ang) * p.size, -Math.sin(ang) * p.size);
                ctx.lineTo(Math.cos(ang) * p.size, Math.sin(ang) * p.size);
            }
            ctx.stroke();
            break;
        case 'electric':
            ctx.globalCompositeOperation = 'lighter';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            if (hq) {
                ctx.strokeStyle = rgba(p.color, a * 0.16);
                ctx.lineWidth = p.size * 3.2;
                ctx.stroke();
            }
            ctx.strokeStyle = rgba(p.color, a);
            ctx.lineWidth = p.size * 1.6;
            ctx.stroke();
            ctx.strokeStyle = rgba('#ffffff', a * 0.9);
            ctx.lineWidth = p.size * 0.5;
            ctx.stroke();
            break;
        case 'void':
            ctx.fillStyle = rgba(p.color, a * 0.9);
            ctx.strokeStyle = rgba(p.color2 || '#a855f7', a * 0.9);
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            break;
        default: { // puff, nebula, rainbow
            let color = p.color;
            if (p.style === 'rainbow') color = `hsl(${p.hue}, 90%, 62%)`;
            else if (p.color2) color = mix(p.color, p.color2, 1 - a);
            ctx.fillStyle = p.style === 'rainbow' ? color : rgba(color, a * 0.75);
            if (p.style === 'rainbow') ctx.globalAlpha = a * 0.75;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (0.45 + a * 0.55), 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}

// Ribbon, laser and comet trails: the points are joined into one tapering band per unbroken
// stretch (a filled outline, so nothing overlaps), drawn in layers: soft glow, colour, and a
// white core for lasers and comets. Oldest points come first, so the band fades toward the tail.
function drawRibbons(ctx, e, hq) {
    const strips = [];
    let strip = [];
    let style = null;
    for (const p of e.trail) {
        if (p.type !== 'trail' || (p.style !== 'ribbon' && p.style !== 'laser' && p.style !== 'comet')) continue;
        style = p.style;
        const last = strip[strip.length - 1];
        if (last && Math.hypot(p.x - last.x, p.y - last.y) >= 60) {
            strips.push(strip);
            strip = [];
        }
        strip.push(p);
    }
    strips.push(strip);
    ctx.save();
    for (const pts of strips) {
        if (pts.length < 2) continue;
        if (hq) band(ctx, pts, style === 'laser' ? 3 : 2, null, 0.18);
        band(ctx, pts, 1, null, 0.85);
        if (style === 'laser' || style === 'comet') band(ctx, pts, 0.35, '#ffffff', 0.9);
    }
    ctx.restore();
}

function band(ctx, pts, widthScale, color, alpha) {
    const left = [];
    const right = [];
    for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(pts.length - 1, i + 1)];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const nx = -(b.y - a.y) / len;
        const ny = (b.x - a.x) / len;
        const half = Math.max(0.2, pts[i].size * Math.max(0, pts[i].life) * widthScale) / 2;
        left.push([pts[i].x + nx * half, pts[i].y + ny * half]);
        right.push([pts[i].x - nx * half, pts[i].y - ny * half]);
    }
    const tail = pts[0];
    const head = pts[pts.length - 1];
    const c = color || head.color;
    const g = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    g.addColorStop(0, rgba(c, 0));
    g.addColorStop(1, rgba(c, alpha * Math.max(0, head.life)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
    // round off the head end
    const headHalf = Math.hypot(left[left.length - 1][0] - head.x, left[left.length - 1][1] - head.y);
    const dir = Math.atan2(head.y - pts[pts.length - 2].y, head.x - pts[pts.length - 2].x);
    ctx.arc(head.x, head.y, headHalf, dir + Math.PI / 2, dir - Math.PI / 2, true);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill();
}
