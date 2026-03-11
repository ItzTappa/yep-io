class SoundManager {
    constructor() {
        // Audio is currently muted to prevent 404 console errors.
        // Once you add real .mp3 files to an /assets/sounds/ folder, we can re-enable this!
        this.enabled = false; 
    }

    play(name, volume = 1.0) {
        if (!this.enabled) return;
        // Silent stub.
    }
}

export const sounds = new SoundManager();