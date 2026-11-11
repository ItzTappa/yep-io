// Accounts and saving.
//   Logged in: progress lives in Firestore at users/<uid>.
//   Guest:     progress is kept in this browser (localStorage) until you register; registering
//              carries your guest progress over to the new account.
import { state, createEmptyProfile } from '../core/state.js';
import { emit } from '../core/events.js';
import { ACCOUNT } from '../config.js';
import { CATEGORIES, emptyLoadout } from '../data/items.js';
import { loadFirebase, EMAIL_DOMAIN } from './firebase.js';

const GUEST_KEY = 'yepio_guest_profile';
const USERNAME_RULE = /^[A-Za-z0-9_]{3,16}$/;
// Progress fields we own and save. Social fields (friends, invites...) are written separately.
const PROFILE_FIELDS = ['xp', 'level', 'equipped', 'unlocked', 'history', 'stats', 'classStats', 'hourly'];

let fb = null;
let unsubscribeDoc = null;
let heartbeatTimer = null;
let saveTimer = null;

// ---------- startup ----------

export async function initAccount() {
    state.profile = loadGuestProfile();
    emit('profile:changed');
    try {
        fb = await loadFirebase();
    } catch (err) {
        console.warn('Accounts unavailable (Firebase failed to load). Playing as guest.', err);
        state.account.available = false;
        emit('account:changed');
        return;
    }
    state.account.available = true;
    emit('account:changed');
    fb.authSdk.onAuthStateChanged(fb.auth, (user) => {
        handleAuthChange(user).catch(err => console.error('Account load failed:', err));
    });
}

async function handleAuthChange(user) {
    stopListening();
    if (!user) {
        state.account.uid = null;
        state.account.username = null;
        state.profile = loadGuestProfile();
        state.social = { friends: [], requestsIn: [], requestsOut: [], invites: [] };
        emit('account:changed');
        emit('profile:changed');
        emit('social:changed');
        return;
    }

    const uid = user.uid;
    const username = usernameFromEmail(user.email);
    const ref = fb.fs.doc(fb.db, 'users', uid);
    const snap = await fb.fs.getDoc(ref);

    if (snap.exists()) {
        state.profile = profileFromData(snap.data());
    } else {
        // New account (or an old one that never saved): keep the progress you have right now.
        await fb.fs.setDoc(ref, { username, ...profilePayload(), friends: [], requestsIn: [], requestsOut: [], invites: [], lastActive: Date.now(), inGame: false }, { merge: true });
    }
    if (fb.auth.currentUser?.uid !== uid) return; // logged out while loading

    state.account.uid = uid;
    state.account.username = username;
    emit('account:changed');
    emit('profile:changed');

    // Live updates for the friends system. Progress itself is only loaded once (above), so
    // a friend request arriving mid-match can never roll back XP you just earned.
    unsubscribeDoc = fb.fs.onSnapshot(ref, (docSnap) => {
        const data = docSnap.data() || {};
        state.social = {
            friends: arrayOf(data.friends),
            requestsIn: arrayOf(data.requestsIn),
            requestsOut: arrayOf(data.requestsOut),
            invites: arrayOf(data.invites).filter(inv => inv && typeof inv === 'object')
        };
        emit('social:changed');
    }, (err) => console.error('Friends listener error:', err));

    sendHeartbeat();
    heartbeatTimer = setInterval(sendHeartbeat, ACCOUNT.heartbeatMs);
}

function stopListening() {
    if (unsubscribeDoc) unsubscribeDoc();
    unsubscribeDoc = null;
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
}

// ---------- login / register / logout ----------

export function validateUsername(name) {
    if (!USERNAME_RULE.test(name)) return 'Username must be 3-16 letters, numbers or _';
    return null;
}

export async function register(username, password) {
    if (!fb) throw new Error('Accounts are unavailable right now.');
    await saveNow(); // so the guest progress we carry over is up to date
    try {
        await fb.authSdk.createUserWithEmailAndPassword(fb.auth, username.toLowerCase() + EMAIL_DOMAIN, password);
    } catch (err) {
        throw new Error(authErrorMessage(err, 'register'));
    }
}

export async function login(username, password) {
    if (!fb) throw new Error('Accounts are unavailable right now.');
    try {
        await fb.authSdk.signInWithEmailAndPassword(fb.auth, username.toLowerCase() + EMAIL_DOMAIN, password);
    } catch (err) {
        throw new Error(authErrorMessage(err, 'login'));
    }
}

export async function logout() {
    if (!fb) return;
    await saveNow();
    await setInGame(false);
    await fb.authSdk.signOut(fb.auth);
}

function authErrorMessage(err, mode) {
    switch (err?.code) {
        case 'auth/email-already-in-use': return 'Username already taken!';
        case 'auth/weak-password': return 'Password must be at least 6 chars!';
        case 'auth/invalid-email': return 'That username is not allowed.';
        case 'auth/network-request-failed': return 'Network error. Check your connection.';
        case 'auth/too-many-requests': return 'Too many attempts. Try again in a minute.';
        default: return mode === 'login' ? 'Incorrect username or password!' : (err?.message || 'Something went wrong.').replace('Firebase: ', '');
    }
}

// ---------- saving ----------

// Coalesces quick changes (e.g. clicking through the locker) into one save.
export function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 800);
}

export async function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!state.account.uid) {
        saveGuestProfile();
        return;
    }
    try {
        await fb.fs.setDoc(fb.fs.doc(fb.db, 'users', state.account.uid), {
            username: state.account.username,
            ...profilePayload(),
            lastActive: Date.now()
        }, { merge: true });
    } catch (err) {
        console.error('Saving progress failed:', err);
    }
}

export async function setInGame(inGame) {
    if (!state.account.uid) return;
    try {
        await fb.fs.updateDoc(fb.fs.doc(fb.db, 'users', state.account.uid), { inGame, lastActive: Date.now() });
    } catch (err) {
        console.warn('Could not update online status:', err.message);
    }
}

function sendHeartbeat() {
    setInGame(state.inMatch);
}

function profilePayload() {
    const out = {};
    for (const key of PROFILE_FIELDS) out[key] = state.profile[key];
    return out;
}

// ---------- shared helpers for other services ----------

export function firebase() {
    return fb;
}

export function usernameFromEmail(email) {
    return String(email || '').split('@')[0].toLowerCase();
}

function arrayOf(value) {
    return Array.isArray(value) ? value : [];
}

// Builds a clean profile from saved data, filling anything missing with defaults.
export function profileFromData(data = {}) {
    const base = createEmptyProfile();
    const equipped = emptyLoadout();
    for (const cat of CATEGORIES) equipped[cat] = typeof data.equipped?.[cat] === 'string' ? data.equipped[cat] : null;
    const classStats = { ...base.classStats };
    for (const type in classStats) classStats[type] = { ...classStats[type], ...(data.classStats?.[type] || {}) };
    const now = Date.now();
    return {
        xp: Number(data.xp) || 0,
        level: Math.max(1, Number(data.level) || 1),
        equipped,
        unlocked: data.unlocked && typeof data.unlocked === 'object' ? { ...data.unlocked } : {},
        history: arrayOf(data.history).filter(m => m && now - (m.timestamp || now) < ACCOUNT.historyMaxAgeMs),
        stats: { ...base.stats, ...(data.stats || {}) },
        classStats,
        hourly: { ...base.hourly, ...(data.hourly || {}) }
    };
}

function loadGuestProfile() {
    try {
        const saved = JSON.parse(localStorage.getItem(GUEST_KEY));
        if (saved) return profileFromData(saved);
    } catch {
        // corrupted or blocked storage: start fresh
    }
    return createEmptyProfile();
}

function saveGuestProfile() {
    try {
        localStorage.setItem(GUEST_KEY, JSON.stringify(state.profile));
    } catch {
        // storage blocked; progress lasts for this session only
    }
}

// Clean out keys from older versions of the game.
for (const key of ['yepio_accounts', 'yepio_current_user', 'yep_shop']) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
}
