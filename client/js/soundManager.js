class SoundManager {
    constructor() {
        this.audioCtx = null;
        this.enabled = true;
        this.init();
    }

    init() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
        } catch (e) {
            console.warn("Web Audio API not supported");
            this.enabled = false;
        }
    }

    play(name, vol = 1.0) {
        if (!this.enabled || !this.audioCtx || vol <= 0) return;
        
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        // Soft Fallback Synthesizer to replace missing MP3s
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        // Drastically lower the base volume so it is pleasant and not distorted
        let baseVol = 0.03 * vol; 

        if (name === 'shoot') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(400, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(baseVol, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.1);
        } 
        else if (name === 'explosion') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(10, this.audioCtx.currentTime + 0.3);
            gain.gain.setValueAtTime(baseVol * 1.5, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.3);
        }
        else if (name === 'collect') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(1200, this.audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(baseVol * 0.5, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.1);
        }
        else if (name === 'dash') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(baseVol, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.2);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.2);
        }
        else if (name === 'levelUp' || name === 'upgradeReady') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, this.audioCtx.currentTime);
            osc.frequency.setValueAtTime(600, this.audioCtx.currentTime + 0.1);
            osc.frequency.setValueAtTime(800, this.audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(baseVol, this.audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.4);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.4);
        }
        else if (name === 'hit') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(baseVol * 0.8, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.1);
        }
        else if (name === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);
            gain.gain.setValueAtTime(baseVol, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.05);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.05);
        }
    }
}

export const sounds = new SoundManager();