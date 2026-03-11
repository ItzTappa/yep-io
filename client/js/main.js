import { GameEngine } from './gameEngine.js';
import { Player } from './entities.js';
import { ITEMS_DB, RARITY_COLORS } from './items.js';
import { UPGRADE_POOL } from './upgrades.js'; 
import { sounds } from './soundManager.js';
import { lobbyUI } from './networkLobby.js';

// ==========================================
// 1. FIREBASE GLOBAL ACCOUNT SYSTEM
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// YOUR REAL FIREBASE KEYS
const firebaseConfig = {
    apiKey: "AIzaSyD1jhU8Z7EkxMqMop4cM0jrQ6aLBnzHmeE",
    authDomain: "yep-io-6a50d.firebaseapp.com",
    projectId: "yep-io-6a50d",
    storageBucket: "yep-io-6a50d.firebasestorage.app",
    messagingSenderId: "956171272863",
    appId: "1:956171272863:web:5aa42a88cf78ff4b7698aa"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let selectedClass = null; 
let currentUser = null;

// Clean out the old local testing logic
localStorage.removeItem('yepio_accounts');
localStorage.removeItem('yepio_current_user');

function resetLocalStats() {
    window.globalAccountXP = 0;
    window.globalAccountLevel = 1;
    window.equippedItems = { Skin: null, Trail: null, Banner: null, Color: null };
    window.claimedItems = {};
    window.matchHistory = [];
    window.lifetimeStats = { matches: 0, kills: 0, time: 0, points: 0, distance: 0 };
}

// Fetch stats securely from the Cloud Database
async function loadUserData(uid) {
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            let data = docSnap.data();
            window.globalAccountXP = data.xp || 0;
            window.globalAccountLevel = data.level || 1;
            window.equippedItems = data.equipped || { Skin: null, Trail: null, Banner: null, Color: null };
            window.claimedItems = data.unlocked || {};
            window.matchHistory = data.history || [];
            window.lifetimeStats = data.stats || { matches: 0, kills: 0, time: 0, points: 0, distance: 0 };
        } else {
            resetLocalStats(); // Brand new account
        }
    } catch(e) { 
        console.error("Error loading profile:", e); 
        resetLocalStats(); 
    }
    refreshAllUIs();
}

// Save stats securely to the Cloud Database
async function saveUserData() {
    if (auth.currentUser) {
        try {
            await setDoc(doc(db, "users", auth.currentUser.uid), {
                username: currentUser,
                xp: window.globalAccountXP,
                level: window.globalAccountLevel,
                equipped: window.equippedItems,
                unlocked: window.claimedItems,
                history: window.matchHistory,
                stats: window.lifetimeStats
            }, { merge: true });
        } catch(e) { console.error("Error saving profile:", e); }
    }
}

// Listen for Login/Logout events
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user.email.split('@')[0]; // Pulls the username out of the fake email
        loadUserData(user.uid);
    } else {
        currentUser = null;
        resetLocalStats();
        refreshAllUIs();
    }
});

// Initialize all default device settings (These stay local)
window.gameSettings = JSON.parse(localStorage.getItem('yepio_settings')) || { 
    highQuality: true, particles: true, showNames: true, showFps: false,
    volume: 1.0, showLeaderboard: true, showBadges: true, showNotifs: true, showMinimap: true,
    keybinds: { up: 'w', down: 's', left: 'a', right: 'd', dash: ' ', ability: 'e' }
};

window.hourlyStats = { kills: 0, time: 0, points: 0, distance: 0 };

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

try { game.startDemo(); } catch(e) { console.error(e); }

// ==========================================
// GLOBAL UI HANDLER
// ==========================================
let currentLockerCategory = null;
window.activePreviewItem = null;

function refreshAllUIs() {
    renderLocker();
    renderSeasonStore();
    renderMainStore();
    renderStats();
    updateMenuXPBar();
}

document.addEventListener('click', async (e) => {
    const target = e.target;

    if (target.tagName === 'BUTTON' || target.closest('button')) {
        if (sounds && sounds.play) sounds.play('click', 0.4 * (window.gameSettings.volume || 1.0));
    }

    // Toggle Password Visibility
    const togglePassBtn = target.closest('#toggle-pass-btn');
    if (togglePassBtn) {
        const passInput = document.getElementById('acc-pass');
        if (passInput.type === 'password') {
            passInput.type = 'text';
            togglePassBtn.innerText = '🙈';
        } else {
            passInput.type = 'password';
            togglePassBtn.innerText = '👁️';
        }
        return;
    }

    // Modals
    if (target.id === 'close-preview-btn' || target.closest('#close-preview-btn')) {
        window.activePreviewItem = null;
        document.getElementById('item-preview-screen').classList.add('hidden');
        return;
    }
    if (target.id === 'close-account-btn') {
        document.getElementById('account-modal').classList.add('hidden');
        return;
    }

    // Account Modal Toggle
    if (target.id === 'account-btn') {
        const accModal = document.getElementById('account-modal');
        const loggedOutView = document.getElementById('account-logged-out');
        const loggedInView = document.getElementById('account-logged-in');
        const errorText = document.getElementById('acc-error');
        
        errorText.innerText = "";
        
        if (auth.currentUser) {
            loggedOutView.classList.add('hidden');
            loggedInView.classList.remove('hidden');
            document.getElementById('acc-display-name').innerText = currentUser;
        } else {
            loggedOutView.classList.remove('hidden');
            loggedInView.classList.add('hidden');
            document.getElementById('acc-user').value = "";
            const passInput = document.getElementById('acc-pass');
            passInput.value = "";
            passInput.type = "password";
            document.getElementById('toggle-pass-btn').innerText = "👁️";
        }
        accModal.classList.remove('hidden');
        return;
    }

    // Firebase Registration
    if (target.id === 'acc-register-btn') {
        const user = document.getElementById('acc-user').value.trim();
        const pass = document.getElementById('acc-pass').value;
        const errorText = document.getElementById('acc-error');
        
        if (user.length < 3) { errorText.innerText = "Username must be at least 3 chars!"; return; }
        if (pass.length < 6) { errorText.innerText = "Password must be at least 6 chars!"; return; }
        
        errorText.innerText = "Creating account...";
        errorText.style.color = "white";

        createUserWithEmailAndPassword(auth, user + "@yepio.game", pass)
            .then(() => {
                document.getElementById('account-modal').classList.add('hidden');
            })
            .catch((error) => {
                errorText.style.color = "#ff4444";
                if(error.code === 'auth/email-already-in-use') errorText.innerText = "Username already taken!";
                else errorText.innerText = error.message.replace("Firebase: ", "");
            });
        return;
    }

    // Firebase Login
    if (target.id === 'acc-login-btn') {
        const user = document.getElementById('acc-user').value.trim();
        const pass = document.getElementById('acc-pass').value;
        const errorText = document.getElementById('acc-error');
        
        if (!user || !pass) { errorText.innerText = "Please enter username and password!"; return; }
        
        errorText.innerText = "Logging in...";
        errorText.style.color = "white";

        signInWithEmailAndPassword(auth, user + "@yepio.game", pass)
            .then(() => {
                document.getElementById('account-modal').classList.add('hidden');
            })
            .catch((error) => {
                errorText.style.color = "#ff4444";
                errorText.innerText = "Incorrect username or password!";
            });
        return;
    }

    // Firebase Logout (FIXED - using modern async/await to guarantee it fires)
    const logoutBtn = target.closest('#acc-logout-btn');
    if (logoutBtn) {
        logoutBtn.innerText = "LOGGING OUT...";
        
        try {
            await saveUserData(); // push final stats
            await signOut(auth);  // clear auth state
            document.getElementById('account-modal').classList.add('hidden');
        } catch (error) {
            console.error("Logout Error:", error);
            document.getElementById('account-modal').classList.add('hidden');
        } finally {
            logoutBtn.innerText = "LOG OUT";
        }
        return;
    }

    // Equipment Logic
    const equipBtn = target.closest('.btn-equip');
    if (equipBtn) {
        const itemId = equipBtn.dataset.id;
        if (!itemId) { 
            if (currentLockerCategory) window.equippedItems[currentLockerCategory] = null;
        } else {
            const item = ITEMS_DB[itemId];
            if (item) {
                if (window.equippedItems[item.category] === itemId) {
                    window.equippedItems[item.category] = null; 
                } else {
                    window.equippedItems[item.category] = itemId; 
                }
            }
        }
        saveUserData(); // Saves instantly to cloud
        renderLocker();
        renderSeasonStore();
        renderMainStore();
        return;
    }

    const iconBtn = target.closest('.item-icon');
    if (iconBtn && iconBtn.dataset.id) {
        const item = ITEMS_DB[iconBtn.dataset.id];
        if (item && item.category !== 'Banner') {
            window.activePreviewItem = item.id;
            document.getElementById('preview-screen-title').innerText = `PREVIEW: ${item.name}`;
            document.getElementById('preview-screen-category').innerText = item.category;
            document.getElementById('item-preview-screen').classList.remove('hidden');
        }
        return;
    }

    const lockerSlot = target.closest('.locker-slot');
    if (lockerSlot) {
        currentLockerCategory = lockerSlot.dataset.category;
        window.activePreviewItem = null;
        renderLocker();
        return;
    }

    if (target.id === 'locker-back-btn') {
        currentLockerCategory = null;
        window.activePreviewItem = null;
        renderLocker();
        return;
    }

    if (target.classList.contains('tab-btn')) {
        const targetTab = target.dataset.target;
        
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
        
        target.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
        
        window.activePreviewItem = null; 

        // Hide whole footer while in locker tab
        const menuFooter = document.querySelector('.menu-footer');
        if (menuFooter) {
            if (targetTab === 'locker') {
                menuFooter.classList.add('hidden');
            } else {
                menuFooter.classList.remove('hidden');
            }
        }
        
        if (targetTab === 'season') renderSeasonStore();
        if (targetTab === 'store') renderMainStore();
        if (targetTab === 'locker') renderLocker();
        if (targetTab === 'stats') renderStats(); 
    }
});

// ==========================================
// HOLD-TO-CLAIM
// ==========================================
const startClaim = (e) => {
    const btn = e.target.closest('.btn-claim');
    if (!btn) return;
    
    e.preventDefault(); 
    btn.classList.add('holding');
    
    const storeItem = btn.closest('.store-item');
    if (storeItem) {
        storeItem.classList.add('shaking');
    }

    btn.claimTimeout = setTimeout(() => {
        const itemId = btn.dataset.id;
        window.claimedItems[itemId] = true;
        saveUserData(); // Instantly save unlocks to the cloud!
        
        if(sounds && sounds.play) sounds.play('levelUp', 0.6 * (window.gameSettings.volume || 1.0)); 
        
        btn.classList.remove('holding');
        if (storeItem) {
            storeItem.classList.remove('shaking');
            storeItem.classList.add('claimed-pop');
        }
        
        setTimeout(() => {
            renderSeasonStore();
            renderMainStore();
            renderLocker();
        }, 300); 
    }, 1000); 
};

const stopClaim = (e) => {
    document.querySelectorAll('.btn-claim.holding').forEach(btn => {
        clearTimeout(btn.claimTimeout);
        btn.classList.remove('holding');
        const storeItem = btn.closest('.store-item');
        if (storeItem) {
            storeItem.classList.remove('shaking');
        }
    });
};

document.addEventListener('mousedown', startClaim);
document.addEventListener('touchstart', startClaim, {passive: false});
document.addEventListener('mouseup', stopClaim);
document.addEventListener('mouseleave', stopClaim);
document.addEventListener('touchend', stopClaim);

// ==========================================
// PREVIEW CANVASES
// ==========================================
const lockerCanvas = document.getElementById('lockerPreviewCanvas');
const lockerCtx = lockerCanvas?.getContext('2d');
const fsCanvas = document.getElementById('fullscreenPreviewCanvas');
const fsCtx = fsCanvas?.getContext('2d');

const dpr = window.devicePixelRatio || 1;

if (lockerCanvas) {
    lockerCanvas.width = 300 * dpr; 
    lockerCanvas.height = 300 * dpr; 
    lockerCtx.scale(dpr, dpr);
}
if (fsCanvas) {
    fsCanvas.width = 350 * dpr; 
    fsCanvas.height = 350 * dpr; 
    fsCtx.scale(dpr, dpr);
}

let previewAngle = 0;
let previewDummy = new Player(0, 0, 'triangle', "");
previewDummy.isPlayer = false; 

if (window.previewAnimationId) {
    cancelAnimationFrame(window.previewAnimationId);
}

let previewLastTime = performance.now();
let previewAccumulator = 0;

function renderPreview() {
    window.previewAnimationId = requestAnimationFrame(renderPreview);
    
    let current = performance.now();
    let dt = current - previewLastTime;
    previewLastTime = current;
    
    if (dt > 250) dt = 16.666; 
    if (dt < 0) dt = 0; 
    
    previewAccumulator += dt;
    
    while (previewAccumulator >= 16.666) {
        previewAngle += 0.015;
        let needsTrail = false;
        
        const lockerTab = document.getElementById('locker');
        if (lockerTab && lockerTab.classList.contains('active') && currentLockerCategory === 'Trail') {
            needsTrail = true;
        }
        
        const itemPreviewScreen = document.getElementById('item-preview-screen');
        if (itemPreviewScreen && !itemPreviewScreen.classList.contains('hidden') && window.activePreviewItem && ITEMS_DB[window.activePreviewItem] && ITEMS_DB[window.activePreviewItem].category === 'Trail') {
            needsTrail = true;
        }
        
        if (needsTrail) {
            previewDummy.vx = Math.cos(previewAngle) * 4;
            previewDummy.vy = Math.sin(previewAngle) * 4;
        } else {
            previewDummy.vx = 0; 
            previewDummy.vy = 0; 
            previewDummy.trail = [];
        }
        
        previewDummy.update();
        previewAccumulator -= 16.666;
    }
    
    const lockerTabRender = document.getElementById('locker');
    if (lockerCtx && lockerTabRender && lockerTabRender.classList.contains('active')) {
        lockerCtx.clearRect(0, 0, 300, 300);
        previewDummy.type = selectedClass || 'triangle';
        previewDummy.equipped = { ...window.equippedItems };
        
        if (previewDummy.equipped.Color && ITEMS_DB[previewDummy.equipped.Color]) {
            const dbColor = ITEMS_DB[previewDummy.equipped.Color].value;
            previewDummy.color = dbColor === 'gold' ? '#ffe600' : dbColor; 
        } else { 
            previewDummy.color = '#d3d3d3'; 
        }
        
        previewDummy.angle = previewAngle; 
        previewDummy.size = 60; 
        previewDummy.x = 150; 
        previewDummy.y = 150;
        
        let tmp = window.gameSettings.showNames; 
        window.gameSettings.showNames = false;
        previewDummy.draw(lockerCtx);
        window.gameSettings.showNames = tmp;
    }

    const itemPreviewRender = document.getElementById('item-preview-screen');
    if (fsCtx && itemPreviewRender && !itemPreviewRender.classList.contains('hidden')) {
        fsCtx.clearRect(0, 0, 350, 350);
        previewDummy.type = selectedClass || 'triangle';
        let equipState = { ...window.equippedItems };
        
        if (window.activePreviewItem && ITEMS_DB[window.activePreviewItem]) {
            equipState[ITEMS_DB[window.activePreviewItem].category] = window.activePreviewItem;
        }
        
        previewDummy.equipped = equipState;
        
        if (previewDummy.equipped.Color && ITEMS_DB[previewDummy.equipped.Color]) {
            const dbColor = ITEMS_DB[previewDummy.equipped.Color].value;
            previewDummy.color = dbColor === 'gold' ? '#ffe600' : dbColor; 
        } else { 
            previewDummy.color = '#d3d3d3'; 
        }
        
        previewDummy.angle = previewAngle; 
        previewDummy.size = 70; 
        previewDummy.x = 175; 
        previewDummy.y = 175;
        
        let tmp = window.gameSettings.showNames; 
        window.gameSettings.showNames = false;
        previewDummy.draw(fsCtx);
        window.gameSettings.showNames = tmp;
    }
}
window.previewAnimationId = requestAnimationFrame(renderPreview);

// --- CLASS / SETTINGS UI BINDINGS ---
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

document.getElementById('settings-btn').addEventListener('click', () => { 
    document.getElementById('settings-modal').classList.remove('hidden'); 
});

document.getElementById('close-settings-btn').addEventListener('click', () => {
    window.gameSettings.highQuality = document.getElementById('set-hq').checked;
    window.gameSettings.particles = document.getElementById('set-particles').checked;
    window.gameSettings.showNames = document.getElementById('set-names').checked;
    window.gameSettings.showFps = document.getElementById('set-fps').checked;
    
    window.gameSettings.volume = parseInt(document.getElementById('set-volume').value) / 100;
    window.gameSettings.showLeaderboard = document.getElementById('set-leaderboard').checked;
    window.gameSettings.showBadges = document.getElementById('set-badges').checked;
    window.gameSettings.showNotifs = document.getElementById('set-notifs').checked;
    window.gameSettings.showMinimap = document.getElementById('set-minimap').checked; 

    localStorage.setItem('yepio_settings', JSON.stringify(window.gameSettings));

    const fpsDisplay = document.getElementById('fps-display');
    if (fpsDisplay) {
        if (window.gameSettings.showFps) fpsDisplay.classList.remove('hidden');
        else fpsDisplay.classList.add('hidden');
    }
    
    if (window.game) {
        window.game.updateLeaderboard();
        window.game.updateUpgradeBadges();
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
        localStorage.setItem('yepio_settings', JSON.stringify(window.gameSettings));
        
        const btn = document.querySelector(`.keybind-btn[data-action="${listeningAction}"]`);
        if (btn) { 
            btn.innerText = formatKeyName(key); 
            btn.classList.remove('listening'); 
        }
        listeningAction = null;
    }
});

function updateMenuXPBar() {
    const xpRequired = window.globalAccountLevel * 1000;
    const progressPercent = Math.min(100, (window.globalAccountXP / xpRequired) * 100);
    
    const bar = document.getElementById('menu-xp-bar');
    const lvl = document.getElementById('menu-level');
    
    if (bar) bar.style.width = `${progressPercent}%`;
    if (lvl) lvl.innerText = window.globalAccountLevel;
    
    const sBar = document.getElementById('season-progress-bar');
    if (sBar) {
        sBar.style.width = `${Math.min(100, (window.globalAccountLevel / 50) * 100)}%`;
    }
}

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
        window.lastMatchStats.timestamp = Date.now(); // ADD TIMESTAMP TO MATCH
        
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
        if (window.matchHistory.length > 20) {
            window.matchHistory.pop();
        }
        window.lastMatchStats = null; 
        
        saveUserData(); // Save stats to cloud after every game!
    }
    
    updateMenuXPBar(); 
    game.startDemo();
});

// --- RENDERERS ---
function renderLocker() {
    const slotsView = document.getElementById('locker-slots-view');
    const itemsView = document.getElementById('locker-items-view');
    if (!slotsView || !itemsView) return;
    
    if (currentLockerCategory === null) {
        slotsView.classList.remove('hidden'); 
        itemsView.classList.add('hidden');
        slotsView.innerHTML = '';
        
        ['Skin', 'Trail', 'Banner', 'Color'].forEach(cat => {
            const item = window.equippedItems[cat] ? ITEMS_DB[window.equippedItems[cat]] : null;
            let color = item ? (item.color || RARITY_COLORS[item.rarity]) : '#888';
            
            slotsView.innerHTML += `
                <div class="locker-slot" data-category="${cat}" style="--slot-color: ${color};">
                    <div class="slot-header">${cat}</div>
                    <div class="slot-icon">${item?.icon || '✖'}</div>
                    <div class="slot-name">${item?.name || 'Default'}</div>
                </div>`;
        });
    } else {
        slotsView.classList.add('hidden'); 
        itemsView.classList.remove('hidden');
        document.getElementById('locker-category-title').innerText = `CHOOSE ${currentLockerCategory}`;
        
        const grid = document.getElementById('locker-item-grid'); 
        grid.innerHTML = '';
        
        const isDefault = !window.equippedItems[currentLockerCategory];
        
        grid.innerHTML += `
            <div class="store-item unlocked" style="--rarity-color: #888;">
                <div class="item-icon" style="cursor: pointer;">✖</div>
                <div style="font-size: 0.8rem; color: #888; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: -5px;">DEFAULT</div>
                <div class="item-name">None</div>
                <button class="btn-equip ${isDefault ? 'equipped' : ''}" data-id="">${isDefault ? '✓ EQUIPPED' : 'EQUIP'}</button>
            </div>`;
        
        if (ITEMS_DB) {
            const sortedItems = Object.keys(window.claimedItems)
                .map(id => ITEMS_DB[id]).filter(item => item && item.category === currentLockerCategory)
                .sort((a, b) => (b.rarity || 1) - (a.rarity || 1));

            sortedItems.forEach(item => {
                let color = item.color || RARITY_COLORS[item.rarity];
                const isEquipped = window.equippedItems[item.category] === item.id;
                
                grid.innerHTML += `
                    <div class="store-item unlocked" style="--rarity-color: ${color};">
                        <div class="item-icon" data-id="${item.id}" style="cursor: pointer;" title="Click to Preview">${item.icon}</div>
                        <div style="font-size: 0.8rem; color: ${color}; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: -5px;">${item.category}</div>
                        <div class="item-name">${item.name}</div>
                        <button class="btn-equip ${isEquipped ? 'equipped' : ''}" data-id="${item.id}">${isEquipped ? '✓ EQUIPPED' : 'EQUIP'}</button>
                    </div>`;
            });
        }
    }
}

function renderStats() {
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    let historyChanged = false;

    // Filter out matches older than 24 hours
    window.matchHistory = window.matchHistory.filter(match => {
        if (!match.timestamp) match.timestamp = now; // Retroactively assign a timestamp to old matches so they don't break
        const isValid = (now - match.timestamp) < ONE_DAY;
        if (!isValid) historyChanged = true;
        return isValid;
    });

    if (historyChanged) {
        saveUserData(); // Update the cloud if matches expired while you were away!
    }

    const el1 = document.getElementById('stat-account-level'); if(el1) el1.innerText = window.globalAccountLevel;
    const el2 = document.getElementById('stat-matches'); if(el2) el2.innerText = window.lifetimeStats.matches;
    const el3 = document.getElementById('stat-kills'); if(el3) el3.innerText = window.lifetimeStats.kills;
    const el4 = document.getElementById('stat-points'); if(el4) el4.innerText = Math.floor(window.lifetimeStats.points);
    const el5 = document.getElementById('stat-time'); if(el5) el5.innerText = formatTime(window.lifetimeStats.time);
    
    const historyList = document.getElementById('match-history-list');
    if (!historyList) return;
    
    if (window.matchHistory.length === 0) {
        historyList.innerHTML = '<p style="color: #aaa; text-align: center; padding: 20px; grid-column: span 5;">Play a match to see your history!</p>';
        return;
    }
    
    historyList.innerHTML = '';
    
    const activeAbilities = ['shield','overdrive','bullet_nova','blink','emp','cloak','repulsor','sonic_boom','phase_strike','strafe_run','juggernaut','missile_swarm','earthshatter','minigun','tactical_nuke','blade_ring'];

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
                    let def = UPGRADE_POOL ? UPGRADE_POOL.find(u => u && u.id === key) : null;
                    let title = def ? def.title.toUpperCase() : key.toUpperCase();
                    
                    if (activeAbilities.includes(key) || (def && def.isActiveAbility)) {
                        upgradesHtml += `
                            <div class="upgrade-badge ability-badge" style="position: relative; top: auto; left: auto; display: flex; height: 24px; box-shadow: none;">
                                <div class="badge-name" style="font-size: 0.65rem; padding: 0 8px;">⭐ ${title.replace('ACTIVE: ', '')}</div>
                                <div class="badge-tier" style="font-size: 0.75rem; padding: 0 6px;">ACTIVE</div>
                            </div>`;
                    } else {
                        let tClass = tier === 1 ? 'badge-t1' : tier === 2 ? 'badge-t2' : tier === 3 ? 'badge-t3' : tier === 4 ? 'badge-t4' : 'badge-t5';
                        upgradesHtml += `
                            <div class="upgrade-badge ${tClass}" style="position: relative; top: auto; left: auto; display: flex; height: 24px; box-shadow: none;">
                                <div class="badge-name" style="font-size: 0.65rem; padding: 0 8px;">${title}</div>
                                <div class="badge-tier" style="font-size: 0.75rem; padding: 0 6px;">T${tier}</div>
                            </div>`;
                    }
                }
            }
        }

        historyList.innerHTML += `
            <div class="match-card" onclick="this.classList.toggle('expanded')" style="border-left-color: ${rankColor};">
                <div class="match-card-main">
                    <div class="match-detail-item">
                        <span class="match-detail-label">RANK</span>
                        <div class="match-rank" style="color: ${rankColor};">${displayRank}</div>
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
            </div>`;
    });
}

function renderSeasonStore() {
    const grid = document.getElementById('season-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    document.getElementById('season-progress-bar').style.width = `${Math.min(100, (window.globalAccountLevel / 50) * 100)}%`;
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
            buttonHtml = `<button class="btn-equip ${isEquipped ? 'equipped' : ''}" data-id="${item.id}">${isEquipped ? '✓ EQUIPPED' : 'EQUIP'}</button>`;
        }

        let isPreviewable = item.category !== 'Banner';
        let cursorStyle = isPreviewable ? 'cursor: pointer;' : 'cursor: default;';
        let titleAttr = isPreviewable ? 'title="Click to Preview"' : '';

        grid.innerHTML += `
            <div class="store-item ${isUnlocked ? 'unlocked' : 'locked'}" style="--rarity-color: ${item.color};">
                <div class="item-icon" data-id="${item.id}" style="${cursorStyle}" ${titleAttr}>${item.icon}</div>
                <div style="font-size: 0.8rem; color: ${item.color}; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: -5px; text-shadow: 0 0 5px ${item.color}40;">${item.category}</div>
                <div class="item-name">${item.name}</div>
                <div class="item-req" style="color: ${item.color};">${isClaimed ? '✓ CLAIMED' : isUnlocked ? 'UNLOCKED!' : `Requires Level ${item.req}`}</div>
                ${buttonHtml}
            </div>`;
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
            buttonHtml = `<button class="btn-equip ${isEquipped ? 'equipped' : ''}" data-id="${item.id}">${isEquipped ? '✓ EQUIPPED' : 'EQUIP'}</button>`;
        } else {
            buttonHtml = `
                <div class="item-progress-bg">
                    <div class="item-progress-fill" style="width: ${progressPercent}%; background: ${color}; box-shadow: 0 0 10px ${color};"></div>
                </div>`;
        }
        
        let isPreviewable = item.category !== 'Banner';
        let cursorStyle = isPreviewable ? 'cursor: pointer;' : 'cursor: default;';
        let titleAttr = isPreviewable ? 'title="Click to Preview"' : '';

        grid.innerHTML += `
            <div class="store-item ${isUnlocked ? 'unlocked' : 'locked'}" style="--rarity-color: ${color};">
                <div class="item-icon" data-id="${item.id}" style="${cursorStyle}" ${titleAttr}>${item.icon}</div>
                <div style="font-size: 0.8rem; color: ${color}; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: -5px; text-shadow: 0 0 5px ${color}40;">${item.category}</div>
                <div class="item-name">${item.name}</div>
                <div class="item-req" style="color: ${color};">${isClaimed ? '✓ CLAIMED' : isUnlocked ? 'UNLOCKED!' : `${Math.floor(currentValue)} / ${shopItem.req} ${shopItem.label}`}</div>
                ${buttonHtml}
            </div>`;
    });
}

setInterval(() => {
    const now = new Date();
    const minutes = 59 - now.getMinutes();
    const seconds = 59 - now.getSeconds();
    
    const shopTimer = document.getElementById('shop-timer');
    if (shopTimer) {
        shopTimer.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    if (now.getHours() !== window.currentShopHour) {
        window.currentShopHour = now.getHours();
        window.hourlyStats = { kills: 0, time: 0, points: 0, distance: 0 };
        window.currentShopItems = getShop(); 
        
        const storeTab = document.getElementById('store');
        if (storeTab && storeTab.classList.contains('active')) {
            renderMainStore();
        }
    }
}, 1000);

try {
    refreshAllUIs(); 
} catch(e) { console.error("Initial render error:", e); }

// ==========================================
// DEV CONSOLE LOGIC
// ==========================================
const devConsole = document.getElementById('dev-console');
const devInput = document.getElementById('dev-input');
const devLog = document.getElementById('dev-log');

function logDev(msg) {
    if (!devLog) return;
    devLog.innerHTML += `<div>> ${msg}</div>`;
    devLog.scrollTop = devLog.scrollHeight;
}

document.addEventListener('keydown', (e) => {
    if ((e.key === '/' || e.key === '`') && document.activeElement !== devInput) {
        e.preventDefault(); 
        if (devConsole && devInput) {
            devConsole.classList.remove('hidden');
            devInput.focus();
            setTimeout(() => { devInput.value = '/'; }, 10); 
        }
    } else if (e.key === 'Escape') {
        if (devConsole && !devConsole.classList.contains('hidden')) {
            devConsole.classList.add('hidden');
            devInput.blur();
        } 
        else if (window.game && !window.game.isDemo && !window.game.isGameOver && window.game.player && !window.game.player.isDead) {
            window.game.processDeath(window.game.player, null);
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
            const player = (window.game && !window.game.isDemo && !window.game.isGameOver) ? window.game.player : null;

            if (cmd === '/level' && !isNaN(arg)) {
                window.globalAccountLevel = arg; 
                window.globalAccountXP = 0; 
                saveUserData();
                refreshAllUIs();
                logDev(`[SUCCESS] Account Level set to ${arg}.`);
            }
            else if (cmd === '/god' || cmd === '/unkillable') {
                if (player) { 
                    player.maxHealth = 9999999; 
                    player.health = 9999999; 
                    player.regen = 9999; 
                    logDev('[SUCCESS] God mode enabled.'); 
                } else {
                    logDev('[ERROR] Must be in a match.');
                }
            }
            else if (cmd === '/score' && !isNaN(arg)) {
                if(player) { 
                    player.points += arg; 
                    player.upgradeProgress += arg; 
                    logDev(`[SUCCESS] Added ${arg} score.`); 
                }
            }
            else if (cmd === '/speed' && !isNaN(arg)) {
                if(player) { 
                    player.speed = arg; 
                    logDev(`[SUCCESS] Speed set to ${arg}.`); 
                }
            }
            else if (cmd === '/damage' && !isNaN(arg)) {
                if(player) { 
                    player.baseDamage = arg; 
                    logDev(`[SUCCESS] Damage set to ${arg}.`); 
                }
            }
            else if (cmd === '/firerate' && !isNaN(arg)) {
                if(player) { 
                    player.fireRate = arg; 
                    logDev(`[SUCCESS] Fire rate set to ${arg}.`); 
                }
            }
            else if (cmd === '/multishot' && !isNaN(arg)) {
                if(player) { 
                    player.multiShot = arg; 
                    logDev(`[SUCCESS] Multishot set to ${arg}.`); 
                }
            }
            else if (cmd === '/spikes' && !isNaN(arg)) {
                if(player) { 
                    player.spikes = arg; 
                    player.frontVisual = 'spikes'; 
                    logDev(`[SUCCESS] Spikes set to ${arg}.`); 
                }
            }
            else if (cmd === '/orbiters' && !isNaN(arg)) {
                if(player) { 
                    player.orbiters = arg; 
                    logDev(`[SUCCESS] Orbiters set to ${arg}.`); 
                }
            }
            else if (cmd === '/missiles' && !isNaN(arg)) {
                if(player) { 
                    player.missiles = arg; 
                    logDev(`[SUCCESS] Missiles set to ${arg}.`); 
                }
            }
            else if (cmd === '/size' && !isNaN(arg)) {
                if(player) { 
                    player.size = arg; 
                    logDev(`[SUCCESS] Size set to ${arg}.`); 
                }
            }
            else if (cmd === '/heal') {
                if(player) { 
                    player.health = player.maxHealth; 
                    logDev('[SUCCESS] Health restored.'); 
                }
            }
            else if (cmd === '/nuke') {
                if(window.game && window.game.bots) { 
                    window.game.bots.forEach(b => b.health = 0); 
                    logDev('[SUCCESS] Destroyed all enemies.'); 
                }
            }
            else if (cmd === '/shake' && !isNaN(arg)) {
                if(window.game) { 
                    window.game.screenShake = arg; 
                    logDev(`[SUCCESS] Screen shake = ${arg}.`); 
                }
            }
            else if (cmd === '/storm') {
                if(window.game) { 
                    window.game.stormActive = true; 
                    window.game.stormRadius = arg || 1000; 
                    logDev(`[SUCCESS] Storm triggered.`); 
                }
            }
            else if (cmd === '/ability') {
                if(player) { 
                    player.activeAbility = parts[1]; 
                    window.game.updateUpgradeBadges(); 
                    logDev(`[SUCCESS] Ability set to ${parts[1]}.`); 
                }
            }
            else if (cmd === '/cooldown') {
                if(player) { 
                    player.abilityMaxCooldown = arg || 0; 
                    player.dashMaxCooldown = arg || 0; 
                    logDev('[SUCCESS] Cooldowns modified.'); 
                }
            }
            else if (cmd === '/maxupgrades') {
                if(player && UPGRADE_POOL) {
                    UPGRADE_POOL.forEach(u => { 
                        while(player.upgrades[u.id] < 5) { 
                            player.applyUpgrade(u.id); 
                        } 
                    });
                    window.game.updateUpgradeBadges(); 
                    logDev('[SUCCESS] ALL UPGRADES MAXED!');
                }
            }
            else if (cmd === '/suicide') {
                if(player) { 
                    player.health = 0; 
                    logDev('[SUCCESS] Goodbye cruel world.'); 
                }
            }
            else if (cmd === '/tiny') {
                if(player) { 
                    player.size = 5; 
                    logDev('[SUCCESS] You are now tiny.'); 
                }
            }
            else if (cmd === '/giant') {
                if(player) { 
                    player.size = 150; 
                    player.maxHealth += 5000; 
                    player.health += 5000; 
                    logDev('[SUCCESS] You are now a giant boss.'); 
                }
            }
            else if (cmd === '/freeze') {
                if(window.game) { 
                    window.game.bots.forEach(b => b.speed = 0); 
                    logDev('[SUCCESS] Enemies frozen.'); 
                }
            }
            else if (cmd === '/unfreeze') {
                if(window.game) { 
                    window.game.bots.forEach(b => b.speed = 4.2); 
                    logDev('[SUCCESS] Enemies unfrozen.'); 
                }
            }
            else if (cmd === '/statpoints' && !isNaN(arg)) {
                window.hourlyStats.points = arg; 
                renderMainStore(); 
                logDev(`[SUCCESS] Hourly points set to ${arg}.`);
            }
            else if (cmd === '/kills' && !isNaN(arg)) {
                window.hourlyStats.kills = arg; 
                renderMainStore(); 
                logDev(`[SUCCESS] Hourly kills set to ${arg}.`);
            }
            else if (cmd === '/dist' && !isNaN(arg)) {
                window.hourlyStats.distance = arg; 
                renderMainStore(); 
                logDev(`[SUCCESS] Hourly distance set to ${arg}.`);
            }
            else if (cmd === '/time' && !isNaN(arg)) {
                window.hourlyStats.time = arg; 
                renderMainStore(); 
                logDev(`[SUCCESS] Hourly time set to ${arg}.`);
            }
            else if (cmd === '/claimall') { 
                Object.keys(ITEMS_DB).forEach(k => window.claimedItems[k] = true);
                saveUserData();
                refreshAllUIs();
                logDev(`[SUCCESS] Unlocked all cosmetics!`);
            }
            else if (cmd === '/reroll') {
                localStorage.removeItem('yep_shop'); 
                window.currentShopItems = getShop(); 
                renderMainStore(); 
                logDev(`[SUCCESS] Shop rerolled.`);
            }
            else if (cmd === '/close' || cmd === '/exit') {
                devConsole.classList.add('hidden'); 
                devInput.blur();
            }
            else if (cmd === '/help') {
                logDev('Commands: /level, /kills, /dist, /time, /statpoints, /claimall, /reroll, /close, /god, /score, /speed, /damage, /firerate, /multishot, /spikes, /orbiters, /missiles, /size, /heal, /nuke, /shake, /storm, /ability [shield/overdrive], /cooldown, /maxupgrades, /suicide, /tiny, /giant, /freeze, /unfreeze');
            }
            else {
                logDev('<span style="color: red;">[ERROR] Unknown command. Type /help</span>');
            }
        }
    });
}