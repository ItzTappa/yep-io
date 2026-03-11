class SoundManager {
    constructor() {
        this.sounds = {};
        this.enabled = true;
        
        // Preload sounds but silently catch errors so it doesn't spam the console
        this.loadSound('shoot', 'assets/sounds/shoot.mp3');
        this.loadSound('hit', 'assets/sounds/hit.mp3');
        this.loadSound('explosion', 'assets/sounds/explosion.mp3');
        this.loadSound('collect', 'assets/sounds/collect.mp3');
        this.loadSound('levelUp', 'assets/sounds/levelUp.mp3');
        this.loadSound('upgradeReady', 'assets/sounds/upgradeReady.mp3');
        this.loadSound('dash', 'assets/sounds/dash.mp3');
        this.loadSound('click', 'assets/sounds/click.mp3');
    }

    loadSound(name, url) {
        const audio = new Audio();
        audio.src = url;
        audio.volume = 1.0;
        
        // Silently ignore missing files
        audio.onerror = () => {
            this.sounds[name] = null; 
        };
        
        this.sounds[name] = audio;
    }

    play(name, volume = 1.0) {
        if (!this.enabled || !this.sounds[name]) return;
        
        try {
            const clone = this.sounds[name].cloneNode();
            clone.volume = Math.max(0, Math.min(1, volume));
            
            let playPromise = clone.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    // Silently catch the DOMException if the file is missing or blocked by browser policy
                });
            }
        } catch (e) {
            // Ignore clone errors
        }
    }
}

export const sounds = new SoundManager();