// Quest progress: today's and this week's quests, the weekly Bonus Goals, and what a match adds
// to them. Progress is part of your profile (profile.quests) and is saved with it.
//
// During a match the game reports stats (GameEngine.stat()). Anything that gets finished comes
// back as a list of rewards for the game to hand out and announce:
//   { kind: 'quest' | 'bonus', title, xp, itemId }
import { state } from '../core/state.js';
import { createRng, hashString } from '../core/math.js';
import { CLASS_TYPES, CLASS_INFO } from '../data/classes.js';
import { ITEMS_DB, getItem } from '../data/items.js';
import {
    DAILY_POOL, WEEKLY_POOL, DAILY_COUNT, WEEKLY_COUNT,
    BONUS_GOALS, BONUS_ITEM_RARITY, BONUS_ITEM_CATEGORIES
} from '../data/quests.js';
import { scheduleSave } from './account.js';

const DAY_MS = 86400000;

// ---------- days and weeks (UTC) ----------

export const dayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

// The Monday that starts this week, e.g. "2026-11-09".
export function weekKey(now = Date.now()) {
    const day = Math.floor(now / DAY_MS);
    const sinceMonday = (new Date(day * DAY_MS).getUTCDay() + 6) % 7;
    return new Date((day - sinceMonday) * DAY_MS).toISOString().slice(0, 10);
}

export const msUntilDailyReset = (now = Date.now()) => DAY_MS - (now % DAY_MS);
export const msUntilWeeklyReset = (now = Date.now()) => Date.parse(`${weekKey(now)}T00:00:00Z`) + 7 * DAY_MS - now;

// ---------- which quests are on today / this week ----------

function describe(def, classType) {
    let n = def.target.toLocaleString('en-US');
    if (def.stat === 'time') n = `${def.target / 60} minutes`;
    return def.text.replace('{n}', n).replace('{class}', classType ? CLASS_INFO[classType].name : '');
}

function pickQuests(pool, count, seedKey) {
    const rng = createRng(hashString(seedKey));
    const order = [...pool];
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    const picked = [];
    const stats = new Set();
    for (const def of order) {
        if (picked.length >= count) break;
        if (stats.has(def.stat)) continue;
        stats.add(def.stat);
        const classType = def.class ? CLASS_TYPES[Math.floor(rng() * CLASS_TYPES.length)] : null;
        picked.push({ ...def, classType, title: describe(def, classType) });
    }
    return picked;
}

const cache = new Map();
function questsFor(kind, key) {
    const id = `${kind}:${key}`;
    if (!cache.has(id)) {
        cache.set(id, kind === 'day'
            ? pickQuests(DAILY_POOL, DAILY_COUNT, `daily:${key}`)
            : pickQuests(WEEKLY_POOL, WEEKLY_COUNT, `weekly:${key}`));
    }
    return cache.get(id);
}

// Your quest progress, moved on to today / this week first if the date changed.
function questState() {
    const q = state.profile.quests;
    const day = dayKey();
    const week = weekKey();
    let changed = false;
    if (q.day.key !== day) {
        q.day = { key: day, progress: {}, done: {} };
        changed = true;
    }
    if (q.week.key !== week) {
        q.week = { key: week, progress: {}, done: {}, count: 0, goals: {}, rewards: pickBonusItems() };
        changed = true;
    }
    if (changed) scheduleSave();
    return q;
}

// Two cosmetics you don't own yet for this week's Bonus Goals.
function pickBonusItems() {
    const owned = state.profile.unlocked;
    return BONUS_GOALS.filter(g => g.item).map(goal => {
        const [min, max] = BONUS_ITEM_RARITY[goal.item];
        const options = Object.values(ITEMS_DB).filter(item =>
            item.isRotating && !item.hideFromStore && !owned[item.id] &&
            BONUS_ITEM_CATEGORIES.includes(item.category) && item.rarity >= min && item.rarity <= max);
        return options.length ? options[Math.floor(Math.random() * options.length)].id : null;
    });
}

const withProgress = (list, bucket) => list.map(def => {
    const progress = Math.min(def.target, Math.floor(bucket.progress[def.id] || 0));
    return { ...def, progress, done: !!bucket.done[def.id] };
});

export function dailyQuests() {
    const q = questState();
    return withProgress(questsFor('day', q.day.key), q.day);
}

export function weeklyQuests() {
    const q = questState();
    return withProgress(questsFor('week', q.week.key), q.week);
}

// The Bonus Goals track: how many quests you finished this week and each goal's reward.
//   goal.reward: { type: 'xp', xp } or { type: 'item', itemId }
export function bonusGoals() {
    const week = questState().week;
    let itemIndex = 0;
    const goals = BONUS_GOALS.map((goal, i) => {
        const reached = week.count >= goal.at;
        let reward = { type: 'xp', xp: goal.xp };
        if (goal.item) {
            const itemId = week.rewards[itemIndex++] || null;
            const granted = week.goals[i];
            // Already owned before you got here (or nothing left to give): XP instead.
            const asItem = reached ? granted === 'item' : !!itemId && !state.profile.unlocked[itemId];
            reward = asItem ? { type: 'item', itemId } : { type: 'xp', xp: goal.fallbackXp };
        }
        return { at: goal.at, reached, reward };
    });
    return { count: week.count, max: BONUS_GOALS[BONUS_GOALS.length - 1].at, goals };
}

// ---------- tracking a match ----------

let match = null; // { mode, classType, values: { stat: amount this match } }

export function startQuestMatch({ mode, classType }) {
    questState();
    match = { mode, classType, values: {} };
}

// Something happened in the match (a kill, some damage, a second alive...). Returns rewards.
export function trackQuestStat(stat, amount = 1) {
    if (!match || !(amount > 0)) return [];
    match.values[stat] = (match.values[stat] || 0) + amount;
    return advance(stat, amount, match.values[stat]);
}

// A "best in one match" value right now (points). Only best-in-a-match quests use it.
export function reportQuestBest(stat, value) {
    if (!match || !(value > 0)) return [];
    match.values[stat] = Math.max(match.values[stat] || 0, value);
    return advance(stat, 0, match.values[stat]);
}

// The match is over: count it (and its placement). Returns rewards.
export function endQuestMatch(summary) {
    if (!match) return [];
    const rewards = trackQuestStat('matches', 1);
    const placed = summary.placement;
    const field = summary.totalPlayers;
    if (summary.mode !== 'duel' && placed) {
        if (placed <= 10 && field > 10) rewards.push(...trackQuestStat('top10', 1));
        if (placed <= 3 && field > 3) rewards.push(...trackQuestStat('top3', 1));
    }
    match = null;
    return rewards;
}

function advance(stat, amount, matchValue) {
    const q = questState();
    const rewards = [];
    const buckets = [[questsFor('day', q.day.key), q.day], [questsFor('week', q.week.key), q.week]];
    for (const [list, bucket] of buckets) {
        for (const def of list) {
            if (def.stat !== stat || bucket.done[def.id]) continue;
            if (def.classType && def.classType !== match.classType) continue;
            if (def.best) bucket.progress[def.id] = Math.max(bucket.progress[def.id] || 0, matchValue);
            else bucket.progress[def.id] = (bucket.progress[def.id] || 0) + amount;
            if (bucket.progress[def.id] >= def.target) rewards.push(...complete(def, bucket));
        }
    }
    return rewards;
}

function complete(def, bucket) {
    const week = questState().week;
    bucket.done[def.id] = true;
    bucket.progress[def.id] = def.target;
    week.count++;
    const rewards = [{ kind: 'quest', title: def.title, xp: def.xp }];

    // Bonus Goals reached by this quest.
    let itemIndex = 0;
    BONUS_GOALS.forEach((goal, i) => {
        const itemId = goal.item ? week.rewards[itemIndex++] : null;
        if (week.goals[i] || week.count < goal.at) return;
        if (goal.item && itemId && getItem(itemId) && !state.profile.unlocked[itemId]) {
            state.profile.unlocked[itemId] = true;
            week.goals[i] = 'item';
            rewards.push({ kind: 'bonus', title: `${getItem(itemId).name} ${getItem(itemId).category}`, xp: 0, itemId });
        } else {
            week.goals[i] = 'xp';
            rewards.push({ kind: 'bonus', title: `${goal.at} quests done`, xp: goal.item ? goal.fallbackXp : goal.xp });
        }
    });
    return rewards;
}

// ---------- admin console ----------

// Finishes every quest on today's and this week's list. Returns the rewards (XP not added yet).
export function completeAllQuests() {
    const q = questState();
    const rewards = [];
    for (const [list, bucket] of [[questsFor('day', q.day.key), q.day], [questsFor('week', q.week.key), q.week]]) {
        for (const def of list) if (!bucket.done[def.id]) rewards.push(...complete(def, bucket));
    }
    scheduleSave();
    return rewards;
}

export function resetQuests() {
    state.profile.quests.day.key = null;
    state.profile.quests.week.key = null;
    questState(); // starts fresh (and saves)
}
