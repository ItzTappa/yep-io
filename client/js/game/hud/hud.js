// In-match HUD: points bar, leaderboard, upgrade badges, spectator banner, notifications,
// kill feed, the "ELIMINATED" banner and the red screen edge when you get hit.
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
    $('kill-feed').innerHTML = '';
    setVisible($('kill-banner'), false);
    setLowHealth(false);
    $('hit-vignette').style.opacity = '0';
    for (const box of document.querySelectorAll('#notif-queue .notif-quest')) box.remove();
    applyHudSettings();
}

export function applyHudSettings() {
    $('leaderboard-container').style.display = settings.showLeaderboard ? 'block' : 'none';
    $('upgrade-badges').style.display = settings.showBadges ? 'flex' : 'none';
    $('minimap-container').style.display = settings.showMinimap ? 'block' : 'none';
    if (!settings.showFps) setVisible($('fps-display'), false);
}

export function updatePointsBar(points, progress, needed, kills = 0) {
    $('level-display').textContent = kills > 0 ? `${Math.floor(points)} PTS  ·  ${kills} ${kills === 1 ? 'KILL' : 'KILLS'}` : `${Math.floor(points)} PTS`;
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

// A finished quest or Bonus Goal: { kind: 'quest' | 'bonus', title, xp, itemId }
export function showQuestComplete(reward) {
    if (!settings.showNotifs) return;
    sounds.play('mastery_unlock', { category: 'alert', volume: 0.6 });
    const box = $('quest-notif-template').content.firstElementChild.cloneNode(true);
    box.querySelector('.notif-text').textContent = reward.kind === 'bonus' ? (reward.itemId ? 'BONUS REWARD UNLOCKED' : 'BONUS GOAL REACHED') : 'QUEST COMPLETE';
    box.querySelector('.quest-notif-title').textContent = reward.title;
    box.querySelector('.quest-notif-reward').textContent = reward.xp ? `+${reward.xp.toLocaleString('en-US')} XP` : 'In your Locker';
    $('notif-queue').appendChild(box);
    slideIn(box, 4500, { removeWhenDone: true });
}

// ---------- fights ----------

// One line in the kill feed. tone: 'you' | 'mate' | 'enemy' | 'storm'
export function addKillFeed({ killer, killerTone, victim, victimTone }) {
    const feed = $('kill-feed');
    const row = document.createElement('div');
    row.className = 'kf-row';
    const name = (text, tone) => {
        const span = document.createElement('span');
        span.className = `kf-name kf-${tone}`;
        span.textContent = text;
        return span;
    };
    const icon = document.createElement('span');
    icon.className = 'kf-icon';
    icon.textContent = '✖';
    if (killer) row.append(name(killer, killerTone), icon, name(victim, victimTone));
    else row.append(name(victim, victimTone), name('WAS ELIMINATED', 'note'));
    feed.prepend(row);
    while (feed.children.length > 4) feed.lastElementChild.remove();
    setTimeout(() => row.classList.add('fade'), 5000);
    setTimeout(() => row.remove(), 5600);
}

let killBannerTimer = null;
export function showKillBanner(victimName) {
    const banner = $('kill-banner');
    $('kill-banner-name').textContent = victimName;
    setVisible(banner, true);
    banner.classList.remove('pop');
    void banner.offsetWidth; // restart the animation
    banner.classList.add('pop');
    clearTimeout(killBannerTimer);
    killBannerTimer = setTimeout(() => setVisible(banner, false), 1800);
}

// Red flash at the screen edges when you take damage (fraction = share of your max health).
let lastHitFlash = 0;
export function flashHit(fraction) {
    const now = performance.now();
    if (now - lastHitFlash < 90) return;
    lastHitFlash = now;
    const el = $('hit-vignette');
    el.style.transition = 'none';
    el.style.opacity = String(Math.min(1, 0.45 + fraction * 4));
    void el.offsetWidth;
    el.style.transition = 'opacity 0.45s ease-out';
    el.style.opacity = '0';
}

export function setLowHealth(low) {
    const el = $('low-health-vignette');
    if (el.classList.contains('on') !== low) el.classList.toggle('on', low);
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
