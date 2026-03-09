// server/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../client')));

const lobbies = {};

io.on('connection', (socket) => {
    console.log('✅ Player connected:', socket.id);

    socket.on('createLobby', (data) => {
        const code = Array.from({length: 5}, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(Math.floor(Math.random() * 36))).join('');
        socket.join(code);
        lobbies[code] = { 
            id: code, mode: data.mode, maxPlayers: data.maxPlayers, state: 'LOBBY', 
            players: [{ id: socket.id, name: "HOST", color: data.color || "#d3d3d3", classType: data.classType || "triangle", isReady: false }] 
        };
        socket.emit('lobbyCreated', lobbies[code]);
    });

    socket.on('joinLobby', (data) => {
        const lobby = lobbies[data.code];
        if (!lobby) return socket.emit('joinError', 'Lobby not found!');
        if (lobby.players.length >= lobby.maxPlayers) return socket.emit('joinError', 'Lobby is full!');
        if (lobby.state !== 'LOBBY') return socket.emit('joinError', 'Match already starting!');

        socket.join(data.code);
        lobby.players.push({ id: socket.id, name: "FRIEND", color: data.color || "#d3d3d3", classType: data.classType || "triangle", isReady: false });
        io.to(data.code).emit('lobbyUpdate', lobby);
    });

    socket.on('toggleReady', (code) => {
        const lobby = lobbies[code];
        if (!lobby) return;

        const player = lobby.players.find(p => p.id === socket.id);
        if (player) {
            player.isReady = !player.isReady;
            io.to(code).emit('lobbyUpdate', lobby); 
        }

        const allReady = lobby.players.length > 1 && lobby.players.length === lobby.maxPlayers && lobby.players.every(p => p.isReady);
        
        if (allReady && lobby.state === 'LOBBY') {
            lobby.state = 'STARTING'; 
            io.to(code).emit('countdownStart'); 
            setTimeout(() => {
                lobby.state = 'INGAME';
                io.to(code).emit('prepareMatch'); 
                setTimeout(() => { io.to(code).emit('startGame', lobby.players); }, 1000);
            }, 3000);
        }
    });

    // --- LEADERBOARD & MOVEMENT SYNC ---
    socket.on('playerMove', (data) => {
        socket.to(data.code).emit('teammateMoved', { 
            id: socket.id, x: data.x, y: data.y, angle: data.angle, 
            health: data.health, maxHealth: data.maxHealth, points: data.points 
        });
    });

    socket.on('playerShoot', (data) => {
        socket.to(data.code).emit('teammateShoot', { id: socket.id, angle: data.angle, multiShot: data.multiShot, type: data.type });
    });

    socket.on('playerDied', (data) => {
        socket.to(data.code).emit('teammateDied', { id: socket.id });
    });

    socket.on('hostBotSync', (data) => {
        socket.to(data.code).emit('hostBotSync', data);
    });

    socket.on('leaveLobby', (code) => {
        const lobby = lobbies[code];
        if (!lobby) return;
        const index = lobby.players.findIndex(p => p.id === socket.id);
        if (index !== -1) {
            lobby.players.splice(index, 1);
            socket.leave(code); 
            io.to(code).emit('lobbyUpdate', lobby);
            if (lobby.players.length === 0) delete lobbies[code]; 
        }
    });

    socket.on('disconnect', () => {
        for (const code in lobbies) {
            const lobby = lobbies[code];
            const index = lobby.players.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                lobby.players.splice(index, 1);
                io.to(code).emit('lobbyUpdate', lobby);
                if (lobby.players.length === 0) delete lobbies[code]; 
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
// We added '0.0.0.0' so Render knows this is open to the public internet!
server.listen(PORT, '0.0.0.0', () => { 
    console.log(`🚀 Server ready on port ${PORT}`); 
});