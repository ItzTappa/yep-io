// Admin console (press / or `). Only opens while signed in to an account listed in
// ADMIN_USERNAMES (config.js). Type /help for the command list.
import { $, setVisible } from '../core/dom.js';
import { ADMIN_USERNAMES } from '../config.js';
import { state } from '../core/state.js';
import { on } from '../core/events.js';
import { UPGRADE_POOL, isAbility } from '../data/upgrades.js';
import { devSetLevel, devUnlockAll, devSetHourly, addAccountXP, setTutorialDone } from '../services/profile.js';
import { completeAllQuests, resetQuests } from '../services/quests.js';
import { emit } from '../core/events.js';
import { STORM } from '../config.js';
import { LuckySlotMachine } from '../entities/pickups.js';

export const isAdmin = () => ADMIN_USERNAMES.includes(state.account.username);
export const isDevConsoleOpen = () => !$('dev-console').classList.contains('hidden');

export function initDevConsole(engine) {
    const consoleEl = $('dev-console');
    const input = $('dev-input');
    const log = (msg, isError = false) => {
        const line = document.createElement('div');
        line.textContent = `> ${msg}`;
        if (isError) line.style.color = 'red';
        $('dev-log').appendChild(line);
        $('dev-log').scrollTop = $('dev-log').scrollHeight;
    };

    document.addEventListener('keydown', (e) => {
        const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
        if ((e.key === '/' || e.key === '`') && !typing && isAdmin()) {
            e.preventDefault();
            setVisible(consoleEl, true);
            input.focus();
            input.value = '/';
        } else if (e.key === 'Escape' && isDevConsoleOpen()) {
            e.stopImmediatePropagation();
            closeDevConsole();
        }
    }, true);

    input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const raw = input.value.trim();
        if (!raw) return;
        input.value = '';
        if (!isAdmin()) return closeDevConsole();
        log(raw);
        try {
            run(raw, engine, log);
        } catch (err) {
            log(`[ERROR] ${err.message}`, true);
        }
    });

    // Signing out (or into a non-admin account) closes it.
    on('account:changed', () => { if (!isAdmin()) closeDevConsole(); });
}

export function closeDevConsole() {
    setVisible($('dev-console'), false);
    $('dev-input').blur();
}

function run(raw, engine, log) {
    const [cmdRaw, argRaw] = raw.split(/\s+/);
    const cmd = cmdRaw.toLowerCase();
    const arg = Number(argRaw);
    const hasArg = argRaw !== undefined && !Number.isNaN(arg);
    const p = !engine.isDemo && !engine.isGameOver && engine.player && !engine.player.isDead ? engine.player : null;
    const needPlayer = () => { if (!p) throw new Error('Must be in a match.'); return p; };
    const needArg = () => { if (!hasArg) throw new Error(`Usage: ${cmd} <number>`); return arg; };
    const ok = (msg) => log(`[SUCCESS] ${msg}`);

    const commands = {
        '/level': () => { devSetLevel(needArg()); ok(`Account level set to ${arg}.`); },
        '/claimall': () => { devUnlockAll(); ok('Unlocked all cosmetics!'); },
        '/kills': () => { devSetHourly('kills', needArg()); ok(`Hourly kills set to ${arg}.`); },
        '/dist': () => { devSetHourly('distance', needArg()); ok(`Hourly distance set to ${arg}.`); },
        '/time': () => { devSetHourly('time', needArg()); ok(`Hourly time set to ${arg}.`); },
        '/statpoints': () => { devSetHourly('points', needArg()); ok(`Hourly points set to ${arg}.`); },
        '/god': () => { const pl = needPlayer(); pl.maxHealth = pl.health = 9999999; pl.regen = 9999; ok('God mode enabled.'); },
        '/heal': () => { const pl = needPlayer(); pl.health = pl.maxHealth; ok('Health restored.'); },
        '/score': () => { const pl = needPlayer(); pl.points += needArg(); pl.upgradeProgress += arg; ok(`Added ${arg} score.`); },
        '/speed': () => { needPlayer().speed = needArg(); ok(`Speed set to ${arg}.`); },
        '/damage': () => { needPlayer().baseDamage = needArg(); ok(`Damage set to ${arg}.`); },
        '/firerate': () => { needPlayer().fireRate = needArg(); ok(`Fire rate set to ${arg}.`); },
        '/multishot': () => { needPlayer().multiShot = needArg(); ok(`Multishot set to ${arg}.`); },
        '/spikes': () => { const pl = needPlayer(); pl.spikes = needArg(); pl.frontVisual = 'spikes'; ok(`Spikes set to ${arg}.`); },
        '/orbiters': () => { needPlayer().orbiters = needArg(); ok(`Orbiters set to ${arg}.`); },
        '/missiles': () => { needPlayer().missiles = needArg(); ok(`Missiles set to ${arg}.`); },
        '/size': () => { const pl = needPlayer(); pl.size = pl.baseSize = needArg(); ok(`Size set to ${arg}.`); },
        '/tiny': () => { const pl = needPlayer(); pl.size = pl.baseSize = 5; ok('You are now tiny.'); },
        '/giant': () => { const pl = needPlayer(); pl.size = pl.baseSize = 150; pl.maxHealth += 5000; pl.health += 5000; ok('You are now a giant boss.'); },
        '/suicide': () => { engine.kill(needPlayer(), null); ok('Goodbye cruel world.'); },
        '/nuke': () => {
            for (const bot of [...engine.bots]) engine.kill(bot, p);
            ok('Destroyed all enemies.');
        },
        '/freeze': () => {
            for (const bot of engine.bots) {
                if (bot.frozenSpeed === undefined) bot.frozenSpeed = bot.speed;
                bot.speed = 0;
            }
            ok('Enemies frozen.');
        },
        '/unfreeze': () => {
            for (const bot of engine.bots) {
                if (bot.frozenSpeed !== undefined) bot.speed = bot.frozenSpeed;
                delete bot.frozenSpeed;
            }
            ok('Enemies unfrozen.');
        },
        '/shake': () => { engine.camera.shake = needArg(); ok(`Screen shake = ${arg}.`); },
        '/storm': () => {
            Object.assign(engine.storm, {
                active: true, x: engine.worldSize / 2, y: engine.worldSize / 2,
                startRadius: hasArg ? arg : STORM.startRadius, startedAt: performance.now(), delaySeconds: 0
            });
            ok('Storm triggered.');
        },
        '/slot': () => {
            const pl = needPlayer();
            engine.slotMachines = [];
            engine.slotMachines.push(new LuckySlotMachine(pl.x + 100, pl.y));
            ok('Spawned a Lucky Slot Machine nearby.');
        },
        '/ability': () => {
            const pl = needPlayer();
            if (!isAbility(argRaw)) throw new Error(`Unknown ability. Try: ${UPGRADE_POOL.filter(u => u.isActiveAbility).map(u => u.id).join(', ')}`);
            pl.activeAbility = argRaw;
            pl.upgrades[argRaw] = 1;
            engine.refreshBadges();
            ok(`Ability set to ${argRaw}.`);
        },
        '/cooldown': () => { const pl = needPlayer(); pl.abilityMaxCooldown = pl.dashMaxCooldown = hasArg ? arg : 0; ok('Cooldowns modified.'); },
        '/maxupgrades': () => {
            const pl = needPlayer();
            for (const upg of UPGRADE_POOL) {
                if (upg.isActiveAbility) continue;
                while (pl.applyUpgrade(upg.id)) { /* until maxed */ }
            }
            engine.refreshBadges();
            ok('ALL UPGRADES MAXED!');
        },
        '/questsdone': () => {
            const rewards = completeAllQuests();
            addAccountXP(rewards.reduce((sum, r) => sum + (r.xp || 0), 0));
            emit('profile:changed');
            ok(`Finished ${rewards.filter(r => r.kind === 'quest').length} quests (+${rewards.length - rewards.filter(r => r.kind === 'quest').length} bonus rewards).`);
        },
        '/questsreset': () => { resetQuests(); emit('profile:changed'); ok('Quest progress reset for today and this week.'); },
        '/tutorial': () => { setTutorialDone(false); ok('The tutorial will play in your next solo match.'); },
        '/close': () => closeDevConsole(),
        '/exit': () => closeDevConsole(),
        '/help': () => log('Commands: ' + Object.keys(commands).join(', '))
    };

    const handler = commands[cmd];
    if (!handler) throw new Error(`Unknown command "${cmd}". Type /help`);
    handler();
}
