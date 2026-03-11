import { GameEngine } from './gameEngine.js';
import { sounds } from './soundManager.js';
import { ITEMS_DB } from './items.js';

// ==========================================
// GLOBALS & GAME STATE (STRICT RESET)
// ==========================================
// FORCE WIPE BROWSER CACHE ON REFRESH SO XP IS NEVER STUCK!
localStorage.clear();

window.globalAccountXP = 0;
window.globalAccountLevel = 1;
window.equippedItems = { Skin: null, Trail: null, Banner: null, Color: null };
window.unlockedItems = [];
window.matchHistory = [];
window.gameStats = { matches: 0, kills: 0, points: 0, time: 0 };

window.gameSettings = {
    volume: 100,
    highQuality: true,
    particles: true,
    showNames: true,
    showLeaderboard: true,
    showBadges: true,
    showNotifs: true,
    showMinimap: true,
    showFps: false,
    keybinds: { up: 'w', down: 's', left: 'a', right: 'd', dash: ' ', ability: 'e' }
};

function saveData() {
    // Only saving settings so your keybinds persist, everything else stays fresh
    localStorage.setItem('yepio_settings', JSON.stringify(window.gameSettings));
}

// ==========================================
// ENGINE INITIALIZATION
// ==========================================
const canvas = document.getElementById('gameCanvas');
const engine = new GameEngine(canvas);
let selectedClass = null; 

let socket = null;
if (typeof io !== 'undefined') {
    socket = io();
    window.gameSocket = socket;
}

engine.startDemo();

// ==========================================
// SHOP ROTATION TIMER
// ==========================================
setInterval(() => {
    let d = new Date();
    let m = 59 - d.getMinutes();
    let s = 59 - d.getSeconds();
    const timerEl = document.getElementById('shop-timer');
    if (timerEl) {
        timerEl.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
}, 1000);

// ==========================================
// UI BINDINGS: TABS & CLASS SELECTION
// ==========================================
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        sounds.play('click', 0.5 * (window.gameSettings.volume/100));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        const targetId = e.target.dataset.target;
        document.getElementById(targetId).classList.add('active');
        
        if (targetId === 'store' || targetId === 'season') {
            renderShop();
        } else if (targetId === 'stats') {
            renderStats();
        } else if (targetId === 'locker') {
            renderLocker();
        }
    });
});

document.querySelectorAll('.class-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        sounds.play('click', 0.5 * (window.gameSettings.volume/100));
        document.querySelectorAll('.class-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        selectedClass = e.target.dataset.class;
        
        const info = document.getElementById('class-info');
        if (selectedClass === 'triangle') info.innerText = "JET: Very fast, fragile, fires rapidly but weakly.";
        else if (selectedClass === 'square') info.innerText = "TANK: Slow, massive health, fires slow heavy shots.";
        else if (selectedClass === 'circle') info.innerText = "SOLDIER: Balanced speed, health, and damage.";
        
        info.style.color = "white"; 
        info.classList.remove('hidden', 'fade-out');
        setTimeout(() => info.classList.add('fade-out'), 2000);
    });
});

document.getElementById('play-btn').addEventListener('click', () => {
    if (!selectedClass) {
        const info = document.getElementById('class-info');
        info.innerText = "PLEASE SELECT A CLASS!";
        info.style.color = "#ff4444"; 
        info.classList.remove('hidden', 'fade-out');
        setTimeout(() => {
            info.classList.add('fade-out');
            setTimeout(() => info.style.color = "white", 500);
        }, 2000);
        return;
    }
    sounds.play('click', 0.8 * (window.gameSettings.volume/100));
    document.getElementById('main-menu').style.display = 'none';
    engine.start(selectedClass);
});

// ==========================================
// POST-MATCH LOGIC
// ==========================================
document.getElementById('return-lobby-btn').addEventListener('click', () => {
    sounds.play('click', 0.5 * (window.gameSettings.volume/100));
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('game-ui').classList.add('hidden');
    document.getElementById('br-ui').classList.add('hidden');
    
    if (socket) {
        socket.emit('leaveLobby');
    }

    let stats = window.lastMatchStats;
    if (stats) {
        window.gameStats.kills += stats.kills || 0;
        window.gameStats.time += stats.time || 0;
        window.gameStats.matches += 1;
        window.gameStats.points += stats.points || 0;

        window.matchHistory.unshift(stats);
        if (window.matchHistory.length > 20) window.matchHistory.pop();
    }
    
    updateMenuXPBar();
    document.getElementById('main-menu').style.display = 'flex';
    engine.startDemo();
});

// ==========================================
// MULTIPLAYER LOBBY SYSTEM
// ==========================================
let currentLobbyCode = null;
let isHost = false;
let lobbyPlayers = [];
let lobbyAnimationIds = {}; 

document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', (e) => {
        if (!selectedClass) {
            const info = document.getElementById('class-info');
            info.innerText = "PLEASE SELECT A CLASS BEFORE JOINING MULTIPLAYER!";
            info.style.color = "#ff4444"; 
            info.classList.remove('hidden', 'fade-out');
            setTimeout(() => { info.classList.add('fade-out'); setTimeout(() => info.style.color = "white", 500); }, 2000);
            
            document.querySelectorAll('.tab-btn')[0].click();
            return;
        }
        if (!socket) {
            alert("Multiplayer server is offline.");
            return;
        }
        sounds.play('click', 0.5 * (window.gameSettings.volume/100));
        let mode = e.currentTarget.dataset.mode;
        let maxP = mode === 'duos' ? 2 : (mode === 'trios' ? 3 : 4);
        
        socket.emit('createLobby', { maxPlayers: maxP, playerClass: selectedClass, color: getEquippedColor() });
    });
});

document.getElementById('join-lobby-btn').addEventListener('click', () => {
    if (!selectedClass) {
        const info = document.getElementById('class-info');
        info.innerText = "PLEASE SELECT A CLASS!";
        info.style.color = "#ff4444"; 
        info.classList.remove('hidden', 'fade-out');
        setTimeout(() => { info.classList.add('fade-out'); setTimeout(() => info.style.color = "white", 500); }, 2000);
        document.querySelectorAll('.tab-btn')[0].click();
        return;
    }
    if (!socket) return;
    let code = document.getElementById('join-code-input').value.toUpperCase().trim();
    if (code.length === 5) {
        sounds.play('click', 0.5 * (window.gameSettings.volume/100));
        socket.emit('joinLobby', { code: code, playerClass: selectedClass, color: getEquippedColor() });
    }
});

document.getElementById('copy-code-btn').addEventListener('click', () => {
    sounds.play('click', 0.5 * (window.gameSettings.volume/100));
    if (currentLobbyCode) {
        navigator.clipboard.writeText(currentLobbyCode);
        let btn = document.getElementById('copy-code-btn');
        btn.innerText = "COPIED!";
        btn.style.background = "#00ffcc";
        btn.style.color = "black";
        setTimeout(() => {
            btn.innerText = "COPY";
            btn.style.background = "#333";
            btn.style.color = "white";
        }, 2000);
    }
});

document.getElementById('leave-lobby-btn').addEventListener('click', () => {
    sounds.play('click', 0.5 * (window.gameSettings.volume/100));
    if (socket) socket.emit('leaveLobby');
    document.getElementById('lobby-screen').classList.add('hidden');
    currentLobbyCode = null;
});

document.getElementById('ready-btn').addEventListener('click', () => {
    sounds.play('click', 0.5 * (window.gameSettings.volume/100));
    if (socket && currentLobbyCode) {
        socket.emit('toggleReady', { code: currentLobbyCode });
    }
});

if (socket) {
    socket.on('lobbyCreated', (data) => {
        currentLobbyCode = data.code || data.lobbyCode;
        isHost = true;
        showLobbyScreen(data);
    });

    socket.on('lobbyJoined', (data) => {
        currentLobbyCode = data.code || data.lobbyCode;
        isHost = false;
        showLobbyScreen(data);
    });

    socket.on('lobbyError', (msg) => {
        alert(msg);
    });

    socket.on('lobbyUpdate', (data) => {
        renderLobbySlots(data);
    });

    socket.on('lobbyStartCountdown', (data) => {
        const btn = document.getElementById('ready-btn');
        btn.innerText = `STARTING IN ${data.time}...`;
        btn.style.background = "#00ffcc";
        btn.style.pointerEvents = "none";
        sounds.play('click', 0.8 * (window.gameSettings.volume/100));
    });

    socket.on('lobbyCountdownCancelled', () => {
        const btn = document.getElementById('ready-btn');
        btn.innerText = "READY";
        btn.style.background = "var(--accent)";
        btn.style.pointerEvents = "auto";
    });

    socket.on('startGame', (data) => {
        document.getElementById('lobby-screen').classList.add('hidden');
        document.getElementById('main-menu').style.display = 'none';
        
        const btn = document.getElementById('ready-btn');
        btn.innerText = "READY";
        btn.style.background = "var(--accent)";
        btn.style.pointerEvents = "auto";

        const snapOverlay = document.getElementById('black-fade-overlay');
        snapOverlay.classList.add('snap-black');
        setTimeout(() => snapOverlay.classList.remove('snap-black'), 1500);

        engine.startMultiplayer(data.players, data.code, isHost);
    });
}

function getEquippedColor() {
    if (window.equippedItems.Color && ITEMS_DB && ITEMS_DB[window.equippedItems.Color]) {
        const dbColor = ITEMS_DB[window.equippedItems.Color].value;
        return dbColor === 'gold' ? '#ffe600' : dbColor;
    }
    return '#d3d3d3';
}

function showLobbyScreen(data) {
    let displayCode = data.code || data.lobbyCode;
    if (!displayCode && typeof data === 'string') displayCode = data;
    document.getElementById('lobby-code-display').innerText = displayCode || "ERROR";
    
    document.getElementById('lobby-screen').classList.remove('hidden');
    renderLobbySlots(data);
}

function renderLobbySlots(data) {
    const container = document.getElementById('player-slots-container');
    container.innerHTML = '';
    lobbyPlayers = data.players;

    for (let i = 0; i < data.maxPlayers; i++) {
        let p = data.players[i];
        let slot = document.createElement('div');
        
        if (p) {
            slot.className = `player-slot ${p.isReady ? 'ready' : ''}`;
            slot.innerHTML = `
                <canvas class="lobby-preview-canvas" id="lobby-canvas-${i}" width="200" height="200"></canvas>
                <div class="name">${p.name} ${p.id === socket.id ? '(YOU)' : ''}</div>
                <div class="status">${p.isReady ? 'READY' : 'NOT READY'}</div>
            `;
            container.appendChild(slot);
            startLobbyPreviewLoop(document.getElementById(`lobby-canvas-${i}`), p.classType, p.color, i);
        } else {
            slot.className = 'player-slot empty';
            slot.innerHTML = `
                <div class="lobby-preview-canvas">?</div>
                <div class="name" style="color:gray;">WAITING...</div>
                <div class="status" style="color:#333;">---</div>
            `;
            container.appendChild(slot);
        }
    }

    const readyBtn = document.getElementById('ready-btn');
    let myData = data.players.find(px => px.id === socket.id);
    if (myData && myData.isReady) {
        readyBtn.innerText = "UNREADY";
        readyBtn.style.background = "#ff4444";
        readyBtn.style.color = "white";
    } else {
        readyBtn.innerText = "READY";
        readyBtn.style.background = "var(--accent)";
        readyBtn.style.color = "black";
    }
}

function startLobbyPreviewLoop(canvas, pClass, pColor, slotIndex) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let angle = 0;
    
    if (lobbyAnimationIds[slotIndex]) {
        cancelAnimationFrame(lobbyAnimationIds[slotIndex]);
    }
    
    const loop = () => {
        if (canvas.offsetParent === null) {
            lobbyAnimationIds[slotIndex] = requestAnimationFrame(loop);
            return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        angle += 0.015; 
        
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(angle);
        
        let size = 45;
        ctx.fillStyle = pColor;
        ctx.shadowBlur = 15;
        ctx.shadowColor = pColor;
        if (pColor === '#111111' || pColor === '#000000') {
            ctx.shadowColor = '#ffffff';
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 4;
        }

        ctx.beginPath();
        if (pClass === 'circle') {
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
            if (pColor === '#111111') ctx.stroke();
        } else if (pClass === 'square') {
            size = 55;
            ctx.rect(-size/2, -size/2, size, size);
            ctx.fill();
            if (pColor === '#111111') ctx.stroke();
        } else {
            ctx.moveTo(size, 0);
            ctx.lineTo(-size/2, -size*0.866);
            ctx.lineTo(-size/2, size*0.866);
            ctx.closePath();
            ctx.fill();
            if (pColor === '#111111') ctx.stroke();
        }
        
        ctx.restore();
        lobbyAnimationIds[slotIndex] = requestAnimationFrame(loop);
    };
    loop();
}

// ==========================================
// MATCH HISTORY & STATS
// ==========================================
function getOrdinal(n) {
    let s = ["th", "st", "nd", "rd"], v = n % 100;
    return (s[(v - 20) % 10] || s[v] || s[0]);
}

function renderStats() {
    document.getElementById('stat-account-level').innerText = window.globalAccountLevel;
    document.getElementById('stat-matches').innerText = window.gameStats.matches;
    document.getElementById('stat-kills').innerText = window.gameStats.kills;
    document.getElementById('stat-points').innerText = Math.floor(window.gameStats.points);
    document.getElementById('stat-time').innerText = `${Math.floor(window.gameStats.time / 60)}m ${window.gameStats.time % 60}s`;

    const list = document.getElementById('match-history-list');
    list.innerHTML = '';
    
    if (window.matchHistory.length === 0) {
        list.innerHTML = '<p class="empty-history">Play a match to see your history!</p>';
        return;
    }

    const abilities = ['shield','overdrive','bullet_nova','blink','emp','cloak','repulsor','sonic_boom','phase_strike','strafe_run','juggernaut','missile_swarm','earthshatter','minigun','tactical_nuke','blade_ring'];

    window.matchHistory.forEach(m => {
        let upgHtml = '';
        for(let key in m.upgrades) {
            let tier = m.upgrades[key];
            
            if (tier > 0) {
                if (abilities.includes(key)) {
                    upgHtml += `
                        <div class="upgrade-badge ability-badge">
                            <div class="badge-name">⭐ ${key.replace('_',' ').toUpperCase()}</div>
                            <div class="badge-tier">ACTIVE</div>
                        </div>`;
                } else {
                    let tc = tier === 1 ? 'badge-t1' : tier === 2 ? 'badge-t2' : tier === 3 ? 'badge-t3' : tier === 4 ? 'badge-t4' : 'badge-t5';
                    upgHtml += `
                        <div class="upgrade-badge ${tc}">
                            <div class="badge-name">${key.toUpperCase()}</div>
                            <div class="badge-tier">T${tier}</div>
                        </div>`;
                }
            }
        }

        let card = document.createElement('div');
        card.className = 'match-card';
        card.innerHTML = `
            <div class="match-card-main">
                <div><span class="match-detail-label">RANK</span><span class="match-detail-val">${m.rank}<span>${getOrdinal(m.rank)}</span></span></div>
                <div><span class="match-detail-label">CLASS</span><span class="match-detail-val" style="text-transform:capitalize;">${m.playerClass}</span></div>
                <div><span class="match-detail-label">KILLS</span><span class="match-detail-val">${m.kills}</span></div>
                <div><span class="match-detail-label">POINTS</span><span class="match-detail-val">${Math.floor(m.points)}</span></div>
                <div><span class="match-detail-label">TIME</span><span class="match-detail-val">${Math.floor(m.time/60)}m ${m.time%60}s</span></div>
            </div>
            <div class="match-upgrades" style="display:none; flex-wrap:wrap; gap:5px; margin-top:15px; padding-top:10px; border-top:1px solid #333;">
                ${upgHtml || '<span style="color:gray; font-size:0.8rem;">No Upgrades</span>'}
            </div>
        `;
        
        card.addEventListener('click', () => {
            sounds.play('click', 0.3 * (window.gameSettings.volume/100));
            card.classList.toggle('expanded');
            let upgDiv = card.querySelector('.match-upgrades');
            upgDiv.style.display = card.classList.contains('expanded') ? 'flex' : 'none';
        });
        
        list.appendChild(card);
    });
}

// ==========================================
// SHOP & LOCKER & PREVIEWS
// ==========================================
let previewAnimationId = null;
let previewAngle = 0;

function renderShop() {
    const seasonGrid = document.getElementById('season-grid');
    const mainGrid = document.getElementById('main-store-grid');
    
    if (seasonGrid) seasonGrid.innerHTML = '';
    if (mainGrid) mainGrid.innerHTML = '';

    // STRICT SHOP FILTERING
    Object.values(ITEMS_DB).forEach(item => {
        const isEquipped = window.equippedItems[item.category] === item.id;
        
        if (item.reqType === 'level' && seasonGrid) {
            let reqVal = item.reqVal || 1;
            const isUnlocked = window.globalAccountLevel >= reqVal || window.unlockedItems.includes(item.id);
            
            let btnHTML = isUnlocked 
                ? `<button class="btn-equip ${isEquipped ? 'equipped' : ''}" data-id="${item.id}" data-cat="${item.category}">${isEquipped ? 'EQUIPPED' : 'EQUIP'}</button>` 
                : `<button class="btn-claim locked" data-id="${item.id}"><span>REACH LVL ${reqVal}</span><div class="fill"></div></button>`;
                
            seasonGrid.innerHTML += `
                <div class="store-item ${isUnlocked ? 'unlocked' : 'locked'}" style="--rarity-color: ${getRarityColor(item.rarity)}">
                    <div class="item-name">${item.name} (${item.category})</div>
                    <div class="item-icon" data-id="${item.id}">${item.icon}</div>
                    ${btnHTML}
                </div>`;
        } 
        else if (item.reqType === 'points' && mainGrid) {
            let reqVal = item.reqVal || 1000;
            const isUnlocked = window.gameStats.points >= reqVal || window.unlockedItems.includes(item.id);
            let progressPct = Math.min(100, (window.gameStats.points / reqVal) * 100);
            
            let btnHTML = isUnlocked 
                ? `<button class="btn-equip ${isEquipped ? 'equipped' : ''}" data-id="${item.id}" data-cat="${item.category}">${isEquipped ? 'EQUIPPED' : 'EQUIP'}</button>` 
                : `<div class="item-progress-bg"><div class="item-progress-fill" style="background:${getRarityColor(item.rarity)}; width:${progressPct}%"></div></div>
                   <button class="btn-claim locked"><span>${Math.floor(window.gameStats.points)} / ${reqVal} PTS</span><div class="fill"></div></button>`;

            if (window.gameStats.points >= reqVal && !window.unlockedItems.includes(item.id)) {
                btnHTML = `<button class="btn-claim claimable" data-id="${item.id}"><span>HOLD TO CLAIM</span><div class="fill"></div></button>`;
            }

            mainGrid.innerHTML += `
                <div class="store-item ${isUnlocked ? 'unlocked' : 'locked'}" style="--rarity-color: ${getRarityColor(item.rarity)}">
                    <div class="item-name">${item.name} (${item.category})</div>
                    <div class="item-icon" data-id="${item.id}">${item.icon}</div>
                    ${btnHTML}
                </div>`;
        }
    });

    bindShopButtons();
}

function bindShopButtons() {
    document.querySelectorAll('.btn-equip').forEach(btn => {
        btn.addEventListener('click', (e) => {
            sounds.play('click', 0.5 * (window.gameSettings.volume/100));
            const id = e.target.dataset.id;
            const cat = e.target.dataset.cat;
            
            if (window.equippedItems[cat] === id) {
                window.equippedItems[cat] = null;
            } else {
                window.equippedItems[cat] = id === "null" ? null : id; 
            }
            renderShop();
            renderLocker();
        });
    });

    document.querySelectorAll('.btn-claim.claimable').forEach(btn => {
        let holdTimer = null;
        let isHolding = false;
        
        const startHold = (e) => {
            e.preventDefault();
            if(isHolding) return;
            isHolding = true;
            btn.classList.add('holding');
            
            holdTimer = setTimeout(() => {
                const id = btn.dataset.id;
                if (!window.unlockedItems.includes(id)) {
                    window.unlockedItems.push(id);
                    sounds.play('levelUp', 0.5 * (window.gameSettings.volume/100));
                    btn.classList.remove('holding');
                    renderShop();
                    renderLocker();
                }
            }, 1000); 
        };

        const cancelHold = () => {
            isHolding = false;
            clearTimeout(holdTimer);
            btn.classList.remove('holding');
        };

        btn.addEventListener('mousedown', startHold);
        btn.addEventListener('touchstart', startHold);
        btn.addEventListener('mouseup', cancelHold);
        btn.addEventListener('mouseleave', cancelHold);
        btn.addEventListener('touchend', cancelHold);
    });

    document.querySelectorAll('.item-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            if(id && id !== "null") openFullScreenPreview(id);
        });
    });
}

function renderLocker() {
    const slotsView = document.getElementById('locker-slots-view');
    if (!slotsView) return;
    slotsView.innerHTML = '';
    
    ['Skin', 'Color', 'Trail', 'Banner'].forEach(cat => {
        let equippedId = window.equippedItems[cat];
        let item = equippedId ? ITEMS_DB[equippedId] : null;
        
        let icon = item ? item.icon : '❌'; 
        let name = item ? item.name : 'NONE';
        let rColor = item ? getRarityColor(item.rarity) : '#444';
        
        slotsView.innerHTML += `
            <div class="locker-slot" data-targetcat="${cat}" style="--slot-color: ${rColor}">
                <div class="slot-header">${cat}</div>
                <div class="slot-icon">${icon}</div>
                <div class="slot-name">${name}</div>
            </div>
        `;
    });
    
    document.querySelectorAll('.locker-slot').forEach(slot => {
        slot.addEventListener('click', (e) => {
            sounds.play('click', 0.5 * (window.gameSettings.volume/100));
            openLockerCategory(e.currentTarget.dataset.targetcat);
        });
    });

    startPreviewLoop(document.getElementById('lockerPreviewCanvas'));
}

function openLockerCategory(category) {
    document.getElementById('locker-slots-view').classList.add('hidden');
    document.getElementById('locker-items-view').classList.remove('hidden');
    document.getElementById('locker-category-title').innerText = category + "S";
    
    const grid = document.getElementById('locker-item-grid');
    grid.innerHTML = '';
    
    const noneEquipped = window.equippedItems[category] === null;
    grid.innerHTML += `
        <div class="store-item unlocked" style="--rarity-color: #555;">
            <div class="item-name">Unequip</div>
            <div class="item-icon">❌</div>
            <button class="btn-equip ${noneEquipped ? 'equipped' : ''}" data-id="null" data-cat="${category}">${noneEquipped ? 'EQUIPPED' : 'EQUIP'}</button>
        </div>
    `;

    Object.values(ITEMS_DB).filter(i => i.category === category).forEach(item => {
        let isUnlocked = false;
        if (item.reqType === 'level') {
            isUnlocked = window.globalAccountLevel >= (item.reqVal || 1) || window.unlockedItems.includes(item.id);
        } else if (item.reqType === 'points') {
            isUnlocked = window.gameStats.points >= (item.reqVal || 1000) || window.unlockedItems.includes(item.id);
        }
        
        if (isUnlocked) {
            const isEquipped = window.equippedItems[category] === item.id;
            grid.innerHTML += `
                <div class="store-item unlocked" style="--rarity-color: ${getRarityColor(item.rarity)}">
                    <div class="item-name">${item.name}</div>
                    <div class="item-icon" data-id="${item.id}">${item.icon}</div>
                    <button class="btn-equip ${isEquipped ? 'equipped' : ''}" data-id="${item.id}" data-cat="${category}">${isEquipped ? 'EQUIPPED' : 'EQUIP'}</button>
                </div>
            `;
        }
    });
    
    bindShopButtons();
}

document.getElementById('locker-back-btn')?.addEventListener('click', () => {
    sounds.play('click', 0.5 * (window.gameSettings.volume/100));
    document.getElementById('locker-items-view').classList.add('hidden');
    document.getElementById('locker-slots-view').classList.remove('hidden');
});

function getRarityColor(rarity) {
    if(rarity === 'Common') return '#b0c4de';
    if(rarity === 'Rare') return '#3b82f6';
    if(rarity === 'Epic') return '#a855f7';
    if(rarity === 'Legendary') return '#ffe600';
    return '#fff';
}

function updateMenuXPBar() {
    let nextLvlReq = window.globalAccountLevel * 1000;
    let pct = (window.globalAccountXP / nextLvlReq) * 100;
    
    let bar1 = document.getElementById('menu-xp-bar');
    let bar2 = document.getElementById('season-progress-bar');
    
    if (bar1) bar1.style.width = `${pct}%`;
    if (bar2) bar2.style.width = `${pct}%`;
    
    let lvl1 = document.getElementById('menu-level');
    if (lvl1) lvl1.innerText = window.globalAccountLevel;
}

// ==========================================
// PREVIEW SYSTEM
// ==========================================
let currentPreviewItem = null;

function openFullScreenPreview(itemId) {
    sounds.play('click', 0.5 * (window.gameSettings.volume/100));
    const item = ITEMS_DB[itemId];
    if (!item) return;

    currentPreviewItem = item;
    document.getElementById('preview-screen-title').innerText = item.name;
    document.getElementById('preview-screen-title').style.color = getRarityColor(item.rarity);
    document.getElementById('preview-screen-title').style.textShadow = `0 0 20px ${getRarityColor(item.rarity)}`;
    document.getElementById('preview-screen-category').innerText = `${item.rarity} ${item.category}`;

    document.getElementById('item-preview-screen').classList.remove('hidden');
    startPreviewLoop(document.getElementById('fullscreenPreviewCanvas'), item);
}

document.getElementById('close-preview-btn').addEventListener('click', () => {
    sounds.play('click', 0.5 * (window.gameSettings.volume/100));
    document.getElementById('item-preview-screen').classList.add('hidden');
    currentPreviewItem = null;
    startPreviewLoop(document.getElementById('lockerPreviewCanvas'));
});

function startPreviewLoop(canvas, specificItem = null) {
    if (previewAnimationId) {
        cancelAnimationFrame(previewAnimationId);
    }
    const ctx = canvas.getContext('2d');
    
    const loop = () => {
        if (canvas.offsetParent === null) {
            previewAnimationId = requestAnimationFrame(loop);
            return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        previewAngle += 0.015; 
        
        drawPreview(ctx, canvas.width, canvas.height, previewAngle, specificItem);
        previewAnimationId = requestAnimationFrame(loop);
    };
    loop();
}

function drawPreview(ctx, w, h, angle, specificItem = null) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(angle);

    let pClass = selectedClass || 'triangle';
    let size = 70; 
    if (pClass === 'square') size = 90;

    let baseColor = getEquippedColor();
    let skinType = null;
    let hasTrail = false;
    let hasBanner = false;
    let bannerText = "";

    if (specificItem) {
        if (specificItem.category === 'Color') baseColor = specificItem.value === 'gold' ? '#ffe600' : specificItem.value;
        if (specificItem.category === 'Skin') skinType = specificItem.value;
        if (specificItem.category === 'Trail') hasTrail = specificItem.value;
        if (specificItem.category === 'Banner') { hasBanner = true; bannerText = specificItem.value; }
    } else {
        if (window.equippedItems.Skin) skinType = ITEMS_DB[window.equippedItems.Skin].value;
        if (window.equippedItems.Trail) hasTrail = ITEMS_DB[window.equippedItems.Trail].value;
        if (window.equippedItems.Banner) { hasBanner = true; bannerText = ITEMS_DB[window.equippedItems.Banner].value; }
    }

    if (hasTrail) {
        ctx.save();
        ctx.translate(-size * 1.5, 0);
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = hasTrail;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.translate(-25, 0);
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    ctx.fillStyle = baseColor;
    ctx.shadowBlur = 15;
    ctx.shadowColor = baseColor;
    
    if (baseColor === '#111111' || baseColor === '#000000') {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffffff';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 3;
    }

    ctx.beginPath();
    if (pClass === 'circle') { ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill(); if(baseColor === '#111') ctx.stroke(); } 
    else if (pClass === 'square') { ctx.rect(-size / 2, -size / 2, size, size); ctx.fill(); if(baseColor === '#111') ctx.stroke(); } 
    else if (pClass === 'triangle') { ctx.moveTo(size, 0); ctx.lineTo(-size / 2, -size * 0.866); ctx.lineTo(-size / 2, size * 0.866); ctx.closePath(); ctx.fill(); if(baseColor === '#111') ctx.stroke(); }

    if (skinType) {
        ctx.save();
        if (['spectre', 'luminescent', 'celestial', 'voidwalker', 'inferno', 'neon', 'dark', 'glitch'].includes(skinType)) { ctx.shadowBlur = 30; }

        if (skinType === 'ghost') { ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.beginPath(); if(pClass==='circle') ctx.arc(0,0,size,0,Math.PI*2); else if(pClass==='square') ctx.rect(-size/2,-size/2,size,size); else { ctx.moveTo(size,0); ctx.lineTo(-size/2,-size*0.866); ctx.lineTo(-size/2,size*0.866); ctx.closePath(); } ctx.fill(); ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(size*0.4,-size*0.3,5,0,Math.PI*2); ctx.arc(size*0.4,size*0.3,5,0,Math.PI*2); ctx.fill(); }
        else if (skinType === 'assassin') { ctx.fillStyle='rgba(0,0,0,0.8)'; ctx.beginPath(); if(pClass==='circle') ctx.arc(0,0,size*0.8,0,Math.PI*2); else if(pClass==='square') ctx.rect(-size*0.4,-size*0.4,size*0.8,size*0.8); else { ctx.moveTo(size*0.8,0); ctx.lineTo(-size*0.4,-size*0.69); ctx.lineTo(-size*0.4,size*0.69); ctx.closePath(); } ctx.fill(); ctx.fillStyle='#ff0000'; ctx.shadowColor='#ff0000'; ctx.shadowBlur=15; ctx.beginPath(); ctx.arc(size*0.3,0,6,0,Math.PI*2); ctx.fill(); }
        else if (skinType === 'paladin') { ctx.strokeStyle='#fbbf24'; ctx.lineWidth=6; ctx.beginPath(); ctx.moveTo(-size*0.8,0); ctx.lineTo(size*0.8,0); ctx.moveTo(0,-size*0.8); ctx.lineTo(0,size*0.8); ctx.stroke(); }
        else if (skinType === 'hologram') { ctx.fillStyle='transparent'; ctx.strokeStyle='#00ffff'; ctx.lineWidth=3; ctx.shadowColor='#00ffff'; ctx.shadowBlur=15; ctx.beginPath(); if(pClass==='circle') ctx.arc(0,0,size*0.6,0,Math.PI*2); else if(pClass==='square') ctx.rect(-size*0.3,-size*0.3,size*0.6,size*0.6); else { ctx.moveTo(size*0.6,0); ctx.lineTo(-size*0.3,-size*0.5); ctx.lineTo(-size*0.3,size*0.5); ctx.closePath(); } ctx.stroke(); }
        else if (skinType === 'spartan') { ctx.strokeStyle='#dc2626'; ctx.lineWidth=8; ctx.beginPath(); ctx.moveTo(-size*0.5,-size*0.8); ctx.lineTo(size*0.5,0); ctx.lineTo(-size*0.5,size*0.8); ctx.stroke(); }
        else if (skinType === 'luminescent') { const hue=(Date.now()/15)%360; const rColor=`hsl(${hue}, 100%, 50%)`; ctx.fillStyle=rColor; ctx.shadowColor=rColor; ctx.shadowBlur=35; ctx.beginPath(); ctx.arc(0,0,size*0.5,0,Math.PI*2); ctx.fill(); }
        else if (skinType === 'ninja') { ctx.fillStyle='#111'; ctx.beginPath(); ctx.fillRect(-size,-size*0.3,size*2,size*0.6); ctx.fillStyle='#fff'; ctx.fillRect(-size*0.5,-size*0.1,size,size*0.2); }
        else if (skinType === 'celestial') { ctx.fillStyle='#fff'; ctx.shadowColor='#00ffff'; ctx.shadowBlur=25; ctx.beginPath(); ctx.moveTo(0,-size*0.6); ctx.lineTo(size*0.2,-size*0.2); ctx.lineTo(size*0.6,0); ctx.lineTo(size*0.2,size*0.2); ctx.lineTo(0,size*0.6); ctx.lineTo(-size*0.2,size*0.2); ctx.lineTo(-size*0.6,0); ctx.lineTo(-size*0.2,-size*0.2); ctx.closePath(); ctx.fill(); }
        else if (skinType === 'cyborg') { ctx.save(); ctx.beginPath(); if(pClass==='circle') ctx.arc(0,0,size,0,Math.PI*2); else if(pClass==='square') ctx.rect(-size/2,-size/2,size,size); else { ctx.moveTo(size,0); ctx.lineTo(-size/2,-size*0.866); ctx.lineTo(-size/2,size*0.866); ctx.closePath(); } ctx.clip(); ctx.fillStyle='#9ca3af'; ctx.fillRect(-size,-size,size*2,size); ctx.fillStyle='#ff0000'; ctx.shadowColor='#ff0000'; ctx.shadowBlur=15; ctx.beginPath(); ctx.arc(size*0.4,-size*0.4,8,0,Math.PI*2); ctx.fill(); ctx.restore(); }
        else if (skinType === 'voidwalker') { ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(0,0,size*0.5,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#a855f7'; ctx.lineWidth=4; ctx.shadowColor='#a855f7'; ctx.shadowBlur=25; ctx.stroke(); }
        else if (skinType === 'glitch') { ctx.fillStyle='rgba(0,255,255,0.7)'; ctx.beginPath(); ctx.arc(-5,-5,size*0.4,0,Math.PI*2); ctx.fill(); ctx.fillStyle='rgba(255,0,255,0.7)'; ctx.beginPath(); ctx.arc(5,5,size*0.4,0,Math.PI*2); ctx.fill(); }
        else if (skinType === 'inferno') { ctx.fillStyle='#fbbf24'; ctx.beginPath(); ctx.arc(0,0,size*0.6,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#dc2626'; ctx.shadowColor='#dc2626'; ctx.shadowBlur=25; ctx.beginPath(); ctx.arc(0,0,size*0.4,0,Math.PI*2); ctx.fill(); }
        else if (skinType === 'warlord') { ctx.strokeStyle='#444'; ctx.lineWidth=6; ctx.beginPath(); ctx.moveTo(-size*0.5,-size*0.5); ctx.lineTo(size*0.5,size*0.5); ctx.moveTo(size*0.5,-size*0.5); ctx.lineTo(-size*0.5,size*0.5); ctx.stroke(); }
        else if (skinType === 'spectre') { ctx.fillStyle='rgba(168,85,247,0.8)'; ctx.shadowColor='#a855f7'; ctx.shadowBlur=30; ctx.beginPath(); ctx.arc(0,0,size*0.7,0,Math.PI*2); ctx.fill(); }
        else if (skinType === 'phantom') { ctx.strokeStyle='rgba(59,130,246,0.8)'; ctx.lineWidth=4; ctx.shadowColor='#3b82f6'; ctx.shadowBlur=15; ctx.beginPath(); ctx.arc(0,0,size*0.8,0,Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.arc(0,0,size*0.4,0,Math.PI*2); ctx.stroke(); }
        else if (skinType === 'target') { ctx.save(); ctx.beginPath(); if(pClass==='circle') ctx.arc(0,0,size,0,Math.PI*2); else if(pClass==='square') ctx.rect(-size/2,-size/2,size,size); else { ctx.moveTo(size,0); ctx.lineTo(-size/2,-size*0.866); ctx.lineTo(-size/2,size*0.866); ctx.closePath(); } ctx.clip(); ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=6; ctx.beginPath(); ctx.arc(0,0,size*0.6,0,Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.arc(0,0,size*0.2,0,Math.PI*2); ctx.stroke(); ctx.restore(); }
        else if (skinType === 'stripes') { ctx.save(); ctx.beginPath(); if(pClass==='circle') ctx.arc(0,0,size,0,Math.PI*2); else if(pClass==='square') ctx.rect(-size/2,-size/2,size,size); else { ctx.moveTo(size,0); ctx.lineTo(-size/2,-size*0.866); ctx.lineTo(-size/2,size*0.866); ctx.closePath(); } ctx.clip(); ctx.fillStyle='rgba(255,255,255,0.3)'; for(let i=-size; i<size; i+=15) { ctx.fillRect(i,-size,8,size*2); } ctx.restore(); }
        else if (skinType === 'checker') { ctx.save(); ctx.beginPath(); if(pClass==='circle') ctx.arc(0,0,size,0,Math.PI*2); else if(pClass==='square') ctx.rect(-size/2,-size/2,size,size); else { ctx.moveTo(size,0); ctx.lineTo(-size/2,-size*0.866); ctx.lineTo(-size/2,size*0.866); ctx.closePath(); } ctx.clip(); ctx.fillStyle='rgba(0,0,0,0.3)'; let sq=size*0.25; for(let x=-size;x<=size;x+=sq){ for(let y=-size;y<=size;y+=sq){ if(Math.abs(Math.round(x/sq)+Math.round(y/sq))%2===0) ctx.fillRect(x,y,sq,sq); } } ctx.restore(); }
        else if (skinType === 'zebra') { ctx.save(); ctx.beginPath(); if(pClass==='circle') ctx.arc(0,0,size,0,Math.PI*2); else if(pClass==='square') ctx.rect(-size/2,-size/2,size,size); else { ctx.moveTo(size,0); ctx.lineTo(-size/2,-size*0.866); ctx.lineTo(-size/2,size*0.866); ctx.closePath(); } ctx.clip(); ctx.fillStyle='#111'; for(let i=-size; i<size; i+=20) { ctx.beginPath(); ctx.moveTo(i,-size); ctx.lineTo(i+8,0); ctx.lineTo(i-4,size); ctx.lineTo(i+6,size); ctx.lineTo(i+18,0); ctx.lineTo(i+12,-size); ctx.fill(); } ctx.restore(); }
        else if (skinType === 'camo') { ctx.save(); ctx.beginPath(); if(pClass==='circle') ctx.arc(0,0,size,0,Math.PI*2); else if(pClass==='square') ctx.rect(-size/2,-size/2,size,size); else { ctx.moveTo(size,0); ctx.lineTo(-size/2,-size*0.866); ctx.lineTo(-size/2,size*0.866); ctx.closePath(); } ctx.clip(); ctx.fillStyle='#4b5320'; ctx.fillRect(-size,-size,size*2,size*2); ctx.fillStyle='#556b2f'; ctx.beginPath(); ctx.arc(-size*0.4,-size*0.3,size*0.5,0,Math.PI*2); ctx.arc(size*0.3,size*0.5,size*0.4,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#8b7355'; ctx.beginPath(); ctx.arc(size*0.5,-size*0.4,size*0.4,0,Math.PI*2); ctx.arc(-size*0.2,size*0.4,size*0.5,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#2f4f4f'; ctx.beginPath(); ctx.arc(-size*0.6,0.1,size*0.3,0,Math.PI*2); ctx.arc(size*0.1,-size*0.1,size*0.3,0,Math.PI*2); ctx.fill(); ctx.restore(); }
        else if (skinType === 'demon') { ctx.fillStyle='#111'; ctx.beginPath(); ctx.moveTo(-size*0.2,-size*0.5); ctx.lineTo(-size*0.5,-size*0.8); ctx.lineTo(0,-size*0.6); ctx.fill(); ctx.beginPath(); ctx.moveTo(-size*0.2,size*0.5); ctx.lineTo(-size*0.5,size*0.8); ctx.lineTo(0,size*0.6); ctx.fill(); ctx.fillStyle='#ff0000'; ctx.shadowColor='#ff0000'; ctx.shadowBlur=15; ctx.beginPath(); ctx.moveTo(size*0.3,-size*0.3); ctx.lineTo(size*0.6,-size*0.1); ctx.lineTo(size*0.3,-size*0.1); ctx.fill(); ctx.beginPath(); ctx.moveTo(size*0.3,size*0.3); ctx.lineTo(size*0.6,size*0.1); ctx.lineTo(size*0.3,size*0.1); ctx.fill(); }
        else if (skinType === 'angel') { ctx.strokeStyle='#ffe600'; ctx.lineWidth=5; ctx.shadowColor='#ffe600'; ctx.shadowBlur=15; ctx.beginPath(); ctx.ellipse(-size*0.2,0,size*0.2,size*0.6,0,0,Math.PI*2); ctx.stroke(); }
        else if (skinType === 'pirate') { ctx.save(); ctx.beginPath(); if(pClass==='circle') ctx.arc(0,0,size,0,Math.PI*2); else if(pClass==='square') ctx.rect(-size/2,-size/2,size,size); else { ctx.moveTo(size,0); ctx.lineTo(-size/2,-size*0.866); ctx.lineTo(-size/2,size*0.866); ctx.closePath(); } ctx.clip(); ctx.strokeStyle='#111'; ctx.lineWidth=6; ctx.beginPath(); ctx.moveTo(-size,-size); ctx.lineTo(size,size); ctx.stroke(); ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(size*0.2,size*0.2,size*0.3,0,Math.PI*2); ctx.fill(); ctx.restore(); }
        else if (skinType === 'bandit') { ctx.save(); ctx.beginPath(); if(pClass==='circle') ctx.arc(0,0,size,0,Math.PI*2); else if(pClass==='square') ctx.rect(-size/2,-size/2,size,size); else { ctx.moveTo(size,0); ctx.lineTo(-size/2,-size*0.866); ctx.lineTo(-size/2,size*0.866); ctx.closePath(); } ctx.clip(); ctx.fillStyle='#111'; ctx.fillRect(0,-size,size*0.6,size*2); ctx.fillStyle='#fff'; ctx.fillRect(size*0.2,-size*0.4,size*0.2,size*0.2); ctx.fillRect(size*0.2,size*0.2,size*0.2,size*0.2); ctx.restore(); }
        else if (skinType === 'mecha') { ctx.save(); ctx.beginPath(); if(pClass==='circle') ctx.arc(0,0,size,0,Math.PI*2); else if(pClass==='square') ctx.rect(-size/2,-size/2,size,size); else { ctx.moveTo(size,0); ctx.lineTo(-size/2,-size*0.866); ctx.lineTo(-size/2,size*0.866); ctx.closePath(); } ctx.clip(); ctx.strokeStyle='#00ffcc'; ctx.lineWidth=3; ctx.shadowColor='#00ffcc'; ctx.shadowBlur=10; ctx.beginPath(); ctx.moveTo(-size*0.8,-size*0.2); ctx.lineTo(0,-size*0.2); ctx.lineTo(size*0.2,-size*0.6); ctx.moveTo(-size*0.8,size*0.2); ctx.lineTo(0,size*0.2); ctx.lineTo(size*0.2,size*0.6); ctx.moveTo(size*0.4,-size*0.8); ctx.lineTo(size*0.4,size*0.8); ctx.stroke(); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(0,-size*0.2,4,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(0,size*0.2,4,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(size*0.4,0,4,0,Math.PI*2); ctx.fill(); ctx.restore(); }
        else {
            ctx.beginPath(); const innerSize = size * 0.5;
            if (pClass === 'circle') ctx.arc(0, 0, innerSize, 0, Math.PI * 2); 
            else if (pClass === 'square') ctx.rect(-innerSize / 2, -innerSize / 2, innerSize, innerSize); 
            else if (pClass === 'triangle') { ctx.moveTo(innerSize, 0); ctx.lineTo(-innerSize / 2, -innerSize * 0.866); ctx.lineTo(-innerSize / 2, innerSize * 0.866); ctx.closePath(); }
            
            if (skinType === 'neon') { ctx.fillStyle = '#ffffff'; if(window.gameSettings.highQuality) { ctx.shadowBlur=25; ctx.shadowColor='#ffffff'; } ctx.fill(); } 
            else if (skinType === 'dark') { ctx.fillStyle = '#111111'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#a855f7'; ctx.stroke(); } 
            else if (skinType === 'gladiator') { ctx.fillStyle = '#9ca3af'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke(); }
        }
        ctx.restore();
    }

    ctx.restore(); 

    if (hasBanner) {
        ctx.save();
        ctx.translate(w / 2, h / 2 - size - 40);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'black';
        ctx.fillText(`${bannerText} Player`, 0, 0);
        ctx.restore();
    }
}

// ==========================================
// SETTINGS & DEV CONSOLE
// ==========================================
document.getElementById('settings-btn').addEventListener('click', () => {
    sounds.play('click', 0.5 * (window.gameSettings.volume/100));
    document.getElementById('settings-modal').classList.remove('hidden');
});

document.getElementById('close-settings-btn').addEventListener('click', () => {
    sounds.play('click', 0.5 * (window.gameSettings.volume/100));
    document.getElementById('settings-modal').classList.add('hidden');
    
    window.gameSettings.volume = document.getElementById('set-volume').value;
    window.gameSettings.highQuality = document.getElementById('set-hq').checked;
    window.gameSettings.particles = document.getElementById('set-particles').checked;
    window.gameSettings.showNames = document.getElementById('set-names').checked;
    window.gameSettings.showLeaderboard = document.getElementById('set-leaderboard').checked;
    window.gameSettings.showBadges = document.getElementById('set-badges').checked;
    window.gameSettings.showNotifs = document.getElementById('set-notifs').checked;
    window.gameSettings.showMinimap = document.getElementById('set-minimap').checked;
    window.gameSettings.showFps = document.getElementById('set-fps').checked;
    
    saveData();
});

let listeningForKey = null;
document.querySelectorAll('.keybind-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        sounds.play('click', 0.5 * (window.gameSettings.volume/100));
        document.querySelectorAll('.keybind-btn').forEach(b => b.innerText = window.gameSettings.keybinds[b.dataset.action].toUpperCase());
        e.target.innerText = "PRESS KEY...";
        listeningForKey = e.target.dataset.action;
    });
});

window.addEventListener('keydown', (e) => {
    if (listeningForKey) {
        e.preventDefault();
        let key = e.key.toLowerCase();
        if (key === ' ') key = 'space';
        window.gameSettings.keybinds[listeningForKey] = key;
        document.querySelector(`.keybind-btn[data-action="${listeningForKey}"]`).innerText = key.toUpperCase();
        listeningForKey = null;
        saveData();
    }

    if (e.key === 'Escape') {
        const consoleEl = document.getElementById('dev-console');
        if (!consoleEl.classList.contains('hidden')) {
            consoleEl.classList.add('hidden');
            document.getElementById('dev-input').blur();
            return; 
        }
        
        const gameUi = document.getElementById('game-ui');
        if (!gameUi.classList.contains('hidden') && !engine.isGameOver && !engine.isDemo && engine.player && !engine.player.isDead) {
            // TRIGGER GAME OVER/SPECTATOR
            engine.processDeath(engine.player, null);
        }
    }
});

// Init Settings UI
document.getElementById('set-volume').value = window.gameSettings.volume;
document.getElementById('set-hq').checked = window.gameSettings.highQuality;
document.getElementById('set-particles').checked = window.gameSettings.particles;
document.getElementById('set-names').checked = window.gameSettings.showNames;
document.getElementById('set-leaderboard').checked = window.gameSettings.showLeaderboard;
document.getElementById('set-badges').checked = window.gameSettings.showBadges;
document.getElementById('set-notifs').checked = window.gameSettings.showNotifs;
document.getElementById('set-minimap').checked = window.gameSettings.showMinimap;
document.getElementById('set-fps').checked = window.gameSettings.showFps;

document.querySelectorAll('.keybind-btn').forEach(btn => {
    let act = btn.dataset.action;
    let k = window.gameSettings.keybinds[act];
    if (k === ' ') k = 'space';
    btn.innerText = k.toUpperCase();
});

// DEV CONSOLE
window.addEventListener('keydown', (e) => {
    if (e.key === '`' || e.key === '/') {
        if (!listeningForKey && document.activeElement !== document.getElementById('join-code-input')) {
            e.preventDefault();
            const consoleEl = document.getElementById('dev-console');
            const inputEl = document.getElementById('dev-input');
            if (consoleEl.classList.contains('hidden')) {
                consoleEl.classList.remove('hidden');
                inputEl.value = e.key === '/' ? '/' : '';
                inputEl.focus();
            } else {
                consoleEl.classList.add('hidden');
                inputEl.blur();
            }
        }
    }
});

document.getElementById('dev-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const val = e.target.value.trim();
        if (val) {
            logDev(`> ${val}`);
            processDevCommand(val);
            e.target.value = '';
        }
    }
});

function logDev(msg) {
    const logEl = document.getElementById('dev-log');
    const entry = document.createElement('div');
    entry.innerText = msg;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
}

function processDevCommand(cmd) {
    const parts = cmd.split(' ');
    const root = parts[0].toLowerCase();
    
    if (root === '/help') {
        logDev("Available commands: /help, /xp [amount], /level [amount], /unlockall, /clear, /fps");
    } else if (root === '/xp') {
        let amount = parseInt(parts[1]);
        if (!isNaN(amount)) { window.globalAccountXP += amount; updateMenuXPBar(); saveData(); logDev(`Added ${amount} XP.`); }
    } else if (root === '/level') {
        let amount = parseInt(parts[1]);
        if (!isNaN(amount)) { window.globalAccountLevel = amount; updateMenuXPBar(); saveData(); logDev(`Set level to ${amount}.`); }
    } else if (root === '/unlockall') {
        window.unlockedItems = Object.values(ITEMS_DB).map(i => i.id); saveData(); renderShop(); renderLocker(); logDev("All items unlocked.");
    } else if (root === '/clear') {
        localStorage.clear(); location.reload();
    } else if (root === '/fps') {
        window.gameSettings.showFps = !window.gameSettings.showFps; saveData(); logDev(`FPS Display set to ${window.gameSettings.showFps}`);
    } else {
        logDev("Unknown command. Type /help");
    }
}

updateMenuXPBar();