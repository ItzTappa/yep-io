// yep.io game server: serves the browser client and runs multiplayer lobbies over socket.io.
// Start with `npm start` (Render runs the same command).
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const { PORT, MAX_MESSAGE_BYTES } = require('./config');
const { LobbyManager } = require('./lobbyManager');
const { registerMatchRelay } = require('./matchRelay');
const { isPlainObject } = require('./sanitize');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: MAX_MESSAGE_BYTES });
const lobbies = new LobbyManager(io);

app.use(express.static(path.join(__dirname, '../client')));

// Quick status check (also handy for uptime monitors that keep a free Render instance awake).
app.get('/health', (req, res) => res.json({ ok: true, ...lobbies.stats() }));

// Wraps a handler that answers through a socket.io acknowledgement callback.
const withAck = (handler) => (...args) => {
    const ack = typeof args[args.length - 1] === 'function' ? args.pop() : null;
    const result = handler(...args);
    if (ack) ack(result || { ok: true });
};

io.on('connection', (socket) => {
    socket.on('lobby:create', withAck((profile) => lobbies.create(socket, isPlainObject(profile) ? profile : {})));
    socket.on('lobby:join', withAck((data) => {
        if (!isPlainObject(data)) return { ok: false, error: 'BAD REQUEST' };
        return lobbies.join(socket, data.code, isPlainObject(data.profile) ? data.profile : {});
    }));
    socket.on('lobby:leave', withAck(() => lobbies.leave(socket)));
    socket.on('lobby:loadout', (data) => { if (isPlainObject(data)) lobbies.updateLoadout(socket, data); });
    socket.on('lobby:ready', (ready) => lobbies.setReady(socket, ready));
    socket.on('lobby:mode', withAck((data) => lobbies.setMode(socket, isPlainObject(data) ? data : {})));
    socket.on('lobby:start', withAck(() => lobbies.start(socket)));
    socket.on('lobby:returned', () => lobbies.returned(socket));

    registerMatchRelay(io, socket, lobbies);

    socket.on('disconnect', () => lobbies.leave(socket));
});

// '0.0.0.0' so Render (and other hosts) can reach the server from outside the container.
server.listen(PORT, '0.0.0.0', () => {
    console.log(`yep.io server ready on port ${PORT}`);
});
