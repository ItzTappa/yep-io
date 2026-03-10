import { Player, Bot, Orb, Projectile, Particle, getWeightedUpgrades } from './entities.js';
import { distance } from './utils.js';
import { sounds } from './soundManager.js';

export class GameEngine {
    constructor(canvas) {
        this.canvas = canvas; this.ctx = canvas.getContext('2d');
        this.width = window.innerWidth; this.height = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr; this.canvas.height = this.height * dpr;
        this.canvas.style.width = `${this.width}px`; this.canvas.style.height = `${this.height}px`;
        this.ctx.scale(dpr, dpr);

        this.worldSize = 4000;
        this.player = null; this.bots = []; this.orbs = []; this.projectiles = []; this.particles = [];
        this.teammates = []; 
        
        this.lobbyCode = null; 
        this.isHost = false; 
        
        this.mouseX = this.width / 2; this.mouseY = this.height / 2;
        this.keys = {}; this.frameCount = 0; 
        
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
        
        this.fpsInterval = 1000 / 60; 
        this.lastTime = 0;
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
        this.pointsToNextUpgrade = 10; 
        
        this.leftTouch = { id: null, originX: 0, originY: 0, x: 0, y: 0, active: false };
        this.aimTouchId = null;
        this.aimOriginX = 0;
        this.aimOriginY = 0;
        this.isAimDragging = false; 
        
        this.isTouchDevice = false; 

        this.initInput();
    }

    initInput() {
        window.addEventListener('resize', () => {
            this.width = window.innerWidth; this.height = window.innerHeight;
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = this.width * dpr; this.canvas.height = this.height * dpr;
            this.canvas.style.width = `${this.width}px`; this.canvas.style.height = `${this.height}px`;
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
            if (Object.values(window.gameSettings.keybinds).includes(key)) { e.preventDefault(); }
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
                        if (dist > maxDist) { dx = (dx/dist) * maxDist; dy = (dy/dist) * maxDist; }
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

                    if (this.isAimDragging) {
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
                this.keys[window.gameSettings.keybinds.dash] = true;
            });
            dashBtn.addEventListener('touchend', (e) => {
                if (this.isDemo || this.isGameOver) return;
                e.preventDefault();
                this.keys[window.gameSettings.keybinds.dash] = false;
            });
        }
    }

    playSoundAt(soundName, x, y, baseVolume = 1.0) {
        const dist = distance(this.camera.x, this.camera.y, x, y);
        const maxHearingDistance = 2000; 
        if (dist < maxHearingDistance) {
            const falloff = 1 - (dist / maxHearingDistance);
            const spatialVolume = baseVolume * (falloff * falloff);
            sounds.play(soundName, spatialVolume);
        }
    }

    getSafeSpawnPosition() {
        let x, y, isSafe = false;
        while (!isSafe) {
            x = Math.random() * this.worldSize; y = Math.random() * this.worldSize;
            if (!this.player || distance(x, y, this.player.x, this.player.y) > 1000) isSafe = true;
        }
        return { x, y };
    }

    getSafeOrbPosition(minDist = 500) {
        let x, y; let isSafe = false; let attempts = 0;
        while (!isSafe && attempts < 50) {
            x = Math.random() * this.worldSize; y = Math.random() * this.worldSize; isSafe = true;
            for (let orb of this.orbs) {
                if (orb.type === 'health' && distance(x, y, orb.x, orb.y) < minDist) { isSafe = false; break; }
            }
            attempts++;
        }
        return { x, y };
    }

    spawnParticles(x, y, color, amount) {
        if (!window.gameSettings.particles) return;
        for (let i = 0; i < amount; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    grantAccountXP(baseAmount, enemyPoints = 0) {
        let multiplier = 1;
        if (enemyPoints > this.player.points) { multiplier = enemyPoints / Math.max(1, this.player.points); }
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
            window.globalAccountLevel++; window.globalAccountXP -= xpRequired;
            xpRequired = window.globalAccountLevel * 1000; leveledUp = true;
        }
        if (leveledUp && !this.isDemo) {
            const notif = document.getElementById('account-level-notif');
            if (notif) {
                sounds.play('levelUp', 0.8);
                document.getElementById('account-notif-level-num').innerText = window.globalAccountLevel;
                notif.classList.add('show');
                if (this.accountLevelUpTimeout) clearTimeout(this.accountLevelUpTimeout);
                this.accountLevelUpTimeout = setTimeout(() => notif.classList.remove('show'), 4000);
            }
        }
    }

    startDemo() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) mobileControls.classList.add('hidden');
        const brUi = document.getElementById('br-ui');
        if (brUi) brUi.classList.add('hidden');

        this.worldSize = 4000;
        this.stormActive = false;
        this.isDemo = true; this.isGameOver = false; this.spectateTarget = null;
        this.bots = []; this.orbs = []; this.projectiles = []; this.particles = [];
        this.teammates = []; this.isCinematicIntro = false;
        
        this.player = new Player(-10000, -10000, 'circle'); this.player.health = 999999; 

        for(let i = 0; i < 40; i++) {
            const types = ['triangle', 'square', 'circle'];
            this.bots.push(new Bot(Math.random() * this.worldSize, Math.random() * this.worldSize, types[Math.floor(Math.random()*3)], Math.random() * 5000));
        }
        for(let i = 0; i < 400; i++) this.orbs.push(new Orb(Math.random() * this.worldSize, Math.random() * this.worldSize, 'xp', 1, null, 0));

        this.demoTargetX = this.worldSize / 2; this.demoTargetY = this.worldSize / 2;
        this.camera.x = this.demoTargetX; this.camera.y = this.demoTargetY;
        this.cameraZoom = 1.0;
        this.lastTime = performance.now(); this.loop(this.lastTime);
    }

    start(playerClass) {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
            mobileControls.classList.remove('hidden');
        } else if (mobileControls) {
            mobileControls.classList.add('hidden');
        }
        const brUi = document.getElementById('br-ui');
        if (brUi) brUi.classList.add('hidden');
        
        this.worldSize = 4000; 
        this.stormActive = false; 

        this.isDemo = false; this.isGameOver = false; this.spectateTarget = null;
        this.bots = []; this.orbs = []; this.projectiles = []; this.particles = []; this.teammates = [];
        
        this.player = new Player(this.worldSize / 2, this.worldSize / 2, playerClass);
        this.player.name = "YOU"; 

        this.camera.x = this.player.x; this.camera.y = this.player.y;
        this.cameraZoom = 1.0; this.isCinematicIntro = false;
        
        this.pointsToNextUpgrade = 10; this.matchStartTime = Date.now(); this.matchXPEarned = 0; 
        this.distanceTraveled = 0; this.lastPlayerPos = { x: this.player.x, y: this.player.y };
        this.pendingUpgrades = 0; this.isChoosingUpgrade = false;
        
        document.getElementById('upgrade-ui').classList.add('hidden');
        document.getElementById('xp-bar').style.width = '0%';
        document.getElementById('level-display').innerText = '0 PTS';
        
        let matchSeed = Math.random();
        for(let i = 0; i < 35; i++) {
            const types = ['triangle', 'square', 'circle']; const type = types[Math.floor(Math.random()*3)]; const spawn = this.getSafeSpawnPosition();
            
            let startingPts = 0;
            if (matchSeed > 0.9) { startingPts = Math.random() < 0.2 ? Math.random() * 25000 : Math.random() * 1500; } 
            else if (matchSeed < 0.4) { startingPts = Math.random() * 80; } 
            else { startingPts = Math.random() < 0.1 ? Math.random() * 3000 : Math.random() * 300; }
            this.bots.push(new Bot(spawn.x, spawn.y, type, startingPts));
        }
        for(let i = 0; i < 300; i++) this.orbs.push(new Orb(Math.random() * this.worldSize, Math.random() * this.worldSize, 'xp', 1, null, 0));
        for(let i = 0; i < 15; i++) { let pos = this.getSafeOrbPosition(500); this.orbs.push(new Orb(pos.x, pos.y, 'health', 1, null, 0)); }

        this.totalMatchPlayers = this.bots.length + 1; 
        this.lastTime = performance.now(); this.lastFpsTime = performance.now(); this.framesThisSecond = 0;
        this.loop(this.lastTime);
    }

    startMultiplayer(players, lobbyCode, isHost) {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
            mobileControls.classList.remove('hidden');
        } else if (mobileControls) {
            mobileControls.classList.add('hidden');
        }
        
        this.lobbyCode = lobbyCode; 
        this.isHost = isHost || false;
        this.worldSize = 10000; 
        this.stormActive = true; 
        this.stormCenter = { x: this.worldSize / 2, y: this.worldSize / 2 };
        this.stormRadius = 7500; 

        this.isDemo = false; 
        this.isGameOver = false; 
        this.spectateTarget = null;
        this.bots = []; 
        this.orbs = []; 
        this.projectiles = []; 
        this.particles = [];
        this.teammates = [];

        document.getElementById('game-ui').classList.remove('hidden');
        document.querySelector('.hud').classList.remove('hidden');
        
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
                this.player = new Player(px, py, pClass, "YOU");
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
            for(let i = 0; i < 96; i++) {
                const types = ['triangle', 'square', 'circle']; 
                const type = types[Math.floor(Math.random()*3)]; 
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

        for(let i = 0; i < 1500; i++) {
            this.orbs.push(new Orb(Math.random() * this.worldSize, Math.random() * this.worldSize, 'xp', 1, null, 0));
        }
        
        for(let i = 0; i < 60; i++) { 
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
                        if (!bot.upgrades) bot.upgrades = {};
                        for (let key in b.u) {
                            let hostTier = b.u[key];
                            for(let i=0; i<hostTier; i++) bot.applyUpgrade(key);
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
                        if (bd.d && !bot.isDead) this.processDeath(bot, null); 
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
                                for(let i=0; i<hostTier; i++) newBot.applyUpgrade(key);
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
                        if (data.type === 'triangle') finalAngle += (Math.random() - 0.5) * 0.15;
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
        
        if (players.length <= 2) this.introStartZoom = 0.8;
        else if (players.length === 3) this.introStartZoom = 0.65;
        else this.introStartZoom = 0.5;
        
        this.cameraZoom = this.introStartZoom;

        this.pointsToNextUpgrade = 10; 
        this.matchStartTime = Date.now(); 
        this.matchXPEarned = 0; 
        this.distanceTraveled = 0; 
        this.lastPlayerPos = { x: this.player.x, y: this.player.y };
        this.pendingUpgrades = 0; 
        this.isChoosingUpgrade = false;

        document.getElementById('upgrade-ui').classList.add('hidden');
        document.getElementById('xp-bar').style.width = '0%';
        document.getElementById('level-display').innerText = '0 PTS';

        this.totalMatchPlayers = 97; 
        this.lastTime = performance.now(); 
        this.lastFpsTime = performance.now(); 
        this.framesThisSecond = 0;
        this.loop(this.lastTime);
    }

    updateLeaderboard() {
        const allPlayers = (this.isDemo || this.isGameOver) ? [...this.bots] : [this.player, ...this.bots];
        allPlayers.sort((a, b) => b.points - a.points); 
        if (this.isDemo) return; 
        
        const list = document.getElementById('leaderboard-list'); 
        list.innerHTML = ''; 
        
        const displayLimit = window.innerWidth <= 768 ? 5 : 10;
        
        allPlayers.slice(0, displayLimit).forEach((p, index) => {
            const li = document.createElement('li'); 
            li.innerText = `#${index + 1} ${p.name} - ${Math.floor(p.points)} Pts`;
            if (p === this.player) li.style.color = '#00ffcc';
            list.appendChild(li);
        });
    }

    showNextUpgrade() {
        if (this.pendingUpgrades <= 0 || this.isDemo || this.isGameOver) return;
        
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
                const currentTier = this.player.upgrades[choice.id];
                document.getElementById(`title-${i+1}`).innerText = `${choice.title} [T${currentTier+1}]`;
                document.getElementById(`desc-${i+1}`).innerText = choice.desc;
                card.style.display = 'block';
            } else if (card) { 
                card.style.display = 'none'; 
            }
        }
        document.getElementById('upgrade-ui').classList.remove('hidden');
    }

    selectUpgrade(index) {
        if (this.isDemo || this.isGameOver) return;
        
        const choice = this.currentUpgradeChoices[index];
        this.player.applyUpgrade(choice.id); 
        this.grantAccountXP(15); 
        
        document.getElementById('upgrade-ui').classList.add('hidden');
        this.isChoosingUpgrade = false; 
        this.pendingUpgrades--;
        
        if (this.pendingUpgrades > 0) {
            setTimeout(() => this.showNextUpgrade(), 200); 
        }
    }

    triggerUpgradeReady() {
        if (this.isDemo || this.isGameOver) return;
        
        const notif = document.getElementById('level-up-notif');
        if (notif) {
            sounds.play('upgradeReady', 0.6); 
            notif.classList.add('show');
            if (this.levelUpTimeout) clearTimeout(this.levelUpTimeout);
            this.levelUpTimeout = setTimeout(() => notif.classList.remove('show'), 3000);
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
            this.projectiles.push(new Projectile(owner.x, owner.y, angle + Math.PI, owner));
        }
    }

    processDeath(victim, killer) {
        if (victim.isDead) return;
        victim.isDead = true;

        this.playSoundAt('explosion', victim.x, victim.y, 0.7);
        this.spawnParticles(victim.x, victim.y, victim.color, 30); 
        
        if (victim === this.player && window.gameSocket && this.lobbyCode) {
            window.gameSocket.emit('playerDied', { code: this.lobbyCode });
        }

        let totalTargetPoints = victim.points || 0;
        let orbReward = Math.floor(totalTargetPoints * 0.75); 
        
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

        let orbsToSpawn = Math.min(orbReward, 20); 
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
        
        if (victim === this.player) {
            this.handleGameOver(killer);
        } else {
            const botIndex = this.bots.indexOf(victim);
            if (botIndex > -1) {
                this.bots.splice(botIndex, 1);
            }
            
            if (this.spectateTarget === victim) {
                this.spectateTarget = killer;
                if (document.getElementById('go-killer-name')) {
                    document.getElementById('go-killer-name').innerText = killer ? killer.name : "UNKNOWN";
                }
            }

            if (!this.isDemo && !this.stormActive && this.isHost) { 
                const safePos = this.getSafeSpawnPosition();
                let newBot = new Bot(safePos.x, safePos.y, ['triangle', 'square', 'circle'][Math.floor(Math.random()*3)]);
                newBot.id = 'b_respawn' + Math.random();
                this.bots.push(newBot);
            }
        }
    }

    handleGameOver(killer) {
        if (this.isDemo || this.isGameOver) return; 
        
        this.isGameOver = true;
        this.spectateTarget = killer;
        document.getElementById('upgrade-ui').classList.add('hidden'); 

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
            playerClass: this.player.type || 'Unknown' 
        };

        document.getElementById('go-killer-name').innerText = killer ? killer.name : "UNKNOWN";
        document.getElementById('go-points').innerText = Math.floor(this.player.points);
        document.getElementById('go-kills').innerText = this.player.kills;
        document.getElementById('go-time').innerText = `${timeAlive}s`;
        document.getElementById('game-over-screen').classList.remove('hidden');
    }

    update() {
        this.frameCount++;
        if (this.frameCount % 30 === 0) {
            this.updateLeaderboard(); 
        }

        let pointsGainedThisFrame = 0;

        if (this.isGameOver && this.spectateTarget) {
            if (this.spectateTarget.isDead || !this.bots.includes(this.spectateTarget)) {
                if (this.bots.length > 0) {
                    this.spectateTarget = this.bots.reduce((a, b) => a.points > b.points ? a : b);
                    const nameEl = document.getElementById('go-killer-name');
                    if (nameEl) nameEl.innerText = this.spectateTarget.name;
                } else {
                    this.spectateTarget = null;
                }
            }
        }

        const allPlayers = (this.isDemo || this.isGameOver) ? [...this.bots] : [this.player, ...this.bots];

        if (this.stormActive && !this.isCinematicIntro) {
            this.stormRadius = Math.max(0, this.stormRadius - 0.4); 

            if (this.frameCount % 30 === 0) {
                allPlayers.forEach(p => {
                    if (p.isDead) return;
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
                });
            }
        }

        if (!this.isDemo && !this.isGameOver) {
            let dx = 0; 
            let dy = 0;
            const binds = window.gameSettings.keybinds;

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
                        sounds.play('dash', 0.4);
                        this.spawnParticles(this.player.x, this.player.y, '#ffffff', 8);
                    }
                    this.keys[binds.dash] = false; 
                }

                if (dx !== 0 || dy !== 0) {
                    const length = Math.hypot(dx, dy);
                    this.player.vx += (dx / length) * (this.player.speed * 0.2);
                    this.player.vy += (dy / length) * (this.player.speed * 0.2);
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
                    
                    allPlayers.forEach(p => {
                        if (p === this.player || p.isDead) return;
                        if (p.isTeammate) return;
                        if (distance(this.player.x, this.player.y, p.x, p.y) < 250) { 
                            p.health -= this.player.shockwave * 25; 
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

            if (bot.wantsShockwave) {
                bot.wantsShockwave = false;
                this.playSoundAt('explosion', bot.x, bot.y, 0.4); 
                this.spawnParticles(bot.x, bot.y, '#ffcc00', 20); 
                
                allPlayers.forEach(p => {
                    if (p === bot || p.isDead) return;
                    if (bot.isTeammate && (p.isPlayer || p.isTeammate)) return;
                    if (distance(bot.x, bot.y, p.x, p.y) < 250) {
                        p.health -= bot.shockwave * 25; 
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

            // NEW: Simplified targeting so enemies will shoot at ANY enemy close to them
            let enemyClose = false;
            for(let p of allPlayers) {
                if (p === bot || p.isDead) continue;
                
                // If I am a teammate, ignore the player and other teammates
                if (bot.isTeammate && (p.isPlayer || p.isTeammate)) continue;
                
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
                        p2.health -= Math.max(1, dmg - (p2.plating * 2)); 
                        p1.spikeCooldown = 30; 
                        this.spawnParticles(p2.x, p2.y, '#ff4444', 5);
                        if (p2.health <= 0) {
                            this.processDeath(p2, p1);
                        }
                    }
                    
                    if (p2.spikes > 0 && p2.spikeCooldown <= 0 && !p1.isDead) {
                        let dmg = p2.type === 'square' ? p2.spikes * 2.5 : p2.spikes * 5;
                        p1.health -= Math.max(1, dmg - (p1.plating * 2)); 
                        p2.spikeCooldown = 30;
                        this.spawnParticles(p1.x, p1.y, '#ff4444', 5);
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
                    
                    let dmg = proj.damage;
                    if (target.health < target.maxHealth * 0.5) {
                        dmg *= (1 + proj.owner.executioner);
                    }
                    
                    target.health -= Math.max(1, dmg - (target.plating * 2));
                    
                    this.playSoundAt('hit', target.x, target.y, 0.4);
                    this.spawnParticles(proj.x, proj.y, proj.color, 4);

                    if (target.health <= 0) {
                        this.processDeath(target, proj.owner);
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
            
            if (!this.isDemo && !this.isGameOver && !this.isCinematicIntro) {
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
                if (collectedBy === this.player) sounds.play('collect', 0.4); 
                
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

        if (pointsGainedThisFrame > 0 && !this.isDemo && !this.isGameOver) {
            while (this.player.upgradeProgress >= this.pointsToNextUpgrade) {
                this.player.upgradeProgress -= this.pointsToNextUpgrade;
                this.player.upgradeCount++;
                this.pointsToNextUpgrade = Math.floor(this.pointsToNextUpgrade * 1.5); 
                this.triggerUpgradeReady();
            }
        }

        if (!this.isDemo && !this.isGameOver) {
            document.getElementById('level-display').innerText = `${Math.floor(this.player.points)} PTS`;
            document.getElementById('xp-bar').style.width = Math.min(100, (this.player.upgradeProgress / this.pointsToNextUpgrade) * 100) + '%';
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
                targetCamX = this.player.x; 
                targetCamY = this.player.y;
                glideSpeed = 0.05 + (ease * 0.1); 
                this.cameraZoom = this.introStartZoom + (1.0 - this.introStartZoom) * ease;
            } else {
                this.isCinematicIntro = false;
                targetCamX = this.player.x; 
                targetCamY = this.player.y; 
                this.cameraZoom = 1.0;
            }
        } else {
            targetCamX = this.player.x;
            targetCamY = this.player.y;
            glideSpeed = 0.15; 
            this.cameraZoom += (1.0 - this.cameraZoom) * 0.1;
        }
        
        this.camera.x += (targetCamX - this.camera.x) * glideSpeed;
        this.camera.y += (targetCamY - this.camera.y) * glideSpeed;

        let camX = this.width / 2 - this.camera.x * this.cameraZoom;
        let camY = this.height / 2 - this.camera.y * this.cameraZoom;
        
        this.ctx.translate(camX, camY);
        this.ctx.scale(this.cameraZoom, this.cameraZoom);
        
        if (this.stormActive) {
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(138, 43, 226, 0.25)'; 
            this.ctx.beginPath();
            this.ctx.rect(-5000, -5000, this.worldSize + 10000, this.worldSize + 10000);
            this.ctx.arc(this.stormCenter.x, this.stormCenter.y, this.stormRadius, 0, Math.PI * 2, true);
            this.ctx.fill();
            
            this.ctx.strokeStyle = '#8a2be2';
            this.ctx.lineWidth = 15;
            if (window.gameSettings.highQuality) {
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

        this.orbs.forEach(orb => orb.draw(this.ctx));
        this.particles.forEach(p => p.draw(this.ctx));
        this.projectiles.forEach(proj => proj.draw(this.ctx));
        this.bots.forEach(bot => { if (!bot.isDead) bot.draw(this.ctx) });
        
        if (!this.isDemo && !this.player.isDead) {
            this.player.draw(this.ctx);
        }

        this.ctx.restore();

        const brUi = document.getElementById('br-ui');
        if (brUi && !brUi.classList.contains('hidden')) {
            this.drawMinimap();
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
            countDisplay.innerText = `ALIVE: ${aliveCount}`;
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
        if (window.gameSettings.showFps) {
            this.framesThisSecond++;
            if (timestamp - this.lastFpsTime >= 1000) {
                document.getElementById('fps-display').innerText = `${this.framesThisSecond} FPS`;
                this.framesThisSecond = 0;
                this.lastFpsTime = timestamp;
            }
        }

        const elapsed = timestamp - this.lastTime;
        
        if (elapsed >= this.fpsInterval) {
            this.lastTime = timestamp - (elapsed % this.fpsInterval);
            this.update();
            this.draw();
        }
        
        this.animationId = requestAnimationFrame((t) => this.loop(t));
    }
}