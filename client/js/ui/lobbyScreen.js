// The Multiplayer tab: create/join a lobby, see who's in it, pick the mode, ready up, and the
// "MATCH STARTING IN 3" countdown. Lobby state comes from the game server (services/network.js).
import { $, escapeHtml, setVisible } from '../core/dom.js';
import { state, displayName, isLobbyHost } from '../core/state.js';
import { on } from '../core/events.js';
import { sounds } from '../core/sound.js';
import { network } from '../services/network.js';
import { showToast, showError } from './toast.js';
import { activeTab, switchTab } from './menu.js';

let creating = null;     // in-flight "create lobby" request
let countdownTimer = null;

export const lobbyProfile = () => ({
    name: displayName(),
    classType: state.selectedClass || 'triangle',
    equipped: state.profile.equipped
});

export function initLobbyScreen({ onMatchStart }) {
    $('copy-code-btn').addEventListener('click', copyCode);
    $('join-lobby-btn').addEventListener('click', () => {
        const code = $('join-code-input').value.trim().toUpperCase();
        if (code.length !== 5) return showError('ENTER A 5 CHARACTER CODE');
        joinLobby(code, $('join-lobby-btn'));
    });
    $('join-code-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') $('join-lobby-btn').click();
    });
    $('ready-btn').addEventListener('click', onReadyClick);
    $('leave-lobby-btn').addEventListener('click', async () => {
        await network.leaveLobby();
        switchTab('lobby');
    });

    $('gamemodes-main-btn').addEventListener('click', () => {
        if (!state.lobby) return;
        if (!isLobbyHost()) return showError('ONLY THE HOST CAN CHANGE THE MODE');
        $('gamemodes-menu').classList.toggle('hidden');
    });
    document.querySelectorAll('.menu-mode-btn').forEach(btn => btn.addEventListener('click', () => {
        setVisible($('gamemodes-menu'), false);
        changeMode({ mainMode: btn.dataset.mainmode });
    }));
    document.querySelectorAll('.mode-select-btn[data-teamsize]').forEach(btn => btn.addEventListener('click', () => {
        if (!isLobbyHost()) return showError('ONLY THE HOST CAN CHANGE THE MODE');
        changeMode({ teamSize: btn.dataset.teamsize });
    }));

    on('tab:changed', (tab) => { if (tab === 'multiplayer') ensureLobby(); });
    on('lobby:changed', render);
    on('profile:changed', () => network.updateLoadout({ equipped: state.profile.equipped }));
    on('account:changed', () => network.updateLoadout({ name: displayName() }));

    network.on('match:countdown', ({ ms }) => runCountdown(ms));
    network.on('match:cancelled', ({ reason }) => {
        stopCountdown();
        showError(`MATCH CANCELLED: ${reason || ''}`.trim());
    });
    network.on('match:start', (match) => startMatchTransition(match, onMatchStart));
    network.on('disconnected', () => {
        stopCountdown();
        showError('DISCONNECTED FROM SERVER');
    });

    render();
}

// Opening the Multiplayer tab puts you in a lobby of your own (unless you're already in one).
// Callers that need the lobby can await this; overlapping calls share one request.
export function ensureLobby() {
    if (state.lobby) return Promise.resolve();
    if (creating) return creating;
    if (!state.connected) {
        showToast('CONNECTING TO SERVER...', { color: 'white', ms: 2000 });
        return Promise.resolve();
    }
    creating = network.createLobby(lobbyProfile()).then((res) => {
        creating = null;
        if (!res.ok) showError(res.error || 'COULD NOT CREATE LOBBY');
    });
    return creating;
}

export async function joinLobby(code, button = null) {
    const original = button?.textContent;
    if (button) button.textContent = 'JOINING...';
    const res = await network.joinLobby(code, lobbyProfile());
    if (button) button.textContent = original;
    if (!res.ok) {
        showError(res.error || 'COULD NOT JOIN');
        return false;
    }
    $('join-code-input').value = '';
    switchTab('multiplayer');
    return true;
}

async function changeMode(mode) {
    const res = await network.setMode(mode);
    if (!res.ok) showError(res.error);
}

async function copyCode() {
    if (!state.lobby) return;
    const btn = $('copy-code-btn');
    try {
        await navigator.clipboard.writeText(state.lobby.code);
        btn.textContent = 'COPIED!';
    } catch {
        btn.textContent = state.lobby.code; // clipboard blocked: show the code to copy by hand
    }
    setTimeout(() => { btn.textContent = 'COPY'; }, 2000);
}

async function onReadyClick() {
    const lobby = state.lobby;
    const me = lobby?.players.find(p => p.id === state.myNetId);
    if (!me) return;
    if (isLobbyHost()) {
        const res = await network.startMatch();
        if (!res.ok) showError(res.error);
        return;
    }
    if (!me.ready) sounds.play('ui_ready', { category: 'ui' });
    network.setReady(!me.ready);
}

// ---------- rendering ----------

function render() {
    const lobby = state.lobby;
    $('lobby-code-display').textContent = lobby ? lobby.code : (state.connected ? '-----' : 'OFFLINE');

    const mainMode = lobby?.mainMode || 'br';
    const teamSize = lobby?.teamSize || 'duos';
    $('gamemodes-main-btn').textContent = mainMode === '1v1' ? 'GAMEMODE: 1v1 DUEL' : 'GAMEMODE: BATTLE ROYALE';
    document.querySelectorAll('.menu-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mainmode === mainMode));
    document.querySelectorAll('.mode-select-btn[data-teamsize]').forEach(b => b.classList.toggle('active', b.dataset.teamsize === teamSize));
    if (activeTab() === 'multiplayer') setVisible($('br-team-selector'), mainMode !== '1v1');
    document.querySelector('.footer-left-container').classList.toggle('lobby-controls-locked', !!lobby && !isLobbyHost());

    renderSlots(lobby);
    renderReadyButton(lobby);
    setVisible($('leave-lobby-btn'), !!lobby);
}

function renderSlots(lobby) {
    const capacity = lobby ? lobby.capacity : 2;
    const players = lobby ? lobby.players : [];
    let html = '';
    for (let i = 0; i < capacity; i++) {
        const p = players[i];
        if (!p) {
            html += `
                <div class="player-slot empty">
                    <div class="lobby-preview-canvas slot-placeholder">+</div>
                    <div class="name">WAITING...</div>
                    <div class="status"></div>
                </div>`;
            continue;
        }
        const isHost = p.id === lobby.hostId;
        const role = p.id === state.myNetId ? '(YOU)' : isHost ? '(HOST)' : '(PLAYER)';
        let status = p.ready ? 'READY' : 'NOT READY';
        let statusClass = '';
        if (p.inMatch) status = 'IN MATCH';
        else if (isHost) {
            status = 'HOST';
            statusClass = 'host-status';
        }
        html += `
            <div class="player-slot ${p.ready ? 'ready' : ''} ${p.inMatch ? 'in-match' : ''}">
                <canvas class="lobby-preview-canvas" id="lobby-canvas-${i}"></canvas>
                <div class="name">${escapeHtml(p.name)} <span class="role-tag">${role}</span></div>
                <div class="status ${statusClass}">${status}</div>
            </div>`;
    }
    $('player-slots-container').innerHTML = html;
}

function renderReadyButton(lobby) {
    const btn = $('ready-btn');
    const me = lobby?.players.find(p => p.id === state.myNetId);
    let text = 'READY';
    let waiting = !me;
    let active = false;

    if (me && lobby.phase === 'countdown') {
        text = 'STARTING...';
        waiting = true;
    } else if (me && lobby.phase === 'playing') {
        text = 'MATCH IN PROGRESS';
        waiting = true;
    } else if (me && isLobbyHost()) {
        const others = lobby.players.filter(p => p.id !== me.id);
        if (others.length === 0) {
            text = 'WAITING FOR PLAYERS';
            waiting = true;
        } else if (others.every(p => p.ready)) {
            text = 'START MATCH';
        } else {
            text = 'WAITING FOR READY';
            waiting = true;
        }
    } else if (me) {
        text = me.ready ? 'UNREADY' : 'READY';
        active = me.ready;
    }
    btn.textContent = text;
    btn.classList.toggle('is-waiting', waiting);
    btn.classList.toggle('ready-active', active);
}

// ---------- countdown & match start ----------

function runCountdown(ms) {
    stopCountdown();
    let count = Math.max(1, Math.round(ms / 1000));
    const overlay = $('match-countdown-overlay');
    const text = $('countdown-text');
    setVisible(overlay, true);
    text.textContent = count;
    sounds.play('ui_click', { category: 'ui' });
    countdownTimer = setInterval(() => {
        count--;
        if (count > 0) {
            text.textContent = count;
            sounds.play('ui_click', { category: 'ui' });
        } else {
            clearInterval(countdownTimer);
            countdownTimer = null;
        }
    }, 1000);
}

function stopCountdown() {
    clearInterval(countdownTimer);
    countdownTimer = null;
    setVisible($('match-countdown-overlay'), false);
}

function startMatchTransition(match, onMatchStart) {
    clearInterval(countdownTimer);
    countdownTimer = null;
    setVisible($('match-countdown-overlay'), true);
    $('countdown-text').textContent = 'FIGHT!';

    const fade = $('black-fade-overlay');
    fade.style.transition = 'opacity 0.5s ease-in-out';
    fade.style.opacity = '1';
    fade.style.pointerEvents = 'all';
    setTimeout(() => {
        setVisible($('match-countdown-overlay'), false);
        try {
            onMatchStart(match);
        } catch (err) {
            console.error('Could not start the match:', err);
            showError('COULD NOT START THE MATCH');
        } finally {
            // Always lift the black screen, even if something went wrong.
            setTimeout(() => {
                fade.style.opacity = '0';
                setTimeout(() => { fade.style.pointerEvents = 'none'; }, 500);
            }, 500);
        }
    }, 500);
}
