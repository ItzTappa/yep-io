import { GameEngine } from './gameEngine.js';
import { Player } from './entities.js';
import { ITEMS_DB, RARITY_COLORS } from './items.js';
import { UPGRADE_POOL } from './upgrades.js'; 
import { sounds } from './soundManager.js';
import { lobbyUI } from './networkLobby.js';

let selectedClass = null; 

window.globalAccountXP = 0;
window.globalAccountLevel = 1;

window.gameSettings = { 
    highQuality: true, particles: true, showNames: true, showFps: false,
    keybinds: { up: 'w', down: 's', left: 'a', right: 'd', dash: ' ', ability: 'e' }
};

window.hourlyStats = { kills: 0, time: 0, points: 0, distance: 0 };
window.claimedItems = {}; 
window.equippedItems = { Skin: null, Trail: null, Banner: null, Color: null };
window.lifetimeStats = { matches: 0, kills: 0, time: 0, points: 0, distance: 0 };
window.matchHistory = [];

// ==========================================
// DYNAMIC SHOP GENERATOR
// ==========================================
function generateShop() {
    const rotatingItems = Object.values(ITEMS_DB).filter(item => item.isRotating);
    const shuffled = rotatingItems.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 4);
    
    const statTypes = [
        { type: 'kills', label: 'Kills', mult: [15, 30, 50, 80, 120] },
        { type: 'distance', label: 'Dist.', mult: [15000, 30000, 60000, 90000, 150000] },
        { type: 'time', label: 'Secs', mult: [300, 600, 1200, 2400, 3600] },
        { type: 'points', label: 'Pts', mult: [1000, 2500, 5000, 10000, 20000] }
    ];

    const newShop = selected.map(item => {
        const stat = statTypes[Math.floor(Math.random() * statTypes.length)];
        const base = stat.mult[item.rarity - 1];
        const variance = base * 0.2; 
        let req = Math.floor(base + (Math.random() * variance * 2) - variance);
        
        if (stat.type === 'distance' || stat.type === 'points') req = Math.ceil(req / 100) * 100;
        if (stat.type === 'time') req = Math.ceil(req / 10) * 10;
        
        return { id: item.id, type: stat.type, req: req, label: stat.label };
    });

    localStorage.setItem('yep_shop', JSON.stringify({ hour: new Date().getHours(), items: newShop }));
    return newShop;
}

function getShop() {
    const saved = localStorage.getItem('yep_shop');
    const currentHour = new Date().getHours();
    if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.hour === currentHour) return parsed.items; 
    }
    window.hourlyStats = { kills: 0, time: 0, points: 0, distance: 0 }; 
    return generateShop();
}

window.currentShopHour = new Date().getHours();
window.currentShopItems = getShop();

function formatTime(secs) {
    if (!secs || isNaN(secs)) return '0m 0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
}

const canvas = document.getElementById('gameCanvas');
const game = new GameEngine(canvas);
window.game = game; 
game.startDemo();

// --- BUTTON SOUNDS ---
document.body.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        sounds.play('click', 0.4);
    }
});

// --- LOCKER PREVIEW ---
const lockerPreviewCanvas = document.getElementById('lockerPreviewCanvas');
const lockerPreviewCtx = lockerPreviewCanvas?.getContext('2d');
const dpr = window.devicePixelRatio || 1;
if (lockerPreviewCanvas) {
    lockerPreviewCanvas.width = 300 * dpr; lockerPreviewCanvas.height = 300 * dpr; 
    lockerPreviewCtx.scale(dpr, dpr);
}

let previewAngle = 0;
function renderPreview() {
    previewAngle += 0.015;
    if (lockerPreviewCtx) {
        lockerPreviewCtx.clearRect(0, 0, 300, 300);
        const dummyClass = selectedClass || 'triangle'; 
        const dummy = new Player(150, 150, dummyClass, ""); 
        dummy.isPlayer = false; 
        dummy.equipped = window.equippedItems;
        if (dummy.equipped.Color && ITEMS_DB && ITEMS_DB[dummy.equipped.Color]) {
            const dbColor = ITEMS_DB[dummy.equipped.Color].value;
            if (dbColor === 'gold') dummy.color = '#ffe600'; 
            else dummy.color = dbColor; 
        } else { dummy.color = '#d3d3d3'; }
        
        dummy.angle = previewAngle; dummy.size = 60; 
        let tempShowNames = window.gameSettings.showNames;
        window.gameSettings.showNames = false;
        dummy.draw(lockerPreviewCtx);
        window.gameSettings.showNames = tempShowNames;
    }
    requestAnimationFrame(renderPreview);
}
renderPreview();

// --- TABS & CLASSES ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetTab = e.target.dataset.target;
        
        if (targetTab === 'multiplayer' && !selectedClass) {
            const info = document.getElementById('class-info');
            if (info) {
                info.innerText = "PLEASE SELECT A CLASS FIRST!";
                info.style.color = "red";
                info.classList.remove('fade-out', 'hidden');
                if (window.classInfoTimeout) clearTimeout(window.classInfoTimeout);
                window.classInfoTimeout = setTimeout(() => info.classList.add('fade-out'), 2000);
            }
            return;
        }

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
        const seasonLevelUI = document.querySelector('.player-level-ui');
        if (seasonLevelUI) {
            if (targetTab === 'locker') seasonLevelUI.classList.add('hidden');
            else seasonLevelUI.classList.remove('hidden');
        }
        if (targetTab === 'season') renderSeasonStore();
        if (targetTab === 'store') renderMainStore();
        if (targetTab === 'locker') renderLocker();
        if (targetTab === 'stats') renderStats(); 
    });
});

document.querySelectorAll('.class-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.class-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        selectedClass = e.target.dataset.class;

        const info = document.getElementById('class-info');
        if (info) {
            if (selectedClass === 'triangle') info.innerText = "JET: Fast & agile. Lower health. Good for hit-and-run.";
            if (selectedClass === 'square') info.innerText = "TANK: High health, slow speed. Excels in close-quarters brawls.";
            if (selectedClass === 'circle') info.innerText = "SOLDIER: Balanced speed and health. The perfect all-rounder.";
            
            info.style.color = "var(--accent)";
            info.classList.remove('hidden', 'fade-out');
            
            if (window.classInfoTimeout) clearTimeout(window.classInfoTimeout);
            window.classInfoTimeout = setTimeout(() => {
                info.classList.add('fade-out');
            }, 4000);
        }
    });
});

// --- SETTINGS ---
document.getElementById('settings-btn').addEventListener('click', () => { document.getElementById('settings-modal').classList.remove('hidden'); });
document.getElementById('close-settings-btn').addEventListener('click', () => {
    window.gameSettings.highQuality = document.getElementById('set-hq').checked;
    window.gameSettings.particles = document.getElementById('set-particles').checked;
    window.gameSettings.showNames = document.getElementById('set-names').checked;
    window.gameSettings.showFps = document.getElementById('set-fps').checked;
    const fpsDisplay = document.getElementById('fps-display');
    if (fpsDisplay) {
        if (window.gameSettings.showFps) fpsDisplay.classList.remove('hidden');
        else fpsDisplay.classList.add('hidden');
    }
    document.getElementById('settings-modal').classList.add('hidden');
});

let listeningAction = null;
const formatKeyName = (key) => key === ' ' ? 'SPACE' : key.toUpperCase();
document.querySelectorAll('.keybind-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.keybind-btn').forEach(b => b.classList.remove('listening'));
        listeningAction = e.target.dataset.action;
        e.target.classList.add('listening');
        e.target.innerText = "PRESS KEY";
    });
});

document.addEventListener('keydown', (e) => {
    if (listeningAction) {
        e.preventDefault(); 
        const key = e.key.toLowerCase();
        window.gameSettings.keybinds[listeningAction] = key;
        const btn = document.querySelector(`.keybind-btn[data-action="${listeningAction}"]`);
        if (btn) { btn.innerText = formatKeyName(key); btn.classList.remove('listening'); }
        listeningAction = null;
    }
});

// --- MENU PROGRESS BAR ---
function updateMenuXPBar() {
    const xpRequired = window.globalAccountLevel * 1000;
    const progressPercent = Math.min(100, (window.globalAccountXP / xpRequired) * 100);
    const bar = document.getElementById('menu-xp-bar');
    const lvl = document.getElementById('menu-level');
    if (bar) bar.style.width = `${progressPercent}%`;
    if (lvl) lvl.innerText = window.globalAccountLevel;
    const sBar = document.getElementById('season-progress-bar');
    if (sBar) sBar.style.width = `${Math.min(100, (window.globalAccountLevel / 50) * 100)}%`;
}

// --- PLAY & GAME OVER ---
document.getElementById('play-btn').addEventListener('click', () => {
    if (!selectedClass) {
        const info = document.getElementById('class-info');
        if (info) {
            info.innerText = "PLEASE SELECT A CLASS FIRST!";
            info.style.color = "red";
            info.classList.remove('fade-out', 'hidden');
            if (window.classInfoTimeout) clearTimeout(window.classInfoTimeout);
            window.classInfoTimeout = setTimeout(() => info.classList.add('fade-out'), 2000);
        }
        return;
    }

    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');
    const hud = document.querySelector('.hud');
    if(hud) hud.classList.remove('hidden');
    game.start(selectedClass);
});

document.getElementById('return-lobby-btn').addEventListener('click', () => {
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('game-ui').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
    if (window.lastMatchStats) {
        window.hourlyStats.kills += window.lastMatchStats.kills || 0;
        window.hourlyStats.time += window.lastMatchStats.time || 0;
        window.hourlyStats.points += window.lastMatchStats.points || 0;
        window.hourlyStats.distance += window.lastMatchStats.distance || 0;
        
        window.lifetimeStats.matches += 1;
        window.lifetimeStats.kills += window.lastMatchStats.kills || 0;
        window.lifetimeStats.time += window.lastMatchStats.time || 0;
        window.lifetimeStats.points += window.lastMatchStats.points || 0;
        window.lifetimeStats.distance += window.lastMatchStats.distance || 0;
        
        window.matchHistory.unshift(window.lastMatchStats);
        if (window.matchHistory.length > 20) window.matchHistory.pop();
        window.lastMatchStats = null; 
    }
    updateMenuXPBar(); 
    game.startDemo();
});

// --- LOCKER LOGIC ---
let currentLockerCategory = null;
window.openLockerCategory = (cat) => { currentLockerCategory = cat; renderLocker(); };
window.toggleEquip = (itemId, catOverride = null) => {
    if (itemId === null && catOverride) { window.equippedItems[catOverride] = null; } 
    else {
        const item = ITEMS_DB[itemId];
        if (!item) return;
        window.equippedItems[item.category] = (window.equippedItems[item.category] === itemId) ? null : itemId;
    }
    renderLocker();
};

document.body.addEventListener('click', (e) => {
    if (e.target.id === 'locker-back-btn') { currentLockerCategory = null; renderLocker(); }
});

function renderLocker() {
    const slotsView = document.getElementById('locker-slots-view');
    const itemsView = document.getElementById('locker-items-view');
    if (!slotsView || !itemsView) return;
    
    if (currentLockerCategory === null) {
        slotsView.classList.remove('hidden'); itemsView.classList.add('hidden');
        slotsView.innerHTML = '';
        ['Skin', 'Trail', 'Banner', 'Color'].forEach(cat => {
            const item = window.equippedItems[cat] ? ITEMS_DB[window.equippedItems[cat]] : null;
            let color = item ? (item.color || RARITY_COLORS[item.rarity]) : '#888';
            slotsView.innerHTML += `<div class="locker-slot" onclick="openLockerCategory('${cat}')" style="--slot-color: ${color};">
                <div class="slot-header">${cat}</div><div class="slot-icon">${item?.icon || '✖'}</div><div class="slot-name">${item?.name || 'Default'}</div>
            </div>`;
        });
    } else {
        slotsView.classList.add('hidden'); itemsView.classList.remove('hidden');
        document.getElementById('locker-category-title').innerText = `CHOOSE ${currentLockerCategory}`;
        const grid = document.getElementById('locker-item-grid'); grid.innerHTML = '';
        const isDefault = !window.equippedItems[currentLockerCategory];
        
        grid.innerHTML += `<div class="store-item unlocked" style="--rarity-color: #888;"><div class="item-icon">✖</div>
            <div style="font-size: 0.8rem; color: #888; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: -5px;">DEFAULT</div>
            <div class="item-name">None</div>
            <button class="btn-equip ${isDefault ? 'equipped' : ''}" onclick="window.toggleEquip(null, '${currentLockerCategory}')">${isDefault ? '✓ EQUIPPED' : 'EQUIP'}</button></div>`;
        
        if (ITEMS_DB) {
            const sortedItems = Object.keys(window.claimedItems)
                .map(id => ITEMS_DB[id])
                .filter(item => item && item.category === currentLockerCategory)
                .sort((a, b) => (b.rarity || 1) - (a.rarity || 1));

            sortedItems.forEach(item => {
                let color = item.color || RARITY_COLORS[item.rarity];
                const isEquipped = window.equippedItems[item.category] === item.id;
                grid.innerHTML += `<div class="store-item unlocked" style="--rarity-color: ${color};"><div class="item-icon">${item.icon}</div>
                    <div style="font-size: 0.8rem; color: ${color}; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: -5px;">${item.category}</div>
                    <div class="item-name">${item.name}</div>
                    <button class="btn-equip ${isEquipped ? 'equipped' : ''}" onclick="window.toggleEquip('${item.id}')">${isEquipped ? '✓ EQUIPPED' : 'EQUIP'}</button></div>`;
            });
        }
    }
}

// --- STATS LOGIC ---
function renderStats() {
    document.getElementById('stat-account-level').innerText = window.globalAccountLevel;
    document.getElementById('stat-matches').innerText = window.lifetimeStats.matches;
    document.getElementById('stat-kills').innerText = window.lifetimeStats.kills;
    document.getElementById('stat-points').innerText = Math.floor(window.lifetimeStats.points);
    document.getElementById('stat-time').innerText = formatTime(window.lifetimeStats.time);
    
    const historyList = document.getElementById('match-history-list');
    if (!historyList) return;
    
    if (window.matchHistory.length === 0) {
        historyList.innerHTML = '<p style="color: #aaa; text-align: center; padding: 20px; grid-column: span 5;">Play a match to see your history!</p>';
        return;
    }
    
    historyList.innerHTML = '';
    
    window.matchHistory.forEach(match => {
        let rankColor = '#a0a0a0'; 
        let rank = match.rank ? match.rank : '?';
        
        if (rank === 1) rankColor = '#ffe600'; 
        else if (rank !== '?' && rank <= 5) rankColor = '#00ffcc'; 
        
        let suffix = "th";
        if (rank !== '?') {
            let r = parseInt(rank);
            if (r % 10 === 1 && r % 100 !== 11) suffix = "st";
            else if (r % 10 === 2 && r % 100 !== 12) suffix = "nd";
            else if (r % 10 === 3 && r % 100 !== 13) suffix = "rd";
        }
        let displayRank = rank === '?' ? '?' : `${rank}${suffix}`;
        
        let pClass = match.playerClass ? match.playerClass.charAt(0).toUpperCase() + match.playerClass.slice(1) : 'Unknown';

        let upgradesHtml = '';
        if (match.upgrades) {
            for(let key in match.upgrades) {
                let tier = match.upgrades[key];
                if (tier > 0) {
                    let tClass = tier === 1 ? 'badge-t1' : tier === 2 ? 'badge-t2' : tier === 3 ? 'badge-t3' : tier === 4 ? 'badge-t4' : 'badge-t5';
                    let def = UPGRADE_POOL.find(u => u.id === key);
                    let title = def ? def.title.toUpperCase() : key.toUpperCase();
                    
                    upgradesHtml += `
                        <div class="upgrade-badge ${tClass}" style="position: relative; top: auto; left: auto; display: flex; height: 24px; box-shadow: none;">
                            <div class="badge-name" style="font-size: 0.65rem; padding: 0 8px;">${title}</div>
                            <div class="badge-tier" style="font-size: 0.75rem; padding: 0 6px;">T${tier}</div>
                        </div>`;
                }
            }
        }

        const html = `
            <div class="match-card" onclick="this.classList.toggle('expanded')" style="border-left-color: ${rankColor};">
                <div class="match-card-main">
                    <div class="match-detail-item">
                        <span class="match-detail-label">RANK</span>
                        <div class="match-rank" style="color: ${rankColor};">
                            ${displayRank}
                        </div>
                    </div>
                    <div class="match-detail-item">
                        <span class="match-detail-label">CLASS</span>
                        <span class="match-detail-val" style="color: #bbb;">${pClass}</span>
                    </div>
                    <div class="match-detail-item">
                        <span class="match-detail-label">KILLS</span>
                        <span class="match-detail-val">${match.kills || 0}</span>
                    </div>
                    <div class="match-detail-item">
                        <span class="match-detail-label">POINTS</span>
                        <span class="match-detail-val">${Math.floor(match.points || 0)}</span>
                    </div>
                    <div class="match-detail-item">
                        <span class="match-detail-label">TIME ALIVE</span>
                        <span class="match-detail-val">${formatTime(match.time || 0)}</span>
                    </div>
                </div>
                <div class="match-upgrades" style="grid-column: span 5; display:none; flex-wrap:wrap; justify-content:center; gap:5px; padding-top:15px; border-top:1px solid #333; margin-top:5px;">
                    ${upgradesHtml || '<span style="color:#666; font-size:0.8rem; font-style:italic;">No upgrades acquired.</span>'}
                </div>
            </div>
        `;
        historyList.innerHTML += html;
    });
}

// --- STORE LOGIC ---
function renderSeasonStore() {
    const grid = document.getElementById('season-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const progressPercent = Math.min(100, (window.globalAccountLevel / 50) * 100);
    document.getElementById('season-progress-bar').style.width = `${progressPercent}%`;

    const sItems = ['s_banner', 's_trail', 's_skin1', 's_skin2'];

    sItems.forEach(id => {
        const item = ITEMS_DB[id];
        if (!item) return;
        const isUnlocked = window.globalAccountLevel >= item.req;
        const isClaimed = window.claimedItems[item.id];
        const isEquipped = window.equippedItems[item.category] === item.id;
        
        let buttonHtml = '';
        if (isUnlocked && !isClaimed) {
            buttonHtml = `<button class="btn-claim" data-id="${item.id}"><div class="fill"></div><span>HOLD TO CLAIM</span></button>`;
        } else if (isClaimed) {
            buttonHtml = `<button class="btn-equip ${isEquipped ? 'equipped' : ''}" onclick="window.toggleEquip('${item.id}')">${isEquipped ? '✓ EQUIPPED' : 'EQUIP'}</button>`;
        }

        const html = `
            <div class="store-item ${isUnlocked ? 'unlocked' : 'locked'}" style="--rarity-color: ${item.color};">
                <div class="item-icon">${item.icon}</div>
                <div style="font-size: 0.8rem; color: ${item.color}; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: -5px; text-shadow: 0 0 5px ${item.color}40;">${item.category}</div>
                <div class="item-name">${item.name}</div>
                <div class="item-req" style="color: ${item.color};">${isClaimed ? '✓ CLAIMED' : isUnlocked ? 'UNLOCKED!' : `Requires Level ${item.req}`}</div>
                ${buttonHtml}
            </div>
        `;
        grid.innerHTML += html;
    });
}

function renderMainStore() {
    const grid = document.getElementById('main-store-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    let shopItems = [...window.currentShopItems];
    shopItems.sort((a, b) => (ITEMS_DB[b.id]?.rarity || 1) - (ITEMS_DB[a.id]?.rarity || 1));

    shopItems.forEach(shopItem => {
        const item = ITEMS_DB[shopItem.id];
        if (!item) return;
        
        const currentValue = window.hourlyStats[shopItem.type] || 0;
        const isUnlocked = currentValue >= shopItem.req;
        const isClaimed = window.claimedItems[item.id];
        const isEquipped = window.equippedItems[item.category] === item.id;
        const progressPercent = Math.min(100, (currentValue / shopItem.req) * 100);
        
        const color = RARITY_COLORS[item.rarity];
        
        let buttonHtml = '';
        if (isUnlocked && !isClaimed) {
            buttonHtml = `<button class="btn-claim" data-id="${item.id}"><div class="fill"></div><span>HOLD TO CLAIM</span></button>`;
        } else if (isClaimed) {
            buttonHtml = `<button class="btn-equip ${isEquipped ? 'equipped' : ''}" onclick="window.toggleEquip('${item.id}')">${isEquipped ? '✓ EQUIPPED' : 'EQUIP'}</button>`;
        } else {
            buttonHtml = `<div class="item-progress-bg"><div class="item-progress-fill" style="width: ${progressPercent}%; background: ${color}; box-shadow: 0 0 10px ${color};"></div></div>`;
        }
        
        const html = `
            <div class="store-item ${isUnlocked ? 'unlocked' : 'locked'}" style="--rarity-color: ${color};">
                <div class="item-icon">${item.icon}</div>
                <div style="font-size: 0.8rem; color: ${color}; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: -5px; text-shadow: 0 0 5px ${color}40;">${item.category}</div>
                <div class="item-name">${item.name}</div>
                <div class="item-req" style="color: ${color};">${isClaimed ? '✓ CLAIMED' : isUnlocked ? 'UNLOCKED!' : `${Math.floor(currentValue)} / ${shopItem.req} ${shopItem.label}`}</div>
                ${buttonHtml}
            </div>
        `;
        grid.innerHTML += html;
    });
}

const startClaim = (e) => {
    const btn = e.target.closest('.btn-claim');
    if (!btn) return;
    
    const itemId = btn.dataset.id;
    const storeItem = btn.closest('.store-item');
    
    btn.classList.add('holding');
    storeItem.classList.add('shaking');

    btn.claimTimeout = setTimeout(() => {
        window.claimedItems[itemId] = true;
        sounds.play('levelUp', 0.6); 
        btn.classList.remove('holding');
        storeItem.classList.remove('shaking');
        storeItem.classList.add('claimed-pop');
        
        setTimeout(() => {
            renderSeasonStore();
            renderMainStore();
            renderLocker();
        }, 500); 
    }, 1000); 
};

const stopClaim = (e) => {
    document.querySelectorAll('.btn-claim.holding').forEach(btn => {
        clearTimeout(btn.claimTimeout);
        btn.classList.remove('holding');
        btn.closest('.store-item').classList.remove('shaking');
    });
};

document.body.addEventListener('mousedown', startClaim);
document.body.addEventListener('touchstart', startClaim, {passive: true});
document.body.addEventListener('mouseup', stopClaim);
document.body.addEventListener('mouseleave', stopClaim);
document.body.addEventListener('touchend', stopClaim);

// --- DYNAMIC SHOP ROTATION TIMER ---
setInterval(() => {
    const now = new Date();
    const minutes = 59 - now.getMinutes();
    const seconds = 59 - now.getSeconds();
    const shopTimer = document.getElementById('shop-timer');
    if (shopTimer) shopTimer.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    if (now.getHours() !== window.currentShopHour) {
        window.currentShopHour = now.getHours();
        window.hourlyStats = { kills: 0, time: 0, points: 0, distance: 0 };
        window.currentShopItems = getShop(); 
        if (document.getElementById('store').classList.contains('active')) renderMainStore();
    }
}, 1000);

renderSeasonStore();
renderMainStore();
updateMenuXPBar(); 

// --- DEV CONSOLE & ESCAPE KEY LOGIC ---
const devConsole = document.getElementById('dev-console');
const devInput = document.getElementById('dev-input');
const devLog = document.getElementById('dev-log');

function logDev(msg) {
    if (!devLog) return;
    devLog.innerHTML += `<div>> ${msg}</div>`;
    devLog.scrollTop = devLog.scrollHeight;
}

window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== devInput) {
        e.preventDefault(); 
        if (devConsole) {
            devConsole.classList.remove('hidden');
            devInput.focus();
            devInput.value = '/'; 
        }
    } else if (e.key === 'Escape') {
        if (devConsole && !devConsole.classList.contains('hidden')) {
            devConsole.classList.add('hidden');
            devInput.blur();
        } 
        // NEW: Quits the game completely and takes you to the death screen
        else if (window.game && !window.game.isDemo && !window.game.isGameOver) {
            window.game.handleGameOver({ name: "SURRENDERED" });
        }
    }
});

if (devInput) {
    devInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const val = devInput.value.trim();
            if (!val) return;
            
            logDev(val);
            devInput.value = ''; 
            
            const parts = val.split(' ');
            const cmd = parts[0].toLowerCase();
            const arg = parseInt(parts[1]);

            if (cmd === '/level' && !isNaN(arg)) {
                window.globalAccountLevel = arg;
                window.globalAccountXP = 0; 
                updateMenuXPBar();
                renderSeasonStore();
                if (document.getElementById('stats').classList.contains('active')) renderStats();
                logDev(`[SUCCESS] Account Level set to ${arg}.`);
            }
            else if (cmd === '/kills' && !isNaN(arg)) {
                window.hourlyStats.kills = arg; renderMainStore(); logDev(`[SUCCESS] Hourly kills set to ${arg}.`);
            }
            else if (cmd === '/dist' && !isNaN(arg)) {
                window.hourlyStats.distance = arg; renderMainStore(); logDev(`[SUCCESS] Hourly distance set to ${arg}.`);
            }
            else if (cmd === '/time' && !isNaN(arg)) {
                window.hourlyStats.time = arg; renderMainStore(); logDev(`[SUCCESS] Hourly time set to ${arg}.`);
            }
            else if (cmd === '/points' && !isNaN(arg)) {
                window.hourlyStats.points = arg; renderMainStore(); logDev(`[SUCCESS] Hourly points set to ${arg}.`);
            }
            else if (cmd === '/claimall') { 
                if (typeof ITEMS_DB !== 'undefined') {
                    Object.keys(ITEMS_DB).forEach(k => window.claimedItems[k] = true);
                    renderLocker();
                    renderSeasonStore();
                    renderMainStore();
                    logDev(`[SUCCESS] Unlocked all cosmetics and items!`);
                }
            }
            else if (cmd === '/reroll') {
                localStorage.removeItem('yep_shop');
                window.currentShopItems = getShop();
                renderMainStore();
                logDev(`[SUCCESS] Force-rerolled the current shop items.`);
            }
            else if (cmd === '/close' || cmd === '/exit') {
                devConsole.classList.add('hidden');
                devInput.blur();
            }
            else if (cmd === '/help') {
                logDev('Commands: /level [num], /kills [num], /dist [num], /time [num], /points [num], /claimall, /reroll, /close');
            }
            else {
                logDev('<span style="color: red;">[ERROR] Unknown command. Type /help</span>');
            }
        }
    });
}