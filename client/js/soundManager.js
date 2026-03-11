class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = false;
        this.lastPlayTimes = {}; // Limits sounds so they don't overlap and get crazy loud
        
        // Browsers require user interaction before playing audio
        document.addEventListener('click', () => this.init(), {once: true});
        document.addEventListener('keydown', () => this.init(), {once: true});
    }

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.enabled = true;
    }

    play(name, volume = 1.0) {
        if (!this.enabled || !this.ctx) return;
        
        // HARD LIMITER: Prevents 50 bots shooting at once from blowing out your speakers
        let now = Date.now();
        if (this.lastPlayTimes[name] && now - this.lastPlayTimes[name] < 40) return; 
        this.lastPlayTimes[name] = now;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        // Cap maximum possible volume to prevent distortion
        let v = Math.min(volume, 0.4); 

        const t = this.ctx.currentTime;

        if (name === 'shoot') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(300, t);
            osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
            gain.gain.setValueAtTime(v * 0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
            osc.start(); osc.stop(t + 0.1);
        } else if (name === 'hit') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, t);
            osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
            gain.gain.setValueAtTime(v * 0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
            osc.start(); osc.stop(t + 0.1);
        } else if (name === 'explosion') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, t);
            osc.frequency.exponentialRampToValueAtTime(10, t + 0.3);
            gain.gain.setValueAtTime(v * 0.5, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
            osc.start(); osc.stop(t + 0.3);
        } else if (name === 'collect') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, t);
            osc.frequency.linearRampToValueAtTime(900, t + 0.1);
            gain.gain.setValueAtTime(v * 0.2, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.1);
            osc.start(); osc.stop(t + 0.1);
        } else if (name === 'levelUp' || name === 'upgradeReady') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, t);
            osc.frequency.setValueAtTime(554, t + 0.1);
            osc.frequency.setValueAtTime(659, t + 0.2);
            gain.gain.setValueAtTime(v * 0.3, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.4);
            osc.start(); osc.stop(t + 0.4);
        } else if (name === 'dash') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(250, t);
            osc.frequency.exponentialRampToValueAtTime(50, t + 0.2);
            gain.gain.setValueAtTime(v * 0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
            osc.start(); osc.stop(t + 0.2);
        } else if (name === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, t);
            gain.gain.setValueAtTime(v * 0.4, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
            osc.start(); osc.stop(t + 0.05);
        }
    }
}

export const sounds = new SoundManager();