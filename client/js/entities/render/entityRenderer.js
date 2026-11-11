// Draws a ship: trail, ability effects, armour, thrusters, guns, spikes, body, skin,
// orbiters, facing arrow, name and status bars.
// `preview: true` is for menu canvases (locker, store preview, lobby) and skips the in-game extras.
import { settings } from '../../core/settings.js';
import { getItem } from '../../data/items.js';
import { traceBody } from './shapes.js';
import { drawSkin } from './skins.js';
import { armorTierOf, bladeRingRadius, orbiterPositions, ORBITER_BLADE_RADIUS } from '../geometry.js';

export function drawEntity(ctx, e, { preview = false } = {}) {
    const hq = settings.highQuality;

    drawTrail(ctx, e, hq);

    const oldAlpha = ctx.globalAlpha;
    if (e.isCloaked) ctx.globalAlpha = 0.2;

    drawAbilityEffect(ctx, e);
    drawRegenAura(ctx, e);
    const armorOffset = drawArmor(ctx, e);
    drawThrusters(ctx, e, armorOffset);
    drawGuns(ctx, e, armorOffset);
    drawSpikes(ctx, e, armorOffset);
    drawBody(ctx, e, hq);

    const skin = getItem(e.equipped.Skin);
    if (skin) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle);
        drawSkin(ctx, e, skin.value, hq);
        ctx.restore();
    }

    ctx.globalAlpha = oldAlpha;
    if (preview) return;

    if (e.orbiters > 0 && !e.isCloaked) drawOrbiters(ctx, e, hq);
    if (e.isPlayer && e.frontVisual !== 'gun' && e.frontVisual !== 'spikes' && !e.isCloaked) {
        drawFacingArrow(ctx, e, armorOffset, hq);
    }
    if (!e.isCloaked) drawNameAndBars(ctx, e, armorOffset, hq);
}

function drawTrail(ctx, e, hq) {
    for (const t of e.trail) {
        ctx.save();
        ctx.translate(t.x, t.y);
        if (t.type === 'fire') {
            ctx.fillStyle = t.color;
            ctx.globalAlpha = Math.max(0, t.alpha);
            if (hq) {
                ctx.shadowBlur = 8;
                ctx.shadowColor = t.color;
            }
            ctx.beginPath();
            ctx.arc(0, 0, t.size, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // 'ghost' afterimages and 'smoke' puffs are copies of the ship shape.
            ctx.rotate(t.angle);
            if (t.type === 'smoke') {
                const scale = Math.max(0.1, (t.alpha / t.startAlpha) * (t.isDashing ? 1.5 : 1.0));
                ctx.scale(scale, scale);
            }
            ctx.fillStyle = t.color;
            ctx.globalAlpha = t.alpha;
            traceBody(ctx, e.type, e.size);
            ctx.fill();
        }
        ctx.restore();
    }
}

function drawAbilityEffect(ctx, e) {
    if (e.abilityTimer <= 0) return;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.beginPath();

    switch (e.activeAbility) {
        case 'shield':
            ctx.arc(0, 0, e.size + 15, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 150, 255, 0.3)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 200, 255, 0.8)';
            ctx.lineWidth = 3;
            ctx.stroke();
            break;
        case 'overdrive':
        case 'sonic_boom':
        case 'phase_strike':
        case 'minigun':
            ctx.arc(0, 0, e.size + 8, 0, Math.PI * 2);
            ctx.strokeStyle = e.activeAbility === 'minigun' ? 'rgba(255, 170, 0, 0.8)' : 'rgba(255, 50, 0, 0.8)';
            ctx.lineWidth = 4;
            ctx.setLineDash([10, 10]);
            ctx.lineDashOffset = Date.now() / 20;
            ctx.stroke();
            break;
        case 'repulsor':
            ctx.arc(0, 0, 250, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.lineDashOffset = -(Date.now() / 20);
            ctx.stroke();
            break;
        case 'juggernaut':
            ctx.arc(0, 0, e.size + 15, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.lineWidth = 6;
            ctx.stroke();
            break;
        case 'blade_ring': {
            const radius = bladeRingRadius(e);
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 40, 40, 0.35)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#ff3333';
            const spin = Date.now() / 120;
            for (let i = 0; i < 12; i++) {
                const a = spin + (i / 12) * Math.PI * 2;
                ctx.save();
                ctx.translate(Math.cos(a) * radius, Math.sin(a) * radius);
                ctx.rotate(a + Math.PI / 2);
                ctx.beginPath();
                ctx.moveTo(0, -10);
                ctx.lineTo(5, 6);
                ctx.lineTo(-5, 6);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
            break;
        }
    }
    ctx.restore();
}

function drawRegenAura(ctx, e) {
    if (e.auraVisual !== 'regen') return;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.beginPath();
    ctx.arc(0, 0, (e.type === 'square' ? e.size / 1.5 : e.size) + 15, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.4)';
    ctx.lineWidth = 3;
    ctx.setLineDash([15, 15]);
    ctx.lineDashOffset = -Date.now() / 30;
    ctx.stroke();
    ctx.restore();
}

// Returns how far the armour sticks out, so guns/thrusters/spikes sit on top of it.
function drawArmor(ctx, e) {
    if (e.bodyVisual !== 'armor') return 0;
    const tier = armorTierOf(e);
    const offset = 4 + tier;
    const thickness = 4 + tier * 1.5;

    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = thickness;
    ctx.beginPath();
    if (e.type === 'circle') {
        ctx.arc(0, 0, e.size + offset, 0, Math.PI * 2);
    } else if (e.type === 'square') {
        ctx.rect(-e.size / 2 - offset, -e.size / 2 - offset, e.size + offset * 2, e.size + offset * 2);
    } else {
        const S = e.size + offset + 2;
        ctx.moveTo(S, 0);
        ctx.lineTo(-S / 2, -S * 0.866);
        ctx.lineTo(-S / 2, S * 0.866);
        ctx.closePath();
    }
    ctx.stroke();
    ctx.restore();
    return offset + thickness / 2;
}

function drawThrusters(ctx, e, armorOffset) {
    if (e.rearVisual !== 'thrusters') return;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    const tier = Math.max(e.upgrades.speed || 0, e.upgrades.dash || 0);
    const tSize = 6 + tier * 3;
    const tLen = 8 + tier * 3;
    let back = e.type === 'circle' ? -e.size : -e.size / 2;
    if (e.bodyVisual === 'armor') back -= armorOffset;
    const spread = e.type === 'square' ? e.size * 0.35 : e.size * 0.45;
    ctx.fillStyle = '#444';
    ctx.fillRect(back - tLen + 2, -spread - tSize / 2, tLen, tSize);
    ctx.fillRect(back - tLen + 2, spread - tSize / 2, tLen, tSize);
    ctx.restore();
}

function drawGuns(ctx, e, armorOffset) {
    if (e.frontVisual !== 'gun') return;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    const guns = e.multiShot + 1;
    const tier = Math.max(e.upgrades.fireRate || 0, e.upgrades.damage || 0, e.upgrades.multiShot || 0);
    const len = 12 + tier * 4;
    const thick = 6 + tier * 2;
    const spread = 0.2;
    const start = -(spread * (guns - 1)) / 2;
    const base = (e.type === 'square' ? e.size / 2 : e.size * 0.8) + armorOffset - 6;
    for (let i = 0; i < guns; i++) {
        ctx.save();
        ctx.rotate(start + i * spread);
        ctx.translate(base, 0);
        ctx.fillStyle = '#555';
        ctx.fillRect(0, -thick / 2, len, thick);
        ctx.fillStyle = '#222';
        ctx.fillRect(len - 4, -thick / 2 + 1, 4, thick - 2);
        ctx.restore();
    }
    ctx.restore();
}

function drawSpikes(ctx, e, armorOffset) {
    if (e.spikes <= 0) return;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    ctx.fillStyle = '#ff4444';

    if (e.type === 'circle') {
        const count = 3 * e.spikes;
        const len = 8 + e.spikes * 2;
        const base = 4 + e.spikes;
        const r = e.size + armorOffset - 2;
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2;
            ctx.save();
            ctx.translate(Math.cos(a) * r, Math.sin(a) * r);
            ctx.rotate(a);
            ctx.beginPath();
            ctx.moveTo(-1.5, base);
            ctx.lineTo(-1.5, -base);
            ctx.lineTo(len, 0);
            ctx.fill();
            ctx.restore();
        }
    } else if (e.type === 'square') {
        const perSide = 3;
        const len = 6 + e.spikes * 2;
        const base = (e.size / perSide) * 0.5;
        const edge = e.size / 2 + armorOffset - 2;
        for (let side = 0; side < 4; side++) {
            for (let i = 0; i < perSide; i++) {
                const f = (i + 0.5) / perSide;
                let px, py, normal;
                if (side === 0) { px = edge; py = -e.size / 2 + f * e.size; normal = 0; }
                else if (side === 1) { px = e.size / 2 - f * e.size; py = edge; normal = Math.PI / 2; }
                else if (side === 2) { px = -edge; py = e.size / 2 - f * e.size; normal = Math.PI; }
                else { px = -e.size / 2 + f * e.size; py = -edge; normal = 3 * Math.PI / 2; }
                ctx.save();
                ctx.translate(px, py);
                ctx.rotate(normal);
                ctx.beginPath();
                ctx.moveTo(-1.5, base / 2);
                ctx.lineTo(-1.5, -base / 2);
                ctx.lineTo(len, 0);
                ctx.fill();
                ctx.restore();
            }
        }
    } else if (e.frontVisual === 'spikes') {
        // Triangles get a single ram spike on the nose.
        const S = e.size + armorOffset;
        ctx.beginPath();
        ctx.moveTo(S + 4 + e.spikes * 4, 0);
        ctx.lineTo(S * 0.3, -e.size * 0.4);
        ctx.lineTo(S * 0.3, e.size * 0.4);
        ctx.fill();
    }
    ctx.restore();
}

function drawBody(ctx, e, hq) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    ctx.fillStyle = e.color;
    ctx.shadowBlur = hq ? 15 : 0;
    if (hq) ctx.shadowColor = e.color;

    // Very dark colours get a white glow + outline so they stay visible on the dark arena.
    const isDark = e.color === '#111111' || e.color === '#000000';
    if (isDark) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffffff';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
    }
    traceBody(ctx, e.type, e.size);
    ctx.fill();
    if (e.color === '#111111') ctx.stroke();
    ctx.restore();
}

function drawOrbiters(ctx, e, hq) {
    ctx.save();
    ctx.fillStyle = '#a855f7';
    if (hq) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#a855f7';
    }
    const selfSpin = (Date.now() / 80) * e.overclock;
    const swayX = Math.max(-3, Math.min(3, -e.vx * 0.3));
    const swayY = Math.max(-3, Math.min(3, -e.vy * 0.3));
    const teeth = 8;
    for (const pos of orbiterPositions(e)) {
        ctx.save();
        ctx.translate(pos.x + swayX, pos.y + swayY);
        ctx.rotate(selfSpin);
        ctx.beginPath();
        for (let j = 0; j < teeth * 2; j++) {
            const r = j % 2 === 0 ? ORBITER_BLADE_RADIUS : 5;
            const a = (j / (teeth * 2)) * Math.PI * 2;
            if (j === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
            else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#a855f7';
        if (hq) ctx.shadowBlur = 10;
        ctx.restore();
    }
    ctx.restore();
}

// The floating arrow in front of your own ship (until you have a gun or ram spike).
function drawFacingArrow(ctx, e, armorOffset, hq) {
    const bob = Math.sin(Date.now() / 300) * 1.5;
    const localVx = e.vx * Math.cos(-e.angle) - e.vy * Math.sin(-e.angle);
    const localVy = e.vx * Math.sin(-e.angle) + e.vy * Math.cos(-e.angle);
    const swayX = Math.max(-3, Math.min(3, -localVx * 0.3));
    const swayY = Math.max(-3, Math.min(3, -localVy * 0.3));

    let extra = 0;
    if (e.abilityTimer > 0) {
        if (e.activeAbility === 'shield') extra = 18;
        else if (e.activeAbility === 'overdrive' || e.activeAbility === 'sonic_boom') extra = 10;
        else if (e.activeAbility === 'juggernaut') extra = 15;
    }
    if (e.auraVisual === 'regen') extra = Math.max(extra, 15);

    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    const offset = (e.type === 'square' ? e.size / 2 : e.size) + armorOffset + extra + 12 + bob;
    ctx.translate(swayX, swayY);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    if (hq) {
        ctx.shadowBlur = 5;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    }
    ctx.beginPath();
    ctx.moveTo(offset, -6);
    ctx.lineTo(offset + 12, 0);
    ctx.lineTo(offset, 6);
    ctx.fill();
    ctx.restore();
}

function drawNameAndBars(ctx, e, armorOffset, hq) {
    let offset = armorOffset;
    if (e.abilityTimer > 0) {
        if (e.activeAbility === 'shield' || e.activeAbility === 'juggernaut') offset = Math.max(offset, 20);
        else if (['overdrive', 'sonic_boom', 'phase_strike', 'minigun'].includes(e.activeAbility)) offset = Math.max(offset, 12);
    }
    if (e.auraVisual === 'regen') offset = Math.max(offset, 18);
    if (e.orbiters > 0) offset = Math.max(offset, 38);

    if (settings.showNames && e.name) {
        ctx.save();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        if (hq) {
            ctx.shadowBlur = 2;
            ctx.shadowColor = 'black';
        }
        const banner = getItem(e.equipped.Banner);
        ctx.fillText(banner ? `${banner.value} ${e.name}` : e.name, e.x, e.y - e.size - 20 - offset);
        ctx.restore();
    }

    const barX = e.x - 20;
    const barY = e.y + e.size + 15 + offset;

    if (e.health < e.maxHealth || e.isPlayer) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.fillRect(barX, barY, 40, 5);
        ctx.fillStyle = '#00ffcc';
        ctx.fillRect(barX, barY, 40 * Math.max(0, Math.min(1, e.health / e.maxHealth)), 5);
    }

    // Dash bar: yellow = ready, grey = not enough points, white = recharging.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(barX, barY + 7, 40, 3);
    if (e.dashCooldown <= 0) {
        ctx.fillStyle = e.points >= e.dashCost() ? '#ffe600' : '#888888';
        ctx.fillRect(barX, barY + 7, 40, 3);
    } else {
        ctx.fillStyle = '#ffffff';
        const pct = Math.max(0, 1 - e.dashCooldown / e.dashMaxCooldown);
        ctx.fillRect(barX, barY + 7, Math.min(40 * pct, 38), 3);
    }

    // Ability bar: magenta = ready.
    if (e.activeAbility) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(barX, barY + 13, 40, 3);
        if (e.abilityCooldown <= 0) {
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(barX, barY + 13, 40, 3);
        } else {
            ctx.fillStyle = '#ffffff';
            const pct = Math.max(0, 1 - e.abilityCooldown / e.abilityMaxCooldown);
            ctx.fillRect(barX, barY + 13, Math.min(40 * pct, 38), 3);
        }
    }
}
