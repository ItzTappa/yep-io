// Small maths helpers shared by the whole game.
export const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

// Shortest signed difference between two angles, in -PI..PI.
export function angleDiff(target, current) {
    let diff = target - current;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return diff;
}

// Deterministic random numbers: the same seed gives the same sequence on every computer.
// Used so all players in a match (and in the same shop hour) see the same layout.
export function createRng(seed) {
    let a = seed >>> 0;
    return function rng() {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function hashString(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

// 1 -> "1st", 2 -> "2nd", 11 -> "11th" ...
export function ordinal(n) {
    const r = Math.floor(n);
    let suffix = 'th';
    if (r % 10 === 1 && r % 100 !== 11) suffix = 'st';
    else if (r % 10 === 2 && r % 100 !== 12) suffix = 'nd';
    else if (r % 10 === 3 && r % 100 !== 13) suffix = 'rd';
    return `${r}${suffix}`;
}

// 125 -> "2m 5s"
export function formatDuration(totalSeconds) {
    const secs = Math.floor(totalSeconds || 0);
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

// 125 -> "2m 5s", 45 -> "45s"
export function formatShortDuration(totalSeconds) {
    const secs = Math.floor(totalSeconds || 0);
    const m = Math.floor(secs / 60);
    return m > 0 ? `${m}m ${secs % 60}s` : `${secs % 60}s`;
}

export function formatPoints(points) {
    return points >= 1000 ? (points / 1000).toFixed(1) + 'k' : Math.floor(points);
}
