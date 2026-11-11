// The end-of-match screen.
import { $, setVisible } from '../../core/dom.js';
import { ordinal, formatShortDuration } from '../../core/math.js';

const TITLES = {
    victory: { text: 'VICTORY!', color: '#ffe600' },
    defeat: { text: 'DEFEAT', color: 'red' },
    eliminated: { text: 'MATCH OVER', color: 'red' }
};

export function showGameOver(summary) {
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
    setVisible($('game-over-screen'), true);
}

export function hideGameOver() {
    setVisible($('game-over-screen'), false);
}
