import { Player, Bot, Orb, Projectile, Particle, SafeZone, getWeightedUpgrades } from './entities.js';
import { distance } from './utils.js';
import { sounds } from './soundManager.js';
import { UPGRADE_POOL } from './upgrades.js'; 

export class GameEngine {
    constructor(canvas) {
        this.canvas = canvas; 
        this.ctx = canvas.getContext('2d');
        this.width = window.innerWidth; 
        this.height = window.innerHeight;
        
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr; 
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = `${this.width}px`; 
        this.canvas.style.height = `${this.height}px`;
        this.ctx.scale(dpr, dpr);

        this.worldSize = 8000;
        this.player = null; 
        this.bots = []; 
        this.orbs = []; 
        this.projectiles = []; 
        this.particles = [];
        this.teammates = []; 
        this.safeZones = [];
        this.safeZoneSpawnTimer = 0;
        
        this.lobbyCode = null; 
        this.isHost = false; 
        
        this.mouseX = this.width / 2; 
        this.mouseY = this.height / 2;
        this.keys = {}; 
        this.frameCount = 0; 
        
        this.camera = { x: this.worldSize / 2, y: this.worldSize / 2 };
        this.cameraZoom = 1.0; 
        this.spectateTarget = null;
        
        this.isCinematicIntro = false;
        this.introTimer = 0;
        this.introTargetX = 0;
        this.introTargetY = 0;
        this.introStartZoom = 1.0;

        this.stormActive = false;
        this.stormCenter = { x: 0, y: 0 };
        this.stormRadius = 0;
        
        this.levelUpTimeout = null; 
        this.accountLevelUpTimeout = null; 
        this.animationId = null; 
        
        this.isRunning = false; 
        
        this.fpsInterval = 1000 / 60; 
        this.lastTime = performance.now();
        this.accumulator = 0; 
        
        this.lastFpsTime = performance.now(); 
        this.framesThisSecond = 0;

        this.isGameOver = false;
        this.isDemo = true; 
        this.demoTargetX = this.worldSize / 2;
        this.demoTargetY = this.worldSize / 2;

        this.matchStartTime = 0;
        this.matchXPEarned = 0; 
        this.totalMatchPlayers = 0; 
        this.distanceTraveled = 0;
        this.lastPlayerPos = { x: 0, y: 0 };

        this.pendingUpgrades = 0; 
        this.currentUpgradeChoices = [];
        this.isChoosingUpgrade = false;
        this.pointsToNextUpgrade = 15; 
        
        this.leftTouch = { id: null, originX: 0, originY: 0, x: 0, y: 0, active: false };
        this.aimTouchId = null;
        this.aimOriginX = 0;
        this.aimOriginY = 0;
        this.isAimDragging = false; 
        
        this.isTouchDevice = false; 
        this.screenShake = 0;

        this.initInput();
    }

    getVol() {
        if (window.gameSettings && window.gameSettings.volume !== undefined) {
            return window.gameSettings.volume;
        }
        return 1.0;
    }

    initInput() {
        window.addEventListener('resize', () => {
            this.width = window.innerWidth; 
            this.height = window.innerHeight;
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = this.width * dpr; 
            this.canvas.height = this.height * dpr;
            this.canvas.style.width = `${this.width}px`; 
            this.canvas.style.height = `${this.height}px`;
            this.ctx.scale(dpr, dpr);
        });
        
        window.addEventListener('touchstart', () => {
            this.isTouchDevice = true;
        }, { passive: true });

        window.addEventListener('mousemove', (e) => { 
            if (!this.isTouchDevice) {
                this.mouseX = e.clientX; 
                this.mouseY = e.clientY; 
            }
        });
        
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            const key = e.key.toLowerCase();
            if (window.gameSettings && window.gameSettings.keybinds && Object.values(window.gameSettings.keybinds).includes(key)) { 
                e.preventDefault(); 
            }
            this.keys[key] = true;
            
            if (this.isChoosingUpgrade && !this.isDemo && !this.isGameOver) {
                if (key === '1' && this.currentUpgradeChoices[0]) this.selectUpgrade(0);
                if (key === '2' && this.currentUpgradeChoices[1]) this.selectUpgrade(1);
                if (key === '3' && this.currentUpgradeChoices[2]) this.selectUpgrade(2);
            }
        });
        
        window.addEventListener('keyup', (e) => { 
            if (e.target.tagName === 'INPUT') return;
            this.keys[e.key.toLowerCase()] = false; 
        });

        [1, 2, 3].forEach(num => {
            const card = document.getElementById(`card-${num}`);
            if (card) {
                card.addEventListener('pointerdown', (e) => {
                    if (this.isChoosingUpgrade && !this.isDemo && !this.isGameOver) {
                        e.stopPropagation();
                        this.selectUpgrade(num - 1);
                    }
                });
            }
        });

        const leftZone = document.getElementById('joystick-left');
        const leftBase = document.getElementById('base-left');
        const leftStick = document.getElementById('stick-left');
        const dashBtn = document.getElementById('mobile-dash-btn');
        const abilityBtn = document.getElementById('mobile-ability-btn');

        if (leftZone) {
            leftZone.addEventListener('touchstart', (e) => {
                if (this.isDemo || this.isGameOver) return; 
                e.preventDefault();
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const t = e.changedTouches[i];
                    if (!this.leftTouch.active) {
                        this.leftTouch.active = true;
                        this.leftTouch.id = t.identifier;
                        this.leftTouch.originX = t.clientX;
                        this.leftTouch.originY = t.clientY;
                        this.leftTouch.x = t.clientX;
                        this.leftTouch.y = t.clientY;
                        
                        leftBase.style.bottom = 'auto'; 
                        leftBase.style.left = t.clientX + 'px';
                        leftBase.style.top = t.clientY + 'px';
                        leftBase.style.transform = 'translate(-50%, -50%)';
                        leftBase.classList.add('active');
                        leftStick.style.transform = `translate(-50%, -50%)`;
                    }
                }
            }, {passive: false});

            leftZone.addEventListener('touchmove', (e) => {
                if (this.isDemo || this.isGameOver) return; 
                e.preventDefault();
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const t = e.changedTouches[i];
                    if (this.leftTouch.active && t.identifier === this.leftTouch.id) {
                        this.leftTouch.x = t.clientX;
                        this.leftTouch.y = t.clientY;
                        
                        let dx = t.clientX - this.leftTouch.originX;
                        let dy = t.clientY - this.leftTouch.originY;
                        let dist = Math.hypot(dx, dy);
                        let maxDist = 40; 
                        if (dist > maxDist) { 
                            dx = (dx/dist) * maxDist; 
                            dy = (dy/dist) * maxDist; 
                        }
                        leftStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                    }
                }
            }, {passive: false});

            const endLeft = (e) => {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const t = e.changedTouches[i];
                    if (this.leftTouch.active && t.identifier === this.leftTouch.id) {
                        this.leftTouch.active = false;
                        leftBase.classList.remove('active'); 
                        
                        leftBase.style.top = 'auto';
                        leftBase.style.bottom = '40px';
                        leftBase.style.left = '40px';
                        leftBase.style.transform = 'none';
                        leftStick.style.transform = `translate(-50%, -50%)`;
                    }
                }
            };
            leftZone.addEventListener('touchend', endLeft);
            leftZone.addEventListener('touchcancel', endLeft);
        }

        window.addEventListener('touchstart', (e) => {
            if (this.isDemo || this.isGameOver) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if ((!this.leftTouch.active || t.identifier !== this.leftTouch.id) && 
                    e.target.id !== 'mobile-dash-btn' && 
                    e.target.id !== 'mobile-ability-btn' && 
                    !e.target.closest('#joystick-left') &&
                    !e.target.closest('.card')) { 
                    
                    this.aimTouchId = t.identifier;
                    this.aimOriginX = t.clientX;
                    this.aimOriginY = t.clientY;
                    this.isAimDragging = false; 
                }
            }
        }, {passive: false});

        window.addEventListener('touchmove', (e) => {
            if (this.isDemo || this.isGameOver) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (t.identifier === this.aimTouchId) {
                    let dx = t.clientX - this.aimOriginX;
                    let dy = t.clientY - this.aimOriginY;
                    
                    if (!this.isAimDragging && Math.hypot(dx, dy) > 10) { 
                        this.isAimDragging = true;
                    }

                    if (this.isAimDragging && this.player) {
                        this.player.angle = Math.atan2(dy, dx);
                    }
                }
            }
        }, {passive: false});

        window.addEventListener('touchend', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === this.aimTouchId) {
                    this.aimTouchId = null;
                    this.isAimDragging = false; 
                }
            }
        });

        if (dashBtn) {
            dashBtn.addEventListener('touchstart', (e) => {
                if (this.isDemo || this.isGameOver) return;
                e.preventDefault();
                if (window.gameSettings && window.gameSettings.keybinds) this.keys[window.gameSettings.keybinds.dash] = true;
            });
            dashBtn.addEventListener('touchend', (e) => {
                if (this.isDemo || this.isGameOver) return;
                e.preventDefault();
                if (window.gameSettings && window.gameSettings.keybinds) this.keys[window.gameSettings.keybinds.dash] = false;
            });
        }
        
        if (abilityBtn) {
            abilityBtn.addEventListener('touchstart', (e) => {
                if (this.isDemo || this.isGameOver) return;
                e.preventDefault();
                if (window.gameSettings && window.gameSettings.keybinds) this.keys[window.gameSettings.keybinds.ability] = true;
            });
            abilityBtn.addEventListener('touchend', (e) => {
                if (this.isDemo || this.isGameOver) return;
                e.preventDefault();
                if (window.gameSettings && window.gameSettings.keybinds) this.keys[window.gameSettings.keybinds.ability] = false;
            });
        }
    }

    playSoundAt(soundName, x, y, baseVolume = 1.0) {
        const dist = distance(this.camera.x, this.camera.y, x, y);
        const maxHearingDistance = 2000; 
        if (dist < maxHearingDistance) {
            const falloff = 1 - (dist / maxHearingDistance);
            const spatialVolume = baseVolume * (falloff * falloff) * this.getVol();
            sounds.play(soundName, spatialVolume);
        }
    }

    getSafeSpawnPosition(minDistFromOthers = 0) {
        let x, y, isSafe = false;
        let attempts = 0;
        
        while (!isSafe && attempts < 100) {
            x = Math.random() * this.worldSize; 
            y = Math.random() * this.worldSize;
            isSafe = true;
            
            // Keep away from player
            if (this.player && distance(x, y, this.player.x, this.player.y) < 1000) {
                isSafe = false;
            }
            
            // Keep away from other safe zones!
            if (isSafe && minDistFromOthers > 0) {
                for (let sz of this.safeZones) {
                    if (distance(x, y, sz.x, sz.y) < minDistFromOthers) {
                        isSafe = false;
                        break;
                    }
                }
            }
            attempts++;
        }
        return { x, y };
    }

    getSafeOrbPosition(minDist = 500) {
        let x, y; 
        let isSafe = false; 
        let attempts = 0;
        
        while (!isSafe && attempts < 50) {
            x = Math.random() * this.worldSize; 
            y = Math.random() * this.worldSize; 
            isSafe = true;
            for (let orb of this.orbs) {
                if (orb.type === 'health' && distance(x, y, orb.x, orb.y) < minDist) { 
                    isSafe = false; 
                    break; 
                }
            }
            attempts++;
        }
        return { x, y };
    }

    spawnParticles(x, y, color, amount) {
        if (window.gameSettings && window.gameSettings.particles === false) return;
        for (let i = 0; i < amount; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    grantAccountXP(baseAmount, enemyPoints = 0) {
        let multiplier = 1;
        if (this.player && enemyPoints > this.player.points) { 
            multiplier = enemyPoints / Math.max(1, this.player.points); 
        }
        multiplier = Math.min(multiplier, 5);
        
        let bonusFromScore = Math.floor(enemyPoints / 100); 
        const finalXP = Math.floor(baseAmount * multiplier) + bonusFromScore;
        window.globalAccountXP += finalXP;
        this.matchXPEarned += finalXP;
        this.checkAccountLevelUp();
    }

    checkAccountLevelUp() {
        let xpRequired = window.globalAccountLevel * 1000;
        let leveledUp = false;
        
        while (window.globalAccountXP >= xpRequired) {
            window.globalAccountLevel++; 
            window.globalAccountXP -= xpRequired;
            xpRequired = window.globalAccountLevel * 1000; 
            leveledUp = true;
        }
        
        if (leveledUp && !this.isDemo) {
            if (!window.gameSettings || window.gameSettings.showNotifs !== false) {
                const notif = document.getElementById('account-level-notif');
                if (notif) {
                    sounds.play('levelUp', 0.8 * this.getVol());
                    document.getElementById('account-notif-level-num').innerText = window.globalAccountLevel;
                    notif.classList.remove('hidden');
                    notif.classList.add('show');
                    if (this.accountLevelUpTimeout) {
                        clearTimeout(this.accountLevelUpTimeout);
                    }
                    this.accountLevelUpTimeout = setTimeout(() => {
                        notif.classList.remove('show');
                    }, 4000);
                }
            }
        }
    }

    stopLoop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    startDemo() {
        this.stopLoop();
        
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) mobileControls.classList.add('hidden');
        
        const gameUi = document.getElementById('game-ui');
        if (gameUi) {
            gameUi.classList.add('hidden');
            gameUi.style.display = 'none';
        }
        
        const hudEl = document.querySelector('.hud');
        if (hudEl) {
            hudEl.classList.add('hidden');
            hudEl.style.display = 'none';
        }
        
        const brUi = document.getElementById('br-ui');
        if (brUi) brUi.classList.add('hidden');

        this.worldSize = 4000;
        this.stormActive = false;
        this.isDemo = true; 
        this.isGameOver = false; 
        this.spectateTarget = null;
        this.bots = []; 
        this.orbs = []; 
        this.projectiles = []; 
        this.particles = [];
        this.teammates = []; 
        this.safeZones = []; 
        this.isCinematicIntro = false;
        
        this.player = new Player(-10000, -10000, 'circle', ""); 
        this.player.health = 999999; 

        for(let i = 0; i < 30; i++) {
            const types = ['triangle', 'square', 'circle'];
            const type = types[Math.floor(Math.random() * 3)];
            this.bots.push(new Bot(Math.random() * this.worldSize, Math.random() * this.worldSize, type, Math.random() * 5000));
        }
        
        for(let i = 0; i < 1000; i++) {
            this.orbs.push(new Orb(Math.random() * this.worldSize, Math.random() * this.worldSize, 'xp', 1, null, 0));
        }

        this.demoTargetX = this.worldSize / 2; 
        this.demoTargetY = this.worldSize / 2;
        this.camera.x = this.demoTargetX; 
        this.camera.y = this.demoTargetY;
        this.cameraZoom = 1.0;
        
        this.isRunning = true;
        this.accumulator = 0;
        this.lastTime = performance.now(); 
        
        this.animationId = requestAnimationFrame((t) => this.loop(t));
    }

    start(playerClass) {
        this.stopLoop();
        
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            if ('ontouchstart' in window || navigator.maxTouchPoints > 0) mobileControls.classList.remove('hidden');
            else mobileControls.classList.add('hidden');
        }
        
        const brUi = document.getElementById('br-ui');
        if (brUi) brUi.classList.remove('hidden');
        
        this.worldSize = 8000; // 8k map size
        this.stormActive = false; 

        this.isDemo = false; 
        this.isGameOver = false; 
        this.spectateTarget = null;
        this.bots = []; 
        this.orbs = []; 
        this.projectiles = []; 
        this.particles = [];
        this.teammates = [];
        this.screenShake = 0;
        
        this.safeZones = [];
        this.safeZoneSpawnTimer = 0;
        
        // Force them to be 4000 units apart
        for(let i = 0; i < 3; i++) {
            let pos = this.getSafeSpawnPosition(4000);
            this.safeZones.push(new SafeZone(pos.x, pos.y));
        }
        
        this.player = new Player(this.worldSize / 2, this.worldSize / 2, playerClass, "");

        this.camera.x = this.player.x; 
        this.camera.y = this.player.y;
        this.cameraZoom = 1.0; 
        this.isCinematicIntro = false;
        
        this.pointsToNextUpgrade = 15; 
        this.matchStartTime = Date.now(); 
        this.matchXPEarned = 0; 
        this.distanceTraveled = 0; 
        this.lastPlayerPos = { x: this.player.x, y: this.player.y };
        this.pendingUpgrades = 0; 
        this.isChoosingUpgrade = false;
        
        const upgradeUi = document.getElementById('upgrade-ui');
        if (upgradeUi) upgradeUi.classList.add('hidden');
        
        const gameUi = document.getElementById('game-ui');
        if (gameUi) {
            gameUi.classList.remove('hidden');
            gameUi.style.display = 'block';
        }

        const hudEl = document.querySelector('.hud');
        if (hudEl) {
            hudEl.classList.remove('hidden');
            hudEl.style.display = 'block';
        }

        const xpBarContainer = document.querySelector('.xp-bar-container');
        if (xpBarContainer) {
            xpBarContainer.classList.remove('hidden');
            xpBarContainer.style.display = 'block';
        }
        
        const xpBar = document.getElementById('xp-bar');
        if (xpBar) xpBar.style.width = '0%';
        
        const levelDisplay = document.getElementById('level-display');
        if (levelDisplay) levelDisplay.innerText = '0 PTS';
        
        const lb = document.getElementById('leaderboard-container') || document.querySelector('.leaderboard');
        if (lb) {
            lb.classList.remove('hidden');
            if (window.gameSettings && window.gameSettings.showLeaderboard === false) {
                lb.style.display = 'none';
            } else {
                lb.style.display = 'block';
            }
        }
        
        const badgeUI = document.getElementById('upgrade-badges');
        if (badgeUI) {
            badgeUI.classList.remove('hidden');
            badgeUI.innerHTML = '';
            if (window.gameSettings && window.gameSettings.showBadges === false) {
                badgeUI.style.display = 'none';
            } else {
                badgeUI.style.display = 'flex';
            }
        }
        
        let matchSeed = Math.random();
        
        // 49 Bots
        for(let i = 0; i < 49; i++) {
            const types = ['triangle', 'square', 'circle']; 
            const type = types[Math.floor(Math.random() * 3)]; 
            const spawn = this.getSafeSpawnPosition();
            
            let startingPts = 0;
            if (matchSeed > 0.9) startingPts = Math.random() < 0.2 ? Math.random() * 5000 : Math.random() * 500; 
            else if (matchSeed < 0.4) startingPts = Math.random() * 80; 
            else startingPts = Math.random() < 0.1 ? Math.random() * 1000 : Math.random() * 100; 
            
            this.bots.push(new Bot(spawn.x, spawn.y, type, startingPts));
        }
        
        // 2,500 Orbs
        for(let i = 0; i < 2500; i++) {
            const x = Math.random() * this.worldSize;
            const y = Math.random() * this.worldSize;
            this.orbs.push(new Orb(x, y, 'xp', 1, null, 0));
        }
        
        for(let i = 0; i < 75; i++) { 
            let pos = this.getSafeOrbPosition(500); 
            this.orbs.push(new Orb(pos.x, pos.y, 'health', 1, null, 0)); 
        }

        this.totalMatchPlayers = this.bots.length + 1; 
        
        this.isRunning = true;
        this.accumulator = 0;
        this.lastTime = performance.now(); 
        this.lastFpsTime = performance.now(); 
        this.framesThisSecond = 0;
        
        this.animationId = requestAnimationFrame((t) => this.loop(t));
    }

    startMultiplayer(players, lobbyCode, isHost) {
        this.stopLoop();
        
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            if ('ontouchstart' in window || navigator.maxTouchPoints > 0) mobileControls.classList.remove('hidden');
            else mobileControls.classList.add('hidden');
        }
        
        this.lobbyCode = lobbyCode; 
        this.isHost = isHost || false;
        
        this.worldSize = 8000; 
        this.stormActive = true; 
        this.stormCenter = { x: this.worldSize / 2, y: this.worldSize / 2 };
        this.stormRadius = 6000; 

        this.isDemo = false; 
        this.isGameOver = false; 
        this.spectateTarget = null;
        this.bots = []; 
        this.orbs = []; 
        this.projectiles = []; 
        this.particles = [];
        this.teammates = [];
        this.screenShake = 0;
        
        this.safeZones = [];
        this.safeZoneSpawnTimer = 0;
        for(let i = 0; i < 3; i++) {
            let pos = this.getSafeSpawnPosition(4000);
            this.safeZones.push(new SafeZone(pos.x, pos.y));
        }

        const gameUi = document.getElementById('game-ui');
        if (gameUi) {
            gameUi.classList.remove('hidden');
            gameUi.style.display = 'block';
        }

        const hudEl = document.querySelector('.hud');
        if (hudEl) {
            hudEl.classList.remove('hidden');
            hudEl.style.display = 'block';
        }

        const xpBarContainer = document.querySelector('.xp-bar-container');
        if (xpBarContainer) {
            xpBarContainer.classList.remove('hidden');
            xpBarContainer.style.display = 'block';
        }
        
        const lb = document.getElementById('leaderboard-container') || document.querySelector('.leaderboard');
        if (lb) {
            lb.classList.remove('hidden');
            if (window.gameSettings && window.gameSettings.showLeaderboard === false) {
                lb.style.display = 'none';
            } else {
                lb.style.display = 'block';
            }
        }
        
        const badgeUI = document.getElementById('upgrade-badges');
        if (badgeUI) {
            badgeUI.classList.remove('hidden');
            badgeUI.innerHTML = '';
            if (window.gameSettings && window.gameSettings.showBadges === false) {
                badgeUI.style.display = 'none';
            } else {
                badgeUI.style.display = 'flex';
            }
        }
        
        const brUi = document.getElementById('br-ui');
        if (brUi) brUi.classList.remove('hidden'); 

        let spawnX = this.worldSize / 2;
        let spawnY = this.worldSize / 2;
        let spacing = 150;
        let totalWidth = (players.length - 1) * spacing;
        let startX = spawnX - totalWidth / 2;

        for (let i = 0; i < players.length; i++) {
            let pData = players[i];
            let px = startX + i * spacing;
            let py = spawnY;

            if (pData.id === 'local') {
                const activeBtn = document.querySelector('.class-btn.active');
                let pClass = activeBtn ? activeBtn.dataset.class : 'triangle';
                
                this.player = new Player(px, py, pClass, "");
                this.player.color = pData.color; 
                this.introTargetX = px;
                this.introTargetY = py;
            } else {
                let bot = new Bot(px, py, pData.classType || 'square', 0);
                bot.name = pData.name;
                bot.color = pData.color;
                bot.isTeammate = true; 
                bot.isRemotePlayer = true; 
                bot.remoteId = pData.id; 
                
                this.bots.push(bot);
                this.teammates.push(bot);
            }
        }

        if (this.isHost) {
            let botsToSpawn = 50 - players.length;
            
            for(let i = 0; i < botsToSpawn; i++) {
                const types = ['triangle', 'square', 'circle']; 
                const type = types[Math.floor(Math.random() * 3)]; 
                const spawn = this.getSafeSpawnPosition();
                
                let b = new Bot(spawn.x, spawn.y, type, 0);
                b.id = 'b' + i; 
                this.bots.push(b);
            }
            
            setTimeout(() => {
                if (window.gameSocket) {
                    window.gameSocket.emit('hostInit', {
                        code: this.lobbyCode,
                        bots: this.bots.filter(b => !b.isRemotePlayer).map(b => ({ 
                            id: b.id, 
                            x: Math.round(b.x), 
                            y: Math.round(b.y), 
                            type: b.type, 
                            pts: Math.round(b.points),
                            c: b.color, 
                            u: b.upgrades || {}, 
                            n: b.name
                        }))
                    });
                }
            }, 2500);
        } else {
            this.bots = [...this.teammates]; 
        }

        for(let i = 0; i < 2500; i++) {
            this.orbs.push(new Orb(Math.random() * this.worldSize, Math.random() * this.worldSize, 'xp', 1, null, 0));
        }
        
        for(let i = 0; i < 75; i++) { 
            let pos = this.getSafeOrbPosition(500); 
            this.orbs.push(new Orb(pos.x, pos.y, 'health', 1, null, 0));
        }

        if (window.gameSocket) {
            window.gameSocket.removeAllListeners('hostInit');
            window.gameSocket.removeAllListeners('hostBotSync');
            window.gameSocket.removeAllListeners('teammateMoved');
            window.gameSocket.removeAllListeners('teammateShoot');
            window.gameSocket.removeAllListeners('teammateDied');
            
            window.gameSocket.on('hostInit', (data) => {
                if (this.isHost) return;
                
                this.bots = [...this.teammates]; 
                
                data.bots.forEach(b => {
                    let bot = new Bot(b.x, b.y, b.type, 0);
                    bot.id = b.id;
                    bot.points = b.pts; 
                    bot.name = b.n || bot.name; 
                    if (b.c) bot.color = b.c;
                    
                    if (b.u && typeof bot.applyUpgrade === 'function') {
                        if (!bot.upgrades) {
                            bot.upgrades = {};
                        }
                        for (let key in b.u) {
                            let hostTier = b.u[key];
                            for(let i = 0; i < hostTier; i++) {
                                bot.applyUpgrade(key);
                            }
                        }
                    }
                    bot.upgradeProgress = -999999; 
                    this.bots.push(bot);
                });
            });

            window.gameSocket.on('hostBotSync', (data) => {
                if (this.isHost) return;
                
                data.bots.forEach(bd => {
                    let bot = this.bots.find(b => b.id === bd.id);
                    if (bot) {
                        bot.x += (bd.x - bot.x) * 0.5; 
                        bot.y += (bd.y - bot.y) * 0.5;
                        bot.health = bd.h;
                        bot.points = bd.pts; 
                        bot.name = bd.n || bot.name; 
                        if (bd.c) bot.color = bd.c;
                        
                        if (bd.u && typeof bot.applyUpgrade === 'function') {
                            if (!bot.upgrades) bot.upgrades = {};
                            for (let key in bd.u) {
                                let hostTier = bd.u[key];
                                let localTier = bot.upgrades[key] || 0;
                                while (localTier < hostTier) {
                                    bot.applyUpgrade(key);
                                    localTier++;
                                }
                            }
                        }
                        
                        bot.upgradeProgress = -999999; 
                        if (bd.d && !bot.isDead) {
                            this.processDeath(bot, null); 
                        }
                    } else if (!bd.d) {
                        let newBot = new Bot(bd.x, bd.y, bd.type, 0);
                        newBot.id = bd.id;
                        newBot.health = bd.h;
                        newBot.points = bd.pts;
                        newBot.name = bd.n || newBot.name; 
                        if (bd.c) newBot.color = bd.c;
                        
                        if (bd.u && typeof newBot.applyUpgrade === 'function') {
                            for (let key in bd.u) {
                                let hostTier = bd.u[key];
                                for(let i = 0; i < hostTier; i++) {
                                    newBot.applyUpgrade(key);
                                }
                            }
                        }
                        newBot.upgradeProgress = -999999; 
                        this.bots.push(newBot);
                    }
                });
            });

            window.gameSocket.on('teammateMoved', (data) => {
                let tm = this.teammates.find(t => t.remoteId === data.id);
                if (tm) {
                    tm.x = data.x; 
                    tm.y = data.y; 
                    tm.angle = data.angle;
                    if (data.health) tm.health = data.health;
                    if (data.maxHealth) tm.maxHealth = data.maxHealth;
                    if (data.points !== undefined) tm.points = data.points; 
                }
            });

            window.gameSocket.on('teammateShoot', (data) => {
                let tm = this.teammates.find(t => t.remoteId === data.id);
                if (tm) {
                    const totalShots = (data.multiShot || 0) + 1;
                    const spreadAngle = 0.2; 
                    const startAngle = data.angle - (spreadAngle * (totalShots - 1)) / 2;
                    
                    for (let s = 0; s < totalShots; s++) {
                        let finalAngle = startAngle + (s * spreadAngle);
                        if (data.type === 'triangle') {
                            finalAngle += (Math.random() - 0.5) * 0.15;
                        }
                        this.fireProjectile(tm, finalAngle);
                    }
                }
            });

            window.gameSocket.on('teammateDied', (data) => {
                let tm = this.teammates.find(t => t.remoteId === data.id);
                if (tm && !tm.isDead) {
                    this.processDeath(tm, null); 
                }
            });
        }

        this.isCinematicIntro = true;
        this.introTimer = 0;
        this.camera.x = spawnX;
        this.camera.y = spawnY;
        
        if (players.length <= 2) {
            this.introStartZoom = 0.8;
        } else if (players.length === 3) {
            this.introStartZoom = 0.65;
        } else {
            this.introStartZoom = 0.5;
        }
        
        this.cameraZoom = this.introStartZoom;

        this.pointsToNextUpgrade = 15; 
        this.matchStartTime = Date.now(); 
        this.matchXPEarned = 0; 
        this.distanceTraveled = 0; 
        this.lastPlayerPos = { x: this.player.x, y: this.player.y };
        this.pendingUpgrades = 0; 
        this.isChoosingUpgrade = false;

        document.getElementById('upgrade-ui').classList.add('hidden');
        document.getElementById('xp-bar').style.width = '0%';
        document.getElementById('level-display').innerText = '0 PTS';

        this.totalMatchPlayers = 50; 
        
        this.isRunning = true;
        this.accumulator = 0;
        this.lastTime = performance.now(); 
        
        this.animationId = requestAnimationFrame((t) => this.loop(t));
    }

    updateLeaderboard() {
        const container = document.getElementById('leaderboard-container') || document.querySelector('.leaderboard');
        
        if (window.gameSettings && window.gameSettings.showLeaderboard === false) {
            if (container) container.style.display = 'none';
            return;
        }
        
        if (container) container.style.display = 'block';

        const allPlayers = (this.isDemo || this.isGameOver) ? [...this.bots] : (this.player ? [this.player, ...this.bots] : [...this.bots]);
        allPlayers.sort((a, b) => b.points - a.points); 
        
        if (this.isDemo) return; 
        
        const list = document.getElementById('leaderboard-list'); 
        if (!list) return;
        list.innerHTML = ''; 
        
        const displayLimit = window.innerWidth <= 768 ? 5 : 10;
        
        allPlayers.slice(0, displayLimit).forEach((p, index) => {
            const li = document.createElement('li'); 
            let displayPts = p.points >= 1000 ? (p.points / 1000).toFixed(1) + 'k' : Math.floor(p.points);
            li.innerText = `#${index + 1} ${p.isPlayer ? "YOU" : p.name} - ${displayPts} Pts`;
            if (p === this.player) {
                li.style.color = '#00ffcc';
            }
            list.appendChild(li);
        });
    }

    updateUpgradeBadges() {
        const container = document.getElementById('upgrade-badges');
        if (!container) return;
        
        if (window.gameSettings && window.gameSettings.showBadges === false) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';
        container.innerHTML = '';
        
        if (this.player && this.player.activeAbility) {
            let abDef = UPGRADE_POOL.find(u => u.id === this.player.activeAbility);
            let abName = abDef ? abDef.title.toUpperCase() : this.player.activeAbility.toUpperCase();
            let keyText = this.isTouchDevice ? 'TAP ABILITY' : '[E] TO USE';
            container.innerHTML += `
                <div class="upgrade-badge ability-badge" title="Active Ability">
                    <div class="badge-name">⭐ ${abName}</div>
                    <div class="badge-tier">${keyText}</div>
                </div>`;
        }
        
        if (this.player && this.player.upgrades) {
            for (let upgId in this.player.upgrades) {
                let def = UPGRADE_POOL.find(u => u && u.id === upgId);
                if (def && def.isActiveAbility) continue;
                
                let tier = this.player.upgrades[upgId];
                if (tier > 0) {
                    let title = def ? def.title.toUpperCase() : upgId.toUpperCase();
                    let tierClass = tier === 1 ? 'badge-t1' : tier === 2 ? 'badge-t2' : tier === 3 ? 'badge-t3' : tier === 4 ? 'badge-t4' : 'badge-t5';
                    
                    container.innerHTML += `
                        <div class="upgrade-badge ${tierClass}" title="${def ? def.title : ''}">
                            <div class="badge-name">${title}</div>
                            <div class="badge-tier">T${tier}</div>
                        </div>`;
                }
            }
        }
    }

    showNextUpgrade() {
        if (this.pendingUpgrades <= 0 || this.isDemo || this.isGameOver || !this.player) return;
        
        this.isChoosingUpgrade = true; 
        this.currentUpgradeChoices = getWeightedUpgrades(this.player, 3);
        
        if (this.currentUpgradeChoices.length === 0) { 
            this.pendingUpgrades = 0; 
            this.isChoosingUpgrade = false; 
            return; 
        }

        for (let i = 0; i < 3; i++) {
            const choice = this.currentUpgradeChoices[i]; 
            const card = document.getElementById(`card-${i+1}`);
            
            if (choice && card) {
                card.className = 'card';
                
                const currentTier = this.player.upgrades[choice.id] || 0;
                
                if (choice.isActiveAbility) {
                    card.classList.add('ability-card');
                    let shortName = choice.title.replace('Active: ', '');
                    document.getElementById(`title-${i+1}`).innerHTML = `⭐ ABILITY:<br/>${shortName.toUpperCase()}`;
                } else {
                    if (currentTier === 1) card.classList.add('card-t1');
                    else if (currentTier === 2) card.classList.add('card-t2');
                    else if (currentTier === 3) card.classList.add('card-t3');
                    else if (currentTier >= 4) card.classList.add('card-t4');
                    
                    document.getElementById(`title-${i+1}`).innerText = `${choice.title} [T${currentTier+1}]`;
                }
                
                document.getElementById(`desc-${i+1}`).innerText = choice.desc;
                card.style.display = 'block';
            } else if (card) { 
                card.style.display = 'none'; 
            }
        }
        
        const ui = document.getElementById('upgrade-ui');
        if (ui) {
            ui.classList.remove('hidden');
        }
    }

    selectUpgrade(index) {
        if (this.isDemo || this.isGameOver || !this.player) return;
        
        const choice = this.currentUpgradeChoices[index];
        this.player.applyUpgrade(choice.id); 
        this.grantAccountXP(15); 
        this.updateUpgradeBadges(); 
        
        const ui = document.getElementById('upgrade-ui');
        if (ui) {
            ui.classList.add('hidden');
        }
        
        this.isChoosingUpgrade = false; 
        this.pendingUpgrades--;
        
        if (this.pendingUpgrades > 0) {
            setTimeout(() => this.showNextUpgrade(), 200); 
        }
    }

    triggerUpgradeReady() {
        if (this.isDemo || this.isGameOver) return;
        
        if (!window.gameSettings || window.gameSettings.showNotifs !== false) {
            const notif = document.getElementById('level-up-notif');
            if (notif) {
                sounds.play('upgradeReady', 0.6 * this.getVol()); 
                notif.classList.remove('hidden');
                notif.classList.add('show');
                
                if (this.levelUpTimeout) {
                    clearTimeout(this.levelUpTimeout);
                }
                
                this.levelUpTimeout = setTimeout(() => {
                    notif.classList.remove('show');
                }, 3000);
            }
        }
        
        this.pendingUpgrades++; 
        
        if (!this.isChoosingUpgrade) {
            this.showNextUpgrade();
        }
    }

    fireProjectile(owner, angle) {
        let p = new Projectile(owner.x, owner.y, angle, owner);
        this.projectiles.push(p);
        
        this.playSoundAt('shoot', owner.x, owner.y, 0.25);
        
        if (owner.rearguard > 0) {
            let rearP = new Projectile(owner.x, owner.y, angle + Math.PI, owner);
            this.projectiles.push(rearP);
        }
    }

    processDeath(victim, killer) {
        if (victim.isDead) return;
        victim.isDead = true;

        this.playSoundAt('explosion', victim.x, victim.y, 0.7);
        this.spawnParticles(victim.x, victim.y, victim.color, 30); 
        
        if (!this.isDemo && this.player && distance(this.player.x, this.player.y, victim.x, victim.y) < 500) {
            this.screenShake = Math.max(this.screenShake, 15);
        }
        
        if (victim === this.player && window.gameSocket && this.lobbyCode) {
            window.gameSocket.emit('playerDied', { code: this.lobbyCode });
        }

        let totalTargetPoints = victim.points || 0;
        let orbReward = Math.floor(totalTargetPoints * 0.35); 
        
        if (killer) {
            if (killer === this.player && !this.isGameOver) {
                this.player.kills++;
                this.grantAccountXP(50, totalTargetPoints);
            } 
            if (killer.vampirism > 0) {
                killer.health = Math.min(killer.maxHealth, killer.health + killer.vampirism);
                this.spawnParticles(killer.x, killer.y, '#ff0044', 5);
            }
        }

        let orbsToSpawn = Math.min(orbReward, 100); 
        if (orbsToSpawn > 0) {
            let valuePerOrb = Math.max(1, Math.floor(orbReward / orbsToSpawn));
            for (let o = 0; o < orbsToSpawn; o++) {
                this.orbs.push(new Orb(victim.x, victim.y, 'xp', valuePerOrb, null, 180));
            }
        } else if (totalTargetPoints < 3) {
            this.orbs.push(new Orb(victim.x, victim.y, 'xp', 1, null, 100));
        }
        
        if (killer && killer.medicDrop > 0 && Math.random() < (killer.medicDrop * 0.15)) {
            this.orbs.push(new Orb(victim.x, victim.y, 'health'));
        }
        
        if (Math.random() < 0.10) {
            this.orbs.push(new Orb(victim.x, victim.y, 'health'));
        }
        
        if (victim === this.player) {
            this.screenShake = 25; 
            this.handleGameOver(killer);
        } else {
            const botIndex = this.bots.indexOf(victim);
            if (botIndex > -1) {
                this.bots.splice(botIndex, 1);
            }
            
            if (this.spectateTarget === victim) {
                this.spectateTarget = killer;
                const killerNameEl = document.getElementById('go-killer-name');
                if (killerNameEl) {
                    killerNameEl.innerText = killer ? killer.name : "UNKNOWN";
                }
            }

            let isSinglePlayer = !this.lobbyCode;
            
            if (!this.isDemo && !this.stormActive && (this.isHost || isSinglePlayer)) { 
                // NEW RESPAWN AT ZERO POINTS LOGIC!
                setTimeout(() => {
                    if (this.isGameOver) return;
                    
                    const safePos = this.getSafeSpawnPosition(1500); // 1500 away from player
                    const types = ['triangle', 'square', 'circle'];
                    
                    let newBot = new Bot(safePos.x, safePos.y, types[Math.floor(Math.random() * 3)], 0); // START AT 0!
                    newBot.id = 'b_respawn' + Math.random();
                    this.bots.push(newBot);
                }, 3000); 
            }
        }
    }

    handleGameOver(killer) {
        if (this.isDemo || this.isGameOver || !this.player) return; 
        
        this.isGameOver = true;
        this.spectateTarget = killer;
        
        const ui = document.getElementById('upgrade-ui');
        if (ui) {
            ui.classList.add('hidden'); 
        }

        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            mobileControls.classList.add('hidden');
        }

        const timeAlive = Math.floor((Date.now() - this.matchStartTime) / 1000);
        this.grantAccountXP(timeAlive * 2);

        const allPlayers = [this.player, ...this.bots];
        allPlayers.sort((a, b) => b.points - a.points);
        const rank = allPlayers.indexOf(this.player) + 1;
        const totalPlayers = allPlayers.length;

        let suffix = "th";
        if (rank % 10 === 1 && rank % 100 !== 11) suffix = "st";
        else if (rank % 10 === 2 && rank % 100 !== 12) suffix = "nd";
        else if (rank % 10 === 3 && rank % 100 !== 13) suffix = "rd";

        const placementEl = document.getElementById('go-placement');
        if (placementEl) {
            placementEl.innerText = `${rank}${suffix}`;
        }
        
        const xpEl = document.getElementById('go-xp');
        if (xpEl) {
            xpEl.innerText = `+${this.matchXPEarned}`;
        }

        window.lastMatchStats = {
            kills: this.player.kills || 0,
            time: timeAlive || 0,
            points: Math.floor(this.player.points || 0),
            distance: Math.floor(this.distanceTraveled || 0),
            rank: rank || 0,
            totalPlayers: totalPlayers || 0,
            playerClass: this.player.type || 'Unknown',
            upgrades: JSON.parse(JSON.stringify(this.player.upgrades || {})) 
        };

        const goKillerName = document.getElementById('go-killer-name');
        if (goKillerName) goKillerName.innerText = killer ? killer.name : "UNKNOWN";
        
        const goPoints = document.getElementById('go-points');
        if (goPoints) goPoints.innerText = Math.floor(this.player.points);
        
        const goKills = document.getElementById('go-kills');
        if (goKills) goKills.innerText = this.player.kills;
        
        const goTime = document.getElementById('go-time');
        if (goTime) goTime.innerText = `${timeAlive}s`;
        
        const gameOverScreen = document.getElementById('game-over-screen');
        if (gameOverScreen) gameOverScreen.classList.remove('hidden');
    }

    update() {
        this.frameCount++;
        
        if (this.frameCount % 30 === 0) {
            this.updateLeaderboard(); 
        }

        let pointsGainedThisFrame = 0;

        if (this.screenShake > 0) {
            this.screenShake *= 0.9;
            if (this.screenShake < 0.5) {
                this.screenShake = 0;
            }
        }

        // CONTINUOUS ORB SPAWNING (MASSIVE DENSITY)
        let desiredOrbs = this.isDemo ? 1000 : 2500;
        if (this.orbs.length < desiredOrbs) {
            let spawnCount = Math.min(25, desiredOrbs - this.orbs.length);
            for(let i = 0; i < spawnCount; i++) {
                this.orbs.push(new Orb(Math.random() * this.worldSize, Math.random() * this.worldSize, 'xp', 1, null, 0));
            }
        }

        if (this.isGameOver && this.spectateTarget) {
            if (this.spectateTarget.isDead || !this.bots.includes(this.spectateTarget)) {
                if (this.bots.length > 0) {
                    this.spectateTarget = this.bots.reduce((a, b) => a.points > b.points ? a : b);
                    const nameEl = document.getElementById('go-killer-name');
                    if (nameEl) {
                        nameEl.innerText = this.spectateTarget.name;
                    }
                } else {
                    this.spectateTarget = null;
                }
            }
        }

        const allPlayers = (this.isDemo || this.isGameOver) ? [...this.bots] : (this.player ? [this.player, ...this.bots] : [...this.bots]);

        // ==========================================
        // MASSIVE NEW ABILITIES LOGIC (Explosions, Lasers, Etc)
        // ==========================================
        allPlayers.forEach(p => {
            if (p.isDead) return;

            // --- ONE SHOT ABILITY TRIGGERS ---
            if (p.abilityTriggered) {
                p.abilityTriggered = false;
                
                let vol = (p.isPlayer || distance(this.camera.x, this.camera.y, p.x, p.y) < 1500) ? 0.6 : 0;
                
                if (p.activeAbility === 'bullet_nova') {
                    if (vol) this.playSoundAt('shoot', p.x, p.y, vol);
                    for(let a=0; a<Math.PI*2; a+=Math.PI/18) {
                        this.fireProjectile(p, a);
                    }
                    this.spawnParticles(p.x, p.y, '#00ffcc', 20);
                }
                else if (p.activeAbility === 'blink') {
                    if (vol) this.playSoundAt('dash', p.x, p.y, vol);
                    this.spawnParticles(p.x, p.y, '#a855f7', 15);
                    p.x += Math.cos(p.angle) * 400;
                    p.y += Math.sin(p.angle) * 400;
                    p.x = Math.max(0, Math.min(this.worldSize, p.x));
                    p.y = Math.max(0, Math.min(this.worldSize, p.y));
                    this.spawnParticles(p.x, p.y, '#a855f7', 15);
                }
                else if (p.activeAbility === 'emp') {
                    if (vol) this.playSoundAt('explosion', p.x, p.y, vol);
                    this.spawnParticles(p.x, p.y, '#00ffff', 40);
                    if (p.isPlayer) this.screenShake = Math.max(this.screenShake, 15);
                    allPlayers.forEach(e => {
                        if (e !== p && !e.isDead && !e.isTeammate && distance(p.x, p.y, e.x, e.y) < 600) {
                            e.fireCooldown = 180;
                            e.dashCooldown = 180;
                            e.health -= 20;
                            e.vx *= 0.2; e.vy *= 0.2;
                            if (e.health <= 0) this.processDeath(e, p);
                        }
                    });
                }
                else if (p.activeAbility === 'missile_swarm') {
                    if (vol) this.playSoundAt('shoot', p.x, p.y, vol);
                    for(let i=-6; i<=6; i++) {
                        let proj = new Projectile(p.x, p.y, p.angle + (i * 0.15), p, true, false);
                        this.projectiles.push(proj);
                    }
                }
                else if (p.activeAbility === 'earthshatter') {
                    if (vol) this.playSoundAt('explosion', p.x, p.y, vol);
                    this.spawnParticles(p.x, p.y, '#ffaa00', 50);
                    if (p.isPlayer) this.screenShake = Math.max(this.screenShake, 25);
                    allPlayers.forEach(e => {
                        if (e !== p && !e.isDead && !e.isTeammate && distance(p.x, p.y, e.x, e.y) < 600) {
                            e.health -= 100;
                            e.vx += (e.x - p.x) * 0.1;
                            e.vy += (e.y - p.y) * 0.1;
                            if (e.health <= 0) this.processDeath(e, p);
                        }
                    });
                }
                else if (p.activeAbility === 'tactical_nuke') {
                    if (vol) this.playSoundAt('shoot', p.x, p.y, vol);
                    let nuke = new Projectile(p.x, p.y, p.angle, p, false, true);
                    this.projectiles.push(nuke);
                }
            }

            // --- CONTINUOUS ABILITY EFFECTS ---
            if (p.abilityTimer > 0) {
                if (p.activeAbility === 'repulsor') {
                    allPlayers.forEach(e => {
                        if (e !== p && !e.isDead && !e.isTeammate && distance(p.x, p.y, e.x, e.y) < 300) {
                            e.vx += (e.x - p.x) * 0.05;
                            e.vy += (e.y - p.y) * 0.05;
                        }
                    });
                    if (this.frameCount % 10 === 0) {
                        this.projectiles.forEach(proj => {
                            if (proj.owner !== p && distance(p.x, p.y, proj.x, proj.y) < 300) {
                                proj.angle += Math.PI; 
                                proj.owner = p; 
                                proj.color = '#00ffff';
                            }
                        });
                    }
                }
                else if (p.activeAbility === 'strafe_run' && this.frameCount % 5 === 0) {
                    this.fireProjectile(p, p.angle + Math.PI/2);
                    this.fireProjectile(p, p.angle - Math.PI/2);
                }
                else if (p.activeAbility === 'blade_ring' && this.frameCount % 10 === 0) {
                    allPlayers.forEach(e => {
                        if (e !== p && !e.isDead && !e.isTeammate && distance(p.x, p.y, e.x, e.y) < 250) {
                            e.health -= 15;
                            this.spawnParticles(e.x, e.y, '#ff0000', 3);
                            if (e.health <= 0) this.processDeath(e, p);
                        }
                    });
                }
                else if (p.activeAbility === 'sonic_boom' || p.activeAbility === 'phase_strike') {
                    allPlayers.forEach(e => {
                        if (e !== p && !e.isDead && !e.isTeammate && distance(p.x, p.y, e.x, e.y) < p.size + e.size + 20) {
                            e.health -= 5; 
                            if (e.health <= 0) this.processDeath(e, p);
                        }
                    });
                }
            }
        });


        if (this.stormActive && !this.isCinematicIntro) {
            this.stormRadius = Math.max(0, this.stormRadius - 0.4); 

            if (this.frameCount % 30 === 0) {
                allPlayers.forEach(p => {
                    if (p && !p.isDead) {
                        if (distance(p.x, p.y, this.stormCenter.x, this.stormCenter.y) > this.stormRadius) {
                            p.health -= (p.maxHealth * 0.05); 
                            this.spawnParticles(p.x, p.y, '#8a2be2', 3); 
                            
                            if (p.health <= 0) {
                                this.processDeath(p, { 
                                    name: "THE STORM", x: this.stormCenter.x, y: this.stormCenter.y, 
                                    vampirism: 0, medicDrop: 0, isDead: false 
                                }); 
                            }
                        }
                    }
                });
            }
        }

        if (!this.isDemo && !this.isGameOver && this.player) {
            let dx = 0; 
            let dy = 0;
            let binds = { up: 'w', down: 's', left: 'a', right: 'd', dash: ' ', ability: 'e' };
            if (window.gameSettings && window.gameSettings.keybinds) {
                binds = window.gameSettings.keybinds;
            }

            if (!this.isCinematicIntro) {
                if (this.keys[binds.up]) dy -= 1; 
                if (this.keys[binds.down]) dy += 1;
                if (this.keys[binds.left]) dx -= 1; 
                if (this.keys[binds.right]) dx += 1;

                if (this.leftTouch && this.leftTouch.active) {
                    let tdx = this.leftTouch.x - this.leftTouch.originX;
                    let tdy = this.leftTouch.y - this.leftTouch.originY;
                    let dist = Math.hypot(tdx, tdy);
                    if (dist > 10) { 
                        dx += tdx / dist;
                        dy += tdy / dist;
                    }
                }
                
                if (this.keys[binds.dash]) {
                    let preDashPts = this.player.points;
                    this.player.dash(dx, dy);
                    
                    if (preDashPts > this.player.points) { 
                        sounds.play('dash', 0.4 * this.getVol());
                        this.spawnParticles(this.player.x, this.player.y, '#ffffff', 8);
                        this.screenShake = Math.max(this.screenShake, 5); 
                    }
                    this.keys[binds.dash] = false; 
                }

                if (this.keys[binds.ability]) {
                    if (this.player.activeAbility && this.player.abilityCooldown <= 0) {
                        this.player.useAbility();
                        this.screenShake = Math.max(this.screenShake, 8); 
                    }
                    this.keys[binds.ability] = false; 
                }

                if (dx !== 0 || dy !== 0) {
                    const length = Math.hypot(dx, dy);
                    let currentSpeed = this.player.speed * (this.player.abilityTimer > 0 && (this.player.activeAbility === 'overdrive' || this.player.activeAbility === 'sonic_boom') ? 2.5 : 1.0);
                    
                    this.player.vx += (dx / length) * (currentSpeed * 0.2);
                    this.player.vy += (dy / length) * (currentSpeed * 0.2);
                }

                if (!this.isTouchDevice) {
                    let playerScreenX = this.width / 2 + (this.player.x - this.camera.x) * this.cameraZoom;
                    let playerScreenY = this.height / 2 + (this.player.y - this.camera.y) * this.cameraZoom;
                    
                    this.player.angle = Math.atan2(this.mouseY - playerScreenY, this.mouseX - playerScreenX);
                }

            } else {
                this.player.angle = -Math.PI / 2;
            }

            this.player.x = Math.max(0, Math.min(this.worldSize, this.player.x));
            this.player.y = Math.max(0, Math.min(this.worldSize, this.player.y));

            const distMoved = Math.hypot(this.player.x - this.lastPlayerPos.x, this.player.y - this.lastPlayerPos.y);
            this.distanceTraveled += distMoved;
            this.lastPlayerPos.x = this.player.x;
            this.lastPlayerPos.y = this.player.y;

            this.player.update();

            this.player.inSafeZone = false;
            for (let i = this.safeZones.length - 1; i >= 0; i--) {
                let sz = this.safeZones[i];
                let isInside = sz.update(this.player);
                
                if (isInside) {
                    this.player.inSafeZone = true;
                    if (this.player.health < this.player.maxHealth) {
                        this.player.health = Math.min(this.player.maxHealth, this.player.health + (this.player.maxHealth * 0.05 / 60));
                    }
                }
                
                if (sz.state === 'active' && sz.lifeTimer <= 0) {
                    this.safeZones.splice(i, 1);
                    this.safeZoneSpawnTimer = 1800; // 30 seconds wait!
                }
            }

            if (this.safeZones.length < 3) {
                if (this.safeZoneSpawnTimer > 0) {
                    this.safeZoneSpawnTimer--;
                } else {
                    let pos = this.getSafeSpawnPosition(4000);
                    this.safeZones.push(new SafeZone(pos.x, pos.y));
                    this.safeZoneSpawnTimer = 1800; 
                }
            }

            if (window.gameSocket && this.lobbyCode) {
                window.gameSocket.emit('playerMove', {
                    code: this.lobbyCode,
                    x: this.player.x,
                    y: this.player.y,
                    angle: this.player.angle,
                    health: this.player.health,
                    maxHealth: this.player.maxHealth,
                    points: Math.round(this.player.points) 
                });
            }

            if (!this.isCinematicIntro) {
                if (this.player.wantsShockwave) {
                    this.player.wantsShockwave = false;
                    this.playSoundAt('explosion', this.player.x, this.player.y, 0.4); 
                    this.spawnParticles(this.player.x, this.player.y, '#ffcc00', 20); 
                    this.screenShake = Math.max(this.screenShake, 10);
                    
                    allPlayers.forEach(p => {
                        if (p === this.player || p.isDead) return;
                        if (p.isTeammate) return;
                        
                        if (distance(this.player.x, this.player.y, p.x, p.y) < 250) { 
                            if (!(p.abilityTimer > 0 && p.activeAbility === 'shield') && !(p.abilityTimer > 0 && p.activeAbility === 'juggernaut')) {
                                p.health -= this.player.shockwave * 25; 
                            }
                            p.vx += (p.x - this.player.x) * 0.05; 
                            p.vy += (p.y - this.player.y) * 0.05;
                            if (p.health <= 0) {
                                this.processDeath(p, this.player);
                            }
                        }
                    });
                }

                if (this.player.dashTimer > 0 && this.player.afterburner > 0 && this.frameCount % 2 === 0) {
                    let fireProj = new Projectile(this.player.x, this.player.y, 0, this.player);
                    fireProj.speed = 0; 
                    fireProj.life = 30 + (this.player.afterburner * 10);
                    fireProj.damage = 10 * this.player.afterburner;
                    fireProj.color = '#ffaa00';
                    fireProj.sizeScale = 1.5; 
                    this.projectiles.push(fireProj);
                }

                if (this.player.fireCooldown <= 0) {
                    const totalShots = this.player.multiShot + 1;
                    const spreadAngle = 0.2; 
                    const startAngle = this.player.angle - (spreadAngle * (totalShots - 1)) / 2;
                    
                    for (let s = 0; s < totalShots; s++) {
                        let finalAngle = startAngle + (s * spreadAngle);
                        if (this.player.type === 'triangle') {
                            finalAngle += (Math.random() - 0.5) * 0.15;
                        }
                        this.fireProjectile(this.player, finalAngle);
                    }
                    this.player.fireCooldown = this.player.fireRate;

                    if (window.gameSocket && this.lobbyCode) {
                        window.gameSocket.emit('playerShoot', {
                            code: this.lobbyCode,
                            angle: this.player.angle,
                            multiShot: this.player.multiShot || 0,
                            type: this.player.type || 'triangle'
                        });
                    }
                }

                if (this.player.missiles > 0) {
                    if (this.player.missileCooldown <= 0) {
                        this.projectiles.push(new Projectile(this.player.x, this.player.y, this.player.angle, this.player, true));
                        this.player.missileCooldown = Math.max(20, 90 - (this.player.missiles * 15)); 
                    }
                    this.player.missileCooldown--;
                }
            }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update();
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        for (let i = this.bots.length - 1; i >= 0; i--) {
            const bot = this.bots[i];

            if (bot.isRemotePlayer) continue; 

            bot.updateBot(allPlayers, this.isCinematicIntro);
            
            if (this.stormActive && !this.isCinematicIntro) {
                const distToCenter = distance(bot.x, bot.y, this.stormCenter.x, this.stormCenter.y);
                if (distToCenter > this.stormRadius - 300) {
                    bot.targetX = this.stormCenter.x + (Math.random() - 0.5) * (this.stormRadius * 0.5);
                    bot.targetY = this.stormCenter.y + (Math.random() - 0.5) * (this.stormRadius * 0.5);
                    bot.changeTargetTimer = 120; 
                }
            }

            bot.x = Math.max(0, Math.min(this.worldSize, bot.x)); 
            bot.y = Math.max(0, Math.min(this.worldSize, bot.y));
            
            for (let sz of this.safeZones) {
                let distToSZ = distance(bot.x, bot.y, sz.x, sz.y);
                let minAllowed = sz.radius + bot.size;
                
                if (distToSZ < minAllowed) {
                    if (distToSZ === 0) { 
                        distToSZ = 1; 
                        bot.x += 1; 
                    }
                    let overlap = minAllowed - distToSZ;
                    bot.x += ((bot.x - sz.x) / distToSZ) * overlap;
                    bot.y += ((bot.y - sz.y) / distToSZ) * overlap;
                }
            }

            if (bot.wantsShockwave) {
                bot.wantsShockwave = false;
                this.playSoundAt('explosion', bot.x, bot.y, 0.4); 
                this.spawnParticles(bot.x, bot.y, '#ffcc00', 20); 
                
                if (!this.isDemo && this.player && distance(this.player.x, this.player.y, bot.x, bot.y) < 500) {
                    this.screenShake = Math.max(this.screenShake, 10);
                }
                
                allPlayers.forEach(p => {
                    if (p === bot || p.isDead) return;
                    if (bot.isTeammate && (p.isPlayer || p.isTeammate)) return;
                    
                    if (distance(bot.x, bot.y, p.x, p.y) < 250) {
                        if (!(p.abilityTimer > 0 && p.activeAbility === 'shield') && !(p.abilityTimer > 0 && p.activeAbility === 'juggernaut')) {
                            p.health -= bot.shockwave * 25; 
                        }
                        p.vx += (p.x - bot.x) * 0.05; 
                        p.vy += (p.y - bot.y) * 0.05;
                        if (p.health <= 0) {
                            this.processDeath(p, bot);
                        }
                    }
                });
            }

            if (bot.dashTimer > 0 && bot.afterburner > 0 && this.frameCount % 2 === 0) {
                let fireProj = new Projectile(bot.x, bot.y, 0, bot);
                fireProj.speed = 0; 
                fireProj.life = 30 + (bot.afterburner * 10);
                fireProj.damage = 10 * bot.afterburner;
                fireProj.color = '#ffaa00';
                fireProj.sizeScale = 1.5; 
                this.projectiles.push(fireProj);
            }

            let enemyClose = false;
            for(let p of allPlayers) {
                if (p === bot || p.isDead) continue;
                if (bot.isTeammate && (p.isPlayer || p.isTeammate)) continue;
                if (p.inSafeZone) continue;
                
                if (distance(bot.x, bot.y, p.x, p.y) < 600 && !(p.ghostDash && p.dashTimer > 0)) { 
                    enemyClose = true; 
                    break; 
                }
            }
            
            if (enemyClose && bot.fireCooldown <= 0 && !this.isCinematicIntro) {
                let totalShots = bot.multiShot + 1;
                let spreadAngle = 0.2; 
                let startAngle = bot.angle - (spreadAngle * (totalShots - 1)) / 2;
                
                for (let s = 0; s < totalShots; s++) {
                    let finalAngle = startAngle + (s * spreadAngle);
                    if (bot.type === 'triangle') {
                        finalAngle += (Math.random() - 0.5) * 0.15;
                    }
                    this.fireProjectile(bot, finalAngle);
                }
                bot.fireCooldown = bot.fireRate;
            }
            
            if (bot.missiles > 0 && !this.isCinematicIntro) {
                if (bot.missileCooldown <= 0) {
                    this.projectiles.push(new Projectile(bot.x, bot.y, bot.angle, bot, true));
                    bot.missileCooldown = Math.max(20, 90 - (bot.missiles * 15)); 
                }
                bot.missileCooldown--;
            }
        }

        for (let i = 0; i < allPlayers.length; i++) {
            for (let j = i + 1; j < allPlayers.length; j++) {
                const p1 = allPlayers[i]; 
                const p2 = allPlayers[j];
                
                if (p1.isDead || p2.isDead) continue;
                if ((p1.ghostDash && p1.dashTimer > 0) || (p2.ghostDash && p2.dashTimer > 0)) continue;

                const dist = distance(p1.x, p1.y, p2.x, p2.y);
                const minDistance = p1.size + p2.size; 
                
                if (dist < minDistance && dist > 0) {
                    const overlap = minDistance - dist; 
                    const nx = (p1.x - p2.x) / dist; 
                    const ny = (p1.y - p2.y) / dist;
                    
                    p1.x += nx * (overlap / 2); 
                    p1.y += ny * (overlap / 2);
                    p2.x -= nx * (overlap / 2); 
                    p2.y -= ny * (overlap / 2);
                    
                    let areTeammates = (p1.isPlayer || p1.isTeammate) && (p2.isPlayer || p2.isTeammate);
                    if (areTeammates) continue;

                    if (p1.spikes > 0 && p1.spikeCooldown <= 0) {
                        let dmg = p1.type === 'square' ? p1.spikes * 2.5 : p1.spikes * 5;
                        if (!(p2.abilityTimer > 0 && (p2.activeAbility === 'shield' || p2.activeAbility === 'juggernaut'))) {
                            p2.health -= Math.max(1, dmg - (p2.plating * 2)); 
                            this.spawnParticles(p2.x, p2.y, '#ff4444', 5);
                            if (p2 === this.player) this.screenShake = Math.max(this.screenShake, 8);
                        }
                        p1.spikeCooldown = 30; 
                        if (p2.health <= 0) {
                            this.processDeath(p2, p1);
                        }
                    }
                    
                    if (p2.spikes > 0 && p2.spikeCooldown <= 0 && !p1.isDead) {
                        let dmg = p2.type === 'square' ? p2.spikes * 2.5 : p2.spikes * 5;
                        if (!(p1.abilityTimer > 0 && (p1.activeAbility === 'shield' || p1.activeAbility === 'juggernaut'))) {
                            p1.health -= Math.max(1, dmg - (p1.plating * 2)); 
                            this.spawnParticles(p1.x, p1.y, '#ff4444', 5);
                            if (p1 === this.player) this.screenShake = Math.max(this.screenShake, 8);
                        }
                        p2.spikeCooldown = 30;
                        if (p1.health <= 0) {
                            this.processDeath(p1, p2);
                        }
                    }
                }
            }
        }

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.update(allPlayers); 
            
            let hitSafeZone = false;
            for (let sz of this.safeZones) {
                if (distance(proj.x, proj.y, sz.x, sz.y) < sz.radius) {
                    if (!proj.owner.inSafeZone) {
                        hitSafeZone = true;
                        this.spawnParticles(proj.x, proj.y, proj.color, 3);
                    }
                    break;
                }
            }
            
            if (hitSafeZone) {
                this.projectiles.splice(i, 1);
                continue; 
            }
            
            let hit = false;
            for (let j = allPlayers.length - 1; j >= 0; j--) {
                const target = allPlayers[j];
                
                if (proj.owner === target || target.isDead || proj.hitTargets.includes(target)) continue; 
                if (target.ghostDash && target.dashTimer > 0) continue;
                
                let isFriendlyFire = (proj.owner.isPlayer || proj.owner.isTeammate) && (target.isPlayer || target.isTeammate);
                if (isFriendlyFire) continue;
                
                if (distance(proj.x, proj.y, target.x, target.y) < target.size) {
                    if (target.evasion > 0 && Math.random() < target.evasion) continue;
                    
                    proj.hitTargets.push(target);
                    
                    // JUGGERNAUT, SHIELD, AND PHASE STRIKE IMMUNITY
                    let immune = target.abilityTimer > 0 && (target.activeAbility === 'shield' || target.activeAbility === 'juggernaut' || target.activeAbility === 'phase_strike');

                    if (!immune) {
                        let dmg = proj.damage;
                        if (target.health < target.maxHealth * 0.5) dmg *= (1 + proj.owner.executioner);
                        target.health -= Math.max(1, dmg - (target.plating * 2));
                        
                        this.playSoundAt('hit', target.x, target.y, 0.4);
                        this.spawnParticles(proj.x, proj.y, proj.color, 4);
                        if (target === this.player) this.screenShake = Math.max(this.screenShake, 8);
                        
                        if (target.health <= 0) {
                            this.processDeath(target, proj.owner);
                        }
                    } else {
                        this.spawnParticles(proj.x, proj.y, '#0096ff', 3);
                        this.playSoundAt('hit', target.x, target.y, 0.1);
                    }
                    
                    if (proj.pierce > 0) { 
                        proj.pierce--; 
                        hit = false; 
                    } else { 
                        hit = true; 
                    }
                    break;
                }
            }
            
            if (hit || proj.life <= 0) {
                this.projectiles.splice(i, 1);
            }
        }

        for (let i = this.orbs.length - 1; i >= 0; i--) {
            const orb = this.orbs[i];
            if (orb.lockoutTimer > 0) orb.lockoutTimer--;

            let collectedBy = null;
            
            if (!this.isDemo && !this.isGameOver && !this.isCinematicIntro && this.player) {
                let pullRadius = 150 + (this.player.magnet * 100);
                
                let distP = distance(this.player.x, this.player.y, orb.x, orb.y);
                let canPlayerTouch = (orb.lockedOwner !== this.player || orb.lockoutTimer <= 0);
                
                if (distP < pullRadius && canPlayerTouch) { 
                    orb.x += (this.player.x - orb.x) * 0.1; 
                    orb.y += (this.player.y - orb.y) * 0.1; 
                }
                
                if (distP < this.player.size + orb.size && canPlayerTouch) {
                    collectedBy = this.player;
                }
            }

            if (!collectedBy) {
                for (let b of this.bots) {
                    if (b.isDead) continue;
                    
                    let pullRadius = 150 + (b.magnet * 100);
                    let distB = distance(b.x, b.y, orb.x, orb.y);
                    let canBotTouch = (orb.lockedOwner !== b || orb.lockoutTimer <= 0);
                    
                    if (distB < pullRadius && canBotTouch) {
                        orb.x += (b.x - orb.x) * 0.1;
                        orb.y += (b.y - orb.y) * 0.1;
                    }
                    
                    if (distB < b.size + orb.size && canBotTouch) {
                        collectedBy = b;
                        break;
                    }
                }
            }

            if (collectedBy) {
                if (collectedBy === this.player) sounds.play('collect', 0.4 * this.getVol()); 
                
                if (orb.type === 'health') {
                    if (collectedBy.health < collectedBy.maxHealth) {
                        collectedBy.health = Math.min(collectedBy.maxHealth, collectedBy.health + orb.healAmount);
                    }
                } else {
                    let finalVal = orb.value * collectedBy.scavenger;
                    collectedBy.points += finalVal;
                    collectedBy.upgradeProgress += finalVal;
                    if (collectedBy === this.player) pointsGainedThisFrame += finalVal;
                }
                
                this.orbs.splice(i, 1);
            }
        }

        if (pointsGainedThisFrame > 0 && !this.isDemo && !this.isGameOver && this.player) {
            while (this.player.upgradeProgress >= this.pointsToNextUpgrade) {
                this.player.upgradeProgress -= this.pointsToNextUpgrade;
                this.player.upgradeCount++;
                
                let level = this.player.upgradeCount;
                this.pointsToNextUpgrade = Math.floor(15 + (level * 12) + (Math.pow(level, 1.7) * 1.5));
                
                this.triggerUpgradeReady();
            }
        }

        if (!this.isDemo && !this.isGameOver && this.player) {
            let displayEl = document.getElementById('level-display');
            let barEl = document.getElementById('xp-bar');
            
            if (displayEl) {
                displayEl.innerText = `${Math.floor(this.player.points)} PTS`;
            }
            if (barEl) {
                barEl.style.width = Math.min(100, (this.player.upgradeProgress / this.pointsToNextUpgrade) * 100) + '%';
            }
        }

        if (this.isHost && this.frameCount % 5 === 0 && this.lobbyCode && window.gameSocket) {
            let syncData = [];
            for (let b of this.bots) {
                if (!b.isRemotePlayer) {
                    syncData.push({ 
                        id: b.id, 
                        x: Math.round(b.x), 
                        y: Math.round(b.y), 
                        h: Math.round(b.health), 
                        d: b.isDead,
                        pts: Math.round(b.points), 
                        type: b.type,
                        c: b.color, 
                        u: b.upgrades || {}, 
                        n: b.name 
                    });
                }
            }
            window.gameSocket.emit('hostBotSync', { code: this.lobbyCode, bots: syncData });
        }
    }

    draw() {
        this.ctx.fillStyle = '#111'; 
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.save();
        
        let targetCamX, targetCamY;
        let glideSpeed = 0.1; 
        
        if (this.isDemo) {
            targetCamX = this.demoTargetX;
            targetCamY = this.demoTargetY;
            this.cameraZoom += (1.0 - this.cameraZoom) * 0.05;
        } else if (this.isGameOver) {
            targetCamX = this.spectateTarget ? this.spectateTarget.x : this.camera.x;
            targetCamY = this.spectateTarget ? this.spectateTarget.y : this.camera.y;
            glideSpeed = 0.02; 
            this.cameraZoom += (1.0 - this.cameraZoom) * 0.05;
        } else if (this.isCinematicIntro) {
            this.introTimer++;
            if (this.introTimer < 120) {
                targetCamX = this.introTargetX; 
                targetCamY = this.introTargetY; 
                glideSpeed = 1.0; 
            } else if (this.introTimer < 240) {
                let progress = (this.introTimer - 120) / 120;
                let ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
                targetCamX = this.player ? this.player.x : this.worldSize/2; 
                targetCamY = this.player ? this.player.y : this.worldSize/2;
                glideSpeed = 0.05 + (ease * 0.1); 
                this.cameraZoom = this.introStartZoom + (1.0 - this.introStartZoom) * ease;
            } else {
                this.isCinematicIntro = false;
                targetCamX = this.player ? this.player.x : this.worldSize/2; 
                targetCamY = this.player ? this.player.y : this.worldSize/2; 
                this.cameraZoom = 1.0;
            }
        } else {
            targetCamX = this.player ? this.player.x : this.worldSize/2;
            targetCamY = this.player ? this.player.y : this.worldSize/2;
            glideSpeed = 0.15; 
            this.cameraZoom += (1.0 - this.cameraZoom) * 0.1;
        }
        
        this.camera.x += (targetCamX - this.camera.x) * glideSpeed;
        this.camera.y += (targetCamY - this.camera.y) * glideSpeed;

        let camX = this.width / 2 - this.camera.x * this.cameraZoom;
        let camY = this.height / 2 - this.camera.y * this.cameraZoom;
        
        if (this.screenShake > 0) {
            camX += (Math.random() - 0.5) * this.screenShake;
            camY += (Math.random() - 0.5) * this.screenShake;
        }
        
        this.ctx.translate(camX, camY);
        this.ctx.scale(this.cameraZoom, this.cameraZoom);
        
        // ==========================================
        // MAP BORDER FORCEFIELD
        // ==========================================
        this.ctx.save();
        this.ctx.strokeStyle = '#00ffff'; 
        this.ctx.lineWidth = 8;
        if (window.gameSettings && window.gameSettings.highQuality) {
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#00ffff';
        }
        
        this.ctx.strokeRect(0, 0, this.worldSize, this.worldSize);

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([30, 30]);
        this.ctx.lineDashOffset = -(Date.now() / 20) % 60;
        this.ctx.strokeRect(0, 0, this.worldSize, this.worldSize);
        this.ctx.restore();

        this.ctx.fillStyle = 'rgba(0, 20, 30, 0.6)';
        this.ctx.fillRect(-10000, -10000, this.worldSize + 20000, 10000); 
        this.ctx.fillRect(-10000, this.worldSize, this.worldSize + 20000, 10000); 
        this.ctx.fillRect(-10000, 0, 10000, this.worldSize); 
        this.ctx.fillRect(this.worldSize, 0, 10000, this.worldSize); 
        // ==========================================

        if (this.stormActive) {
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(138, 43, 226, 0.25)'; 
            this.ctx.beginPath();
            this.ctx.rect(-5000, -5000, this.worldSize + 10000, this.worldSize + 10000);
            this.ctx.arc(this.stormCenter.x, this.stormCenter.y, this.stormRadius, 0, Math.PI * 2, true);
            this.ctx.fill();
            
            this.ctx.strokeStyle = '#8a2be2';
            this.ctx.lineWidth = 15;
            if (window.gameSettings && window.gameSettings.highQuality) {
                this.ctx.shadowBlur = 30;
                this.ctx.shadowColor = '#8a2be2';
            }
            this.ctx.beginPath();
            this.ctx.arc(this.stormCenter.x, this.stormCenter.y, this.stormRadius, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.restore();
        }

        this.ctx.strokeStyle = '#222'; 
        this.ctx.lineWidth = 1; 
        const gridSize = 100;
        
        const startX = Math.floor(this.camera.x - (this.width / this.cameraZoom) / 2); 
        const startY = Math.floor(this.camera.y - (this.height / this.cameraZoom) / 2);
        const endX = startX + (this.width / this.cameraZoom) + gridSize;
        const endY = startY + (this.height / this.cameraZoom) + gridSize;
        
        this.ctx.beginPath();
        for (let x = startX - (startX % gridSize); x < endX; x += gridSize) {
            this.ctx.moveTo(x, startY - gridSize); 
            this.ctx.lineTo(x, endY);
        }
        for (let y = startY - (startY % gridSize); y < endY; y += gridSize) {
            this.ctx.moveTo(startX - gridSize, y); 
            this.ctx.lineTo(endX, y);
        }
        this.ctx.stroke();

        this.safeZones.forEach(sz => sz.draw(this.ctx));

        this.orbs.forEach(orb => orb.draw(this.ctx));
        this.particles.forEach(p => p.draw(this.ctx));
        this.projectiles.forEach(proj => proj.draw(this.ctx));
        this.bots.forEach(bot => { if (!bot.isDead) bot.draw(this.ctx) });
        
        if (!this.isDemo && this.player && !this.player.isDead) {
            this.player.draw(this.ctx);
        }

        this.ctx.restore();

        const brUi = document.getElementById('br-ui');
        if (brUi && !brUi.classList.contains('hidden')) {
            const minimapContainer = document.getElementById('minimap-container');
            if (minimapContainer) {
                if (window.gameSettings && window.gameSettings.showMinimap === false) {
                    minimapContainer.style.display = 'none';
                } else {
                    minimapContainer.style.display = 'block';
                    this.drawMinimap();
                }
            }
            this.drawTeammatePointers();
        }
    }

    drawMinimap() {
        const mmCanvas = document.getElementById('minimap-canvas');
        if (!mmCanvas) return;
        const ctx = mmCanvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        if (mmCanvas.width !== 220 * dpr) {
            mmCanvas.width = 220 * dpr;
            mmCanvas.height = 220 * dpr;
            ctx.scale(dpr, dpr);
        }

        ctx.clearRect(0, 0, 220, 220);
        const scale = 220 / this.worldSize;

        this.safeZones.forEach(sz => {
            ctx.fillStyle = sz.state === 'active' ? 'rgba(0, 255, 204, 0.4)' : 'rgba(0, 255, 204, 0.15)';
            ctx.beginPath();
            ctx.arc(sz.x * scale, sz.y * scale, sz.radius * scale * 4, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = sz.state === 'active' ? 'rgba(0, 255, 204, 0.8)' : 'rgba(0, 255, 204, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        if (this.stormActive) {
            ctx.fillStyle = 'rgba(138, 43, 226, 0.4)';
            ctx.beginPath();
            ctx.rect(0, 0, 220, 220);
            ctx.arc(this.stormCenter.x * scale, this.stormCenter.y * scale, this.stormRadius * scale, 0, Math.PI * 2, true);
            ctx.fill();
            
            ctx.strokeStyle = '#8a2be2';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.stormCenter.x * scale, this.stormCenter.y * scale, this.stormRadius * scale, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, 220, 220);

        let aliveCount = (this.player && !this.player.isDead) ? 1 : 0;

        const drawDot = (x, y, color, size) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x * scale, y * scale, size, 0, Math.PI * 2);
            ctx.fill();
        };

        this.bots.forEach(b => {
            if (!b.isDead) {
                aliveCount++;
                if (b.isTeammate) drawDot(b.x, b.y, '#00ffcc', 3);
                else drawDot(b.x, b.y, '#ff4444', 2);
            }
        });

        if (this.player && !this.player.isDead) {
            drawDot(this.player.x, this.player.y, '#ffe600', 4);
            
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            const viewW = (this.width / this.cameraZoom) * scale;
            const viewH = (this.height / this.cameraZoom) * scale;
            const cx = (this.camera.x * scale) - viewW/2;
            const cy = (this.camera.y * scale) - viewH/2;
            ctx.strokeRect(cx, cy, viewW, viewH);
        }

        const countDisplay = document.getElementById('player-count-display');
        if (countDisplay) {
            let isMultiplayer = this.lobbyCode || this.isHost;
            if (isMultiplayer) {
                countDisplay.style.display = 'block';
                countDisplay.innerText = `ALIVE: ${aliveCount}`;
            } else {
                countDisplay.style.display = 'none';
            }
        }
    }

    drawTeammatePointers() {
        const pointersContainer = document.getElementById('teammate-pointers');
        if (!pointersContainer) return;
        
        if (this.isCinematicIntro || !this.player || this.player.isDead) {
            pointersContainer.innerHTML = '';
            return;
        }

        let html = '';
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const radius = Math.min(cx, cy) - 60; 
        const viewRadius = (this.width / 2) / this.cameraZoom;

        this.teammates.forEach(t => {
            if (t.isDead) return;
            const dist = distance(this.player.x, this.player.y, t.x, t.y);
            
            if (dist > viewRadius * 0.9) {
                const angle = Math.atan2(t.y - this.player.y, t.x - this.player.x);
                const px = cx + Math.cos(angle) * radius;
                const py = cy + Math.sin(angle) * radius;
                
                html += `
                    <div style="
                        position: absolute; left: ${px}px; top: ${py}px; width: 0; height: 0; 
                        border-left: 12px solid transparent; border-right: 12px solid transparent; border-bottom: 24px solid ${t.color}; 
                        transform: translate(-50%, -50%) rotate(${angle + Math.PI/2}rad); filter: drop-shadow(0 0 5px rgba(0,0,0,0.8));
                    "></div>
                    <div style="
                        position: absolute; left: ${px - Math.cos(angle)*35}px; top: ${py - Math.sin(angle)*35}px;
                        transform: translate(-50%, -50%); color: ${t.color}; font-weight: bold; font-size: 0.9rem; text-shadow: 1px 1px 2px black; text-transform: uppercase;
                    ">${t.name}</div>
                `;
            }
        });
        pointersContainer.innerHTML = html;
    }

    loop(timestamp) {
        if (!this.isRunning) return;
        
        this.animationId = requestAnimationFrame((t) => this.loop(t));

        if (!timestamp) {
            timestamp = performance.now();
        }
        
        let dt = timestamp - this.lastTime;
        
        if (dt < this.fpsInterval) {
            return; 
        }

        if (dt > 100) {
            this.lastTime = timestamp - this.fpsInterval;
        } else {
            this.lastTime = timestamp - (dt % this.fpsInterval);
        }

        this.update();
        this.draw();

        if (window.gameSettings && window.gameSettings.showFps) {
            this.framesThisSecond++;
            if (timestamp - this.lastFpsTime >= 1000) {
                const fpsDisplay = document.getElementById('fps-display');
                if (fpsDisplay) {
                    fpsDisplay.innerText = `${this.framesThisSecond} FPS`;
                    fpsDisplay.classList.remove('hidden');
                }
                this.framesThisSecond = 0;
                this.lastFpsTime = timestamp;
            }
        } else {
            const fpsDisplay = document.getElementById('fps-display');
            if (fpsDisplay && !fpsDisplay.classList.contains('hidden')) {
                fpsDisplay.classList.add('hidden');
            }
        }
    }
}