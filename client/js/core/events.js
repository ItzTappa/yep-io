// A tiny event bus so the menus can react to changes without knowing who made them.
//
// Events used in the game:
//   profile:changed   level, XP, cosmetics, stats or history changed
//   social:changed    friends, friend requests or invites changed
//   account:changed   logged in / logged out / accounts became (un)available
//   lobby:changed     multiplayer lobby state changed (or you left it)
//   class:changed     a different class was selected
//   settings:changed  settings were saved
//   shop:rotated      the hourly shop moved to a new hour
const listeners = new Map();

export function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event).delete(fn);
}

export function emit(event, payload) {
    const set = listeners.get(event);
    if (!set) return;
    for (const fn of set) {
        try {
            fn(payload);
        } catch (err) {
            console.error(`Error in "${event}" listener:`, err);
        }
    }
}
