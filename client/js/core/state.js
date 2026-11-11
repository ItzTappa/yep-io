// The app's shared state. Read it anywhere; change it through the services (account, shop,
// network) so the right events fire and the right things get saved.
import { emptyLoadout } from '../data/items.js';
import { CLASS_TYPES } from '../data/classes.js';

export function createEmptyProfile() {
    const classStats = {};
    for (const type of CLASS_TYPES) classStats[type] = { kills: 0, matches: 0 };
    return {
        xp: 0,
        level: 1,
        equipped: emptyLoadout(),
        unlocked: {},                 // itemId -> true for every claimed cosmetic
        history: [],                  // recent matches (last 24 hours, newest first)
        stats: { matches: 0, kills: 0, time: 0, points: 0, distance: 0 },
        classStats,
        hourly: { key: null, kills: 0, time: 0, points: 0, distance: 0 } // hourly shop progress
    };
}

export const state = {
    // Progression. Saved to Firestore when logged in, to this browser when playing as a guest.
    profile: createEmptyProfile(),

    // Friends system (logged-in players only).
    social: { friends: [], requestsIn: [], requestsOut: [], invites: [] },

    account: {
        available: false,   // Firebase loaded and reachable
        uid: null,          // set while logged in
        username: null
    },

    guestName: 'GUEST' + Math.floor(1000 + Math.random() * 9000),
    selectedClass: null,    // 'triangle' | 'square' | 'circle' once the player picks one
    inMatch: false,

    // Multiplayer
    connected: false,       // socket.io connection to the game server
    myNetId: null,          // our socket id
    lobby: null             // latest lobby state from the server, or null when not in one
};

export const displayName = () => state.account.username || state.guestName;
export const isLoggedIn = () => !!state.account.uid;
export const isLobbyHost = () => !!state.lobby && state.lobby.hostId === state.myNetId;
