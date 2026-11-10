// Upgrade visuals: the guns, missile pods, blades, nozzles, auras and glows that show what a ship
// has picked. Common upgrades are plain steel parts; the rarer "special" ones glow and move so
// they stand out. Ship-space parts are drawn centred on the ship, facing +x, under the hull
// (so the hull covers their roots); world-space parts (auras, magnet field) are drawn before it.
import { traceBody } from './shapes.js';
import { STEEL, TIER_GLOW, rgba } from './palette.js';

const time = () => performance.now() / 1000;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const tierOf = (e, ...ids) => Math.max(0, ...ids.map(id => e.upgrades[id] || 0));

export const GUN_UPGRADES = ['fireRate', 'damage', 'multiShot', 'heavyArt', 'sniper', 'piercing', 'shrapnel'];
export const hasGuns = (e) => GUN_UPGRADES.some(id => (e.upgrades[id] || 0) > 0);

// ---------- shared drawing helpers ----------

export function roundRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
}

export function metalPath(ctx, fill = STEEL.mid) {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = STEEL.edge;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
}

// Half the ship's width at a point `x` along its length (ship space).
function halfWidthAt(e, x) {
    const s = e.size;
    if (e.type === 'circle') return Math.sqrt(Math.max(0, s * s - x * x));
    if (e.type === 'square') return s / 2;
    return Math.max(0, (s - Math.max(x, -s / 2)) * 0.5774);
}

// Distance from the centre to the furthest point of the hull.
const outerRadius = (e) => (e.type === 'square' ? e.size * 0.71 : e.size);
const backEdge = (e) => (e.type === 'circle' ? e.size : e.size / 2);

// ---------- guns ----------

// Where each barrel sits, which way it points, and how thick it can be:
//   Jet:     wing cannons following the two swept front edges (one in the nose for odd counts)
//   Tank:    barrels side by side across the flat front
//   Soldier: a fan from the centre, spaced so barrels never overlap
function barrelLayout(e, guns, width, armor) {
    const s = e.size;
    const offsets = (sp) => Array.from({ length: guns }, (_, i) => (i - (guns - 1) / 2) * sp);
    if (e.type === 'triangle') {
        // Wing cannons: a row of guns along each swept front edge (one in the nose for odd
        // counts). Each barrel starts just under the edge, so the row follows the wing.
        const edgeX = (y) => s + armor * 1.6 - Math.abs(y) * 1.732;
        const perWing = Math.floor(guns / 2);
        width = Math.max(3, Math.min(width, perWing >= 3 ? 3.8 : perWing === 2 ? 4.8 : 6.5));
        const sp = width + 1.5;
        const first = guns % 2 ? s * 0.3 : s * 0.22;
        const barrels = guns % 2 ? [{ x: edgeX(0) - 4, y: 0, angle: 0 }] : [];
        for (const side of [-1, 1]) {
            for (let k = 0; k < perWing; k++) {
                const y = side * (first + k * sp);
                barrels.push({ x: edgeX(y) - 4, y, angle: side * 0.05 });
            }
        }
        return { width, barrels, pods: [] };
    }
    if (e.type === 'square') {
        const span = s * 1.05;
        width = Math.max(3, Math.min(width, span / guns - 1.6));
        const barrels = offsets(width + 1.6).map((y, i) => ({ x: s / 2 + armor - 4, y, angle: (i - (guns - 1) / 2) * 0.05 }));
        // a mantlet across the front holds several barrels together
        const pods = guns > 1 ? [{ x: s / 2 + armor - 4, y: 0, h: guns * (width + 1.6) + 2, angle: 0 }] : [];
        return { width, barrels, pods };
    }
    const R = s + armor;
    const step = Math.max(0.2, (width + 2.4) / R);
    return {
        width,
        barrels: offsets(step).map(a => ({ x: Math.cos(a) * (R - 5), y: Math.sin(a) * (R - 5), angle: a })),
        pods: []
    };
}

export function drawGuns(ctx, e, armor, inGame) {
    if (!hasGuns(e)) return;
    const tier = Math.max(1, tierOf(e, 'fireRate', 'damage', 'multiShot'));
    const heavy = e.upgrades.heavyArt || 0;
    const sniper = e.upgrades.sniper || 0;
    const pierce = e.upgrades.piercing || 0;
    const shrapnel = e.upgrades.shrapnel || 0;
    const guns = Math.max(1, e.multiShot + 1);
    const len = 12 + tier * 2.6 + sniper * 3.5;           // how far each barrel reaches past the hull
    const base = clamp(9 - guns * 0.7 + tier * 0.5, 3, 10) * (1 + heavy * 0.09) * (1 - sniper * 0.05);
    const { width, barrels, pods } = barrelLayout(e, guns, base, armor);
    const main = barrels.find(b => b.y === 0) || barrels[0];

    for (const b of barrels) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        const L = len + 4;
        const w = width;
        roundRect(ctx, 0, -w / 2, L, w, Math.min(2.5, w / 2));
        metalPath(ctx, STEEL.mid);
        ctx.fillStyle = STEEL.light;
        ctx.fillRect(2, -w / 2 + 1, L - 6, Math.max(1, w * 0.22));       // top highlight
        ctx.fillStyle = STEEL.edge;
        ctx.fillRect(L - 3.5, -w / 2 + 1, 2.5, w - 2);                    // muzzle band
        if (tier >= 3) {
            ctx.fillStyle = e.color;
            ctx.fillRect(4 + len * 0.35, -w / 2 + 1, 2.2, w - 2);
        }

        if (heavy > 0) {
            // Heavy Artillery: a chunky muzzle brake with vents and a hot bore.
            const bw = w * 1.5;
            const bl = 4 + heavy * 0.9;
            roundRect(ctx, L - bl, -bw / 2, bl + 1, bw, 1.5);
            metalPath(ctx, STEEL.dark);
            ctx.fillStyle = '#0b0d12';
            for (let k = 0; k < 2; k++) ctx.fillRect(L - bl + 1.2 + k * (bl * 0.45), -bw / 2 + 1, 1.2, bw - 2);
            if (heavy >= 3) {
                ctx.fillStyle = rgba('#ff8a3d', 0.75 + 0.25 * Math.sin(time() * 6));   // glowing-hot bore
                ctx.fillRect(L - 0.5, -w * 0.22, 1.8, w * 0.44);
            }
        }
        if (pierce > 0) {
            // Piercing Rounds: a glowing energy rail down the barrel.
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = rgba('#22d3ee', 0.55 + 0.25 * Math.sin(time() * 5 + b.y));
            ctx.lineWidth = Math.max(1, w * 0.22);
            ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(L - 2, 0); ctx.stroke();
            ctx.restore();
        }
        if (shrapnel > 0) {
            // Shrapnel: a spiked flash hider that splits the shot.
            ctx.fillStyle = '#fb923c';
            ctx.strokeStyle = '#7c2d12';
            ctx.lineWidth = 1;
            const prong = 3 + shrapnel * 0.8;
            for (const side of [-1, 1]) {
                ctx.beginPath();
                ctx.moveTo(L - 2.5, side * w * 0.1);
                ctx.lineTo(L + prong, side * (w * 0.45 + prong * 0.6));
                ctx.lineTo(L - 0.5, side * (w * 0.5 + 1.5));
                ctx.closePath(); ctx.fill(); ctx.stroke();
            }
            ctx.fillStyle = '#fed7aa';
            ctx.fillRect(L - 1, -w * 0.18, 1.5, w * 0.36);
        }
        if (tier >= 5) {
            // top tier: a glowing band in the tier colour
            ctx.fillStyle = rgba(TIER_GLOW[5], 0.9);
            ctx.fillRect(L - 6.5, -w / 2 + 1, 2, w - 2);
        }

        if (b === main && sniper > 0 && !b.inPod) {
            // Sniper Sight: a scope on the main barrel and (in a match) a faint laser sight.
            roundRect(ctx, 5, -w / 2 - 4.5, 11, 4, 2);
            metalPath(ctx, STEEL.dark);
            glowDot(ctx, 16, -w / 2 - 2.5, 1.8, '#67e8f9', 0.9);
            if (inGame) {
                ctx.save();
                ctx.strokeStyle = 'rgba(255, 70, 70, 0.22)';
                ctx.lineWidth = 1.2;
                ctx.setLineDash([6, 7]);
                ctx.lineDashOffset = -time() * 30;
                ctx.beginPath(); ctx.moveTo(L + 3, 0); ctx.lineTo(L + 130 + sniper * 34, 0); ctx.stroke();
                ctx.restore();
            }
        }
        ctx.restore();
    }
    for (const pod of pods) {
        ctx.save();
        ctx.translate(pod.x, pod.y);
        ctx.rotate(pod.angle);
        roundRect(ctx, 0, -pod.h / 2, 8, pod.h, 3);
        const g = ctx.createLinearGradient(0, -pod.h / 2, 0, pod.h / 2);
        g.addColorStop(0, STEEL.light);
        g.addColorStop(1, STEEL.dark);
        metalPath(ctx, g);
        if (tier >= 3) {
            ctx.fillStyle = e.color;
            ctx.fillRect(2, -pod.h / 2 + 1.5, 2, pod.h - 3);
        }
        ctx.restore();
    }
}

// A soft additive glow (cheap: two circles, no blur).
function glowDot(ctx, x, y, r, color, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(color, alpha * 0.35);
    ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba(color, alpha);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

// Rearguard: a gun on the back (twin barrels at tier 3).
export function drawRearGun(ctx, e, armor) {
    const tier = e.upgrades.rearguard || 0;
    if (tier <= 0) return;
    const ys = tier >= 3 ? [-3.8, 3.8] : [0];
    const w = tier >= 3 ? 5 : 6.5;
    const L = 10 + tier * 3;
    const root = -backEdge(e) - armor + 4;
    for (const y of ys) {
        roundRect(ctx, root - L, y - w / 2, L, w, 2);
        metalPath(ctx, STEEL.mid);
        ctx.fillStyle = STEEL.edge;
        ctx.fillRect(root - L + 1, y - w / 2 + 1, 2.5, w - 2);
        ctx.fillStyle = e.color;
        ctx.fillRect(root - L * 0.55, y - w / 2 + 1, 2, w - 2);
    }
}

// ---------- special mounts ----------

// Homing Missiles: a pod on each side, loaded with red-tipped missiles (more per tier).
// The tips glow when the next missile is ready.
export function drawMissilePods(ctx, e, armor) {
    const m = e.missiles || 0;
    if (m <= 0) return;
    const per = Math.min(3, 1 + Math.floor((m - 1) / 2));
    const podLen = 12 + m * 1.2;
    const podX = e.type === 'triangle' ? -e.size * 0.35 : -e.size * 0.15;
    const h = per * 3.8 + 2.5;
    const ready = (e.missileCooldown || 0) <= 15;
    for (const side of [-1, 1]) {
        const outside = Math.max(halfWidthAt(e, podX + podLen / 2), halfWidthAt(e, podX), halfWidthAt(e, podX - podLen / 2));
        const y0 = side * (outside + armor + h / 2 - 1);
        roundRect(ctx, podX - podLen / 2, y0 - h / 2, podLen, h, 3);
        metalPath(ctx, STEEL.dark);
        for (let j = 0; j < per; j++) {
            const my = y0 + (j - (per - 1) / 2) * 3.8;
            ctx.fillStyle = '#e5e7eb';
            roundRect(ctx, podX - podLen / 2 + 2, my - 1.3, podLen + 1, 2.6, 1.3);
            ctx.fill();
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(podX + podLen / 2 + 3, my - 1.4);
            ctx.lineTo(podX + podLen / 2 + 6.5, my);
            ctx.lineTo(podX + podLen / 2 + 3, my + 1.4);
            ctx.closePath(); ctx.fill();
            if (ready) glowDot(ctx, podX + podLen / 2 + 5, my, 1.6, '#ff4444', 0.7 + 0.3 * Math.sin(time() * 8));
        }
    }
}

// Executioner: crimson blades curving forward from the front flanks.
export function drawExecutionerBlades(ctx, e, armor) {
    const tier = e.upgrades.executioner || 0;
    if (tier <= 0) return;
    const s = e.size;
    const ax = e.type === 'square' ? s * 0.25 : s * 0.3;
    const reach = 9 + tier * 2.6;
    const pulse = 0.65 + 0.35 * Math.sin(time() * 4);
    for (const side of [-1, 1]) {
        const ay = side * (halfWidthAt(e, ax) + armor - 1);
        ctx.beginPath();
        ctx.moveTo(ax - 4, ay);
        ctx.quadraticCurveTo(ax + reach * 0.4, ay + side * reach * 0.55, ax + reach, ay + side * reach * 0.15);
        ctx.quadraticCurveTo(ax + reach * 0.45, ay + side * reach * 0.2, ax + 4, ay - side * 1.5);
        ctx.closePath();
        const g = ctx.createLinearGradient(ax, ay, ax + reach, ay);
        g.addColorStop(0, '#450a0a');
        g.addColorStop(1, '#dc2626');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = rgba('#fca5a5', 0.6 + 0.4 * pulse);
        ctx.lineWidth = 1.2;
        ctx.stroke();
        if (tier >= 3) glowDot(ctx, ax + reach * 0.85, ay + side * reach * 0.2, 1.8, '#ef4444', pulse);
    }
}

// Shockwave: glowing emitter arcs hugging the hull, bright when the blast is ready.
export function drawShockwaveEmitters(ctx, e, armor) {
    const tier = e.upgrades.shockwave || 0;
    if (tier <= 0) return;
    const R = outerRadius(e) + armor + 5;
    const n = 3 + tier;
    const ready = (e.shockwaveCooldown || 0) <= 0;
    const spin = time() * 0.6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const [w, a] of [[5, 0.18], [2.2, 0.9]]) {
        ctx.strokeStyle = rgba('#38bdf8', (ready ? 1 : 0.35) * a);
        ctx.lineWidth = w;
        for (let i = 0; i < n; i++) {
            const start = spin + (i / n) * Math.PI * 2;
            ctx.beginPath(); ctx.arc(0, 0, R, start, start + 0.32); ctx.stroke();
        }
    }
    ctx.restore();
}

// Afterburner: hot nozzles (on the thrusters if you have them, otherwise their own pair) that
// roar orange when you move.
export function drawAfterburner(ctx, e, armor, hasThrusters) {
    const tier = e.upgrades.afterburner || 0;
    if (tier <= 0) return;
    const moving = Math.hypot(e.vx, e.vy) > 1 || e.dashTimer > 0;
    const back = -backEdge(e) - armor + 3;
    const spread = e.type === 'square' ? e.size * 0.3 : e.size * 0.42;
    const len = hasThrusters ? 7 + tier * 2 + 9 : 6 + tier;
    for (const side of [-1, 1]) {
        const y = side * spread * (hasThrusters ? 1 : 0.55);
        if (!hasThrusters) {
            ctx.beginPath();
            ctx.moveTo(back, y - 3);
            ctx.lineTo(back - len, y - 4.5);
            ctx.lineTo(back - len, y + 4.5);
            ctx.lineTo(back, y + 3);
            ctx.closePath();
            metalPath(ctx, '#3a2a22');
        }
        const flick = 0.8 + Math.random() * 0.4;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const fl = moving ? (10 + tier * 3) * flick : 3;
        const g = ctx.createLinearGradient(back - len, 0, back - len - fl, 0);
        g.addColorStop(0, `rgba(255, 240, 200, ${moving ? 0.9 : 0.5})`);
        g.addColorStop(0.4, `rgba(255, 120, 30, ${moving ? 0.7 : 0.35})`);
        g.addColorStop(1, 'rgba(220, 38, 38, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(back - len, y - 3.5);
        ctx.lineTo(back - len - fl, y);
        ctx.lineTo(back - len, y + 3.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

// Evasion: a glitchy cyan / pink afterimage around the hull (it's hard to pin down).
export function drawEvasionShimmer(ctx, e) {
    const tier = e.upgrades.evasion || 0;
    if (tier <= 0) return;
    const t = time();
    const off = 1.4 + tier * 0.45;
    ctx.save();
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    for (const [color, phase] of [['#22d3ee', 0], ['#f472b6', Math.PI]]) {
        ctx.save();
        ctx.translate(Math.sin(t * 6 + phase) * off * 0.6, Math.cos(t * 4.3 + phase) * off);
        traceBody(ctx, e.type, e.size + 1);
        ctx.strokeStyle = rgba(color, 0.3 + tier * 0.05);
        ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}

// Medic Drop: a small medic badge on the back of the hull (drawn on top of the hull).
export function drawMedicBadge(ctx, e) {
    if (!(e.medicDrop > 0)) return;
    const x = e.type === 'circle' ? -e.size * 0.52 : e.type === 'square' ? -e.size * 0.26 : -e.size * 0.12;
    const r = 3.8;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x - 0.9, -r * 0.65, 1.8, r * 1.3);
    ctx.fillRect(x - r * 0.65, -0.9, r * 1.3, 1.8);
    ctx.restore();
}

// ⭐ Ability: a small power core in the middle of the hull. Pulses when ready, dim while
// recharging (with an arc showing how far along it is).
export function drawAbilityCore(ctx, e) {
    if (!e.activeAbility) return;
    const ready = e.abilityCooldown <= 0;
    const t = time();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pulse = ready ? 0.75 + 0.25 * Math.sin(t * 5) : 0.35;
    ctx.fillStyle = rgba('#ff4dff', 0.25 * pulse);
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba('#ffd6ff', pulse);
    const r = ready ? 4.2 : 3;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const rad = i % 2 === 0 ? r : r * 0.4;
        const a = (i / 8) * Math.PI * 2 + (ready ? t * 1.5 : 0);
        ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath(); ctx.fill();
    if (!ready && e.abilityMaxCooldown > 0) {
        ctx.strokeStyle = rgba('#ff4dff', 0.7);
        ctx.lineWidth = 1.4;
        const done = 1 - e.abilityCooldown / e.abilityMaxCooldown;
        ctx.beginPath(); ctx.arc(0, 0, 6, -Math.PI / 2, -Math.PI / 2 + done * Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
}

// ---------- world-space auras ----------

const auraBase = (e) => (e.type === 'square' ? e.size / 1.5 : e.size) + 12;

// How far the auras reach (for placing the name tag above them).
export function auraReach(e) {
    if ((e.upgrades.siphon || 0) > 0) return 22;
    if ((e.upgrades.vampirism || 0) > 0) return 18;
    if ((e.upgrades.regen || 0) > 0 || (e.upgrades.ghostDash || 0) > 0) return 16;
    return 0;
}

// Nanobots (green crosses), Vampirism (blood drops), Soul Siphon (purple soul wisps) and Ghost Dash
// (pale wisps), each on its own ring so they read separately when stacked.
export function drawAuras(ctx, e) {
    const regen = Math.min(5, e.upgrades.regen || 0);
    const vamp = Math.min(5, e.upgrades.vampirism || 0);
    const siphon = Math.min(5, e.upgrades.siphon || 0);
    const ghost = e.upgrades.ghostDash || 0;
    if (!regen && !vamp && !siphon && !ghost) return;
    const t = time();
    const base = auraBase(e);
    ctx.save();
    ctx.translate(e.x, e.y);

    if (regen) {
        const radius = base + regen;
        if (regen >= 3) {
            const g = ctx.createRadialGradient(0, 0, radius * 0.5, 0, 0, radius);
            g.addColorStop(0, 'rgba(74, 222, 128, 0)');
            g.addColorStop(1, `rgba(74, 222, 128, ${0.04 * regen})`);
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = `rgba(74, 222, 128, ${0.16 + regen * 0.04 + 0.12 * Math.sin(t * 3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(134, 239, 172, 0.85)';
        for (let i = 0; i < 2 + regen; i++) {
            const a = t * 0.8 + (i / (2 + regen)) * Math.PI * 2;
            const x = Math.cos(a) * radius;
            const y = Math.sin(a) * radius;
            ctx.beginPath();
            ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y);
            ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 3);
            ctx.stroke();
        }
    }

    if (vamp) {
        const radius = base + 6 + vamp;
        ctx.strokeStyle = `rgba(220, 38, 38, ${0.2 + vamp * 0.05 + 0.1 * Math.sin(t * 2.5)})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 6]);
        ctx.lineDashOffset = t * 12;
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        for (let i = 0; i < 2 + vamp; i++) {
            const a = -t * 0.9 + (i / (2 + vamp)) * Math.PI * 2;
            ctx.save();
            ctx.translate(Math.cos(a) * radius, Math.sin(a) * radius);
            ctx.rotate(a + Math.PI / 2);
            ctx.fillStyle = '#dc2626';
            ctx.strokeStyle = '#450a0a';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(0, -4);
            ctx.quadraticCurveTo(3, 0, 0, 2.8);
            ctx.quadraticCurveTo(-3, 0, 0, -4);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath(); ctx.arc(-0.8, 0.4, 0.8, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
    }

    if (siphon) {
        const radius = base + 11 + siphon;
        ctx.strokeStyle = `rgba(192, 132, 252, ${0.1 + siphon * 0.03})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const souls = 2 + Math.ceil(siphon / 2);
        for (let i = 0; i < souls; i++) {
            const a = t * 1.3 + (i / souls) * Math.PI * 2;
            const wob = Math.sin(t * 4 + i) * 2.5;
            const x = Math.cos(a) * (radius + wob);
            const y = Math.sin(a) * (radius + wob);
            // a little flame-like soul with a fading tail behind it
            for (let k = 0; k < 5; k++) {
                const ta = a - k * 0.09;
                ctx.fillStyle = `rgba(192, 132, 252, ${0.75 - k * 0.14})`;
                ctx.beginPath();
                ctx.arc(Math.cos(ta) * (radius + wob), Math.sin(ta) * (radius + wob), 4.6 - k * 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = 'rgba(250, 245, 255, 0.95)';
            ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    if (ghost) {
        const radius = base + 2;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 2; i++) {
            const a = t * 0.6 + i * Math.PI;
            const x = Math.cos(a) * radius;
            const y = Math.sin(a) * radius + Math.sin(t * 3 + i) * 2;
            // a tiny ghost: round head, wavy hem, two eyes
            ctx.fillStyle = 'rgba(224, 242, 254, 0.18)';
            ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(240, 249, 255, 0.85)';
            ctx.beginPath();
            ctx.arc(x, y - 1, 4, Math.PI, 0);
            ctx.lineTo(x + 4, y + 4);
            for (let k = 0; k < 4; k++) ctx.lineTo(x + 4 - (k + 0.5) * 2, y + (k % 2 ? 4 : 2.6));
            ctx.lineTo(x - 4, y + 4);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        for (let i = 0; i < 2; i++) {
            const a = t * 0.6 + i * Math.PI;
            const x = Math.cos(a) * radius;
            const y = Math.sin(a) * radius + Math.sin(t * 3 + i) * 2;
            ctx.fillRect(x - 2, y - 1.8, 1.3, 1.6);
            ctx.fillRect(x + 0.7, y - 1.8, 1.3, 1.6);
        }
    }
    ctx.restore();
}

// Orb Magnet: a faint dashed ring showing your pickup range (your own ship only).
export function drawMagnetField(ctx, e) {
    if (!(e.magnet > 0) || !e.isPlayer) return;
    const radius = 150 + e.magnet * 100;
    ctx.save();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 10]);
    ctx.lineDashOffset = -time() * 8;
    ctx.beginPath(); ctx.arc(e.x, e.y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
}
