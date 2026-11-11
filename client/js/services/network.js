// Connection to the game server (socket.io): multiplayer lobbies and in-match messages.
import { state } from '../core/state.js';
import { emit } from '../core/events.js';

const REQUEST_TIMEOUT_MS = 6000;
const serverEvents = ['match:countdown', 'match:cancelled', 'match:start', 'match:hostChanged', 'match:playerLeft'];

class Network {
    constructor() {
        this.socket = null;
        this.handlers = new Map(); // server event -> Set of listeners
    }

    get id() {
        return this.socket?.id ?? null;
    }

    connect() {
        if (typeof window.io !== 'function') {
            console.warn('socket.io client missing: multiplayer is unavailable.');
            return;
        }
        this.socket = window.io();

        this.socket.on('connect', () => {
            state.connected = true;
            state.myNetId = this.socket.id;
            emit('lobby:changed');
        });
        this.socket.on('disconnect', () => {
            const wasInLobby = !!state.lobby;
            state.connected = false;
            state.lobby = null;
            emit('lobby:changed');
            if (wasInLobby) this.fire('disconnected', {});
        });
        this.socket.on('lobby:state', (lobby) => {
            state.lobby = lobby;
            emit('lobby:changed');
        });
        for (const event of serverEvents) this.socket.on(event, (data) => this.fire(event, data));
    }

    // Listen for a server event (match:start, match:countdown, ...). Returns an unsubscribe function.
    on(event, fn) {
        if (!this.handlers.has(event)) this.handlers.set(event, new Set());
        this.handlers.get(event).add(fn);
        return () => this.handlers.get(event).delete(fn);
    }

    fire(event, data) {
        for (const fn of this.handlers.get(event) || []) fn(data);
    }

    // Emits with an acknowledgement; resolves to { ok, error?, ... }.
    request(event, data) {
        if (!this.socket || !this.socket.connected) return Promise.resolve({ ok: false, error: 'NOT CONNECTED TO SERVER' });
        return new Promise((resolve) => {
            this.socket.timeout(REQUEST_TIMEOUT_MS).emit(event, data, (err, response) => {
                resolve(err ? { ok: false, error: 'SERVER DID NOT RESPOND' } : (response || { ok: true }));
            });
        });
    }

    // ---------- lobby ----------

    async createLobby(profile) {
        const res = await this.request('lobby:create', profile);
        if (res.ok) this.setLobby(res.lobby);
        return res;
    }

    async joinLobby(code, profile) {
        const res = await this.request('lobby:join', { code, profile });
        if (res.ok) this.setLobby(res.lobby);
        return res;
    }

    async leaveLobby() {
        state.lobby = null;
        emit('lobby:changed');
        await this.request('lobby:leave');
    }

    setLobby(lobby) {
        state.lobby = lobby;
        emit('lobby:changed');
    }

    updateLoadout(loadout) {
        if (state.lobby) this.socket?.emit('lobby:loadout', loadout);
    }

    setReady(ready) {
        this.socket?.emit('lobby:ready', ready);
    }

    setMode(mode) {
        return this.request('lobby:mode', mode);
    }

    startMatch() {
        return this.request('lobby:start');
    }

    returnedToLobby() {
        this.socket?.emit('lobby:returned');
    }

    // ---------- in-match messages ----------

    send(event, data) {
        if (this.socket?.connected) this.socket.emit(event, data);
    }

    onMatch(event, fn) {
        this.socket?.on(event, fn);
        return () => this.socket?.off(event, fn);
    }
}

export const network = new Network();
