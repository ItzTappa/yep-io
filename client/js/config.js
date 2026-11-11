// Game-wide tuning numbers. Change gameplay balance here instead of hunting through the code.

// The simulation always runs at 60 updates per second, whatever the screen's refresh rate.
export const TICK_MS = 1000 / 60;
export const TICKS_PER_SECOND = 60;

export const WORLD = {
    demo: 4000,
    solo: 8000,
    br: 8000,
    duel: 3000
};

export const MATCH = {
    soloBots: 49,
    demoBots: 30,
    brTotalPlayers: 50,      // multiplayer battle royale is filled up with bots to this many
    xpOrbs: 3000,
    demoOrbs: 1000,
    healthOrbs: 91,
    safeZones: 3,
    safeZoneRespawnTicks: 1800,
    introTicks: 180,         // the zoom-in camera shot at the start of a multiplayer match
    botRespawnDelayMs: 3000,
    duelPassivePointsPerTick: 0.15,
    slotMachineChancePerTick: 0.0002
};

export const STORM = {
    startRadius: 6000,
    shrinkPerSecond: 24,
    damageEveryTicks: 30,
    damageFraction: 0.05     // of max health, per damage tick
};

export const NET = {
    stateEveryTicks: 3,      // own ship -> others (20 per second)
    worldEveryTicks: 6,      // host bots & zones -> others (10 per second)
    botMetaEveryTicks: 180,  // full bot list resend, recovers anything missed (every 3 seconds)
    remoteLerp: 0.3
};

export const ACCOUNT = {
    xpPerLevel: 1000,            // XP needed for the next level = level * xpPerLevel
    heartbeatMs: 60000,          // "online" ping for the friends list
    onlineWindowMs: 150000,      // a friend counts as online if they pinged this recently
    historyMax: 20,
    historyMaxAgeMs: 24 * 60 * 60 * 1000,
    inviteLifetimeMs: 60000
};

// The developer console (press / or `) only exists when running the game on your own machine.
export const DEV_TOOLS_ENABLED = ['localhost', '127.0.0.1'].includes(location.hostname);
