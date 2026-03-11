// ==========================================
// YEP.IO - SOUND MANAGER (WEB AUDIO API)
// ==========================================

class SoundManager {
    constructor() {
        // Create the high-performance Web Audio API context
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.context = new AudioContext();
        
        this.buffers = {}; // Stores the decoded audio data in RAM
        this.enabled = true;
        this.volume = 0.5;
        this.lastPlayed = {}; 

        // Master volume control that routes to the speakers
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.context.destination);

        // Initialize your library
        this.load('shoot', 'assets/sounds/shoot.mp3');
        this.load('dash', 'assets/sounds/dash.mp3');
        this.load('explosion', 'assets/sounds/explosion.mp3');
        this.load('hit', 'assets/sounds/hit.mp3');
        this.load('collect', 'assets/sounds/collect.mp3');
        this.load('levelUp', 'assets/sounds/levelUp.mp3');
        this.load('upgradeReady', 'assets/sounds/upgradeReady.mp3');
        this.load('click', 'assets/sounds/click.mp3');
    }

    async load(name, path) {
        try {
            // Fetch the audio file and decode it into raw buffer data
            const response = await fetch(path);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            this.buffers[name] = audioBuffer;
            this.lastPlayed[name] = 0;
        } catch (e) {
            console.warn(`Failed to load sound: ${name} at ${path}`, e);
        }
    }

    play(name, customVolume = 1.0) {
        if (!this.enabled || !this.buffers[name]) return;

        // Browsers block audio until the user clicks somewhere.
        // This wakes up the audio engine the moment they click "PLAY".
        if (this.context.state === 'suspended') {
            this.context.resume();
        }

        // Throttling: Prevent 10 bots shooting on the exact same frame 
        // from blowing out the player's speakers
        const now = Date.now();
        if (now - this.lastPlayed[name] < 40) return;
        this.lastPlayed[name] = now;

        // Create a new lightweight sound source for this specific playback
        const source = this.context.createBufferSource();
        source.buffer = this.buffers[name];

        // Create a temporary volume node for just this sound (for spatial audio)
        const gainNode = this.context.createGain();
        gainNode.gain.value = customVolume;

        // Connect the pipes: Source -> Individual Volume -> Master Volume -> Speakers
        source.connect(gainNode);
        gainNode.connect(this.masterGain);

        // Play the sound! (The Web Audio API automatically destroys it when it finishes)
        source.start(0);
    }

    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
        this.masterGain.gain.value = this.volume;
    }

    toggle(state) {
        this.enabled = state !== undefined ? state : !this.enabled;
        this.masterGain.gain.value = this.enabled ? this.volume : 0;
    }
}

export const sounds = new SoundManager();