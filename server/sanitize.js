// Cleans everything a client sends about itself before other players ever see it.
const { NAME_MAX_LENGTH, CLASS_TYPES } = require('./config');

const ITEM_ID = /^[a-z0-9_]{1,40}$/i;
const SLOTS = ['Skin', 'Trail', 'Banner', 'Color'];

function sanitizeName(name) {
    const clean = String(name || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, NAME_MAX_LENGTH);
    return clean || 'GUEST';
}

function sanitizeEquipped(equipped) {
    const out = {};
    for (const slot of SLOTS) {
        const id = equipped && equipped[slot];
        out[slot] = typeof id === 'string' && ITEM_ID.test(id) ? id : null;
    }
    return out;
}

function sanitizeClass(classType) {
    return CLASS_TYPES.includes(classType) ? classType : 'triangle';
}

function sanitizeProfile(profile = {}) {
    return {
        name: sanitizeName(profile.name),
        classType: sanitizeClass(profile.classType),
        equipped: sanitizeEquipped(profile.equipped)
    };
}

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

module.exports = { sanitizeName, sanitizeEquipped, sanitizeClass, sanitizeProfile, isPlainObject };
