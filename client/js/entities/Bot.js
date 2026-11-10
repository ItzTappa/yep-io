// AI-controlled ships. Each bot is its own team (bots fight each other too).
import { Entity } from './Entity.js';
import { ITEMS_DB } from '../data/items.js';
import { randomBotName } from '../data/botNames.js';
import { getWeightedUpgrades } from './upgradePicker.js';
import { distance } from '../core/math.js';
import { BALANCE } from '../data/balance.js';

const COLORS = Object.values(ITEMS_DB).filter(i => i.category === 'Color');
const SKINS = Object.values(ITEMS_DB).filter(i => i.category === 'Skin' && !i.masteryClass);
const TRAILS = Object.values(ITEMS_DB).filter(i => i.category === 'Trail');
const BANNERS = Object.values(ITEMS_DB).filter(i => i.category === 'Banner');
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const nextUpgradeCost = (count) => Math.floor(15 + count * 12 + Math.pow(count, 1.7) * 1.5);

export class Bot extends Entity {
    constructor(x, y, type, startingPoints = 0, { randomLook = true } = {}) {
        super(x, y, type);
        this.isBot = true;
        this.team = `bot:${this.uid}`;
        this.name = randomBotName();

        this.targetX = x;
        this.targetY = y;
        this.changeTargetTimer = 0;
        this.dashTendency = Math.random();
        this.strafeDir = Math.random() > 0.5 ? 1 : -1;
        this.personality = Math.random();    // > 0.8 = berserker that never flees
        this.botAbilityFatigue = 0;
        this.justDashed = false;             // these three are read by the engine for multiplayer broadcasts
        this.justUsedAbility = false;
        this.metaDirty = false;              // upgrades changed since the host last sent them

        this.points = startingPoints;
        this.upgradeProgress = startingPoints;
        this.botPointsToNextUpgrade = 15;
        this.levelUpFromPoints();

        if (randomLook) this.randomizeLook();
    }

    randomizeLook() {
        if (Math.random() < 0.6) this.equipped.Color = pick(COLORS).id;
        if (Math.random() < 0.3) this.equipped.Skin = pick(SKINS).id;
        if (Math.random() < 0.3) this.equipped.Trail = pick(TRAILS).id;
        if (Math.random() < 0.3) this.equipped.Banner = pick(BANNERS).id;
        this.applyLoadout(this.equipped);
    }

    // Bots pick a random upgrade every time their upgrade bar fills.
    levelUpFromPoints() {
        while (this.upgradeProgress >= this.botPointsToNextUpgrade) {
            this.upgradeProgress -= this.botPointsToNextUpgrade;
            this.upgradeCount++;
            this.botPointsToNextUpgrade = nextUpgradeCost(this.upgradeCount);
            const [choice] = getWeightedUpgrades(this, 1);
            if (choice && this.applyUpgrade(choice.id)) this.metaDirty = true;
        }
    }

    // ---------- multiplayer mirroring ----------

    // Everything another player needs to recreate this bot.
    netMeta() {
        return {
            id: this.netId,
            type: this.type,
            n: this.name,
            c: this.color,
            e: this.equipped,
            u: this.upgradeTiers(),
            x: Math.round(this.x),
            y: Math.round(this.y),
            h: Math.round(this.health),
            pts: Math.round(this.points)
        };
    }

    // A copy of the host's bot. It doesn't think for itself until it is promoted (host migration).
    static fromNetMeta(meta) {
        const bot = new Bot(meta.x, meta.y, meta.type, 0, { randomLook: false });
        bot.netId = meta.id;
        bot.isReplica = true;
        bot.applyNetMeta(meta);
        bot.health = meta.h ?? bot.maxHealth;
        bot.points = meta.pts || 0;
        bot.netTarget = { x: meta.x, y: meta.y, angle: 0 };
        return bot;
    }

    applyNetMeta(meta) {
        if (typeof meta.n === 'string') this.name = meta.n.slice(0, 24);
        if (typeof meta.c === 'string') this.color = meta.c;
        if (meta.e) this.applyLoadout(meta.e);
        if (meta.u) this.syncUpgradeTiers(meta.u);
        this.upgradeCount = Object.values(this.upgrades).reduce((a, b) => a + b, 0);
        this.botPointsToNextUpgrade = nextUpgradeCost(this.upgradeCount);
    }

    // ---------- AI ----------

    updateBot(combatants, { referencePoints = 100, isEnemy }) {
        this.changeTargetTimer--;
        if (this.botAbilityFatigue > 0) this.botAbilityFatigue--;

        // Closest visible enemy (with a little randomness so bots don't all focus the same target).
        let nearestEnemy = null;
        let minDist = 800;
        for (const p of combatants) {
            if (p === this || p.isDead || p.isCloaked || p.inSafeZone || !isEnemy(this, p)) continue;
            const d = distance(this.x, this.y, p.x, p.y) + Math.random() * 100;
            if (d < minDist) {
                minDist = d;
                nearestEnemy = p;
            }
        }

        // Tutorial targets and the training bot stay exactly as they were made.
        if (!this.trainingDummy) {
            this.rubberBandPoints(referencePoints);
            this.levelUpFromPoints();
        }

        const speedBoost = this.abilityTimer > 0 && (this.activeAbility === 'overdrive' || this.activeAbility === 'sonic_boom') ? 2.5 : 1.0;
        const speed = this.speed * speedBoost;

        if (nearestEnemy) this.fight(nearestEnemy, speed);
        else this.wander(speed);

        this.update();
    }

    // Bots drift toward a score relative to the local player, so matches stay competitive.
    rubberBandPoints(referencePoints) {
        const R = BALANCE.bots;
        const target = Math.max(100, referencePoints) * (R.targetMin + this.personality * R.targetRange);
        if (this.points > target * R.decayAbove) {
            const decay = (this.points - target) * 0.01;
            this.points -= decay;
            this.upgradeProgress = Math.max(0, this.upgradeProgress - decay);
        } else if (this.points < target) {
            const gain = 0.2 + (target - this.points) * 0.0015;
            this.points += gain;
            this.upgradeProgress += gain;
        } else {
            this.points += 0.2;
            this.upgradeProgress += 0.2;
        }
    }

    fight(enemy, speed) {
        const dx = enemy.x - this.x;
        const dy = enemy.y - this.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const fleeThreshold = this.personality > 0.8 ? 0 : 0.15 + this.personality * 0.20;

        if (this.activeAbility && this.abilityCooldown <= 0 && this.botAbilityFatigue <= 0) {
            const defensive = ['juggernaut', 'shield', 'cloak'].includes(this.activeAbility);
            const shouldCast = defensive ? this.health < this.maxHealth * 0.4 : dist < 300;
            if (shouldCast && this.useAbility()) {
                this.botAbilityFatigue = this.abilityTimer + Math.floor(600 + Math.random() * 600);
                this.justUsedAbility = true;
            }
        }

        if (this.health < this.maxHealth * fleeThreshold) {
            // Retreat while still facing (and shooting at) the enemy.
            this.angle = Math.atan2(dy, dx);
            this.vx -= (dx / dist) * speed * 0.14;
            this.vy -= (dy / dist) * speed * 0.14;
            if (this.dashCooldown <= 0 && Math.random() < 0.03 && this.dash(-dx, -dy)) this.justDashed = true;
            return;
        }

        this.angle = Math.atan2(dy, dx);
        if (dist > 150 && dist < 400 && Math.random() < 0.002 + this.dashTendency * 0.005 && this.dash(dx, dy)) {
            this.justDashed = true;
        }

        const optimal = this.type === 'square' ? 100 : this.type === 'triangle' ? 300 : 200;
        if (Math.random() < 0.01) this.strafeDir *= -1;

        if (dist > optimal + 50) {
            this.vx += (dx / dist) * speed * 0.12;
            this.vy += (dy / dist) * speed * 0.12;
        } else if (dist < optimal - 50) {
            this.vx -= (dx / dist) * speed * 0.12;
            this.vy -= (dy / dist) * speed * 0.12;
        } else {
            this.vx += (-dy / dist) * speed * 0.08 * this.strafeDir;
            this.vy += (dx / dist) * speed * 0.08 * this.strafeDir;
        }
    }

    wander(speed) {
        if (this.changeTargetTimer <= 0) {
            this.targetX = this.x + (Math.random() - 0.5) * 800;
            this.targetY = this.y + (Math.random() - 0.5) * 800;
            this.changeTargetTimer = 60 + Math.random() * 60;
        }
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);
        this.angle = Math.atan2(dy, dx);
        if (dist > 10) {
            this.vx += (dx / dist) * speed * 0.10;
            this.vy += (dy / dist) * speed * 0.10;
        }
    }
}
