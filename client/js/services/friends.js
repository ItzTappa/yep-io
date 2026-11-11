// Friends: requests, accepting, lobby invites, and friend profiles (with online status).
import { state } from '../core/state.js';
import { ACCOUNT } from '../config.js';
import { firebase } from './account.js';

const PROFILE_CACHE_MS = 30000;
const profileCache = new Map(); // uid -> { data, fetchedAt }

function requireAccount() {
    const fb = firebase();
    if (!fb || !state.account.uid) throw new Error('Log in to use friends.');
    return fb;
}

const userRef = (fb, uid) => fb.fs.doc(fb.db, 'users', uid);

// Sends a friend request by username. Returns a short message for the UI.
export async function sendFriendRequest(rawName) {
    const fb = requireAccount();
    const name = rawName.trim().toLowerCase();
    if (!name) return { ok: false, message: 'Type a username first.' };
    if (name === state.account.username) return { ok: false, message: "You can't add yourself!" };

    const result = await fb.fs.getDocs(fb.fs.query(fb.fs.collection(fb.db, 'users'), fb.fs.where('username', '==', name)));
    if (result.empty) return { ok: false, message: 'Player not found!' };
    const targetUid = result.docs[0].id;

    if (state.social.friends.includes(targetUid)) return { ok: false, message: 'Already friends!' };
    if (state.social.requestsIn.includes(targetUid)) {
        await acceptFriendRequest(targetUid);
        return { ok: true, message: 'They already asked you. Friend added!' };
    }
    if (state.social.requestsOut.includes(targetUid)) return { ok: false, message: 'Request already sent.' };

    const me = state.account.uid;
    await fb.fs.updateDoc(userRef(fb, me), { requestsOut: fb.fs.arrayUnion(targetUid) });
    await fb.fs.updateDoc(userRef(fb, targetUid), { requestsIn: fb.fs.arrayUnion(me) });
    return { ok: true, message: 'Friend request sent!' };
}

export async function acceptFriendRequest(friendUid) {
    const fb = requireAccount();
    const me = state.account.uid;
    await fb.fs.updateDoc(userRef(fb, me), {
        requestsIn: fb.fs.arrayRemove(friendUid),
        requestsOut: fb.fs.arrayRemove(friendUid),
        friends: fb.fs.arrayUnion(friendUid)
    });
    // Their side: add us to their friends and clear their pending request to us.
    // (Requests sent before requestsOut existed can't be confirmed by the security rules; in that
    // case only our side updates, and they show up once they add us back.)
    try {
        await fb.fs.updateDoc(userRef(fb, friendUid), {
            friends: fb.fs.arrayUnion(me),
            requestsOut: fb.fs.arrayRemove(me)
        });
    } catch (err) {
        console.warn('Could not update the other player\'s friends list:', err.message);
    }
}

export async function denyFriendRequest(friendUid) {
    const fb = requireAccount();
    await fb.fs.updateDoc(userRef(fb, state.account.uid), { requestsIn: fb.fs.arrayRemove(friendUid) });
}

export async function sendLobbyInvite(friendUid, lobbyCode) {
    const fb = requireAccount();
    await fb.fs.updateDoc(userRef(fb, friendUid), {
        invites: fb.fs.arrayUnion({ fromName: state.account.username, fromUid: state.account.uid, code: lobbyCode, timestamp: Date.now() })
    });
}

// Removes invites from one friend (after joining) and anything older than a few minutes.
export async function clearInvites(fromUid = null) {
    const fb = firebase();
    if (!fb || !state.account.uid) return;
    const cutoff = Date.now() - ACCOUNT.inviteLifetimeMs * 5;
    const keep = state.social.invites.filter(inv => inv.fromUid !== fromUid && inv.timestamp > cutoff);
    if (keep.length === state.social.invites.length) return;
    try {
        await fb.fs.updateDoc(userRef(fb, state.account.uid), { invites: keep });
    } catch (err) {
        console.warn('Could not clear invites:', err.message);
    }
}

export const activeInvites = () => state.social.invites.filter(inv => Date.now() - inv.timestamp < ACCOUNT.inviteLifetimeMs);

// Public profile of another player (cached for 30 seconds).
export async function getProfile(uid, { fresh = false } = {}) {
    const cached = profileCache.get(uid);
    if (cached && !fresh && Date.now() - cached.fetchedAt < PROFILE_CACHE_MS) return cached.data;
    const fb = requireAccount();
    const snap = await fb.fs.getDoc(userRef(fb, uid));
    const data = snap.exists() ? snap.data() : null;
    profileCache.set(uid, { data, fetchedAt: Date.now() });
    return data;
}

export const isOnline = (profile) => !!profile && Date.now() - (profile.lastActive || 0) < ACCOUNT.onlineWindowMs;
