// Keyboard, mouse and touch input for the game.
// Desktop: WASD/keybinds + mouse aim. Mobile: left-side joystick, drag anywhere else to aim,
// on-screen DASH / ABILITY buttons.
import { $ } from '../core/dom.js';

export class Input {
    constructor(engine) {
        this.engine = engine;
        this.keys = {};
        this.mouseX = window.innerWidth / 2;
        this.mouseY = window.innerHeight / 2;
        this.isTouchDevice = false;
        this.aimAngle = null;

        this.stick = { id: null, originX: 0, originY: 0, x: 0, y: 0, active: false };
        this.aimTouch = { id: null, originX: 0, originY: 0, dragging: false };

        this.bindKeyboard();
        this.bindMouse();
        this.bindTouch();
        this.bindUpgradeCards();
    }

    // Movement direction from keys + joystick (not normalised).
    movementVector(binds) {
        let dx = 0;
        let dy = 0;
        if (this.keys[binds.up]) dy -= 1;
        if (this.keys[binds.down]) dy += 1;
        if (this.keys[binds.left]) dx -= 1;
        if (this.keys[binds.right]) dx += 1;
        if (this.stick.active) {
            const tdx = this.stick.x - this.stick.originX;
            const tdy = this.stick.y - this.stick.originY;
            const dist = Math.hypot(tdx, tdy);
            if (dist > 10) {
                dx += tdx / dist;
                dy += tdy / dist;
            }
        }
        return { dx, dy };
    }

    // True once per press (used for dash and ability).
    consume(key) {
        if (!this.keys[key]) return false;
        this.keys[key] = false;
        return true;
    }

    clear() {
        this.keys = {};
        this.stick.active = false;
        this.aimTouch.id = null;
    }

    get playing() {
        const e = this.engine;
        return !e.isDemo && !e.isGameOver && !!e.player && !e.player.isDead;
    }

    bindKeyboard() {
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            const key = e.key.toLowerCase();
            if (this.playing && Object.values(this.engine.keybinds()).includes(key)) e.preventDefault();
            this.keys[key] = true;
            if (this.playing && ['1', '2', '3'].includes(key)) this.engine.upgrades.pick(Number(key) - 1);
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        // Releasing keys while the window is in the background never fires keyup: reset instead.
        window.addEventListener('blur', () => this.clear());
        document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });
    }

    bindMouse() {
        window.addEventListener('mousemove', (e) => {
            if (this.isTouchDevice) return;
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });
    }

    bindTouch() {
        window.addEventListener('touchstart', () => { this.isTouchDevice = true; }, { passive: true });

        const zone = $('joystick-left');
        const base = $('base-left');
        const knob = $('stick-left');
        const resetStick = () => {
            this.stick.active = false;
            base.classList.remove('active');
            base.style.top = 'auto';
            base.style.bottom = '40px';
            base.style.left = '40px';
            base.style.transform = 'none';
            knob.style.transform = 'translate(-50%, -50%)';
        };

        zone.addEventListener('touchstart', (e) => {
            if (!this.playing) return;
            e.preventDefault();
            for (const t of e.changedTouches) {
                if (this.stick.active) break;
                Object.assign(this.stick, { active: true, id: t.identifier, originX: t.clientX, originY: t.clientY, x: t.clientX, y: t.clientY });
                base.style.bottom = 'auto';
                base.style.left = t.clientX + 'px';
                base.style.top = t.clientY + 'px';
                base.style.transform = 'translate(-50%, -50%)';
                base.classList.add('active');
                knob.style.transform = 'translate(-50%, -50%)';
            }
        }, { passive: false });

        zone.addEventListener('touchmove', (e) => {
            if (!this.playing) return;
            e.preventDefault();
            for (const t of e.changedTouches) {
                if (!this.stick.active || t.identifier !== this.stick.id) continue;
                this.stick.x = t.clientX;
                this.stick.y = t.clientY;
                let dx = t.clientX - this.stick.originX;
                let dy = t.clientY - this.stick.originY;
                const dist = Math.hypot(dx, dy);
                if (dist > 40) {
                    dx = (dx / dist) * 40;
                    dy = (dy / dist) * 40;
                }
                knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            }
        }, { passive: false });

        const endStick = (e) => {
            for (const t of e.changedTouches) {
                if (this.stick.active && t.identifier === this.stick.id) resetStick();
            }
        };
        zone.addEventListener('touchend', endStick);
        zone.addEventListener('touchcancel', endStick);

        // Aiming: drag anywhere that isn't the joystick, a button or an upgrade card.
        window.addEventListener('touchstart', (e) => {
            if (!this.playing) return;
            for (const t of e.changedTouches) {
                const el = t.target instanceof Element ? t.target : null;
                if (t.identifier === this.stick.id && this.stick.active) continue;
                if (el && el.closest('#joystick-left, #mobile-dash-btn, #mobile-ability-btn, .card')) continue;
                Object.assign(this.aimTouch, { id: t.identifier, originX: t.clientX, originY: t.clientY, dragging: false });
            }
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (!this.playing) return;
            for (const t of e.changedTouches) {
                if (t.identifier !== this.aimTouch.id) continue;
                const dx = t.clientX - this.aimTouch.originX;
                const dy = t.clientY - this.aimTouch.originY;
                if (!this.aimTouch.dragging && Math.hypot(dx, dy) > 10) this.aimTouch.dragging = true;
                if (this.aimTouch.dragging) this.aimAngle = Math.atan2(dy, dx);
            }
        }, { passive: false });

        window.addEventListener('touchend', (e) => {
            for (const t of e.changedTouches) {
                if (t.identifier === this.aimTouch.id) {
                    this.aimTouch.id = null;
                    this.aimTouch.dragging = false;
                }
            }
        });

        const holdButton = (id, action) => {
            const btn = $(id);
            btn.addEventListener('touchstart', (e) => {
                if (!this.playing) return;
                e.preventDefault();
                this.keys[this.engine.keybinds()[action]] = true;
            });
            // No release handling: the press is consumed by the game, so even a very quick tap counts.
            btn.addEventListener('touchend', (e) => e.preventDefault());
        };
        holdButton('mobile-dash-btn', 'dash');
        holdButton('mobile-ability-btn', 'ability');
    }

    bindUpgradeCards() {
        [0, 1, 2].forEach((index) => {
            $(`card-${index + 1}`).addEventListener('pointerdown', (e) => {
                if (!this.playing) return;
                e.stopPropagation();
                this.engine.upgrades.pick(index);
            });
        });
    }
}
