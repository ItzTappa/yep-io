// In-match HUD: points bar, leaderboard, upgrade badges, spectator banner, notifications.
import { $, escapeHtml, setVisible, slideIn } from '../../core/dom.js';
import { settings } from '../../core/settings.js';
import { sounds } from '../../core/sound.js';
import { getUpgrade, abilityName } from '../../data/upgrades.js';
import { formatPoints } from '../../core/math.js';

export function resetHud() {
    setVisible($('upgrade-ui'), false);
    setVisible($('spectator-hud'), false);
    setVisible($('safezone-indicator'), false);
    setVisible($('game-over-screen'), false);
    $('xp-bar').style.width = '0%';
    $('level-display').textContent = '0 PTS';
    $('upgrade-badges').innerHTML = '';
    $('leaderboard-list').innerHTML = '';
    applyHudSettings();
}

export function applyHudSettings() {
    $('leaderboard-container').style.display = settings.showLeaderboard ? 'block' : 'none';
    $('upgrade-badges').style.display = settings.showBadges ? 'flex' : 'none';
    $('minimap-container').style.display = settings.showMinimap ? 'block' : 'none';
    if (!settings.showFps) setVisible($('fps-display'), false);
}

export function updatePointsBar(points, progress, needed) {
    $('level-display').textContent = `${Math.floor(points)} PTS`;
    $('xp-bar').style.width = Math.min(100, (progress / needed) * 100) + '%';
}

export function flashPointsBar() {
    const bar = document.querySelector('.xp-bar-container');
    bar.classList.add('level-up-flash');
    setTimeout(() => bar.classList.remove('level-up-flash'), 500);
}

export function showUpgradeReadyNotif() {
    if (!settings.showNotifs) return;
    sounds.play('upgrade_ready', { category: 'alert' });
    const box = $('level-up-notif');
    box.hideNotif?.();
    slideIn(box, 3000);
}

export function showAccountLevelNotif(level) {
    if (!settings.showNotifs) return;
    sounds.play('level_up', { category: 'alert', volume: 0.8 });
    $('account-notif-level-num').textContent = level;
    const box = $('account-level-notif');
    box.hideNotif?.();
    slideIn(box, 4000);
}

// rows: [{ name, points, highlight }] already sorted, best first.
export function renderLeaderboard(rows) {
    if (!settings.showLeaderboard) return;
    const list = $('leaderboard-list');
    const limit = window.innerWidth <= 768 ? 5 : 10;
    list.replaceChildren(...rows.slice(0, limit).map((row, i) => {
        const li = document.createElement('li');
        li.textContent = `#${i + 1} ${row.name} - ${formatPoints(row.points)} Pts`;
        if (row.highlight) li.style.color = '#00ffcc';
        return li;
    }));
}

const tierClass = (tier) => `badge-t${Math.min(5, Math.max(1, tier))}`;

// Badge markup shared by the HUD and the match history cards.
export function upgradeBadgesHtml(upgrades, activeAbility, { abilityLabel = 'ACTIVE' } = {}) {
    let html = '';
    if (activeAbility) {
        html += `
            <div class="upgrade-badge ability-badge" title="Active Ability">
                <div class="badge-name">⭐ ${escapeHtml(abilityName(activeAbility).toUpperCase())}</div>
                <div class="badge-tier">${escapeHtml(abilityLabel)}</div>
            </div>`;
    }
    for (const id in upgrades) {
        const def = getUpgrade(id);
        const tier = upgrades[id];
        if (!tier || def?.isActiveAbility) continue;
        const title = (def ? def.title : id).toUpperCase();
        html += `
            <div class="upgrade-badge ${tierClass(tier)}" title="${escapeHtml(def ? def.title : '')}">
                <div class="badge-name">${escapeHtml(title)}</div>
                <div class="badge-tier">T${tier}</div>
            </div>`;
    }
    return html;
}

export function renderUpgradeBadges(player, isTouchDevice) {
    const box = $('upgrade-badges');
    if (!settings.showBadges || !player) {
        box.style.display = 'none';
        return;
    }
    box.style.display = 'flex';
    box.innerHTML = upgradeBadgesHtml(player.upgrades, player.activeAbility, {
        abilityLabel: isTouchDevice ? 'TAP ABILITY' : `[${settings.keybinds.ability.toUpperCase()}] TO USE`
    });
}

export function setSpectating(name) {
    setVisible($('spectator-hud'), !!name);
    if (name) $('spectating-name').textContent = name;
}

export function setSafeZoneIndicator(visible) {
    const el = $('safezone-indicator');
    if (el.classList.contains('hidden') === visible) setVisible(el, visible);
}

export function setFps(fps) {
    const el = $('fps-display');
    setVisible(el, fps !== null);
    if (fps !== null) el.textContent = `${fps} FPS`;
}

let matchToastTimer = null;
export function showMatchToast(text, ms = 2500) {
    const el = $('match-toast');
    el.textContent = text;
    setVisible(el, true);
    clearTimeout(matchToastTimer);
    matchToastTimer = setTimeout(() => setVisible(el, false), ms);
}

export function hideMatchToast() {
    clearTimeout(matchToastTimer);
    setVisible($('match-toast'), false);
}
