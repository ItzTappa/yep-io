// Shared combat rules: who is friendly, who is immune, and how a trigger pull spreads.
export const IMMUNE_ABILITIES = new Set(['shield', 'juggernaut', 'phase_strike']);

// Shield, Juggernaut and Phase Strike block all incoming damage while active.
export const isImmune = (ship) => ship.abilityTimer > 0 && IMMUNE_ABILITIES.has(ship.activeAbility);

// Same team = never hurt each other. Bots are each on their own team.
export const areAllies = (a, b) => !!a && !!b && (a === b || (a.team !== null && a.team === b.team));

export const isEnemy = (a, b) => !!a && !!b && a !== b && !areAllies(a, b);

export const isGhosting = (ship) => ship.ghostDash && ship.dashTimer > 0;

// The storm counts as an attacker so kills and death screens can name it.
export const STORM_SOURCE = Object.freeze({ name: 'THE STORM', team: 'storm', isStorm: true, vampirism: 0, medicDrop: 0, isDead: false });
export const FORFEIT_SOURCE = Object.freeze({ name: 'FORFEIT', team: 'forfeit', isForfeit: true, vampirism: 0, medicDrop: 0, isDead: false });

// Angles for one trigger pull: Multishot fans out 0.2 rad per extra barrel; Jets wobble a little.
export function volleyAngles(ship) {
    const shots = ship.multiShot + 1;
    const spread = 0.2;
    const start = ship.angle - (spread * (shots - 1)) / 2;
    const angles = [];
    for (let i = 0; i < shots; i++) {
        let angle = start + i * spread;
        if (ship.type === 'triangle') angle += (Math.random() - 0.5) * 0.15;
        angles.push(angle);
    }
    return angles;
}

// Account XP for a kill. Killing someone with more points than you is worth up to 5x.
export function killXp(killerPoints, victimPoints) {
    let multiplier = 1;
    if (victimPoints > killerPoints) multiplier = victimPoints / Math.max(1, killerPoints);
    multiplier = Math.min(multiplier, 5);
    return Math.floor(50 * multiplier) + Math.floor(victimPoints / 100);
}
