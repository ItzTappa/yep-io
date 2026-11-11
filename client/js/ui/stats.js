// The Stats tab: career totals and the last 24 hours of matches (click a match for its upgrades).
import { $, escapeHtml } from '../core/dom.js';
import { state } from '../core/state.js';
import { on } from '../core/events.js';
import { formatDuration, ordinal } from '../core/math.js';
import { pruneHistory } from '../services/profile.js';
import { upgradeBadgesHtml } from '../game/hud/hud.js';
import { isAbility } from '../data/upgrades.js';

export function initStats() {
    $('match-history-list').addEventListener('click', (e) => {
        const card = e.target instanceof Element ? e.target.closest('.match-card') : null;
        if (card) card.classList.toggle('expanded');
    });
    on('profile:changed', renderStats);
    on('tab:changed', (tab) => { if (tab === 'stats') renderStats(); });
    renderStats();
}

function renderStats() {
    const { stats, level } = state.profile;
    $('stat-account-level').textContent = level;
    $('stat-matches').textContent = stats.matches || 0;
    $('stat-kills').textContent = stats.kills || 0;
    $('stat-points').textContent = Math.floor(stats.points || 0);
    $('stat-time').textContent = formatDuration(stats.time || 0);

    pruneHistory();
    const list = $('match-history-list');
    if (state.profile.history.length === 0) {
        list.innerHTML = '<p class="empty-history">Play a match to see your history!</p>';
        return;
    }
    list.innerHTML = state.profile.history.map(matchCard).join('');
}

function matchCard(match) {
    const rank = Number(match.rank) || null;
    const rankColor = match.result === 'victory' || rank === 1 ? '#ffe600' : rank && rank <= 5 ? '#00ffcc' : '#a0a0a0';
    const cls = match.playerClass ? match.playerClass.charAt(0).toUpperCase() + match.playerClass.slice(1) : 'Unknown';

    const upgrades = match.upgrades || {};
    const ability = Object.keys(upgrades).find(id => upgrades[id] > 0 && isAbility(id)) || null;
    const badges = upgradeBadgesHtml(upgrades, ability);

    return `
        <div class="match-card" style="border-left-color: ${rankColor};">
            <div class="match-card-main">
                <div class="match-detail-item">
                    <span class="match-detail-label">RANK</span>
                    <div class="match-rank" style="color: ${rankColor};">${rank ? ordinal(rank) : '?'}</div>
                </div>
                <div class="match-detail-item">
                    <span class="match-detail-label">CLASS</span>
                    <span class="match-detail-val class-name">${escapeHtml(cls)}</span>
                </div>
                <div class="match-detail-item">
                    <span class="match-detail-label">KILLS</span>
                    <span class="match-detail-val">${Number(match.kills) || 0}</span>
                </div>
                <div class="match-detail-item">
                    <span class="match-detail-label">POINTS</span>
                    <span class="match-detail-val">${Math.floor(match.points || 0)}</span>
                </div>
                <div class="match-detail-item">
                    <span class="match-detail-label">TIME ALIVE</span>
                    <span class="match-detail-val">${formatDuration(match.time || 0)}</span>
                </div>
            </div>
            <div class="match-upgrades">
                ${badges || '<span class="no-upgrades">No upgrades acquired.</span>'}
            </div>
        </div>`;
}
