// The Quests tab: daily and weekly quests, the weekly Bonus Goals track, and each class's
// mastery progress. Pick a category on the left; click a quest or a Bonus Goal to see its reward
// in the preview on the right (empty until you pick something).
import { $, escapeHtml, setVisible } from '../core/dom.js';
import { state } from '../core/state.js';
import { on } from '../core/events.js';
import { CLASS_TYPES, CLASS_INFO } from '../data/classes.js';
import { getItem, itemColor, masterySkinId, MASTERY_KILLS, RARITY_NAMES } from '../data/items.js';
import {
    dailyQuests, weeklyQuests, bonusGoals, msUntilDailyReset, msUntilWeeklyReset
} from '../services/quests.js';
import { isClaimed, toggleEquip, claimAndEquipMastery } from '../services/profile.js';
import { sounds } from '../core/sound.js';
import { itemIconHtml, thumbnailUrl } from './itemThumbnails.js';
import { setQuestPreview } from './previews.js';
import { activeTab, chooseClass } from './menu.js';

const CATEGORIES = [
    { id: 'daily', label: 'DAILY', icon: '☀️' },
    { id: 'weekly', label: 'WEEKLY', icon: '📅' },
    ...CLASS_TYPES.map(type => ({ id: `mastery:${type}`, label: `${CLASS_INFO[type].name.toUpperCase()} MASTERY`, classType: type }))
];

let category = 'daily';
let selectedKey = null;   // what's in the preview: 'q:<quest id>', 'b:<goal index>' or 'm:<class>'
let entries = new Map();  // key -> { reward, kind, title, ... } for the page on screen

export function initQuests() {
    $('quests').addEventListener('click', (e) => {
        const target = e.target instanceof Element ? e.target : null;
        const cat = target?.closest('.quest-cat');
        const pick = target?.closest('[data-select]');
        if (cat) {
            category = cat.dataset.category;
            selectedKey = null;
            renderQuests();
        } else if (target?.closest('#quest-preview-btn')) {
            previewAction();
        } else if (target?.closest('#quest-preview-close')) {
            selectedKey = null;
            renderQuests();
        } else if (pick) {
            // Click again to clear the preview.
            selectedKey = selectedKey === pick.dataset.select ? null : pick.dataset.select;
            renderQuests();
        }
    });
    on('profile:changed', () => { if (activeTab() === 'quests') renderQuests(); });
    on('class:changed', () => { if (activeTab() === 'quests') renderQuests(); });
    on('tab:changed', (tab) => { if (tab === 'quests') renderQuests(); });
    setInterval(() => { if (activeTab() === 'quests') renderTimer(); }, 1000);
}

// ---------- helpers ----------

function formatCountdown(ms) {
    const mins = Math.max(0, Math.floor(ms / 60000));
    const d = Math.floor(mins / 1440);
    const h = Math.floor((mins % 1440) / 60);
    const m = mins % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${Math.max(0, Math.floor(ms / 1000) % 60)}s`;
}

const xpText = (xp) => `${Number(xp).toLocaleString('en-US')} XP`;

function xpChip(xp, extraClass = '') {
    return `<div class="reward-chip xp ${extraClass}" title="${xpText(xp)}"><span class="xp-mark">XP</span><span class="xp-amount">${xp >= 1000 ? `${+(xp / 1000).toFixed(1)}k` : xp}</span></div>`;
}

function itemChip(itemId, extraClass = '') {
    const item = getItem(itemId);
    if (!item) return '';
    return `<div class="reward-chip item ${extraClass}" style="--rarity-color: ${itemColor(item)};" title="${escapeHtml(item.name)}">${itemIconHtml(item)}</div>`;
}

const rewardChip = (reward, extraClass) => (reward.type === 'item' ? itemChip(reward.itemId, extraClass) : xpChip(reward.xp, extraClass));

function masteryInfo(classType) {
    const kills = state.profile.classStats[classType]?.kills || 0;
    const matches = state.profile.classStats[classType]?.matches || 0;
    const skinId = masterySkinId(classType);
    return { kills, matches, skinId, unlocked: kills >= MASTERY_KILLS, claimed: isClaimed(skinId) };
}

// ---------- rendering ----------

function renderQuests() {
    const daily = dailyQuests();
    const weekly = weeklyQuests();
    const bonus = bonusGoals();
    entries = new Map();
    renderSidebar(daily, weekly);

    const cat = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];
    if (cat.classType) renderMastery(cat.classType);
    else renderQuestPage(cat.id === 'daily' ? daily : weekly, bonus);
    renderTimer();
    renderPreview();
}

function renderSidebar(daily, weekly) {
    const countDone = (list) => list.filter(q => q.done).length;
    $('quest-categories').innerHTML = CATEGORIES.map(cat => {
        let sub;
        let complete = false;
        let icon = `<span class="quest-cat-emoji">${cat.icon || ''}</span>`;
        if (cat.classType) {
            const m = masteryInfo(cat.classType);
            complete = m.unlocked;
            sub = complete ? 'MASTERED' : `${m.kills} / ${MASTERY_KILLS} KILLS`;
            icon = `<img src="${thumbnailUrl(m.skinId, cat.classType)}" alt="" draggable="false">`;
        } else {
            const list = cat.id === 'daily' ? daily : weekly;
            complete = countDone(list) === list.length;
            sub = `${countDone(list)} / ${list.length} DONE`;
        }
        return `
            <button class="quest-cat ${cat.id === category ? 'active' : ''} ${complete ? 'complete' : ''}" data-category="${cat.id}">
                <span class="quest-cat-icon">${icon}</span>
                <span class="quest-cat-text">
                    <span class="quest-cat-label">${cat.label}</span>
                    <span class="quest-cat-sub">${complete ? '✔ ' : ''}${sub}</span>
                </span>
            </button>`;
    }).join('');
}

function renderHeader(kicker, title, desc) {
    $('quest-kicker').textContent = kicker;
    $('quest-title').textContent = title;
    $('quest-desc').textContent = desc;
}

const progressText = (progress, target, stat) => (stat === 'time'
    ? `${Math.floor(progress / 60)} / ${target / 60} MIN`
    : `${progress.toLocaleString('en-US')} / ${target.toLocaleString('en-US')}`);

function questRow(key, { title, progress, target, done, reward, stat }) {
    const pct = Math.min(100, (progress / target) * 100);
    const count = progressText(progress, target, stat);
    entries.set(key, { kind: key.startsWith('m:') ? 'mastery' : 'quest', reward, title, done, count });
    return `
        <div class="quest-row ${done ? 'done' : ''} ${selectedKey === key ? 'selected' : ''}" data-select="${key}">
            <div class="quest-row-main">
                <div class="quest-name">${escapeHtml(title)}</div>
                <div class="quest-progress">
                    <div class="quest-bar"><div class="quest-bar-fill" style="width: ${pct}%;"></div></div>
                    <div class="quest-count">${count}</div>
                </div>
            </div>
            ${rewardChip(reward)}
            ${done ? '<div class="quest-check">✔</div>' : ''}
        </div>`;
}

function renderQuestPage(list, bonus) {
    const daily = category === 'daily';
    renderHeader(
        daily ? 'NEW EVERY DAY' : 'ALL WEEK',
        daily ? 'DAILY QUESTS' : 'WEEKLY QUESTS',
        daily ? 'Finished quests give XP right away and count toward this week\'s Bonus Goals.'
              : 'Bigger quests that last all week. They count toward the Bonus Goals too.'
    );
    const prevAt = (i) => (i === 0 ? 0 : bonus.goals[i - 1].at);
    $('quest-bonus').innerHTML = `
        <div class="bonus-card">
            <div class="bonus-head">
                <div>
                    <h3 class="bonus-title">BONUS GOALS</h3>
                    <div class="bonus-sub">Finish quests this week: ${Math.min(bonus.count, bonus.max)} / ${bonus.max}</div>
                </div>
                ${daily ? `<div class="bonus-ends">Ends in <span id="bonus-timer">${formatCountdown(msUntilWeeklyReset())}</span></div>` : ''}
            </div>
            <div class="bonus-goals" style="--goals: ${bonus.goals.length};">
                ${bonus.goals.map((goal, i) => {
                    const fill = Math.max(0, Math.min(1, (bonus.count - prevAt(i)) / (goal.at - prevAt(i))));
                    const key = `b:${i}`;
                    entries.set(key, { kind: 'bonus', reward: goal.reward, at: goal.at, reached: goal.reached });
                    return `
                        <div class="bonus-goal ${goal.reached ? 'reached' : ''} ${selectedKey === key ? 'selected' : ''}">
                            <div class="bonus-tile" data-select="${key}">${rewardChip(goal.reward, 'big')}${goal.reached ? '<span class="tile-check">✔</span>' : ''}</div>
                            <div class="bonus-track">
                                <div class="bonus-seg"><div class="bonus-seg-fill" style="width: ${fill * 100}%;"></div></div>
                                <div class="bonus-num">${goal.at}</div>
                            </div>
                        </div>`;
                }).join('')}
            </div>
        </div>`;

    $('quest-list').innerHTML = list.map(q => questRow(`q:${q.id}`, {
        title: q.title, progress: q.progress, target: q.target, done: q.done, stat: q.stat, reward: { type: 'xp', xp: q.xp }
    })).join('');
}

function renderMastery(classType) {
    const name = CLASS_INFO[classType].name;
    const m = masteryInfo(classType);
    renderHeader('CLASS MASTERY', `${name.toUpperCase()} MASTERY`,
        `Get ${MASTERY_KILLS} kills with the ${name} to master it and unlock the Golden ${name} skin.`);
    $('quest-bonus').innerHTML = `
        <div class="mastery-strip">
            <div class="mastery-stat"><span>KILLS AS ${name.toUpperCase()}</span><b>${m.kills}</b></div>
            <div class="mastery-stat"><span>MATCHES AS ${name.toUpperCase()}</span><b>${m.matches}</b></div>
        </div>`;
    $('quest-list').innerHTML = questRow(`m:${classType}`, {
        title: `Get ${MASTERY_KILLS} kills as a ${name}`,
        progress: Math.min(m.kills, MASTERY_KILLS), target: MASTERY_KILLS, done: m.unlocked,
        reward: { type: 'item', itemId: m.skinId }
    });
}

function renderTimer() {
    const daily = category === 'daily';
    const mastery = category.startsWith('mastery:');
    const el = $('quest-timer');
    setVisible(el, !mastery);
    if (!mastery) el.textContent = daily ? `New quests in ${formatCountdown(msUntilDailyReset())}` : `Ends in ${formatCountdown(msUntilWeeklyReset())}`;
    const bonusTimer = $('bonus-timer');
    if (bonusTimer) bonusTimer.textContent = formatCountdown(msUntilWeeklyReset());
}

// ---------- preview panel ----------

function renderPreview() {
    const entry = entries.get(selectedKey) || null;
    if (!entry) selectedKey = null;
    const panel = $('quest-preview');
    setVisible(panel, !!entry);
    if (!entry) {
        setQuestPreview(null);
        return;
    }
    const btn = $('quest-preview-btn');
    const status = $('quest-preview-status');
    const reward = entry.reward;
    const item = reward.type === 'item' ? getItem(reward.itemId) : null;
    panel.style.setProperty('--rarity-color', item ? itemColor(item) : 'var(--accent)');

    const showShip = !!item && item.category !== 'Banner';
    setQuestPreview(showShip ? item.id : null);
    setVisible($('questPreviewCanvas'), showShip);
    const emoji = $('quest-preview-emoji');
    setVisible(emoji, !showShip);
    emoji.innerHTML = item ? escapeHtml(item.icon) : '<span class="xp-mark big">XP</span>';

    if (!item) {
        $('quest-preview-rarity').textContent = entry.kind === 'bonus' ? 'BONUS GOAL REWARD' : 'QUEST REWARD';
        $('quest-preview-name').textContent = `+${xpText(reward.xp)}`;
        if (entry.kind === 'bonus') status.textContent = entry.reached ? '✔ Reached' : `Finish ${entry.at} quests this week`;
        else status.textContent = entry.done ? `✔ ${entry.title}` : `${entry.title} · ${entry.count}`;
        setVisible(btn, false);
        return;
    }
    $('quest-preview-rarity').textContent = `${RARITY_NAMES[item.rarity] || ''} ${item.category}`.toUpperCase();
    $('quest-preview-name').textContent = item.name;

    const owned = isClaimed(item.id);
    const equipped = state.profile.equipped[item.category] === item.id;
    btn.disabled = false;
    btn.classList.toggle('equipped', owned && equipped);

    if (item.masteryClass) {
        const m = masteryInfo(item.masteryClass);
        const name = CLASS_INFO[item.masteryClass].name;
        status.textContent = m.unlocked ? (owned ? 'Mastery reward' : 'Mastered! Claim your skin.') : `${MASTERY_KILLS - m.kills} more kills as a ${name}`;
        if (!m.unlocked) {
            btn.textContent = 'LOCKED';
            btn.disabled = true;
        } else {
            btn.textContent = !owned ? 'CLAIM & EQUIP' : equipped && state.selectedClass === item.masteryClass ? '✓ EQUIPPED' : 'EQUIP';
        }
    } else if (owned) {
        status.textContent = 'Bonus Goal reward';
        btn.textContent = equipped ? '✓ EQUIPPED' : 'EQUIP';
    } else {
        status.textContent = `Finish ${entry.at} quests this week`;
        btn.textContent = 'LOCKED';
        btn.disabled = true;
    }
    setVisible(btn, true);
}

function previewAction() {
    const reward = entries.get(selectedKey)?.reward;
    const item = reward?.type === 'item' ? getItem(reward.itemId) : null;
    if (!item) return;
    if (item.masteryClass) {
        if (!masteryInfo(item.masteryClass).unlocked) return;
        const firstClaim = !isClaimed(item.id);
        // Mastery skins only fit their own class: switch to it first.
        if (state.selectedClass !== item.masteryClass) chooseClass(item.masteryClass);
        else if (state.profile.equipped.Skin === item.id && !firstClaim) return toggleEquip('Skin', null);
        if (claimAndEquipMastery(item.masteryClass) && firstClaim) sounds.play('mastery_unlock', { category: 'ui' });
        return;
    }
    if (isClaimed(item.id)) toggleEquip(item.category, item.id);
}
