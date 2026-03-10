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
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, query, collection, where, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
let currentLobbyMode = 'duos'; 
window.currentLobbyCode = null; // Globally available code
window.lobbyPlayers = [];

// Persistent Guest ID for those without an account
if (!window.mySessionId) {
    window.mySessionId = 'guest_' + Math.floor(Math.random() * 1000000);
}

function getMyUid() {
    if (auth.currentUser) {
        return auth.currentUser.uid;
    }
    return window.mySessionId;
}

// Utility to generate a random 5-char code
function generateLobbyCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function setInGameStatus(isIngame) {
    if (auth.currentUser) {
        updateDoc(doc(db, "users", auth.currentUser.uid), {
            inGame: isIngame
        }).catch(e => {
            console.error(e);
        });
    }
}

// Clean out old local testing
localStorage.removeItem('yepio_accounts');
localStorage.removeItem('yepio_current_user');

function resetLocalStats() {
    window.globalAccountXP = 0;
    window.globalAccountLevel = 1;
    window.equippedItems = { Skin: null, Trail: null, Banner: null, Color: null };
    window.claimedItems = {};
    window.matchHistory = [];
    window.lifetimeStats = { matches: 0, kills: 0, time: 0, points: 0, distance: 0 };
    window.myFriends = [];
    window.myRequests = [];
    window.myInvites = [];
}

// Run immediately on boot so the UI never crashes looking for a missing 'Skin'
resetLocalStats();

let unsubUser = null;
let handledInvites = {};
let friendCache = {};

// Fetch stats & Start Listening for Live Updates
async function listenToUserData(uid) {
    if (unsubUser) {
        unsubUser();
    }
    
    unsubUser = onSnapshot(doc(db, "users", uid), async (docSnap) => {
        if (docSnap.exists()) {
            let data = docSnap.data();
            
            window.globalAccountXP = data.xp || 0;
            window.globalAccountLevel = data.level || 1;
            
            // 🚨 SAFEGUARD: Ensure equippedItems is always a valid object, even if database is corrupted
            if (data.equipped && typeof data.equipped === 'object') {
                window.equippedItems = data.equipped;
            } else {
                window.equippedItems = { Skin: null, Trail: null, Banner: null, Color: null };
            }
            
            window.claimedItems = data.unlocked || {};
            window.matchHistory = data.history || [];
            window.lifetimeStats = data.stats || { matches: 0, kills: 0, time: 0, points: 0, distance: 0 };
            
            window.myFriends = data.friends || [];
            window.myRequests = data.requestsIn || [];
            window.myInvites = data.invites || [];
            
            const now = Date.now();
            window.myInvites.forEach(inv => {
                if (now - inv.timestamp < 60000 && !handledInvites[inv.timestamp]) {
                    handledInvites[inv.timestamp] = true;
                    showInviteNotification(inv.fromName, inv.code, inv.fromUid);
                }
            });

            refreshAllUIs();
            renderFriendsUI(); 
            
        } else {
            resetLocalStats(); 
            refreshAllUIs();
        }
    }, (error) => {
        console.error("Firebase Snapshot Error:", error);
        resetLocalStats();
        refreshAllUIs();
    });
}

// Save stats securely to the Cloud
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
                stats: window.lifetimeStats,
                lastActive: Date.now()
            }, { merge: true });
        } catch(e) { 
            console.error("Error saving profile:", e); 
        }
    }
}

// Keep "Online" status alive every 30s
setInterval(() => {
    if (auth.currentUser) {
        saveUserData();
    }
}, 30000);

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user.email.split('@')[0];
        setInGameStatus(false); // Reset inGame flag on fresh load
        listenToUserData(user.uid);
    } else {
        currentUser = null;
        if (unsubUser) {
            unsubUser();
        }
        resetLocalStats();
        refreshAllUIs();
    }
});

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
        
        if (stat.type === 'distance' || stat.type === 'points') {
            req = Math.ceil(req / 100) * 100;
        }
        if (stat.type === 'time') {
            req = Math.ceil(req / 10) * 10;
        }
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
        if (parsed.hour === currentHour) {
            return parsed.items; 
        }
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

try { 
    game.startDemo(); 
} catch(e) { 
    console.error(e); 
}

// ==========================================
// REAL-TIME LOBBY SYSTEM
// ==========================================
let lobbyUnsub = null;

function renderLobbySlots(hostName = null) {
    const container = document.getElementById('player-slots-container');
    if (!container) return;
    
    // FORCES THE LOBBY PREVIEWS TO CENTER VERTICALLY IN THE MIDDLE OF THE SCREEN
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    container.style.flexGrow = '1';
    container.style.marginTop = 'auto';
    container.style.marginBottom = 'auto';
    
    let count = currentLobbyMode === 'duos' ? 2 : currentLobbyMode === 'trios' ? 3 : 4;
    container.innerHTML = '';
    
    const players = window.lobbyPlayers || [];
    
    for (let i = 0; i < count; i++) {
        const p = players[i];
        if (p) {
            const isMe = p.uid === getMyUid();
            const isHost = i === 0;
            let roleTag = isHost ? '(HOST)' : '(PLAYER)';
            if (isMe) roleTag = '(YOU)';
            
            container.innerHTML += `
                <div class="player-slot ${p.ready ? 'ready' : ''}">
                    <canvas class="lobby-preview-canvas" id="lobby-canvas-${i}"></canvas>
                    <div class="name">${p.name} <span style="font-size:0.7rem; color:gray;">${roleTag}</span></div>
                    <div class="status" style="color: ${p.ready ? '#00ffcc' : 'gray'}">${p.ready ? 'READY' : 'NOT READY'}</div>
                </div>`;
        } else {
            container.innerHTML += `
                <div class="player-slot empty">
                    <div class="lobby-preview-canvas" style="display:flex; align-items:center; justify-content:center; font-size:3rem; border: 2px dashed #555; border-radius:50%; color:#555;">+</div>
                    <div class="name" style="color:gray;">WAITING...</div>
                    <div class="status"></div>
                </div>`;
        }
    }

    // Toggle LEAVE button visibility
    const myUid = getMyUid();
    const me = (window.lobbyPlayers || []).find(pl => pl.uid === myUid);
    const leaveBtn = document.getElementById('leave-lobby-btn');
    if (leaveBtn) {
        if (me && window.lobbyPlayers && window.lobbyPlayers.length > 0) {
            leaveBtn.classList.remove('hidden');
        } else {
            leaveBtn.classList.add('hidden');
        }
    }
}

function listenToLobby(code) {
    if (lobbyUnsub) {
        lobbyUnsub();
    }
    
    lobbyUnsub = onSnapshot(doc(db, "lobbies", code), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            window.lobbyPlayers = data.players || [];
            currentLobbyMode = data.mode || 'duos';
            document.getElementById('lobby-code-display').innerText = code;
            
            // Sync mode UI
            document.querySelectorAll('.mode-select-btn').forEach(b => b.classList.remove('active'));
            const mBtn = document.querySelector(`.mode-select-btn[data-mode="${currentLobbyMode}"]`);
            if (mBtn) {
                mBtn.classList.add('active');
            }
            
            renderLobbySlots();

            // Auto-start game if host triggered it
            if (data.inGame && !window.isInMatch) {
                window.isInMatch = true;
                document.getElementById('main-menu').classList.add('hidden');
                document.getElementById('game-ui').classList.remove('hidden');
                
                const hud = document.querySelector('.hud');
                if(hud) {
                    hud.classList.remove('hidden');
                }
                
                setInGameStatus(true);
                game.start(selectedClass);
            }
        } else {
            // Lobby deleted/expired
            window.currentLobbyCode = null;
            window.lobbyPlayers = [];
            renderLobbySlots();
        }
    });
}

function broadcastLobbyUpdate() {
    if (window.currentLobbyCode && window.lobbyPlayers) {
        const newPlayers = window.lobbyPlayers.map(p => 
            p.uid === getMyUid() ? { ...p, class: selectedClass || p.class, equipped: window.equippedItems || {} } : p
        );
        updateDoc(doc(db, "lobbies", window.currentLobbyCode), { players: newPlayers }).catch(e => {
            console.error(e);
        });
    }
}

async function leaveCurrentLobby() {
    if (!window.currentLobbyCode) return;
    
    try {
        const code = window.currentLobbyCode;
        const snap = await getDoc(doc(db, "lobbies", code));
        
        if (snap.exists()) {
            const data = snap.data();
            const me = data.players.find(p => p.uid === getMyUid());
            
            if (me) {
                await updateDoc(doc(db, "lobbies", code), { players: arrayRemove(me) });
            }
        }
    } catch(e) {
        console.error(e);
    }
    
    window.currentLobbyCode = null;
    window.lobbyPlayers = [];
    
    if (lobbyUnsub) { 
        lobbyUnsub(); 
        lobbyUnsub = null; 
    }
}

async function joinLobbyByCode(code, sourceBtn) {
    const originalText = sourceBtn.innerText;
    sourceBtn.innerText = "JOINING...";
    
    try {
        const snap = await getDoc(doc(db, "lobbies", code));
        
        if (!snap.exists()) {
            sourceBtn.innerText = "NOT FOUND!";
            setTimeout(() => {
                sourceBtn.innerText = originalText;
            }, 2000);
            return false;
        }
        
        const data = snap.data();
        const max = data.mode === 'duos' ? 2 : data.mode === 'trios' ? 3 : 4;
        
        if (data.players.length >= max) {
            sourceBtn.innerText = "LOBBY FULL!";
            setTimeout(() => {
                sourceBtn.innerText = originalText;
            }, 2000);
            return false;
        }
        
        if (data.inGame) {
            sourceBtn.innerText = "IN MATCH!";
            setTimeout(() => {
                sourceBtn.innerText = originalText;
            }, 2000);
            return false;
        }

        if (window.currentLobbyCode && window.currentLobbyCode !== code) {
            await leaveCurrentLobby();
        }

        window.currentLobbyCode = code;
        const myPlayerObj = {
            uid: getMyUid(),
            name: currentUser || 'GUEST',
            ready: false,
            class: selectedClass || 'triangle',
            equipped: window.equippedItems || {}
        };
        
        await updateDoc(doc(db, "lobbies", code), { players: arrayUnion(myPlayerObj) });
        listenToLobby(code);
        
        sourceBtn.innerText = originalText;
        document.querySelector('.tab-btn[data-target="multiplayer"]').click();
        return true;
        
    } catch(e) {
        console.error(e);
        sourceBtn.innerText = "ERROR!";
        setTimeout(() => {
            sourceBtn.innerText = originalText;
        }, 2000);
        return false;
    }
}

// ==========================================
// GLOBAL UI HANDLER
// ==========================================
let currentLockerCategory = null;
window.activePreviewItem = null;

// 🚨 CRITICAL FIX: Ensure all variables exist before calling renderers
function refreshAllUIs() {
    if (!window.equippedItems || typeof window.equippedItems !== 'object') {
        window.equippedItems = { Skin: null, Trail: null, Banner: null, Color: null };
    }
    if (!window.claimedItems) {
        window.claimedItems = {};
    }
    
    renderLocker();
    renderSeasonStore();
    renderMainStore();
    renderStats();
    updateMenuXPBar();
}

document.addEventListener('click', async (e) => {
    const target = e.target;

    if (target.tagName === 'BUTTON' || target.closest('button')) {
        if (sounds && sounds.play) {
            sounds.play('ui_click', 0.4 * (window.gameSettings.volume || 1.0));
        }
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
        document.getElementById('friend-profile-view').classList.add('hidden');
        return;
    }

    // Back to Friends list from Friend Profile
    if (target.id === 'back-to-friends-btn') {
        document.getElementById('friend-profile-view').classList.add('hidden');
        document.getElementById('account-logged-in').classList.remove('hidden');
        return;
    }

    // Gamemode Selector (Host Only)
    if (target.classList.contains('mode-select-btn')) {
        if (!window.lobbyPlayers || window.lobbyPlayers.length === 0 || window.lobbyPlayers[0].uid !== getMyUid()) {
            return; // Must be host
        }
        
        document.querySelectorAll('.mode-select-btn').forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        currentLobbyMode = target.dataset.mode;
        
        if (window.currentLobbyCode) {
            updateDoc(doc(db, "lobbies", window.currentLobbyCode), { mode: currentLobbyMode });
        }
        return;
    }
    
    // Manual Join by Code
    if (target.id === 'join-lobby-btn') {
        if (!selectedClass) {
            document.querySelector('.tab-btn[data-target="lobby"]').click();
            const info = document.getElementById('class-info');
            info.innerText = "PLEASE SELECT A CLASS FIRST!";
            info.style.color = "red";
            info.classList.remove('fade-out', 'hidden');
            setTimeout(() => {
                info.classList.add('fade-out');
            }, 2000);
            return;
        }
        
        const codeInput = document.getElementById('join-code-input').value.trim();
        if (codeInput.length === 5) {
            joinLobbyByCode(codeInput.toUpperCase(), target);
        }
        return;
    }

    // Ready Up / Start Match
    if (target.id === 'ready-btn') {
        if (!window.currentLobbyCode) return;
        
        const myUid = getMyUid();
        const me = window.lobbyPlayers.find(p => p.uid === myUid);
        
        if (me) {
            const isHost = window.lobbyPlayers[0].uid === myUid;
            const everyoneElseReady = window.lobbyPlayers.every(p => p.uid === myUid || p.ready);
            
            if (isHost && everyoneElseReady && window.lobbyPlayers.length > 1) {
                // START THE GAME!
                updateDoc(doc(db, "lobbies", window.currentLobbyCode), { inGame: true });
            } else {
                // Toggle ready status
                const isReady = !me.ready;
                const newPlayers = window.lobbyPlayers.map(p => p.uid === myUid ? { ...p, ready: isReady } : p);
                updateDoc(doc(db, "lobbies", window.currentLobbyCode), { players: newPlayers });
            }
        }
        return;
    }
    
    // Leave Lobby
    if (target.id === 'leave-lobby-btn') {
        leaveCurrentLobby();
        document.querySelector('.tab-btn[data-target="lobby"]').click();
        return;
    }

    // Account Modal Toggle
    if (target.id === 'account-btn') {
        const accModal = document.getElementById('account-modal');
        const loggedOutView = document.getElementById('account-logged-out');
        const loggedInView = document.getElementById('account-logged-in');
        const friendProfileView = document.getElementById('friend-profile-view');
        const errorText = document.getElementById('acc-error');
        
        errorText.innerText = "";
        friendProfileView.classList.add('hidden');
        
        if (auth.currentUser) {
            loggedOutView.classList.add('hidden');
            loggedInView.classList.remove('hidden');
            document.getElementById('acc-display-name').innerText = currentUser;
            renderFriendsUI(); 
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
        
        if (user.length < 3) { 
            errorText.innerText = "Username must be at least 3 chars!"; 
            return; 
        }
        if (pass.length < 6) { 
            errorText.innerText = "Password must be at least 6 chars!"; 
            return; 
        }
        
        errorText.innerText = "Creating account...";
        errorText.style.color = "white";

        createUserWithEmailAndPassword(auth, user + "@yepio.game", pass)
            .then(() => {
                document.getElementById('account-modal').classList.add('hidden');
            })
            .catch((error) => {
                errorText.style.color = "#ff4444";
                if(error.code === 'auth/email-already-in-use') {
                    errorText.innerText = "Username already taken!";
                } else {
                    errorText.innerText = error.message.replace("Firebase: ", "");
                }
            });
        return;
    }

    // Firebase Login
    if (target.id === 'acc-login-btn') {
        const user = document.getElementById('acc-user').value.trim();
        const pass = document.getElementById('acc-pass').value;
        const errorText = document.getElementById('acc-error');
        
        if (!user || !pass) { 
            errorText.innerText = "Please enter username and password!"; 
            return; 
        }
        
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

    // Firebase Logout
    const logoutBtn = target.closest('#acc-logout-btn');
    if (logoutBtn) {
        logoutBtn.innerText = "LOGGING OUT...";
        
        try {
            await saveUserData(); 
            await signOut(auth);  
            document.getElementById('account-modal').classList.add('hidden');
        } catch (error) {
            console.error("Logout Error:", error);
            document.getElementById('account-modal').classList.add('hidden');
        } finally {
            logoutBtn.innerText = "LOG OUT";
        }
        return;
    }

    // --- FRIENDS SYSTEM ACTIONS ---
    
    // Add Friend
    if (target.id === 'add-friend-btn') {
        const searchInput = document.getElementById('friend-search-input');
        const msg = document.getElementById('friend-search-msg');
        const targetName = searchInput.value.trim();
        
        if (!targetName) return;
        if (targetName === currentUser) { 
            msg.innerText = "You can't add yourself!"; 
            msg.style.color = "#ff4444"; 
            return; 
        }
        
        msg.innerText = "Searching...";
        msg.style.color = "white";

        const q = query(collection(db, "users"), where("username", "==", targetName));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            msg.innerText = "Player not found!";
            msg.style.color = "#ff4444";
        } else {
            const targetDoc = snap.docs[0];
            const targetUid = targetDoc.id;
            
            if (window.myFriends.includes(targetUid)) {
                msg.innerText = "Already friends!";
                msg.style.color = "#ff4444";
                return;
            }

            try {
                await updateDoc(doc(db, "users", targetUid), {
                    requestsIn: arrayUnion(auth.currentUser.uid)
                });
                msg.innerText = "Friend request sent!";
                msg.style.color = "#00ffcc";
                searchInput.value = "";
            } catch(e) {
                msg.innerText = "Error sending request.";
                msg.style.color = "#ff4444";
            }
        }
        return;
    }

    // Accept Request
    if (target.classList.contains('accept-req-btn')) {
        const friendUid = target.dataset.uid;
        target.innerText = "...";
        try {
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
                requestsIn: arrayRemove(friendUid),
                friends: arrayUnion(friendUid)
            });
            await updateDoc(doc(db, "users", friendUid), {
                friends: arrayUnion(auth.currentUser.uid)
            });
        } catch(e) { 
            console.error(e); 
        }
        return;
    }

    // Deny Request
    if (target.classList.contains('deny-req-btn')) {
        const friendUid = target.dataset.uid;
        try {
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
                requestsIn: arrayRemove(friendUid)
            });
        } catch(e) { 
            console.error(e); 
        }
        return;
    }

    // Accept Live Invite
    if (target.classList.contains('accept-invite-btn') || target.classList.contains('join-invite-btn')) {
        
        // Protect from joining without a class
        if (!selectedClass) {
            document.querySelector('.tab-btn[data-target="lobby"]').click();
            document.getElementById('account-modal').classList.add('hidden');
            const info = document.getElementById('class-info');
            info.innerText = "PLEASE SELECT A CLASS FIRST!";
            info.style.color = "red";
            info.classList.remove('fade-out', 'hidden');
            setTimeout(() => {
                info.classList.add('fade-out');
            }, 2000);
            return; // DON'T REMOVE INVITE, JUST WARN
        }
        
        const hostUid = target.dataset.hostuid;
        const hostName = target.dataset.hostname;
        const code = target.dataset.code;
        
        const joined = await joinLobbyByCode(code, target);
        
        // If successfully joined, clear the invite
        if (joined) {
            const notifBox = target.closest('.notif-box');
            if (notifBox) {
                notifBox.classList.add('fade-out');
                setTimeout(() => {
                    notifBox.remove();
                }, 400);
            }
            if (auth.currentUser) {
                await updateDoc(doc(db, "users", auth.currentUser.uid), {
                    invites: window.myInvites.filter(i => i.fromUid !== hostUid)
                });
            }
        }
        return;
    }

    // Click Friend -> View Profile
    const friendItem = target.closest('.friend-item');
    if (friendItem && !target.classList.contains('friend-action-btn') && !target.classList.contains('join-invite-btn')) {
        const fUid = friendItem.dataset.uid;
        if (!friendCache[fUid]) return;
        
        const fData = friendCache[fUid];
        
        document.getElementById('account-logged-in').classList.add('hidden');
        const pv = document.getElementById('friend-profile-view');
        pv.classList.remove('hidden');
        
        document.getElementById('fp-username').innerText = fData.username;
        document.getElementById('fp-level').innerText = fData.level || 1;
        document.getElementById('fp-kills').innerText = (fData.stats && fData.stats.kills) || 0;
        document.getElementById('fp-matches').innerText = (fData.stats && fData.stats.matches) || 0;
        
        const inviteBtn = document.getElementById('invite-friend-btn');
        inviteBtn.onclick = async () => {
            // Must have a lobby to invite them to
            if (!window.currentLobbyCode) {
                document.querySelector('.tab-btn[data-target="multiplayer"]').click();
            }
            
            inviteBtn.innerText = "SENDING...";
            try {
                await updateDoc(doc(db, "users", fUid), {
                    invites: arrayUnion({
                        fromName: currentUser,
                        fromUid: auth.currentUser.uid,
                        code: window.currentLobbyCode,
                        timestamp: Date.now()
                    })
                });
                
                inviteBtn.innerText = "INVITE SENT! WAITING IN LOBBY...";
                setTimeout(() => { 
                    document.getElementById('account-modal').classList.add('hidden');
                    document.querySelector('.tab-btn[data-target="multiplayer"]').click();
                    inviteBtn.innerText = "INVITE TO MULTIPLAYER";
                }, 1000);

            } catch(e) {
                inviteBtn.innerText = "ERROR!";
                setTimeout(() => { 
                    inviteBtn.innerText = "INVITE TO MULTIPLAYER"; 
                }, 2000);
            }
        };
        return;
    }

    // Class Selection
    if (target.classList.contains('class-btn')) {
        document.querySelectorAll('.class-btn').forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        selectedClass = target.dataset.class;
        
        broadcastLobbyUpdate(); 
        
        const info = document.getElementById('class-info');
        if (info) {
            if (selectedClass === 'triangle') info.innerText = "JET: Fast & agile. Lower health. Good for hit-and-run.";
            if (selectedClass === 'square') info.innerText = "TANK: High health, slow speed. Excels in close-quarters brawls.";
            if (selectedClass === 'circle') info.innerText = "SOLDIER: Balanced speed and health. The perfect all-rounder.";
            
            info.style.color = "var(--accent)";
            info.classList.remove('hidden', 'fade-out');
            
            if (window.classInfoTimeout) {
                clearTimeout(window.classInfoTimeout);
            }
            window.classInfoTimeout = setTimeout(() => { 
                info.classList.add('fade-out'); 
            }, 4000);
        }
    }

    // Equipment Logic
    const equipBtn = target.closest('.btn-equip');
    if (equipBtn) {
        const itemId = equipBtn.dataset.id;
        
        if (!window.equippedItems) {
            window.equippedItems = { Skin: null, Trail: null, Banner: null, Color: null };
        }

        if (!itemId) { 
            if (currentLockerCategory) {
                window.equippedItems[currentLockerCategory] = null;
            }
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
        
        saveUserData(); 
        broadcastLobbyUpdate(); 
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

    // TAB SWITCHING
    if (target.classList.contains('tab-btn')) {
        const targetTab = target.dataset.target;
        
        if (targetTab === 'multiplayer' && !selectedClass) {
            const info = document.getElementById('class-info');
            if (info) {
                info.innerText = "PLEASE SELECT A CLASS FIRST!";
                info.style.color = "red";
                info.classList.remove('fade-out', 'hidden');
                setTimeout(() => {
                    info.classList.add('fade-out');
                }, 2000);
            }
            return;
        }

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        target.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
        
        window.activePreviewItem = null; 

        // Footer Visibility Rules
        const menuFooter = document.querySelector('.menu-footer');
        const gmSelector = document.getElementById('gamemode-selector');
        const lobbyControls = document.getElementById('footer-center-lobby-controls');
        
        if (menuFooter) {
            if (targetTab === 'locker') {
                menuFooter.classList.add('hidden');
            } else {
                menuFooter.classList.remove('hidden');
            }
        }
        
        if (targetTab === 'multiplayer') {
            if (gmSelector) gmSelector.classList.remove('hidden');
            if (lobbyControls) lobbyControls.classList.remove('hidden');
            
            if (!window.currentLobbyCode) {
                window.currentLobbyCode = generateLobbyCode();
                
                const myPlayerObj = {
                    uid: getMyUid(),
                    name: currentUser || 'GUEST',
                    ready: false,
                    class: selectedClass || 'triangle',
                    equipped: window.equippedItems || {}
                };
                
                setDoc(doc(db, "lobbies", window.currentLobbyCode), {
                    mode: currentLobbyMode,
                    players: [myPlayerObj],
                    inGame: false
                }).then(() => {
                    listenToLobby(window.currentLobbyCode);
                });
                
            } else {
                renderLobbySlots(); 
            }
            
        } else {
            if (gmSelector) gmSelector.classList.add('hidden');
            if (lobbyControls) lobbyControls.classList.add('hidden');
        }
        
        if (targetTab === 'season') renderSeasonStore();
        if (targetTab === 'store') renderMainStore();
        if (targetTab === 'locker') renderLocker();
        if (targetTab === 'stats') renderStats(); 
    }
});


// ==========================================
// RENDERERS (CRITICAL FIX: Fully Restored)
// ==========================================
function renderLocker() {
    const slotsView = document.getElementById('locker-slots-view');
    const itemsView = document.getElementById('locker-items-view');
    if (!slotsView || !itemsView) return;
    
    if (currentLockerCategory === null) {
        slotsView.classList.remove('hidden'); 
        itemsView.classList.add('hidden');
        slotsView.innerHTML = '';
        
        ['Skin', 'Trail', 'Banner', 'Color'].forEach(cat => {
            const itemId = window.equippedItems ? window.equippedItems[cat] : null;
            const item = itemId && ITEMS_DB ? ITEMS_DB[itemId] : null;
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
        const titleEl = document.getElementById('locker-category-title');
        if (titleEl) {
            titleEl.innerText = `CHOOSE ${currentLockerCategory}`;
        }
        
        const grid = document.getElementById('locker-item-grid'); 
        grid.innerHTML = '';
        
        const isDefault = window.equippedItems ? !window.equippedItems[currentLockerCategory] : true;
        
        grid.innerHTML += `
            <div class="store-item unlocked" style="--rarity-color: #888;">
                <div class="item-icon" style="cursor: pointer;">✖</div>
                <div style="font-size: 0.8rem; color: #888; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: -5px;">DEFAULT</div>
                <div class="item-name">None</div>
                <button class="btn-equip ${isDefault ? 'equipped' : ''}" data-id="">${isDefault ? '✓ EQUIPPED' : 'EQUIP'}</button>
            </div>`;
        
        if (ITEMS_DB && window.claimedItems) {
            const sortedItems = Object.keys(window.claimedItems)
                .map(id => ITEMS_DB[id]).filter(item => item && item.category === currentLockerCategory)
                .sort((a, b) => (b.rarity || 1) - (a.rarity || 1));

            sortedItems.forEach(item => {
                let color = item.color || RARITY_COLORS[item.rarity];
                const isEquipped = window.equippedItems && window.equippedItems[item.category] === item.id;
                
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

    if (window.matchHistory) {
        window.matchHistory = window.matchHistory.filter(match => {
            if (!match.timestamp) match.timestamp = now; 
            const isValid = (now - match.timestamp) < ONE_DAY;
            if (!isValid) historyChanged = true;
            return isValid;
        });
    } else {
        window.matchHistory = [];
    }

    if (historyChanged) saveUserData();

    const el1 = document.getElementById('stat-account-level'); if(el1) el1.innerText = window.globalAccountLevel || 1;
    const el2 = document.getElementById('stat-matches'); if(el2) el2.innerText = window.lifetimeStats?.matches || 0;
    const el3 = document.getElementById('stat-kills'); if(el3) el3.innerText = window.lifetimeStats?.kills || 0;
    const el4 = document.getElementById('stat-points'); if(el4) el4.innerText = Math.floor(window.lifetimeStats?.points || 0);
    const el5 = document.getElementById('stat-time'); if(el5) el5.innerText = formatTime(window.lifetimeStats?.time || 0);
    
    const historyList = document.getElementById('match-history-list');
    if (!historyList) return;
    
    if (!window.matchHistory || window.matchHistory.length === 0) {
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
    
    const pb = document.getElementById('season-progress-bar');
    if (pb) {
        pb.style.width = `${Math.min(100, ((window.globalAccountLevel || 1) / 50) * 100)}%`;
    }
    
    const sItems = ['s_banner', 's_trail', 's_skin1', 's_skin2'];

    sItems.forEach(id => {
        const item = ITEMS_DB ? ITEMS_DB[id] : null;
        if (!item) return;
        
        const isUnlocked = (window.globalAccountLevel || 1) >= item.req;
        const isClaimed = window.claimedItems && window.claimedItems[item.id];
        const isEquipped = window.equippedItems && window.equippedItems[item.category] === item.id;
        
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
    
    let shopItems = [...(window.currentShopItems || [])];
    shopItems.sort((a, b) => {
        const rA = ITEMS_DB && ITEMS_DB[a.id] ? (ITEMS_DB[a.id].rarity || 1) : 1;
        const rB = ITEMS_DB && ITEMS_DB[b.id] ? (ITEMS_DB[b.id].rarity || 1) : 1;
        return rB - rA;
    });

    shopItems.forEach(shopItem => {
        const item = ITEMS_DB ? ITEMS_DB[shopItem.id] : null;
        if (!item) return;
        
        const currentValue = window.hourlyStats ? (window.hourlyStats[shopItem.type] || 0) : 0;
        const isUnlocked = currentValue >= shopItem.req;
        const isClaimed = window.claimedItems && window.claimedItems[item.id];
        const isEquipped = window.equippedItems && window.equippedItems[item.category] === item.id;
        const progressPercent = Math.min(100, (currentValue / shopItem.req) * 100);
        const color = RARITY_COLORS ? RARITY_COLORS[item.rarity] : '#fff';
        
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

// ==========================================
// FRIENDS LIST RENDERING
// ==========================================
async function renderFriendsUI() {
    const reqContainer = document.getElementById('friend-requests-container');
    const reqList = document.getElementById('friend-requests-list');
    const fList = document.getElementById('friends-list');
    
    if (!reqContainer || !reqList || !fList) return;

    if (window.myRequests.length > 0) {
        reqContainer.classList.remove('hidden');
        reqList.innerHTML = '';
        
        for (let uid of window.myRequests) {
            let data = friendCache[uid];
            if (!data) {
                const s = await getDoc(doc(db, "users", uid));
                if (s.exists()) { 
                    data = s.data(); 
                    friendCache[uid] = data; 
                }
            }
            if (data) {
                reqList.innerHTML += `
                    <div class="friend-item" style="border-color:#555; background:rgba(0,0,0,0.5);">
                        <div class="friend-name" style="margin-left:5px;">${data.username}</div>
                        <div class="friend-actions">
                            <button class="friend-action-btn accept-req-btn yellow-btn-solid" data-uid="${uid}">✓</button>
                            <button class="friend-action-btn deny-req-btn dark-btn-outline" data-uid="${uid}">✖</button>
                        </div>
                    </div>`;
            }
        }
    } else {
        reqContainer.classList.add('hidden');
        reqList.innerHTML = '';
    }

    if (window.myFriends.length > 0) {
        const activeInvites = window.myInvites.filter(inv => (Date.now() - inv.timestamp) < 60000);
        const invitedUids = activeInvites.map(i => i.fromUid);

        // Sort: Invites -> Online -> Offline
        let sortedFriends = [...window.myFriends].sort((a, b) => {
            const aHasInv = invitedUids.includes(a);
            const bHasInv = invitedUids.includes(b);
            if (aHasInv && !bHasInv) return -1;
            if (bHasInv && !aHasInv) return 1;
            
            const aData = friendCache[a];
            const bData = friendCache[b];
            
            const aOn = aData && (Date.now() - (aData.lastActive || 0)) < 65000;
            const bOn = bData && (Date.now() - (bData.lastActive || 0)) < 65000;
            
            if (aOn && !bOn) return -1;
            if (bOn && !aOn) return 1;
            return 0;
        });

        fList.innerHTML = '';
        
        for (let uid of sortedFriends) {
            let data = friendCache[uid];
            if (!data) {
                const s = await getDoc(doc(db, "users", uid));
                if (s.exists()) { 
                    data = s.data(); 
                    friendCache[uid] = data; 
                }
            }
            if (data) {
                const isOnline = (Date.now() - (data.lastActive || 0)) < 65000;
                const dotClass = isOnline ? '' : 'offline';
                
                let avatarIcon = '';
                if (data.equipped && data.equipped.Banner && ITEMS_DB[data.equipped.Banner]) {
                    avatarIcon = ITEMS_DB[data.equipped.Banner].icon;
                }

                // Check for golden invite style
                const activeInvite = activeInvites.find(i => i.fromUid === uid);
                
                if (activeInvite) {
                    fList.innerHTML += `
                        <div class="friend-item has-invite" data-uid="${uid}">
                            <div class="friend-avatar">
                                ${avatarIcon}
                                <div class="friend-online-dot ${dotClass}"></div>
                            </div>
                            <div class="friend-name">
                                ${data.username}
                                <span>INVITE PENDING</span>
                            </div>
                            <button class="friend-action-btn join-invite-btn yellow-btn-solid" data-hostuid="${uid}" data-hostname="${data.username}" data-code="${activeInvite.code}">JOIN</button>
                        </div>`;
                } else {
                    fList.innerHTML += `
                        <div class="friend-item" data-uid="${uid}">
                            <div class="friend-avatar">
                                ${avatarIcon}
                                <div class="friend-online-dot ${dotClass}"></div>
                            </div>
                            <div class="friend-name">${data.username}</div>
                            <span style="color:gray; font-size:0.8rem; font-weight:bold;">❯</span>
                        </div>`;
                }
            }
        }
    } else {
        fList.innerHTML = '<p style="color:gray; font-style:italic; font-size:0.9rem;">No friends yet. Add someone above!</p>';
    }
}

// Slide-in Notification - RESTORED OLD CLASS TOGGLING
function showInviteNotification(senderName, code, hostUid) {
    const queue = document.getElementById('notif-queue');
    const template = document.getElementById('invite-template');
    
    if (!queue || !template) return;

    const clone = template.cloneNode(true);
    clone.id = "";
    clone.classList.remove('hidden', 'fade-out'); // Restore old logic
    clone.querySelector('.invite-sender-name').innerText = `From: ${senderName}`;
    
    const btn = clone.querySelector('.accept-invite-btn');
    btn.dataset.code = code;
    btn.dataset.hostuid = hostUid;
    btn.dataset.hostname = senderName;
    
    queue.appendChild(clone);
    
    if(sounds && sounds.play) {
        sounds.play('notification', 0.8);
    }

    setTimeout(() => {
        if(clone.parentNode) {
            clone.classList.add('fade-out'); // Restore old fade out class
            setTimeout(() => {
                clone.remove();
            }, 500);
        }
    }, 15000);
}

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
        saveUserData(); 
        
        if(sounds && sounds.play) {
            sounds.play('level_up', 0.6 * (window.gameSettings.volume || 1.0)); // Fixed sound name
        }
        
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
    
    if (dt > 250) {
        dt = 16.666; 
    }
    if (dt < 0) {
        dt = 0; 
    }
    
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
    
    let tmp = window.gameSettings.showNames; 
    window.gameSettings.showNames = false;

    // Draw Locker Preview
    const lockerTabRender = document.getElementById('locker');
    if (lockerCtx && lockerTabRender && lockerTabRender.classList.contains('active')) {
        lockerCtx.clearRect(0, 0, 300, 300);
        
        if (!window.equippedItems) {
            window.equippedItems = { Skin: null, Trail: null, Banner: null, Color: null };
        }
        
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
        previewDummy.draw(lockerCtx);
    }

    // Draw Fullscreen Store Preview
    const itemPreviewRender = document.getElementById('item-preview-screen');
    if (fsCtx && itemPreviewRender && !itemPreviewRender.classList.contains('hidden')) {
        fsCtx.clearRect(0, 0, 350, 350);
        previewDummy.type = selectedClass || 'triangle';
        
        if (!window.equippedItems) {
            window.equippedItems = { Skin: null, Trail: null, Banner: null, Color: null };
        }
        
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
        previewDummy.draw(fsCtx);
    }

    // Draw Multiplayer Lobby Slots
    const mpTabRender = document.getElementById('multiplayer');
    if (mpTabRender && mpTabRender.classList.contains('active') && window.lobbyPlayers) {
        for (let i = 0; i < window.lobbyPlayers.length; i++) {
            const p = window.lobbyPlayers[i];
            const cvs = document.getElementById(`lobby-canvas-${i}`);
            
            if (cvs && p) {
                if (!cvs.initialized) {
                    cvs.width = 140 * dpr;
                    cvs.height = 140 * dpr;
                    cvs.getContext('2d').scale(dpr, dpr);
                    cvs.initialized = true;
                }
                
                const ctx = cvs.getContext('2d');
                ctx.clearRect(0, 0, 140, 140);
                
                previewDummy.type = p.class || 'triangle';
                previewDummy.equipped = p.equipped || {};
                
                if (previewDummy.equipped.Color && ITEMS_DB[previewDummy.equipped.Color]) {
                    const dbColor = ITEMS_DB[previewDummy.equipped.Color].value;
                    previewDummy.color = dbColor === 'gold' ? '#ffe600' : dbColor; 
                } else { 
                    previewDummy.color = '#d3d3d3'; 
                }
                
                previewDummy.angle = previewAngle;
                previewDummy.size = 35;
                previewDummy.x = 70;
                previewDummy.y = 70;
                previewDummy.draw(ctx);
            }
        }
    }

    window.gameSettings.showNames = tmp;
}
window.previewAnimationId = requestAnimationFrame(renderPreview);

// ==========================================
// SETTINGS BINDINGS
// ==========================================
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
        if (window.gameSettings.showFps) {
            fpsDisplay.classList.remove('hidden');
        } else {
            fpsDisplay.classList.add('hidden');
        }
    }
    
    if (window.game) {
        window.game.updateLeaderboard();
        window.game.updateUpgradeBadges();
    }
    
    document.getElementById('settings-modal').classList.add('hidden');
});

document.querySelectorAll('.keybind-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.keybind-btn').forEach(b => b.classList.remove('listening'));
        listeningAction = e.target.dataset.action;
        e.target.classList.add('listening');
        e.target.innerText = "PRESS KEY";
    });
});

let listeningAction = null;
const formatKeyName = (key) => key === ' ' ? 'SPACE' : key.toUpperCase();

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
    
    if (bar) {
        bar.style.width = `${progressPercent}%`;
    }
    if (lvl) {
        lvl.innerText = window.globalAccountLevel;
    }
    
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
            
            if (window.classInfoTimeout) {
                clearTimeout(window.classInfoTimeout);
            }
            window.classInfoTimeout = setTimeout(() => {
                info.classList.add('fade-out');
            }, 2000);
        }
        return;
    }
    
    setInGameStatus(true); 
    
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');
    
    const hud = document.querySelector('.hud');
    if(hud) {
        hud.classList.remove('hidden');
    }
    
    window.isInMatch = true;
    game.start(selectedClass);
});

document.getElementById('return-lobby-btn').addEventListener('click', () => {
    setInGameStatus(false);
    window.isInMatch = false;
    
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('game-ui').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
    
    if (window.lastMatchStats) {
        window.lastMatchStats.timestamp = Date.now();
        
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
        
        saveUserData(); 
    }
    
    if (window.currentLobbyCode) {
        document.querySelector('.tab-btn[data-target="multiplayer"]').click();
        const me = window.lobbyPlayers.find(p => p.uid === getMyUid());
        if (me) {
            const newPlayers = window.lobbyPlayers.map(p => p.uid === getMyUid() ? { ...p, ready: false } : p);
            updateDoc(doc(db, "lobbies", window.currentLobbyCode), { 
                players: newPlayers, 
                inGame: false 
            }).catch(e => {
                console.error(e);
            });
        }
    }
    
    updateMenuXPBar(); 
    game.startDemo();
});

// ==========================================
// FULL DEV CONSOLE LOGIC
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
    if ((e.key === '/' || e.key === '`') && document.activeElement !== devInput && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault(); 
        if (devConsole && devInput) {
            devConsole.classList.remove('hidden');
            devInput.focus();
            setTimeout(() => { 
                devInput.value = '/'; 
            }, 10); 
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

// ==========================================
// INITIAL RENDER
// ==========================================
try {
    refreshAllUIs();
} catch(e) {
    console.error("Initial render error:", e);
}