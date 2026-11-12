// Draws the arena: background grid, map border, storm, safe zones, pickups and ships.
// Anything off-screen is skipped, which keeps big maps (3000+ orbs) smooth.
import { settings } from '../../core/settings.js';

const CULL_MARGIN = 150;

export function drawWorld(engine) {
    const ctx = engine.ctx;
    const { width, height, camera } = engine;
    const zoom = camera.zoom;

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);
    ctx.save();

    let camX = width / 2 - camera.x * zoom;
    let camY = height / 2 - camera.y * zoom;
    if (camera.shake > 0) {
        camX += (Math.random() - 0.5) * camera.shake;
        camY += (Math.random() - 0.5) * camera.shake;
    }
    ctx.translate(camX, camY);
    ctx.scale(zoom, zoom);

    const view = {
        left: camera.x - width / 2 / zoom - CULL_MARGIN,
        right: camera.x + width / 2 / zoom + CULL_MARGIN,
        top: camera.y - height / 2 / zoom - CULL_MARGIN,
        bottom: camera.y + height / 2 / zoom + CULL_MARGIN
    };
    const visible = (x, y, r = 0) => x + r > view.left && x - r < view.right && y + r > view.top && y - r < view.bottom;

    drawBorder(ctx, engine.worldSize);
    if (engine.storm.active) drawStorm(ctx, engine);
    drawGrid(ctx, engine);

    for (const zone of engine.safeZones) if (visible(zone.x, zone.y, zone.radius + 60)) zone.draw(ctx);
    for (const machine of engine.slotMachines) if (visible(machine.x, machine.y, 60)) machine.draw(ctx);
    for (const orb of engine.orbs) if (visible(orb.x, orb.y, orb.size)) orb.draw(ctx);
    for (const p of engine.particles) if (visible(p.x, p.y, p.size)) p.draw(ctx);
    for (const proj of engine.projectiles) if (visible(proj.x, proj.y, 40)) proj.draw(ctx);
    for (const bot of engine.bots) if (!bot.isDead && visible(bot.x, bot.y, 300)) bot.draw(ctx);
    for (const r of engine.remotes) if (!r.isDead && visible(r.x, r.y, 300)) r.draw(ctx);
    if (!engine.isDemo && engine.player && !engine.player.isDead) engine.player.draw(ctx);
    engine.admin?.draw(ctx, engine);
    if (settings.damageNumbers && !engine.isDemo) engine.damageNumbers.draw(ctx);

    ctx.restore();
}

function drawBorder(ctx, size) {
    ctx.save();
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 8;
    if (settings.highQuality) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00ffff';
    }
    ctx.strokeRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([30, 30]);
    ctx.lineDashOffset = -(Date.now() / 20) % 60;
    ctx.strokeRect(0, 0, size, size);
    ctx.restore();

    // Tint everything outside the arena.
    ctx.fillStyle = 'rgba(0, 20, 30, 0.6)';
    ctx.fillRect(-10000, -10000, size + 20000, 10000);
    ctx.fillRect(-10000, size, size + 20000, 10000);
    ctx.fillRect(-10000, 0, 10000, size);
    ctx.fillRect(size, 0, 10000, size);
}

function drawStorm(ctx, engine) {
    const storm = engine.storm;
    const size = engine.worldSize;
    ctx.save();
    ctx.fillStyle = 'rgba(138, 43, 226, 0.25)';
    ctx.beginPath();
    ctx.rect(-5000, -5000, size + 10000, size + 10000);
    ctx.arc(storm.x, storm.y, storm.radius, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.strokeStyle = '#8a2be2';
    ctx.lineWidth = 15;
    if (settings.highQuality) {
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#8a2be2';
    }
    ctx.beginPath();
    ctx.arc(storm.x, storm.y, storm.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function drawGrid(ctx, engine) {
    const { width, height, camera } = engine;
    const gridSize = 100;
    const startX = Math.floor(camera.x - width / camera.zoom / 2);
    const startY = Math.floor(camera.y - height / camera.zoom / 2);
    const endX = startX + width / camera.zoom + gridSize;
    const endY = startY + height / camera.zoom + gridSize;

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX - (startX % gridSize); x < endX; x += gridSize) {
        ctx.moveTo(x, startY - gridSize);
        ctx.lineTo(x, endY);
    }
    for (let y = startY - (startY % gridSize); y < endY; y += gridSize) {
        ctx.moveTo(startX - gridSize, y);
        ctx.lineTo(endX, y);
    }
    ctx.stroke();
}
