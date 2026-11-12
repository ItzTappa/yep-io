// Daily and weekly quests and the weekly Bonus Goals.
//
// Everyone gets the same quests on the same day / week: they are picked from these pools with a
// seed made from the date (like the hourly shop). A quest gives its XP the moment it is done.
// Days and weeks change at midnight UTC (weeks start on Monday).
//
//   stat    what counts (reported by the game, see GameEngine.stat()):
//             kills, damage, time (seconds alive), orbs, healthOrbs, upgrades, dashes,
//             abilities, slots (Lucky Slot Machines), matches, top10, top3, points
//   best    true = your best in a single match instead of a running total
//   class   true = only counts with one class (picked with the quest, e.g. "as a Tank")
//   text    {n} = the target, {class} = the class name
//
// Never two quests with the same stat on the same day / week.
//
// XP is sized against match XP (BALANCE.xp): doing every quest adds roughly 19k XP a week on top of
// what you earn playing, so quests speed the Season Store up without skipping it.

export const DAILY_COUNT = 3;
export const WEEKLY_COUNT = 6;

export const DAILY_POOL = [
    { id: 'kills',      stat: 'kills',      target: 10,   xp: 450, text: 'Get {n} kills' },
    { id: 'damage',     stat: 'damage',     target: 4000, xp: 400, text: 'Deal {n} damage' },
    { id: 'time',       stat: 'time',       target: 600,  xp: 300, text: 'Survive {n} in total' },
    { id: 'orbs',       stat: 'orbs',       target: 400,  xp: 300, text: 'Collect {n} orbs' },
    { id: 'upgrades',   stat: 'upgrades',   target: 25,   xp: 300, text: 'Pick {n} upgrades' },
    { id: 'dashes',     stat: 'dashes',     target: 30,   xp: 250, text: 'Dash {n} times' },
    { id: 'abilities',  stat: 'abilities',  target: 8,    xp: 300, text: 'Use your ability {n} times' },
    { id: 'matches',    stat: 'matches',    target: 3,    xp: 250, text: 'Play {n} matches' },
    { id: 'healthOrbs', stat: 'healthOrbs', target: 10,   xp: 250, text: 'Pick up {n} health orbs' },
    { id: 'top10',      stat: 'top10',      target: 1,    xp: 400, text: 'Finish in the top 10' },
    { id: 'pointsBest', stat: 'points',     target: 1500, xp: 400, text: 'Reach {n} points in one match', best: true },
    { id: 'timeBest',   stat: 'time',       target: 240,  xp: 400, text: 'Survive {n} in one match', best: true },
    { id: 'killsBest',  stat: 'kills',      target: 5,    xp: 450, text: 'Get {n} kills in one match', best: true },
    { id: 'classKills', stat: 'kills',      target: 6,    xp: 450, text: 'Get {n} kills as a {class}', class: true }
];

export const WEEKLY_POOL = [
    { id: 'kills',      stat: 'kills',      target: 75,    xp: 2000, text: 'Get {n} kills' },
    { id: 'damage',     stat: 'damage',     target: 30000, xp: 1600, text: 'Deal {n} damage' },
    { id: 'time',       stat: 'time',       target: 3600,  xp: 1600, text: 'Survive {n} in total' },
    { id: 'orbs',       stat: 'orbs',       target: 3000,  xp: 1200, text: 'Collect {n} orbs' },
    { id: 'upgrades',   stat: 'upgrades',   target: 150,   xp: 1200, text: 'Pick {n} upgrades' },
    { id: 'dashes',     stat: 'dashes',     target: 200,   xp: 1000, text: 'Dash {n} times' },
    { id: 'abilities',  stat: 'abilities',  target: 50,    xp: 1200, text: 'Use your ability {n} times' },
    { id: 'matches',    stat: 'matches',    target: 15,    xp: 1200, text: 'Play {n} matches' },
    { id: 'healthOrbs', stat: 'healthOrbs', target: 60,    xp: 1000, text: 'Pick up {n} health orbs' },
    { id: 'slots',      stat: 'slots',      target: 2,     xp: 1600, text: 'Use {n} Lucky Slot Machines' },
    { id: 'top3',       stat: 'top3',       target: 3,     xp: 2000, text: 'Finish in the top 3 in {n} matches' },
    { id: 'pointsBest', stat: 'points',     target: 5000,  xp: 2000, text: 'Reach {n} points in one match', best: true },
    { id: 'timeBest',   stat: 'time',       target: 600,   xp: 2000, text: 'Survive {n} in one match', best: true },
    { id: 'killsBest',  stat: 'kills',      target: 12,    xp: 2000, text: 'Get {n} kills in one match', best: true },
    { id: 'classKills', stat: 'kills',      target: 40,    xp: 2000, text: 'Get {n} kills as a {class}', class: true }
];

// Bonus Goals: every quest you finish this week (daily or weekly) moves you along this track.
// Item rewards are two cosmetics you don't own yet, chosen for you when the week starts
// ('common' = uncommon/rare, 'epic' = epic/legendary). If you already own one by the time you
// reach it, you get `fallbackXp` instead.
export const BONUS_GOALS = [
    { at: 3,  xp: 750 },
    { at: 6,  item: 'common', fallbackXp: 1000 },
    { at: 10, xp: 1500 },
    { at: 15, item: 'epic', fallbackXp: 2500 }
];

export const BONUS_ITEM_RARITY = { common: [2, 3], epic: [4, 5] };
export const BONUS_ITEM_CATEGORIES = ['Skin', 'Trail', 'Color'];
