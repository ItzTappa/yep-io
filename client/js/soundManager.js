// ==========================================
// YEP.IO - ENHANCED SOUND MANAGER
// ==========================================

class SoundManager {
    constructor() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.context = new AudioContext();
        
        this.buffers = {};
        this.enabled = true;
        this.masterVolume = 1.0; 
        this.lastPlayed = {}; 
        
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = this.masterVolume;
        this.masterGain.connect(this.context.destination);

        // --- VOLUME BALANCING PRESETS ---
        this.categoryVolumes = {
            ui: 0.3,       
            pickup: 0.15,  
            combat: 0.5,   
            heavy: 0.7,    
            ability: 0.85, 
            alert: 0.6     
        };

        // --- THROTTLE LIMITS ---
        this.throttles = {
            ui_hover: 40,
            slot_spin: 40,      // Prevents audio crash from rapid slot machine ticks
            hit_marker: 30,
            xp_pickup: 15,  
            take_damage: 100, 
            boost_pad: 100,
            asteroid_boom: 100,
            default: 50
        };

        // Browser Policy Bypass
        this.unlocked = false;
        const unlockAudio = () => {
            if (!this.unlocked && this.context.state !== 'running') {
                this.context.resume().then(() => { this.unlocked = true; });
            }
            document.removeEventListener('click', unlockAudio);
            document.removeEventListener('keydown', unlockAudio);
        };
        document.addEventListener('click', unlockAudio);
        document.addEventListener('keydown', unlockAudio);

        this.initSounds();
    }

    initSounds() {
        // UI & Systems
        this.load('ui_click', 'assets/sounds/ui_click.mp3');
        this.load('ui_hover', 'assets/sounds/ui_hover.mp3');
        this.load('ui_error', 'assets/sounds/ui_error.mp3');
        this.load('ui_ready', 'assets/sounds/ui_ready.mp3');
        this.load('ui_claim', 'assets/sounds/ui_claim.mp3');
        this.load('notification', 'assets/sounds/notification.mp3');
        this.load('upgrade_ready', 'assets/sounds/upgrade_ready.mp3');
        this.load('level_up', 'assets/sounds/level_up.mp3');

        // Combat & Movement
        this.load('dash', 'assets/sounds/dash.mp3');
        this.load('hit_marker', 'assets/sounds/hit_marker.mp3');
        this.load('take_damage', 'assets/sounds/take_damage.mp3');
        this.load('xp_pickup', 'assets/sounds/xp_pickup.mp3');
        this.load('enemy_death', 'assets/sounds/enemy_death.mp3');
        this.load('player_death', 'assets/sounds/player_death.mp3');

        // Map Interactables & Events
        this.load('sz_tick', 'assets/sounds/sz_tick.mp3');
        this.load('sz_on', 'assets/sounds/sz_on.mp3');
        this.load('boost_pad', 'assets/sounds/boost_pad.mp3');
        this.load('asteroid_boom', 'assets/sounds/asteroid_boom.mp3');
        this.load('slot_spin', 'assets/sounds/slot_spin.mp3');
        this.load('slot_win', 'assets/sounds/slot_win.mp3');
        this.load('mastery_unlock', 'assets/sounds/mastery_unlock.mp3');

        // Abilities
        this.load('ability_shield', 'assets/sounds/ability_shield.mp3');
        this.load('ability_blink', 'assets/sounds/ability_blink.mp3');
        this.load('ability_emp', 'assets/sounds/ability_emp.mp3');
        this.load('ability_minigun', 'assets/sounds/ability_minigun.mp3');
        this.load('ability_nuke', 'assets/sounds/ability_nuke.mp3');
        this.load('ability_missile', 'assets/sounds/ability_missile.mp3');
        this.load('plasma_gun', 'assets/sounds/plasma_gun.mp3');
    }

    async load(name, path) {
        try {
            const response = await fetch(path);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            this.buffers[name] = audioBuffer;
            this.lastPlayed[name] = 0;
        } catch (e) {
            console.warn(`Failed to load sound: ${name}`, e);
        }
    }

    play(name, category = 'combat', spatialVolume = 1.0, varyPitch = false) {
        if (!this.enabled || !this.buffers[name]) return;

        if (this.context.state === 'suspended') this.context.resume();

        const now = Date.now();
        const throttleLimit = this.throttles[name] || this.throttles.default;
        
        if (now - this.lastPlayed[name] < throttleLimit) return;
        this.lastPlayed[name] = now;

        const source = this.context.createBufferSource();
        source.buffer = this.buffers[name];

        if (varyPitch) {
            source.playbackRate.value = 0.9 + (Math.random() * 0.2); 
        }

        const baseVol = this.categoryVolumes[category] || 0.5;
        const finalVolume = baseVol * spatialVolume;

        const gainNode = this.context.createGain();
        gainNode.gain.value = finalVolume;

        source.connect(gainNode);
        gainNode.connect(this.masterGain);
        source.start(0);
    }

    setVolume(val) {
        this.masterVolume = Math.max(0, Math.min(1, val));
        this.masterGain.gain.value = this.masterVolume;
    }
}

export const sounds = new SoundManager();

// Stable Version - Important Backup