// Draws a ship, back to front:
//   trail -> ability effect -> auras -> evasion shimmer -> armour -> missile pods -> thrusters /
//   afterburner -> rear gun -> guns -> executioner blades -> spikes -> shockwave emitters ->
//   skin (behind layer) -> body paint -> skin -> outline -> medic badge -> ability core ->
//   orbiters -> facing arrow -> name & bars   (the upgrade parts live in upgradeParts.js)
// Metal parts sit under the body so it overlaps their roots, like a turret on a hull.
// `preview: true` is for menu canvases (locker, store, lobby) and skips the in-game extras.
import { settings } from '../../core/settings.js';
import { getItem, bannerFor } from '../../data/items.js';
import { traceBody } from './shapes.js';
import { SKINS, skinContext } from './skins.js';
import { paintBody, paintOverlay, glowFor, finishOutline } from './finishes.js';
import { drawTrail } from './trails.js';
import { STEEL, TIER_GLOW, rgba } from './palette.js';
import { armorTierOf, bladeRingRadius, orbiterPositions, ORBITER_BLADE_RADIUS, REPULSOR_RANGE } from '../geometry.js';
import {
    roundRect, metalPath, hasGuns, drawGuns, drawRearGun, drawMissilePods, drawExecutionerBlades,
    drawShockwaveEmitters, drawAfterburner, drawEvasionShimmer, drawMedicBadge, drawAbilityCore,
    drawAuras, drawMagnetField, auraReach
} from './upgradeParts.js';

const outlineWidth = (e) => Math.max(2, Math.min(3.2, e.size * 0.11));
const HIT_FLASH_MS = 110;
// Distance from the centre to the back edge / front edge of each shape.
const backEdge = (e) => (e.type === 'circle' ? e.size : e.size / 2);
const frontEdge = (e) => (e.type === 'square' ? e.size / 2 : e.size * 0.8);

export function drawEntity(ctx, e, { preview = false } = {}) {
    const hq = settings.highQuality;

    drawTrail(ctx, e, hq);

    const oldAlpha = ctx.globalAlpha;
    if (e.isCloaked) ctx.globalAlpha = 0.2;

    // Ghost Dash: see-through while dashing.
    if (e.ghostDash && e.dashTimer > 0) ctx.globalAlpha *= 0.45;

    drawAbilityEffect(ctx, e, hq);
    if (!preview) drawMagnetField(ctx, e);
    drawAuras(ctx, e);

    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    drawEvasionShimmer(ctx, e);
    const armor = drawArmor(ctx, e);
    drawMissilePods(ctx, e, armor);
    drawThrusters(ctx, e, armor);
    drawAfterburner(ctx, e, armor, e.rearVisual === 'thrusters');
    drawRearGun(ctx, e, armor);
    drawGuns(ctx, e, armor, !preview);
    drawExecutionerBlades(ctx, e, armor);
    drawSpikes(ctx, e, armor);
    drawShockwaveEmitters(ctx, e, armor);
    drawHull(ctx, e, hq);
    drawMedicBadge(ctx, e);
    drawAbilityCore(ctx, e);
    ctx.restore();

    ctx.globalAlpha = oldAlpha;
    if (preview) return;

    if (e.orbiters > 0 && !e.isCloaked) drawOrbiters(ctx, e, hq);
    if (e.isPlayer && !hasGuns(e) && !(e.spikes > 0) && !e.isCloaked) drawFacingArrow(ctx, e, armor);
    if (!e.isCloaked) drawNameAndBars(ctx, e, armor);
}

// ---------- hull: paint, skin, outline ----------

function drawHull(ctx, e, hq) {
    const skin = SKINS[getItem(e.equipped.Skin)?.value];
    const k = skin ? skinContext(ctx, e, hq) : null;

    if (skin?.behind) {
        ctx.save();
        skin.behind(k);
        ctx.restore();
    }

    const finish = e.colorFinish;
    ctx.save();
    if (hq) {
        const g = glowFor(e.color, finish);
        ctx.shadowColor = g.color;
        ctx.shadowBlur = g.blur;
    }
    traceBody(ctx, e.type, e.size);
    paintBody(ctx, e.color, finish, e.size);
    ctx.restore();

    if (finish) {
        ctx.save();
        traceBody(ctx, e.type, e.size);
        paintOverlay(ctx, e.color, finish, e.size, hq);
        ctx.restore();
    }

    if (skin) {
        ctx.save();
        skin.draw(k);
        ctx.restore();
    }

    // Just got hit: a quick white flash over the hull.
    const flash = e.hitFlashAt ? 1 - (performance.now() - e.hitFlashAt) / HIT_FLASH_MS : 0;
    if (flash > 0) {
        ctx.save();
        ctx.globalAlpha *= flash * 0.6;
        ctx.fillStyle = '#ffffff';
        traceBody(ctx, e.type, e.size);
        ctx.fill();
        ctx.restore();
    }

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = outlineWidth(e);
    ctx.strokeStyle = skin?.outline || finishOutline(e.color, finish);
    traceBody(ctx, e.type, e.size);
    ctx.stroke();
    ctx.restore();
}

// ---------- metal parts (drawn in ship space: centred, facing +x) ----------

function drawArmor(ctx, e) {
    if (e.bodyVisual !== 'armor') return 0;
    const tier = Math.max(1, armorTierOf(e));
    const offset = 3 + tier * 1.4;
    const shellSize = e.type === 'circle' ? e.size + offset : e.size + offset * 2;

    ctx.save();
    traceBody(ctx, e.type, shellSize);
    const g = ctx.createLinearGradient(-shellSize, -shellSize, shellSize, shellSize);
    g.addColorStop(0, STEEL.light);
    g.addColorStop(0.5, STEEL.mid);
    g.addColorStop(1, STEEL.dark);
    metalPath(ctx, g);

    // Plate seams between the hull and the shell edge, plus rivets from tier 3.
    ctx.strokeStyle = STEEL.edge;
    ctx.lineWidth = 1.4;
    const seams = [];
    if (e.type === 'circle') {
        const n = 4 + tier;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + 0.3;
            seams.push([Math.cos(a), Math.sin(a), e.size, e.size + offset]);
        }
    } else if (e.type === 'square') {
        for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) seams.push([sx * Math.SQRT1_2, sy * Math.SQRT1_2, e.size / 2 * Math.SQRT2, (e.size / 2 + offset) * Math.SQRT2]);
    } else {
        for (const a of [0, (2 * Math.PI) / 3, (-2 * Math.PI) / 3]) seams.push([Math.cos(a), Math.sin(a), e.size, e.size + offset * 2]);
    }
    for (const [cx, cy, r0, r1] of seams) {
        ctx.beginPath(); ctx.moveTo(cx * r0, cy * r0); ctx.lineTo(cx * r1, cy * r1); ctx.stroke();
    }
    if (tier >= 3) {
        ctx.fillStyle = STEEL.light;
        ctx.strokeStyle = STEEL.edge;
        ctx.lineWidth = 0.8;
        for (const [x, y] of rivetSpots(e, offset, tier)) {
            ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
    }
    ctx.restore();
    return offset;
}

// Rivet positions on the armour band: between the seams on a circle, along each flat side
// (one per side, two from tier 5) on a square or triangle.
function rivetSpots(e, offset, tier) {
    const spots = [];
    if (e.type === 'circle') {
        const n = 4 + tier;
        const rr = e.size + offset / 2;
        for (let i = 0; i < n; i++) {
            const a = ((i + 0.5) / n) * Math.PI * 2 + 0.3;
            spots.push([Math.cos(a) * rr, Math.sin(a) * rr]);
        }
        return spots;
    }
    // Side midpoints sit at the shape's inradius; a triangle's sides face back and +/-60 degrees.
    const rr = e.size / 2 + offset / 2;
    const normals = e.type === 'square' ? [0, Math.PI / 2, Math.PI, -Math.PI / 2] : [Math.PI, Math.PI / 3, -Math.PI / 3];
    const halfSide = e.type === 'square' ? rr : rr * Math.sqrt(3);
    const along = tier >= 5 ? [-0.45, 0.45] : [0];
    for (const n of normals) {
        const cx = Math.cos(n) * rr;
        const cy = Math.sin(n) * rr;
        for (const f of along) {
            spots.push([cx - Math.sin(n) * halfSide * f, cy + Math.cos(n) * halfSide * f]);
        }
    }
    return spots;
}

// Thrusters: two flared nozzles at the back that glow (tier colour) when moving.
function drawThrusters(ctx, e, armor) {
    if (e.rearVisual !== 'thrusters') return;
    const tier = Math.max(1, Math.max(e.upgrades.speed || 0, e.upgrades.dash || 0));
    const len = 7 + tier * 2;
    const inner = 3.5 + tier * 0.6;
    const outer = 5 + tier * 1.1;
    const back = -backEdge(e) - armor + 3;
    const spread = e.type === 'square' ? e.size * 0.3 : e.size * 0.42;
    const moving = Math.hypot(e.vx, e.vy) > 1 || e.dashTimer > 0;

    for (const side of [-1, 1]) {
        const y = side * spread;
        ctx.beginPath();
        ctx.moveTo(back, y - inner);
        ctx.lineTo(back - len, y - outer);
        ctx.lineTo(back - len, y + outer);
        ctx.lineTo(back, y + inner);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, y - outer, 0, y + outer);
        g.addColorStop(0, STEEL.mid);
        g.addColorStop(1, STEEL.dark);
        metalPath(ctx, g);
        // Nozzle mouth: dark opening with a tier-coloured glow, bright while moving.
        ctx.fillStyle = STEEL.edge;
        ctx.fillRect(back - len - 1, y - outer, 2.5, outer * 2);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba(TIER_GLOW[tier], moving ? 0.85 : 0.3);
        ctx.beginPath();
        ctx.ellipse(back - len - 0.5, y, moving ? 2.5 : 1.6, outer * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Gun barrels: steel tubes with a dark muzzle; from tier 3 a stripe in the ship colour.
function drawSpikes(ctx, e, armor) {
    if (e.spikes <= 0) return;
    const spike = (x, y, angle, len, base) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(-1, -base);
        ctx.lineTo(len, 0);
        ctx.lineTo(-1, base);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, -base, 0, base);
        g.addColorStop(0, STEEL.light);
        g.addColorStop(1, STEEL.mid);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = STEEL.edge;
        ctx.lineWidth = 1.4;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
    };

    if (e.type === 'circle') {
        const count = 4 + e.spikes * 2;
        const r = e.size + armor - 1;
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2;
            spike(Math.cos(a) * r, Math.sin(a) * r, a, 6 + e.spikes * 1.8, 3 + e.spikes * 0.5);
        }
    } else if (e.type === 'square') {
        const edge = e.size / 2 + armor - 1;
        const per = e.spikes >= 3 ? 3 : 2;
        for (let side = 0; side < 4; side++) {
            for (let i = 0; i < per; i++) {
                const f = (i + 0.5) / per - 0.5;
                const normal = (side * Math.PI) / 2;
                const px = Math.cos(normal) * edge - Math.sin(normal) * f * e.size;
                const py = Math.sin(normal) * edge + Math.cos(normal) * f * e.size;
                spike(px, py, normal, 5 + e.spikes * 1.8, 3 + e.spikes * 0.4);
            }
        }
    } else if (!hasGuns(e)) {
        // Jet: one big ram spike on the nose (guns take the nose when it has them)
        spike(e.size + armor - 2, 0, 0, 6 + e.spikes * 3, e.size * 0.3);
    }
}

// ---------- effects (world space) ----------

function drawAbilityEffect(ctx, e, hq) {
    if (e.abilityTimer <= 0) return;
    const t = performance.now() / 1000;
    const r = e.size + 14;
    ctx.save();
    ctx.translate(e.x, e.y);
    // Only the thin rings close to the ship glow (blur): fills and big rings would cost too much.
    const ring = (radius, color, width, dash = null, speed = 0, blur = hq) => {
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        if (dash) {
            ctx.setLineDash(dash);
            ctx.lineDashOffset = t * speed;
        }
        ctx.shadowBlur = blur ? 10 : 0;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.setLineDash([]);
    };

    switch (e.activeAbility) {
        case 'shield': {
            const g = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r);
            g.addColorStop(0, 'rgba(56, 189, 248, 0.05)');
            g.addColorStop(1, 'rgba(56, 189, 248, 0.35)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
            ctx.shadowColor = '#38bdf8';
            ring(r, 'rgba(125, 211, 252, 0.9)', 2.5);
            ctx.beginPath();
            ctx.arc(0, 0, r - 4, t * 2, t * 2 + 1);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 2;
            ctx.stroke();
            break;
        }
        case 'overdrive':
            ctx.shadowColor = '#f97316';
            ring(e.size + 9, 'rgba(251, 146, 60, 0.9)', 3, [10, 8], 60);
            break;
        case 'minigun':
            ctx.shadowColor = '#fbbf24';
            ring(e.size + 9, 'rgba(252, 211, 77, 0.9)', 3, [4, 5], 120);
            break;
        case 'sonic_boom': {
            ctx.shadowColor = '#e0f2fe';
            ctx.rotate(e.angle);
            ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
            ctx.lineWidth = 3;
            if (hq) ctx.shadowBlur = 10;
            for (let i = 0; i < 3; i++) {
                const rad = e.size + 6 + ((t * 60 + i * 8) % 24);
                ctx.globalAlpha = 1 - ((t * 60 + i * 8) % 24) / 24;
                ctx.beginPath(); ctx.arc(0, 0, rad, -0.9, 0.9); ctx.stroke();
            }
            break;
        }
        case 'phase_strike':
            ctx.shadowColor = '#e879f9';
            ring(e.size + 8, 'rgba(232, 121, 249, 0.9)', 3, [6, 6], 90);
            break;
        case 'repulsor': {
            // Ripples rolling out to the edge of the real push/reflect range, which is marked faintly.
            // The faint edge band is a wide stroke, not a filled disc: far fewer pixels to paint.
            const range = REPULSOR_RANGE;
            ring(range - 18, 'rgba(34, 211, 238, 0.045)', 36, null, 0, false);
            ctx.shadowColor = '#22d3ee';
            ring(range, 'rgba(103, 232, 249, 0.35)', 1.5, [6, 10], 20, false);
            for (let i = 0; i < 3; i++) {
                const p = ((t * 0.8 + i / 3) % 1);
                ctx.globalAlpha = (1 - p) * 0.55;
                ring(r + p * (range - r), '#67e8f9', 2, null, 0, false);
            }
            ctx.globalAlpha = 1;
            ring(r, 'rgba(103, 232, 249, 0.8)', 2.5);
            break;
        }
        case 'juggernaut': {
            const pulse = 0.6 + 0.4 * Math.sin(t * 8);
            ctx.shadowColor = '#ef4444';
            ctx.fillStyle = `rgba(239, 68, 68, ${0.12 + 0.08 * pulse})`;
            ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, Math.PI * 2); ctx.fill();
            ring(r + 2, `rgba(248, 113, 113, ${0.6 + 0.4 * pulse})`, 4);
            break;
        }
        case 'blade_ring': {
            // Steel blades spinning on the damage ring, each with a red motion streak behind it.
            const radius = bladeRingRadius(e);
            ring(radius, 'rgba(239, 68, 68, 0.07)', 26, null, 0, false);
            ring(radius, 'rgba(239, 68, 68, 0.1)', 12, null, 0, false);
            const spin = t * 8;
            const n = 12;
            ctx.lineCap = 'round';
            for (let i = 0; i < n; i++) {
                const a = spin + (i / n) * Math.PI * 2;
                ctx.strokeStyle = 'rgba(248, 113, 113, 0.35)';
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(0, 0, radius, a - 0.22, a - 0.04); ctx.stroke();
            }
            for (let i = 0; i < n; i++) {
                const a = spin + (i / n) * Math.PI * 2;
                ctx.save();
                ctx.translate(Math.cos(a) * radius, Math.sin(a) * radius);
                ctx.rotate(a + Math.PI / 2);
                ctx.beginPath();
                ctx.moveTo(11, 0); ctx.lineTo(0, -4); ctx.lineTo(-7, 0); ctx.lineTo(0, 4);
                ctx.closePath();
                const g = ctx.createLinearGradient(0, -4, 0, 4);
                g.addColorStop(0, STEEL.light);
                g.addColorStop(1, STEEL.dark);
                ctx.fillStyle = g;
                ctx.fill();
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 1.2;
                ctx.stroke();
                ctx.restore();
            }
            break;
        }
        case 'cloak':
            ring(e.size + 4, 'rgba(255, 255, 255, 0.25)', 1.5, [3, 6], 30);
            break;
    }
    ctx.restore();
}

function drawOrbiters(ctx, e, hq) {
    ctx.save();
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.size + 25, 0, Math.PI * 2); ctx.stroke();

    const spin = (Date.now() / 90) * e.overclock;
    const overclock = e.upgrades.overclock || 0;
    const positions = orbiterPositions(e);
    if (overclock > 0) {
        // Overclock: cyan motion streaks behind each blade.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (const pos of positions) {
            const r = Math.hypot(pos.x - e.x, pos.y - e.y);
            const a = Math.atan2(pos.y - e.y, pos.x - e.x);
            const tail = 0.22 + overclock * 0.06;
            ctx.strokeStyle = 'rgba(34, 211, 238, 0.2)';
            ctx.lineWidth = ORBITER_BLADE_RADIUS * 0.7;
            ctx.beginPath(); ctx.arc(e.x, e.y, r, a - tail, a); ctx.stroke();
            ctx.strokeStyle = 'rgba(165, 243, 252, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(e.x, e.y, r, a - tail * 0.7, a); ctx.stroke();
        }
        ctx.restore();
    }
    for (const pos of positions) {
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(spin);
        const R = ORBITER_BLADE_RADIUS;
        if (hq) {
            ctx.fillStyle = 'rgba(139, 92, 246, 0.22)';
            ctx.beginPath(); ctx.arc(0, 0, R * 1.45, 0, Math.PI * 2); ctx.fill();
        }
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
            ctx.quadraticCurveTo(Math.cos(a + 0.45) * R * 0.35, Math.sin(a + 0.45) * R * 0.35, Math.cos(a + Math.PI / 2) * R * 0.42, Math.sin(a + Math.PI / 2) * R * 0.42);
        }
        ctx.closePath();
        ctx.fillStyle = overclock > 0 ? '#cffafe' : '#c4b5fd';
        ctx.fill();
        ctx.strokeStyle = overclock > 0 ? '#0e7490' : '#4c1d95';
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.fillStyle = '#1e1b4b';
        ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    ctx.restore();
}

// The floating arrow in front of your own ship (until you have a gun or ram spike).
function drawFacingArrow(ctx, e, armor) {
    const bob = Math.sin(Date.now() / 300) * 1.5;
    let extra = 0;
    if (e.abilityTimer > 0 && ['shield', 'juggernaut'].includes(e.activeAbility)) extra = 16;
    else if (e.abilityTimer > 0 && ['overdrive', 'sonic_boom', 'minigun', 'phase_strike'].includes(e.activeAbility)) extra = 10;
    extra = Math.max(extra, auraReach(e) - 2);

    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    const offset = (e.type === 'square' ? e.size / 2 : e.size) + armor + extra + 12 + bob;
    ctx.beginPath();
    ctx.moveTo(offset, -6);
    ctx.lineTo(offset + 11, 0);
    ctx.lineTo(offset, 6);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
}

// A gold "OWNER" tag in front of the name (the owner banner). Font is already set for the name.
function drawOwnerTag(ctx, cx, y, name) {
    const nameW = ctx.measureText(name).width;
    ctx.font = '900 9px "Segoe UI", sans-serif';
    const tagW = ctx.measureText('OWNER').width + 10;
    const gap = 5;
    const left = cx - (tagW + gap + nameW) / 2;
    const g = ctx.createLinearGradient(0, y - 11, 0, y + 3);
    g.addColorStop(0, '#fde68a');
    g.addColorStop(1, '#f59e0b');
    roundRect(ctx, left, y - 11, tagW, 14, 4);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#1c1206';
    ctx.textAlign = 'center';
    ctx.fillText('OWNER', left + tagW / 2, y);
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(name, left + tagW + gap, y);
    ctx.fillStyle = '#ffe680';
    ctx.fillText(name, left + tagW + gap, y);
}

// Health you just lost stays on the bar for a moment, then drains away (shows how hard a hit was).
function healthChip(e, pct) {
    const now = performance.now();
    if (e.chipPct === undefined || pct >= e.chipPct) {
        e.chipPct = pct;
    } else if (now - (e.hitFlashAt || 0) > 350) {
        e.chipPct = Math.max(pct, e.chipPct - 0.012);
    }
    return e.chipPct;
}

function bar(ctx, x, y, w, h, pct, color, chipPct = 0) {
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(10, 14, 22, 0.78)';
    ctx.fill();
    if (chipPct > pct) {
        roundRect(ctx, x, y, Math.max(h, w * Math.min(1, chipPct)), h, h / 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.fill();
    }
    if (pct > 0) {
        roundRect(ctx, x, y, Math.max(h, w * Math.min(1, pct)), h, h / 2);
        ctx.fillStyle = color;
        ctx.fill();
    }
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function drawNameAndBars(ctx, e, armor) {
    let offset = armor;
    if (e.abilityTimer > 0) {
        if (e.activeAbility === 'shield' || e.activeAbility === 'juggernaut') offset = Math.max(offset, 18);
        else if (['overdrive', 'sonic_boom', 'phase_strike', 'minigun'].includes(e.activeAbility)) offset = Math.max(offset, 12);
    }
    offset = Math.max(offset, auraReach(e));
    if (e.orbiters > 0) offset = Math.max(offset, 36);
    const half = e.type === 'square' ? e.size / 2 : e.size;

    if (settings.showNames && e.name) {
        ctx.save();
        ctx.font = 'bold 12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        const banner = bannerFor(e.equipped, e.name);
        const y = e.y - half - 16 - offset;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 3;
        if (banner?.badge === 'owner') {
            drawOwnerTag(ctx, e.x, y, e.name);
        } else {
            const text = banner ? `${banner.value} ${e.name}` : e.name;
            ctx.strokeText(text, e.x, y);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, e.x, y);
        }
        ctx.restore();
    }

    ctx.save();
    const w = 42;
    const x = e.x - w / 2;
    const y = e.y + half + 14 + offset;
    if (e.health < e.maxHealth || e.isPlayer) {
        const pct = Math.max(0, e.health / e.maxHealth);
        const color = pct > 0.5 ? '#00ffcc' : pct > 0.25 ? '#facc15' : '#ef4444';
        bar(ctx, x, y, w, 5, pct, color, healthChip(e, pct));
    }
    if (e.dashCooldown <= 0) bar(ctx, x, y + 7, w, 3, 1, e.points >= e.dashCost() ? '#ffe600' : '#6b7280');
    else bar(ctx, x, y + 7, w, 3, 1 - e.dashCooldown / e.dashMaxCooldown, '#e5e7eb');
    if (e.activeAbility) {
        if (e.abilityCooldown <= 0) bar(ctx, x, y + 12, w, 3, 1, '#ff4dff');
        else bar(ctx, x, y + 12, w, 3, 1 - e.abilityCooldown / e.abilityMaxCooldown, '#e5e7eb');
    }
    ctx.restore();
}
