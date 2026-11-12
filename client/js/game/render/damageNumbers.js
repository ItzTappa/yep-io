// Floating numbers over ships you damage (Settings > Show Damage Numbers). Quick hits on the same
// ship add up into one number, so fast guns don't fill the screen. Also shows "DODGED" / "IMMUNE".
const LIFE_TICKS = 48;
const MERGE_TICKS = 22;     // a new hit this soon after the last one adds to its number
const MAX_NUMBERS = 40;

export class DamageNumbers {
    constructor() {
        this.list = [];
    }

    clear() {
        this.list = [];
    }

    // big = a heavy hit (several times your normal bullet), drawn larger and in yellow.
    add(target, amount, { big = false } = {}) {
        const last = this.list.find(n => n.target === target && n.value !== null && n.age < MERGE_TICKS);
        if (last) {
            last.value += amount;
            last.big = last.big || big;
            last.age = Math.min(last.age, 6);
            last.pop = 1;
            return;
        }
        this.push(target, { value: amount, big });
    }

    // A word instead of a number ("DODGED", "IMMUNE"), at most once per ship every half second.
    addWord(target, word, color) {
        if (this.list.some(n => n.target === target && n.word === word && n.age < 30)) return;
        this.push(target, { value: null, word, color });
    }

    push(target, fields) {
        const half = target.type === 'square' ? target.size / 2 : target.size;
        this.list.push({
            target,
            x: target.x + (Math.random() - 0.5) * 24,
            y: target.y - half - 18,
            vy: -1.3,
            age: 0,
            pop: 1,
            big: false,
            word: null,
            color: null,
            ...fields
        });
        if (this.list.length > MAX_NUMBERS) this.list.shift();
    }

    update() {
        for (let i = this.list.length - 1; i >= 0; i--) {
            const n = this.list[i];
            n.age++;
            n.y += n.vy;
            n.vy *= 0.93;
            n.pop *= 0.82;
            if (n.age > LIFE_TICKS) this.list.splice(i, 1);
        }
    }

    draw(ctx) {
        if (this.list.length === 0) return;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        for (const n of this.list) {
            const fade = n.age > LIFE_TICKS - 16 ? (LIFE_TICKS - n.age) / 16 : 1;
            const size = (n.word ? 13 : n.big ? 21 : 16) * (1 + 0.35 * n.pop);
            ctx.globalAlpha = Math.max(0, fade);
            ctx.font = `900 ${size.toFixed(1)}px "Segoe UI", sans-serif`;
            const text = n.word || String(Math.max(1, Math.round(n.value)));
            ctx.strokeText(text, n.x, n.y);
            ctx.fillStyle = n.color || (n.big ? '#ffe600' : '#ffffff');
            ctx.fillText(text, n.x, n.y);
        }
        ctx.restore();
    }
}
