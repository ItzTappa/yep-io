// The 👤 account popup: log in / register, your friends list and requests, and friend profiles
// (with the INVITE TO MULTIPLAYER button).
import { $, escapeHtml, setVisible } from '../core/dom.js';
import { state, isLoggedIn } from '../core/state.js';
import { on } from '../core/events.js';
import { sounds } from '../core/sound.js';
import { getItem } from '../data/items.js';
import { login, register, logout, validateUsername } from '../services/account.js';
import {
    sendFriendRequest, acceptFriendRequest, denyFriendRequest, sendLobbyInvite,
    getProfile, isOnline, activeInvites
} from '../services/friends.js';
import { switchTab, requireClass } from './menu.js';
import { ensureLobby } from './lobbyScreen.js';
import { joinInvite } from './invites.js';

let viewingFriend = null;
let refreshTimer = null;

const isOpen = () => !$('account-modal').classList.contains('hidden');

export function initAccountModal() {
    $('account-btn').addEventListener('click', openAccountModal);
    $('close-account-btn').addEventListener('click', closeAccountModal);
    $('toggle-pass-btn').addEventListener('click', togglePassword);
    $('acc-login-btn').addEventListener('click', () => submit('login'));
    $('acc-register-btn').addEventListener('click', () => submit('register'));
    $('acc-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit('login'); });
    $('acc-logout-btn').addEventListener('click', onLogout);
    $('add-friend-btn').addEventListener('click', onAddFriend);
    $('friend-search-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') onAddFriend(); });
    $('back-to-friends-btn').addEventListener('click', () => showView('friends'));
    $('invite-friend-btn').addEventListener('click', onInvite);

    $('friend-requests-list').addEventListener('click', onRequestClick);
    $('friends-list').addEventListener('click', onFriendClick);

    on('account:changed', () => { if (isOpen()) showView(isLoggedIn() ? 'friends' : 'login'); });
    on('social:changed', () => { if (isOpen() && isLoggedIn()) renderFriends(); });
}

export function openAccountModal() {
    setMessage('');
    $('acc-user').value = '';
    $('acc-pass').value = '';
    $('acc-pass').type = 'password';
    $('toggle-pass-btn').textContent = '👁️';
    showView(isLoggedIn() ? 'friends' : 'login');
    setVisible($('account-modal'), true);
    // Keep friends' online dots fresh while the list is open.
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => { if (isOpen() && isLoggedIn()) renderFriends({ fresh: true }); }, 30000);
}

export function closeAccountModal() {
    setVisible($('account-modal'), false);
    clearInterval(refreshTimer);
}

function showView(view) {
    setVisible($('account-logged-out'), view === 'login');
    setVisible($('account-logged-in'), view === 'friends');
    setVisible($('friend-profile-view'), view === 'profile');
    setVisible($('acc-unavailable'), view === 'login' && !state.account.available);
    if (view === 'friends') {
        $('acc-display-name').textContent = state.account.username;
        renderFriends();
    }
}

function setMessage(text, kind = 'error') {
    const el = $('acc-error');
    el.textContent = text;
    el.classList.toggle('info', kind === 'info');
}

function togglePassword() {
    const input = $('acc-pass');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('toggle-pass-btn').textContent = show ? '🙈' : '👁️';
}

async function submit(mode) {
    const username = $('acc-user').value.trim();
    const password = $('acc-pass').value;
    const fail = (msg) => {
        sounds.play('ui_error', { category: 'ui' });
        setMessage(msg);
    };
    if (!state.account.available) return fail('Accounts are unavailable right now.');
    if (mode === 'register') {
        const problem = validateUsername(username);
        if (problem) return fail(problem);
        if (password.length < 6) return fail('Password must be at least 6 chars!');
    } else if (!username || !password) {
        return fail('Please enter username and password!');
    }

    setMessage(mode === 'register' ? 'Creating account...' : 'Logging in...', 'info');
    try {
        if (mode === 'register') await register(username, password);
        else await login(username, password);
        closeAccountModal();
    } catch (err) {
        fail(err.message);
    }
}

async function onLogout() {
    const btn = $('acc-logout-btn');
    btn.textContent = 'LOGGING OUT...';
    try {
        await logout();
    } catch (err) {
        console.error('Logout error:', err);
    } finally {
        btn.textContent = 'LOG OUT';
        closeAccountModal();
    }
}

// ---------- friends ----------

function setSearchMessage(text, kind) {
    const el = $('friend-search-msg');
    el.textContent = text;
    el.className = kind || '';
}

async function onAddFriend() {
    const input = $('friend-search-input');
    if (!input.value.trim()) return;
    setSearchMessage('Searching...', '');
    try {
        const res = await sendFriendRequest(input.value);
        setSearchMessage(res.message, res.ok ? 'success' : 'error');
        if (res.ok) input.value = '';
        else sounds.play('ui_error', { category: 'ui' });
    } catch (err) {
        console.error(err);
        sounds.play('ui_error', { category: 'ui' });
        setSearchMessage('Error sending request.', 'error');
    }
}

async function onRequestClick(e) {
    const btn = e.target instanceof Element ? e.target.closest('.friend-action-btn') : null;
    if (!btn) return;
    btn.textContent = '...';
    try {
        if (btn.classList.contains('accept-req-btn')) await acceptFriendRequest(btn.dataset.uid);
        else await denyFriendRequest(btn.dataset.uid);
    } catch (err) {
        console.error(err);
        sounds.play('ui_error', { category: 'ui' });
    }
}

function onFriendClick(e) {
    const target = e.target instanceof Element ? e.target : null;
    const joinBtn = target?.closest('.join-invite-btn');
    if (joinBtn) {
        const invite = activeInvites().find(inv => inv.fromUid === joinBtn.dataset.hostuid);
        if (invite) joinInvite(invite, joinBtn).then(ok => { if (ok) closeAccountModal(); });
        return;
    }
    const item = target?.closest('.friend-item[data-uid]');
    if (item) openFriendProfile(item.dataset.uid);
}

async function renderFriends({ fresh = false } = {}) {
    const { requestsIn, friends } = state.social;

    setVisible($('friend-requests-container'), requestsIn.length > 0);
    const requestRows = await Promise.all(requestsIn.map(async (uid) => {
        const data = await getProfile(uid).catch(() => null);
        if (!data) return '';
        return `
            <div class="friend-item request">
                <div class="friend-name">${escapeHtml(data.username)}</div>
                <div class="friend-actions">
                    <button class="friend-action-btn accept-req-btn yellow-btn-solid" data-uid="${escapeHtml(uid)}">✓</button>
                    <button class="friend-action-btn deny-req-btn dark-btn-outline" data-uid="${escapeHtml(uid)}">✖</button>
                </div>
            </div>`;
    }));
    $('friend-requests-list').innerHTML = requestRows.join('');

    if (friends.length === 0) {
        $('friends-list').innerHTML = '<p class="friend-empty">No friends yet. Add someone above!</p>';
        return;
    }

    const invites = activeInvites();
    const profiles = await Promise.all(friends.map(uid => getProfile(uid, { fresh }).catch(() => null).then(data => ({ uid, data }))));
    // Invites first, then online friends, then offline.
    const rank = ({ uid, data }) => (invites.some(i => i.fromUid === uid) ? 0 : isOnline(data) ? 1 : 2);
    profiles.sort((a, b) => rank(a) - rank(b));

    $('friends-list').innerHTML = profiles.filter(p => p.data).map(({ uid, data }) => {
        const avatar = getItem(data.equipped?.Banner)?.icon || '';
        const online = isOnline(data);
        const invite = invites.find(i => i.fromUid === uid);
        const name = escapeHtml(data.username);
        const safeUid = escapeHtml(uid);
        const avatarHtml = `<div class="friend-avatar">${avatar}<div class="friend-online-dot ${online ? '' : 'offline'}"></div></div>`;
        if (invite) {
            return `
                <div class="friend-item has-invite" data-uid="${safeUid}">
                    ${avatarHtml}
                    <div class="friend-name">${name}<span>INVITE PENDING</span></div>
                    <button class="friend-action-btn join-invite-btn yellow-btn-solid" data-hostuid="${safeUid}">JOIN</button>
                </div>`;
        }
        return `
            <div class="friend-item" data-uid="${safeUid}">
                ${avatarHtml}
                <div class="friend-name">${name}</div>
                <span class="friend-chevron">❯</span>
            </div>`;
    }).join('');
}

async function openFriendProfile(uid) {
    const data = await getProfile(uid).catch(() => null);
    if (!data) return;
    viewingFriend = uid;
    $('fp-username').textContent = data.username;
    $('fp-level').textContent = data.level || 1;
    $('fp-kills').textContent = data.stats?.kills || 0;
    $('fp-matches').textContent = data.stats?.matches || 0;
    $('fp-points').textContent = Math.floor(data.stats?.points || 0);
    $('invite-friend-btn').textContent = 'INVITE TO MULTIPLAYER';
    showView('profile');
}

async function onInvite() {
    if (!viewingFriend || !requireClass()) return;
    const btn = $('invite-friend-btn');
    btn.textContent = 'SENDING...';
    switchTab('multiplayer');
    await ensureLobby();
    if (!state.lobby) {
        btn.textContent = 'INVITE TO MULTIPLAYER';
        return;
    }
    try {
        await sendLobbyInvite(viewingFriend, state.lobby.code);
        btn.textContent = 'INVITE SENT! WAITING IN LOBBY...';
        setTimeout(closeAccountModal, 1000);
    } catch (err) {
        console.error(err);
        sounds.play('ui_error', { category: 'ui' });
        btn.textContent = 'ERROR!';
        setTimeout(() => { btn.textContent = 'INVITE TO MULTIPLAYER'; }, 2000);
    }
}
