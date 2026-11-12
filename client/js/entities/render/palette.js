// Colour helpers and the shared art palette, so every cosmetic and upgrade uses the same look:
// flat shapes, a darker outline, and steel-grey metal parts.

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));

// Accepts '#rgb', '#rrggbb' or 'hsl(h, s%, l%)'. Returns { r, g, b }.
export function parseColor(color) {
    if (typeof color !== 'string') return { r: 200, g: 200, b: 200 };
    if (color.startsWith('#')) {
        let hex = color.slice(1);
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const n = parseInt(hex.slice(0, 6), 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    const hsl = color.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/);
    if (hsl) {
        const h = Number(hsl[1]) / 360;
        const s = Number(hsl[2]) / 100;
        const l = Number(hsl[3]) / 100;
        const k = (n) => (n + h * 12) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return { r: clamp255(f(0) * 255), g: clamp255(f(8) * 255), b: clamp255(f(4) * 255) };
    }
    return { r: 200, g: 200, b: 200 };
}

const toHex = ({ r, g, b }) => '#' + [r, g, b].map(v => clamp255(v).toString(16).padStart(2, '0')).join('');

// amount -1..1: negative darkens toward black, positive lightens toward white.
export function shade(color, amount) {
    const c = parseColor(color);
    const target = amount < 0 ? 0 : 255;
    const t = Math.abs(amount);
    return toHex({ r: c.r + (target - c.r) * t, g: c.g + (target - c.g) * t, b: c.b + (target - c.b) * t });
}

export function rgba(color, alpha) {
    const c = parseColor(color);
    return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

export function mix(a, b, t) {
    const ca = parseColor(a);
    const cb = parseColor(b);
    return toHex({ r: ca.r + (cb.r - ca.r) * t, g: ca.g + (cb.g - ca.g) * t, b: ca.b + (cb.b - ca.b) * t });
}

// Perceived brightness 0..1 (used to keep very dark colours visible on the dark arena).
export function luminance(color) {
    const c = parseColor(color);
    return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
}

// The ship outline: a darker version of the body colour (or a light rim for near-black ships).
export function outlineFor(color) {
    return luminance(color) < 0.18 ? shade(color, 0.55) : shade(color, -0.45);
}

// Metal parts (barrels, armour, thrusters, spikes).
export const STEEL = {
    light: '#d4dae3',
    mid: '#97a1b0',
    dark: '#5c6575',
    edge: '#2f3540'
};

// Upgrade tiers T1..T5 (matches the HUD badge colours).
export const TIER_GLOW = ['#9aa3b0', '#cd7f32', '#c0c0c0', '#ffd700', '#00ffcc', '#ff4dff'];

// Colours for ships that have no Color cosmetic (bots, mostly). Chosen to read well on the dark arena.
export const SHIP_PALETTE = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
];
