// ==========================================
// YEP.IO - ENHANCED SOUND MANAGER (WEB AUDIO API)
// ==========================================

class SoundManager {
    constructor() {
        // Initialize high-performance audio context
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.context = new AudioContext();
        
        this.buffers = {};
        this.enabled = true;
        this.masterVolume = 1.0; 
        this.lastPlayed = {}; 
        
        // Master gain node routes to the physical speakers
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = this.masterVolume;
        this.masterGain.connect(this.context.destination);

        // --- VOLUME BALANCING PRESETS ---
        this.categoryVolumes = {
            ui: 0.3,       // Keep menus snappy but quiet
            pickup: 0.15,  // Very quiet so mass-looting doesn't blow out speakers
            combat: 0.5,   // Standard hit markers and dashes
            heavy: 0.7,    // Deaths, taking damage
            ability: 0.85, // Massive impact sounds (Railgun, Nuke)
            alert: 0.6     // Level ups, upgrades, notifications
        };

        // --- THROTTLE LIMITS (in milliseconds) ---
        // Prevents the exact same sound from overlapping too many times per frame
        this.throttles = {
            ui_hover: 40,
            hit_marker: 30,
            xp_pickup: 15,  // Extremely short so you hear the cascade of orbs
            take_damage: 100, 
            default: 50
        };

        // Unlock audio context on first user interaction (Browser Policy Bypass)
        this.unlocked = false;
        const unlockAudio = () => {
            if (!this.unlocked && this.context.state !== 'running') {
                this.context.resume().then(() => {
                    this.unlocked = true;
                });
            }
            document.removeEventListener('click', unlockAudio);
            document.removeEventListener('touchstart', unlockAudio);
            document.removeEventListener('keydown', unlockAudio);
        };
        document.addEventListener('click', unlockAudio);
        document.addEventListener('touchstart', unlockAudio, { passive: true });
        document.addEventListener('keydown', unlockAudio);

        this.initSounds();
    }

    initSounds() {
        // --- UI & MENU SOUNDS ---
        this.load('ui_click', 'assets/sounds/ui_click.mp3');
        this.load('ui_hover', 'assets/sounds/ui_hover.mp3');
        this.load('ui_error', 'assets/sounds/ui_error.mp3');
        this.load('ui_ready', 'assets/sounds/ui_ready.mp3');
        this.load('ui_claim', 'assets/sounds/ui_claim.mp3');
        this.load('notification', 'assets/sounds/notification.mp3');
        this.load('upgrade_ready', 'assets/sounds/upgrade_ready.mp3');

        // --- GAMEPLAY & COMBAT ---
        this.load('dash', 'assets/sounds/dash.mp3');
        this.load('hit_marker', 'assets/sounds/hit_marker.mp3');
        this.load('take_damage', 'assets/sounds/take_damage.mp3');
        this.load('xp_pickup', 'assets/sounds/xp_pickup.mp3');
        this.load('level_up', 'assets/sounds/level_up.mp3');
        this.load('enemy_death', 'assets/sounds/enemy_death.mp3');
        this.load('player_death', 'assets/sounds/player_death.mp3');

        // --- SAFE ZONES ---
        this.load('sz_tick', 'assets/sounds/sz_tick.mp3');
        this.load('sz_on', 'assets/sounds/sz_on.mp3');

        // --- ABILITIES ---
        this.load('ability_shield', 'assets/sounds/ability_shield.mp3');
        this.load('ability_blink', 'assets/sounds/ability_blink.mp3');
        this.load('ability_emp', 'assets/sounds/ability_emp.mp3');
        this.load('ability_minigun', 'assets/sounds/ability_minigun.mp3');
        this.load('ability_nuke', 'assets/sounds/ability_nuke.mp3');
        this.load('ability_missile', 'assets/sounds/ability_missile.mp3');
        this.load('plasma_gun', 'assets/sounds/plasma_gun.mp3'); // RAILGUN
    }

    async load(name, path) {
        try {
            const response = await fetch(path);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            this.buffers[name] = audioBuffer;
            this.lastPlayed[name] = 0;
        } catch (e) {
            console.warn(`[SoundManager] Failed to load sound: ${name} at ${path}`, e);
        }
    }

    // Play function with category balancing and pitch variation support
    play(name, category = 'combat', spatialVolume = 1.0, varyPitch = false) {
        if (!this.enabled || !this.buffers[name]) return;

        // Wake up audio context if suspended
        if (this.context.state === 'suspended') {
            this.context.resume();
        }

        const now = Date.now();
        const throttleLimit = this.throttles[name] || this.throttles.default;
        
        if (now - this.lastPlayed[name] < throttleLimit) return;
        this.lastPlayed[name] = now;

        // Create lightweight sound source
        const source = this.context.createBufferSource();
        source.buffer = this.buffers[name];

        // Pitch variation (Makes rapid sounds like XP pickups feel dynamic)
        if (varyPitch) {
            // Randomly shift pitch up or down by a tiny amount
            source.playbackRate.value = 0.9 + (Math.random() * 0.2); 
        }

        // Apply Category Base Volume * Any Distance/Spatial Volume
        const baseVol = this.categoryVolumes[category] || 0.5;
        const finalVolume = baseVol * spatialVolume;

        const gainNode = this.context.createGain();
        gainNode.gain.value = finalVolume;

        // Connect pipes: Source -> Individual Volume -> Master Volume -> Speakers
        source.connect(gainNode);
        gainNode.connect(this.masterGain);

        source.start(0);
    }

    setVolume(val) {
        this.masterVolume = Math.max(0, Math.min(1, val));
        this.masterGain.gain.value = this.masterVolume;
    }

    toggle(state) {
        this.enabled = state !== undefined ? state : !this.enabled;
        this.masterGain.gain.value = this.enabled ? this.masterVolume : 0;
    }
}

export const sounds = new SoundManager();