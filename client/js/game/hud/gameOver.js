// The end-of-match screen.
import { $, setVisible, escapeHtml } from '../../core/dom.js';
import { ordinal, formatShortDuration } from '../../core/math.js';

const TITLES = {
    victory: { text: 'VICTORY!', color: '#ffe600' },
    defeat: { text: 'DEFEAT', color: 'red' },
    eliminated: { text: 'MATCH OVER', color: 'red' }
};

// quests: what you finished this match ({ kind, title, xp, itemId }, see services/quests.js).
export function showGameOver(summary, quests = []) {
    const title = TITLES[summary.result] || TITLES.eliminated;
    const heading = $('go-title-text');
    heading.textContent = title.text;
    heading.style.color = title.color;
    heading.style.textShadow = `0 0 20px ${title.color}`;

    $('go-placement').textContent = ordinal(summary.placement);
    $('go-points').textContent = Math.floor(summary.points);
    $('go-kills').textContent = summary.kills;
    $('go-time').textContent = formatShortDuration(summary.time);
    $('go-xp').textContent = `+${summary.xpEarned}`;

    const list = $('go-quests');
    list.innerHTML = quests.map(q => `
        <div class="go-quest">
            <span class="go-quest-check">✔</span>
            <span class="go-quest-title">${q.kind === 'bonus' ? 'BONUS: ' : ''}${escapeHtml(q.title)}</span>
            <span class="go-quest-reward">${q.xp ? `+${q.xp.toLocaleString('en-US')} XP` : 'NEW ITEM'}</span>
        </div>`).join('');
    setVisible(list, quests.length > 0);
    setVisible($('game-over-screen'), true);
}

export function hideGameOver() {
    setVisible($('game-over-screen'), false);
}
