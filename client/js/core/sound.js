// Sound effects (Web Audio). Every sound plays through one master volume (Settings > Master Volume).
//
//   sounds.play('ui_click', { category: 'ui' })
//   sounds.play('enemy_death', { category: 'heavy', volume: 0.5 })
const SOUND_DIR = 'assets/sounds/';

// name -> file, or { file, rate } to reuse another file at a different pitch.
const SOUND_FILES = {
    // UI & systems
    ui_click: 'ui_click.mp3',
    ui_hover: 'ui_hover.mp3',
    ui_error: 'ui_error.mp3',
    ui_ready: 'ui_ready.mp3',
    ui_claim: 'ui_claim.mp3',
    notification: 'notification.mp3',
    upgrade_ready: 'upgrade_ready.mp3',
    level_up: 'level_up.mp3',
    mastery_unlock: 'mastery_unlock.mp3',

    // Combat & movement
    dash: 'dash.mp3',
    hit_marker: 'hit_marker.mp3',
    kill_confirm: { file: 'hit_marker.mp3', rate: 1.6 },
    take_damage: { file: 'hit_marker.mp3', rate: 0.6 },
    xp_pickup: 'xp_pickup.mp3',
    enemy_death: 'enemy_death.mp3',
    player_death: 'player_death.mp3',

    // Map events
    sz_tick: 'sz_tick.mp3',
    sz_on: 'sz_on.mp3',
    slot_spin: 'slot_spin.mp3',
    slot_win: 'slot_win.mp3',

    // Abilities
    ability_shield: 'ability_shield.mp3',
    ability_blink: 'ability_blink.mp3',
    ability_emp: 'ability_emp.mp3',
    ability_minigun: { file: 'dash.mp3', rate: 0.7 },
    ability_nuke: 'ability_nuke.mp3',
    ability_missile: 'ability_missile.mp3',
    plasma_gun: 'plasma_gun.mp3'
};

const CATEGORY_VOLUME = { ui: 0.3, pickup: 0.15, combat: 0.5, heavy: 0.7, ability: 0.85, alert: 0.6 };

// Minimum milliseconds between two plays of the same sound, so rapid events don't stack into noise.
const THROTTLE_MS = { ui_hover: 40, slot_spin: 40, hit_marker: 30, xp_pickup: 15, take_damage: 100 };
const DEFAULT_THROTTLE_MS = 50;

class SoundManager {
    constructor() {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.context = AudioCtx ? new AudioCtx() : null;
        this.buffers = new Map();
        this.lastPlayed = new Map();
        this.enabled = !!this.context;
        if (!this.context) return;

        this.masterGain = this.context.createGain();
        this.masterGain.connect(this.context.destination);

        // Browsers only allow audio after the first click or key press.
        const unlock = () => {
            if (this.context.state !== 'running') this.context.resume().catch(() => {});
            document.removeEventListener('pointerdown', unlock);
            document.removeEventListener('keydown', unlock);
        };
        document.addEventListener('pointerdown', unlock);
        document.addEventListener('keydown', unlock);

        this.loadAll();
    }

    loadAll() {
        const decoded = new Map(); // file -> Promise<AudioBuffer>, so shared files load once
        for (const [name, entry] of Object.entries(SOUND_FILES)) {
            const file = typeof entry === 'string' ? entry : entry.file;
            if (!decoded.has(file)) decoded.set(file, this.loadFile(file));
            decoded.get(file).then((buffer) => {
                if (buffer) this.buffers.set(name, { buffer, rate: entry.rate || 1 });
            });
        }
    }

    async loadFile(file) {
        try {
            const response = await fetch(SOUND_DIR + file);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await this.context.decodeAudioData(await response.arrayBuffer());
        } catch (err) {
            console.warn(`Sound "${file}" failed to load:`, err.message);
            return null;
        }
    }

    play(name, { category = 'combat', volume = 1, varyPitch = false } = {}) {
        if (!this.enabled || volume <= 0) return;
        const sound = this.buffers.get(name);
        if (!sound) return;

        const now = performance.now();
        const throttle = THROTTLE_MS[name] ?? DEFAULT_THROTTLE_MS;
        if (now - (this.lastPlayed.get(name) || -Infinity) < throttle) return;
        this.lastPlayed.set(name, now);

        if (this.context.state === 'suspended') this.context.resume().catch(() => {});

        const source = this.context.createBufferSource();
        source.buffer = sound.buffer;
        source.playbackRate.value = sound.rate * (varyPitch ? 0.9 + Math.random() * 0.2 : 1);

        const gain = this.context.createGain();
        gain.gain.value = (CATEGORY_VOLUME[category] ?? 0.5) * volume;
        source.connect(gain);
        gain.connect(this.masterGain);
        source.start(0);
    }

    setVolume(value) {
        if (!this.masterGain) return;
        this.masterGain.gain.value = Math.max(0, Math.min(1, value));
    }
}

export const sounds = new SoundManager();
