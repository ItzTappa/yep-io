// The minimap (top right) and the "ALIVE: N" counter under it. Enemies are small red dots (that
// fade out when they die), teammates cyan, you yellow; slot machines flash.
import { $, setupHiDpiCanvas } from '../../core/dom.js';

const SIZE = 220;
const ENEMY_DOT = 1.2;
const GHOST_FADE_MS = 700;

export function drawMinimap(engine) {
    const canvas = $('minimap-canvas');
    const ctx = setupHiDpiCanvas(canvas, SIZE, SIZE);
    ctx.clearRect(0, 0, SIZE, SIZE);
    const scale = SIZE / engine.worldSize;
    const dot = (x, y, color, r) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x * scale, y * scale, r, 0, Math.PI * 2);
        ctx.fill();
    };

    for (const zone of engine.safeZones) {
        const active = zone.state === 'active';
        ctx.fillStyle = active ? 'rgba(0, 255, 204, 0.4)' : 'rgba(0, 255, 204, 0.15)';
        ctx.beginPath();
        ctx.arc(zone.x * scale, zone.y * scale, zone.radius * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = active ? 'rgba(0, 255, 204, 0.8)' : 'rgba(0, 255, 204, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    const storm = engine.storm;
    if (storm.active) {
        ctx.fillStyle = 'rgba(138, 43, 226, 0.4)';
        ctx.beginPath();
        ctx.rect(0, 0, SIZE, SIZE);
        ctx.arc(storm.x * scale, storm.y * scale, storm.radius * scale, 0, Math.PI * 2, true);
        ctx.fill();
        ctx.strokeStyle = '#8a2be2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(storm.x * scale, storm.y * scale, storm.radius * scale, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, SIZE, SIZE);

    const p = engine.player;
    let alive = p && !p.isDead ? 1 : 0;
    for (const ship of [...engine.bots, ...engine.remotes]) {
        if (ship.isDead) continue;
        alive++;
        if (ship.isTeammate) dot(ship.x, ship.y, '#00ffcc', 3);
        else dot(ship.x, ship.y, '#ff4444', ENEMY_DOT);
    }

    const now = performance.now();
    engine.minimapGhosts = engine.minimapGhosts.filter(g => now - g.at < GHOST_FADE_MS);
    for (const ghost of engine.minimapGhosts) {
        ctx.globalAlpha = 1 - (now - ghost.at) / GHOST_FADE_MS;
        dot(ghost.x, ghost.y, '#ff4444', ENEMY_DOT);
    }
    ctx.globalAlpha = 1;

    const flash = Math.floor(Date.now() / 250) % 2 === 0 ? '#ffe600' : '#ff00ff';
    for (const machine of engine.slotMachines) {
        dot(machine.x, machine.y, flash, 5);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    if (p && !p.isDead) {
        dot(p.x, p.y, '#ffe600', 4);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        const viewW = (engine.width / engine.camera.zoom) * scale;
        const viewH = (engine.height / engine.camera.zoom) * scale;
        ctx.strokeRect(engine.camera.x * scale - viewW / 2, engine.camera.y * scale - viewH / 2, viewW, viewH);
    } else if (engine.spectateTarget && !engine.spectateTarget.isDead && engine.spectateTarget.x !== undefined) {
        dot(engine.spectateTarget.x, engine.spectateTarget.y, '#0096ff', 4);
    }

    const count = $('player-count-display');
    count.style.display = engine.isMultiplayer ? 'block' : 'none';
    if (engine.isMultiplayer) count.textContent = `ALIVE: ${alive}`;
}
