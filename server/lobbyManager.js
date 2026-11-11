// Owns every multiplayer lobby: who is in it, the chosen mode, ready states and the match lifecycle.
// Lobbies live in server memory, so a player who disconnects is removed automatically and empty
// lobbies are deleted as soon as the last player leaves.
//
// Phases:  lobby -> countdown -> playing -> lobby (once everyone has returned from the match)
const {
    MODE_CAPACITY, MAIN_MODES, TEAM_SIZES, COUNTDOWN_MS, CODE_LENGTH, CODE_ALPHABET
} = require('./config');
const { sanitizeProfile, sanitizeName, sanitizeEquipped, sanitizeClass } = require('./sanitize');

const fail = (error) => ({ ok: false, error });

class LobbyManager {
    constructor(io) {
        this.io = io;
        this.lobbies = new Map();
    }

    // ---------- lookups ----------

    lobbyOf(socket) {
        const code = socket.data.lobbyCode;
        return code ? this.lobbies.get(code) || null : null;
    }

    playerIn(lobby, socketId) {
        return lobby ? lobby.players.find(p => p.id === socketId) || null : null;
    }

    capacity(lobby) {
        return lobby.mainMode === '1v1' ? MODE_CAPACITY['1v1'] : MODE_CAPACITY[lobby.teamSize];
    }

    publicState(lobby) {
        return {
            code: lobby.code,
            hostId: lobby.hostId,
            mainMode: lobby.mainMode,
            teamSize: lobby.teamSize,
            capacity: this.capacity(lobby),
            phase: lobby.phase,
            players: lobby.players.map(({ id, name, classType, equipped, ready, inMatch }) => (
                { id, name, classType, equipped, ready, inMatch }
            ))
        };
    }

    broadcast(lobby) {
        this.io.to(lobby.code).emit('lobby:state', this.publicState(lobby));
    }

    generateCode() {
        let code;
        do {
            code = '';
            for (let i = 0; i < CODE_LENGTH; i++) {
                code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
            }
        } while (this.lobbies.has(code));
        return code;
    }

    // ---------- membership ----------

    create(socket, profile) {
        this.leave(socket);
        const lobby = {
            code: this.generateCode(),
            hostId: socket.id,
            matchHostId: null,
            mainMode: 'br',
            teamSize: 'duos',
            phase: 'lobby',
            players: [],
            countdownTimer: null
        };
        this.lobbies.set(lobby.code, lobby);
        this.addPlayer(lobby, socket, profile);
        return { ok: true, lobby: this.publicState(lobby) };
    }

    join(socket, code, profile) {
        code = String(code || '').trim().toUpperCase();
        const lobby = this.lobbies.get(code);
        if (!lobby) return fail('LOBBY NOT FOUND');
        if (this.playerIn(lobby, socket.id)) return { ok: true, lobby: this.publicState(lobby) };
        if (lobby.phase !== 'lobby') return fail('MATCH IN PROGRESS');
        if (lobby.players.length >= this.capacity(lobby)) return fail('LOBBY FULL');

        this.leave(socket);
        this.addPlayer(lobby, socket, profile);
        this.broadcast(lobby);
        return { ok: true, lobby: this.publicState(lobby) };
    }

    addPlayer(lobby, socket, profile) {
        lobby.players.push({ id: socket.id, ...sanitizeProfile(profile), ready: false, inMatch: false });
        socket.join(lobby.code);
        socket.data.lobbyCode = lobby.code;
    }

    leave(socket) {
        const lobby = this.lobbyOf(socket);
        socket.data.lobbyCode = null;
        if (!lobby) return;

        socket.leave(lobby.code);
        lobby.players = lobby.players.filter(p => p.id !== socket.id);

        if (lobby.players.length === 0) {
            this.destroy(lobby);
            return;
        }
        if (lobby.hostId === socket.id) lobby.hostId = lobby.players[0].id;

        if (lobby.phase === 'countdown') this.cancelCountdown(lobby, 'A PLAYER LEFT');
        if (lobby.phase === 'playing') {
            this.io.to(lobby.code).emit('match:playerLeft', { id: socket.id });
            this.ensureMatchHost(lobby);
            this.maybeFinishMatch(lobby);
        }
        this.broadcast(lobby);
    }

    destroy(lobby) {
        if (lobby.countdownTimer) clearTimeout(lobby.countdownTimer);
        this.lobbies.delete(lobby.code);
    }

    // ---------- lobby settings ----------

    updateLoadout(socket, data = {}) {
        const lobby = this.lobbyOf(socket);
        const me = this.playerIn(lobby, socket.id);
        if (!me) return;
        if (data.name !== undefined) me.name = sanitizeName(data.name);
        if (data.classType !== undefined) me.classType = sanitizeClass(data.classType);
        if (data.equipped !== undefined) me.equipped = sanitizeEquipped(data.equipped);
        this.broadcast(lobby);
    }

    setReady(socket, ready) {
        const lobby = this.lobbyOf(socket);
        const me = this.playerIn(lobby, socket.id);
        if (!me || me.inMatch) return;
        me.ready = !!ready;
        if (!me.ready && lobby.phase === 'countdown') this.cancelCountdown(lobby, `${me.name} IS NOT READY`);
        this.broadcast(lobby);
    }

    setMode(socket, { mainMode, teamSize } = {}) {
        const lobby = this.lobbyOf(socket);
        if (!lobby) return fail('NOT IN A LOBBY');
        if (lobby.hostId !== socket.id) return fail('ONLY THE HOST CAN CHANGE THE MODE');
        if (lobby.phase !== 'lobby') return fail('WAIT FOR THE MATCH TO FINISH');

        const next = {
            mainMode: MAIN_MODES.includes(mainMode) ? mainMode : lobby.mainMode,
            teamSize: TEAM_SIZES.includes(teamSize) ? teamSize : lobby.teamSize
        };
        const nextCapacity = next.mainMode === '1v1' ? MODE_CAPACITY['1v1'] : MODE_CAPACITY[next.teamSize];
        if (lobby.players.length > nextCapacity) return fail(`TOO MANY PLAYERS FOR THAT MODE (MAX ${nextCapacity})`);

        Object.assign(lobby, next);
        this.broadcast(lobby);
        return { ok: true };
    }

    // ---------- match lifecycle ----------

    start(socket) {
        const lobby = this.lobbyOf(socket);
        if (!lobby) return fail('NOT IN A LOBBY');
        if (lobby.hostId !== socket.id) return fail('ONLY THE HOST CAN START');
        if (lobby.phase !== 'lobby') return fail('WAIT FOR THE CURRENT MATCH TO FINISH');
        const count = lobby.players.length;
        if (count < 2) return fail('NEED AT LEAST 2 PLAYERS');
        if (count > this.capacity(lobby)) return fail('TOO MANY PLAYERS FOR THIS MODE');
        if (lobby.players.some(p => p.id !== lobby.hostId && !p.ready)) return fail('NOT EVERYONE IS READY');

        lobby.phase = 'countdown';
        this.io.to(lobby.code).emit('match:countdown', { ms: COUNTDOWN_MS });
        lobby.countdownTimer = setTimeout(() => this.beginMatch(lobby), COUNTDOWN_MS);
        this.broadcast(lobby);
        return { ok: true };
    }

    cancelCountdown(lobby, reason) {
        if (lobby.countdownTimer) clearTimeout(lobby.countdownTimer);
        lobby.countdownTimer = null;
        lobby.phase = 'lobby';
        this.io.to(lobby.code).emit('match:cancelled', { reason });
    }

    beginMatch(lobby) {
        lobby.countdownTimer = null;
        if (!this.lobbies.has(lobby.code) || lobby.phase !== 'countdown') return;

        lobby.phase = 'playing';
        lobby.matchHostId = lobby.hostId;
        for (const p of lobby.players) {
            p.inMatch = true;
            p.ready = false;
        }

        this.io.to(lobby.code).emit('match:start', {
            mode: lobby.mainMode === '1v1' ? 'duel' : 'br',
            teamSize: lobby.teamSize,
            hostId: lobby.matchHostId,
            seed: Math.floor(Math.random() * 2147483647),
            players: lobby.players.map(({ id, name, classType, equipped }) => ({ id, name, classType, equipped }))
        });
        this.broadcast(lobby);
    }

    // A player clicked "Return to Menu" after their match ended.
    returned(socket) {
        const lobby = this.lobbyOf(socket);
        const me = this.playerIn(lobby, socket.id);
        if (!me || !me.inMatch) return;
        me.inMatch = false;
        me.ready = false;
        this.ensureMatchHost(lobby);
        this.maybeFinishMatch(lobby);
        this.broadcast(lobby);
    }

    // The match host simulates the bots. If they leave the match, hand that job to someone still playing.
    ensureMatchHost(lobby) {
        if (lobby.phase !== 'playing') return;
        const current = lobby.players.find(p => p.id === lobby.matchHostId && p.inMatch);
        if (current) return;
        const next = lobby.players.find(p => p.inMatch);
        if (!next) return;
        lobby.matchHostId = next.id;
        this.io.to(lobby.code).emit('match:hostChanged', { hostId: next.id });
    }

    maybeFinishMatch(lobby) {
        if (lobby.phase === 'playing' && !lobby.players.some(p => p.inMatch)) {
            lobby.phase = 'lobby';
            lobby.matchHostId = null;
        }
    }

    // The lobby this socket is actively playing a match in, or null.
    activeMatchOf(socket) {
        const lobby = this.lobbyOf(socket);
        if (!lobby || lobby.phase !== 'playing') return null;
        const me = this.playerIn(lobby, socket.id);
        return me && me.inMatch ? lobby : null;
    }

    stats() {
        let players = 0;
        for (const lobby of this.lobbies.values()) players += lobby.players.length;
        return { lobbies: this.lobbies.size, players };
    }
}

module.exports = { LobbyManager };
