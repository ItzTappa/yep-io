// Forwards in-match messages between the players of one lobby.
//
// The server does not simulate the game. Each player's browser owns its own ship, and the
// match host's browser owns the bots and safe zones. The relay only checks that the sender
// is really in that match (and is the host, for host-only messages) and rate-limits them.
const { RATE_LIMITS } = require('./config');
const { isPlainObject } = require('./sanitize');

// Sent by any player, delivered to everyone else in the match.
const PLAYER_EVENTS = ['m:state', 'm:shoot', 'm:upgrades', 'm:action', 'm:died'];
// Sent only by the match host, delivered to everyone else.
const HOST_EVENTS = ['m:world', 'm:botMeta', 'm:botDied', 'm:botAction'];
// Sent by non-hosts, delivered only to the match host.
const TO_HOST_EVENTS = ['m:botHit', 'm:requestWorld'];

function createRateLimiter() {
    let windowStart = Date.now();
    const counts = {};
    return (event) => {
        const now = Date.now();
        if (now - windowStart >= 1000) {
            windowStart = now;
            for (const key in counts) counts[key] = 0;
        }
        counts[event] = (counts[event] || 0) + 1;
        return counts[event] <= (RATE_LIMITS[event] || 30);
    };
}

function registerMatchRelay(io, socket, lobbies) {
    const allow = createRateLimiter();

    // (Not "volatile": socket.io drops volatile messages whenever the previous one is still being
    // written, which silently lost every bot snapshot that followed a position update.)
    const relay = (event, data, lobby) => {
        socket.to(lobby.code).emit(event, { ...data, from: socket.id });
    };

    for (const event of PLAYER_EVENTS) {
        socket.on(event, (data) => {
            const lobby = lobbies.activeMatchOf(socket);
            if (!lobby || !isPlainObject(data) || !allow(event)) return;
            relay(event, data, lobby);
        });
    }

    for (const event of HOST_EVENTS) {
        socket.on(event, (data) => {
            const lobby = lobbies.activeMatchOf(socket);
            if (!lobby || lobby.matchHostId !== socket.id || !isPlainObject(data) || !allow(event)) return;
            relay(event, data, lobby);
        });
    }

    for (const event of TO_HOST_EVENTS) {
        socket.on(event, (data) => {
            const lobby = lobbies.activeMatchOf(socket);
            if (!lobby || !lobby.matchHostId || lobby.matchHostId === socket.id) return;
            if (!isPlainObject(data) || !allow(event)) return;
            io.to(lobby.matchHostId).emit(event, { ...data, from: socket.id });
        });
    }
}

module.exports = { registerMatchRelay };
