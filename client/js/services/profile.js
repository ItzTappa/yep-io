// Everything that changes your saved progression: XP and levels, match results, claiming and
// equipping cosmetics. UI code calls these instead of editing state.profile directly.
import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { ACCOUNT } from '../config.js';
import { BALANCE } from '../data/balance.js';
import { getItem, SEASON_ITEM_IDS, MASTERY_KILLS, masterySkinId, ITEMS_DB, isOwnerName } from '../data/items.js';
import { scheduleSave, saveNow } from './account.js';
import { hourlyProgress, addHourlyProgress, shopEntryFor } from './shop.js';

// XP to go from `level` to the next one.
export const xpForNextLevel = (level) => BALANCE.xp.perLevelBase + BALANCE.xp.perLevel * level;

// Adds account XP. Returns the list of levels reached (empty if none).
export function addAccountXP(amount) {
    const profile = state.profile;
    profile.xp += Math.max(0, Math.floor(amount));
    const reached = [];
    while (profile.xp >= xpForNextLevel(profile.level)) {
        profile.xp -= xpForNextLevel(profile.level);
        profile.level++;
        reached.push(profile.level);
    }
    return reached;
}

// Called once when a match ends (summary comes from GameEngine.finishMatch).
export function recordMatch(summary) {
    const profile = state.profile;
    const { kills, time, points, distance, playerClass } = summary;

    profile.stats.matches += 1;
    profile.stats.kills += kills;
    profile.stats.time += time;
    profile.stats.points += points;
    profile.stats.distance += distance;

    const cls = profile.classStats[playerClass] || (profile.classStats[playerClass] = { kills: 0, matches: 0 });
    cls.matches += 1;
    cls.kills += kills;

    addHourlyProgress({ kills, time, points, distance });

    profile.history.unshift({
        kills, time, points, distance,
        rank: summary.placement,
        totalPlayers: summary.totalPlayers,
        playerClass,
        upgrades: summary.upgrades,
        mode: summary.mode,
        result: summary.result,
        timestamp: Date.now()
    });
    pruneHistory();

    emit('profile:changed');
    saveNow();
}

export function pruneHistory() {
    const now = Date.now();
    state.profile.history = state.profile.history
        .filter(m => now - (m.timestamp || now) < ACCOUNT.historyMaxAgeMs)
        .slice(0, ACCOUNT.historyMax);
}

// ---------- cosmetics ----------

export const isClaimed = (itemId) => !!state.profile.unlocked[itemId];

// Can this item be claimed right now? (season level, this hour's shop goal, or class mastery)
export function canClaim(itemId) {
    const item = getItem(itemId);
    if (!item || isClaimed(itemId)) return false;
    if (SEASON_ITEM_IDS.includes(itemId)) return state.profile.level >= item.req;
    if (item.masteryClass) return (state.profile.classStats[item.masteryClass]?.kills || 0) >= MASTERY_KILLS;
    const entry = shopEntryFor(itemId);
    return !!entry && (hourlyProgress()[entry.type] || 0) >= entry.req;
}

export function claimItem(itemId) {
    if (!canClaim(itemId)) return false;
    state.profile.unlocked[itemId] = true;
    emit('profile:changed');
    saveNow();
    return true;
}

// Equips an item (or unequips it if it is already equipped). Pass null to clear a slot.
export function toggleEquip(category, itemId) {
    const equipped = state.profile.equipped;
    if (itemId && !isClaimed(itemId)) return;
    equipped[category] = itemId && equipped[category] !== itemId ? itemId : null;
    emit('profile:changed');
    scheduleSave();
}

export function claimAndEquipMastery(classType) {
    const id = masterySkinId(classType);
    if (!isClaimed(id) && !claimItem(id)) return false;
    state.profile.equipped.Skin = id;
    emit('profile:changed');
    scheduleSave();
    return true;
}

// Changing class takes off another class's mastery skin.
export function onClassChanged(classType) {
    const skin = getItem(state.profile.equipped.Skin);
    if (skin?.masteryClass && skin.masteryClass !== classType) {
        state.profile.equipped.Skin = null;
        emit('profile:changed');
        scheduleSave();
    }
}

// The owner's account (an admin username) gets the OWNER banner, equipped the first time.
export function grantOwnerBanner() {
    if (!isOwnerName(state.account.username) || state.profile.unlocked.b_owner) return;
    state.profile.unlocked.b_owner = true;
    if (!state.profile.equipped.Banner) state.profile.equipped.Banner = 'b_owner';
    emit('profile:changed');
    scheduleSave();
}

// Gives a cosmetic without the usual claim rules (tutorial reward).
export function grantItem(itemId) {
    if (!getItem(itemId) || state.profile.unlocked[itemId]) return false;
    state.profile.unlocked[itemId] = true;
    emit('profile:changed');
    scheduleSave();
    return true;
}

// ---------- tutorial ----------

// done = false makes the tutorial play again in your next solo match (Settings > Replay Tutorial).
export function setTutorialDone(done) {
    state.profile.tutorialDone = done;
    scheduleSave();
}

// ---------- developer console helpers ----------

export function devSetLevel(level) {
    state.profile.level = Math.max(1, Math.floor(level));
    state.profile.xp = 0;
    emit('profile:changed');
    scheduleSave();
}

export function devUnlockAll() {
    for (const id of Object.keys(ITEMS_DB)) state.profile.unlocked[id] = true;
    emit('profile:changed');
    scheduleSave();
}

export function devSetHourly(type, value) {
    hourlyProgress()[type] = value;
    emit('profile:changed');
}
