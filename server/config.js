// Server-wide settings. Everything tunable about lobbies and match relaying lives here.
module.exports = {
    PORT: process.env.PORT || 3000,

    // How many players each lobby mode can hold.
    MODE_CAPACITY: { '1v1': 2, duos: 2, trios: 3, squads: 4 },
    MAIN_MODES: ['br', '1v1'],
    TEAM_SIZES: ['duos', 'trios', 'squads'],
    CLASS_TYPES: ['triangle', 'square', 'circle'],

    COUNTDOWN_MS: 3000,
    CODE_LENGTH: 5,
    CODE_ALPHABET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    NAME_MAX_LENGTH: 16,

    // Largest socket message we accept (bytes). Bot world snapshots are the biggest payloads.
    MAX_MESSAGE_BYTES: 200 * 1024,

    // Per-socket message budget per second for in-match events. Extra messages are dropped.
    RATE_LIMITS: {
        'm:state': 40,
        'm:shoot': 90,
        'm:action': 20,
        'm:upgrades': 20,
        'm:died': 5,
        'm:botHit': 200,
        'm:requestWorld': 5,
        'm:world': 30,
        'm:botMeta': 10,
        'm:botDied': 120,
        'm:botAction': 120
    }
};
