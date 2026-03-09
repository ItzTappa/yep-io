// ==========================================
// YEP.IO - REAL MULTIPLAYER LOBBY SYSTEM
// ==========================================
import { Player } from './entities.js';
import { ITEMS_DB } from './items.js';

const socket = io(); 
window.gameSocket = socket;

export class LobbySystem {
    constructor() {
        this.currentMode = null; 
        this.maxPlayers = 0;
        this.players = []; 
        this.lobbyCode = '';
        this.isHost = false;
        this.previewAngle = 0;
        this.animationId = null;

        setTimeout(() => this.bindEvents(), 100);
    }

    getMyColor() {
        let myColor = '#d3d3d3'; 
        if (window.equippedItems && window.equippedItems.Color && typeof ITEMS_DB !== 'undefined' && ITEMS_DB[window.equippedItems.Color]) {
            const dbColor = ITEMS_DB[window.equippedItems.Color].value;
            myColor = dbColor === 'gold' ? '#ffe600' : dbColor;
        }
        return myColor;
    }

    bindEvents() {
        document.querySelectorAll('.mode-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.createLobby(mode);
            });
        });

        document.getElementById('leave-lobby-btn')?.addEventListener('click', () => this.leaveLobby());
        
        document.getElementById('ready-btn')?.addEventListener('click', () => {
            if (this.lobbyCode) socket.emit('toggleReady', this.lobbyCode);
        });
        
        document.getElementById('join-lobby-btn')?.addEventListener('click', () => {
            const input = document.getElementById('join-code-input');
            if (!input) return;
            const code = input.value.trim().toUpperCase();
            if (code.length === 5) {
                this.isHost = false; // They are joining, not hosting!
                const activeBtn = document.querySelector('.class-btn.active');
                const myClass = activeBtn ? activeBtn.dataset.class : 'triangle';
                socket.emit('joinLobby', { code: code, classType: myClass, color: this.getMyColor() }); 
            }
        });

        document.getElementById('copy-code-btn')?.addEventListener('click', () => {
            if (!this.lobbyCode) return;
            navigator.clipboard.writeText(this.lobbyCode).catch(err => console.log("Clipboard failed", err));
            const btn = document.getElementById('copy-code-btn');
            if (btn) {
                btn.innerText = "COPIED!";
                setTimeout(() => btn.innerText = "COPY", 2000);
            }
        });

        socket.on('lobbyCreated', (lobby) => {
            this.lobbyCode = lobby.id;
            this.maxPlayers = lobby.maxPlayers;
            this.players = lobby.players;
            
            const codeDisplay = document.getElementById('lobby-code-display');
            if (codeDisplay) codeDisplay.innerText = this.lobbyCode;
            
            const joinInput = document.getElementById('join-code-input');
            if (joinInput) joinInput.value = '';
            
            this.showLobbyScreen();
        });

        socket.on('lobbyUpdate', (lobby) => {
            this.lobbyCode = lobby.id;
            this.maxPlayers = lobby.maxPlayers;
            this.players = lobby.players;
            
            const me = this.players.find(p => p.id === socket.id);
            if (me) {
                const btn = document.getElementById('ready-btn');
                if (btn) {
                    btn.innerText = me.isReady ? "UNREADY" : "READY";
                    btn.classList.toggle('ready-active', me.isReady);
                }
            }
            this.showLobbyScreen();
        });

        socket.on('joinError', (msg) => alert(msg));

        socket.on('countdownStart', () => {
            const btn = document.getElementById('ready-btn');
            if (btn) {
                btn.innerText = "STARTING IN 3...";
                btn.classList.add('ready-active');
            }
        });

        socket.on('prepareMatch', () => {
            const fade = document.getElementById('black-fade-overlay');
            if (fade) {
                fade.classList.remove('hidden');
                fade.classList.add('snap-black');
            }
        });

        socket.on('startGame', (playersFromServer) => {
            this.startMatchIntro(playersFromServer);
        });
    }

    showLobbyScreen() {
        const mainMenu = document.getElementById('main-menu');
        const lobbyScreen = document.getElementById('lobby-screen');
        if (mainMenu) mainMenu.classList.add('hidden');
        if (lobbyScreen) lobbyScreen.classList.remove('hidden');
        this.renderSlots(); 
        this.startRenderLoop();
    }

    createLobby(mode) {
        this.currentMode = mode;
        this.maxPlayers = mode === 'duos' ? 2 : mode === 'trios' ? 3 : 4;
        this.isHost = true; // They clicked create, so they are the Host!
        
        const activeBtn = document.querySelector('.class-btn.active');
        const myClass = activeBtn ? activeBtn.dataset.class : 'triangle';

        socket.emit('createLobby', { 
            mode: this.currentMode,
            maxPlayers: this.maxPlayers,
            color: this.getMyColor(),
            classType: myClass
        });
    }

    renderSlots() {
        const container = document.getElementById('player-slots-container');
        if (!container) return;
        container.innerHTML = '';

        for (let i = 0; i < this.maxPlayers; i++) {
            const p = this.players[i];
            if (p) {
                const isMe = (p.id === socket.id);
                container.innerHTML += `
                    <div class="player-slot filled ${p.isReady ? 'ready' : ''}">
                        <canvas id="lobby-canvas-${i}" class="lobby-preview-canvas" width="200" height="200"></canvas>
                        <div class="name">${isMe ? "YOU" : p.name}</div>
                        <div class="status">${p.isReady ? 'READY' : 'NOT READY'}</div>
                    </div>
                `;
            } else {
                container.innerHTML += `
                    <div class="player-slot empty">
                        <div class="lobby-preview-canvas" style="border: 2px dashed #555; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: #555; font-size: 4rem;">+</div>
                        <div class="name" style="color: transparent; text-shadow: none;">WAITING</div>
                        <div class="status">WAITING...</div>
                    </div>
                `;
            }
        }
    }

    startRenderLoop() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        const loop = () => {
            this.previewAngle += 0.015;
            this.renderCanvases();
            this.animationId = requestAnimationFrame(loop);
        };
        loop();
    }

    stopRenderLoop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    renderCanvases() {
        for (let i = 0; i < this.maxPlayers; i++) {
            const p = this.players[i];
            if (!p) continue;
            
            const canvas = document.getElementById(`lobby-canvas-${i}`);
            if (!canvas) continue;
            
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            if (canvas.width !== 200 * dpr) {
                canvas.width = 200 * dpr;
                canvas.height = 200 * dpr;
                ctx.scale(dpr, dpr);
            }
            
            ctx.clearRect(0, 0, 200, 200);

            if (!p.dummy) {
                p.dummy = new Player(100, 100, p.classType || 'triangle', "");
                p.dummy.color = p.color;
                if (p.id !== socket.id) { 
                    p.dummy.equipped = { Skin: null, Trail: null, Banner: null, Color: null };
                }
            }
            
            if (p.id === socket.id) { 
                const activeBtn = document.querySelector('.class-btn.active');
                p.dummy.type = activeBtn ? activeBtn.dataset.class : 'triangle';
                p.dummy.color = this.getMyColor();
                p.dummy.equipped = window.equippedItems || { Skin: null, Trail: null, Banner: null, Color: null };
            }

            p.dummy.angle = this.previewAngle;
            p.dummy.size = 50; 

            let tempNames = window.gameSettings.showNames;
            window.gameSettings.showNames = false;
            p.dummy.draw(ctx);
            window.gameSettings.showNames = tempNames;
        }
    }

    leaveLobby() {
        this.stopRenderLoop(); 
        this.players = [];
        
        if (this.lobbyCode) {
            socket.emit('leaveLobby', this.lobbyCode);
            this.lobbyCode = ''; 
        }
        
        const lobbyScreen = document.getElementById('lobby-screen');
        const mainMenu = document.getElementById('main-menu');
        
        if (lobbyScreen) lobbyScreen.classList.add('hidden');
        if (mainMenu) mainMenu.classList.remove('hidden');
        
        const btn = document.getElementById('ready-btn');
        if(btn) {
            btn.innerText = "READY";
            btn.classList.remove('ready-active');
        }
    }

    startMatchIntro(playersFromServer) {
        this.stopRenderLoop(); 
        
        const lobbyScreen = document.getElementById('lobby-screen');
        if (lobbyScreen) lobbyScreen.classList.add('hidden');
        
        const brUi = document.getElementById('br-ui');
        if (brUi) brUi.classList.remove('hidden');

        playersFromServer.forEach(p => {
            if (p.id === socket.id) p.id = 'local';
        });

        // WE NOW PASS this.isHost TO THE GAME ENGINE
        if (window.game) window.game.startMultiplayer(playersFromServer, this.lobbyCode, this.isHost);

        const fade = document.getElementById('black-fade-overlay');
        if (fade) {
            void fade.offsetWidth; 
            fade.classList.remove('snap-black');
            setTimeout(() => fade.classList.add('hidden'), 1500); 
        }
    }
}

export const lobbyUI = new LobbySystem();