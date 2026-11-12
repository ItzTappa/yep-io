// Admin console and admin menu. Only for accounts listed in ADMIN_USERNAMES (config.js), while
// signed in.
//   /     (once)  the console: type a command, e.g. /speed 20. Type /help for the list.
//   / /   (twice, quickly) the admin menu: buttons for every command, with search and tabs.
//   `     the console straight away.
// The commands themselves live in admin/commands.js.
import { $, setVisible } from '../core/dom.js';
import { ADMIN_USERNAMES } from '../config.js';
import { state } from '../core/state.js';
import { on } from '../core/events.js';
import { findCommand, runCommand } from '../admin/commands.js';
import { AdminEffects } from '../admin/effects.js';
import { initAdminMenu, openAdminMenu, closeAdminMenu, isAdminMenuOpen } from './adminMenu.js';

const DOUBLE_PRESS_MS = 300;

export const isAdmin = () => ADMIN_USERNAMES.includes(state.account.username);
export const isDevConsoleOpen = () => !$('dev-console').classList.contains('hidden');

export function initDevConsole(engine) {
    engine.admin = new AdminEffects();
    initAdminMenu(engine);
    const input = $('dev-input');
    let slashTimer = null;

    const openConsole = () => {
        closeAdminMenu();
        setVisible($('dev-console'), true);
        input.focus();
        input.value = '/';
    };

    document.addEventListener('keydown', (e) => {
        const typing = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
        if (e.key === 'Escape' && (isDevConsoleOpen() || isAdminMenuOpen())) {
            e.stopImmediatePropagation();
            closeDevConsole();
            closeAdminMenu();
            return;
        }
        if (typing || !isAdmin()) return;
        if (e.key === '`') {
            e.preventDefault();
            openConsole();
        } else if (e.key === '/') {
            e.preventDefault();
            if (isAdminMenuOpen()) return closeAdminMenu();
            if (slashTimer) {
                // second press: the menu, never the console
                clearTimeout(slashTimer);
                slashTimer = null;
                openAdminMenu();
            } else {
                slashTimer = setTimeout(() => {
                    slashTimer = null;
                    openConsole();
                }, DOUBLE_PRESS_MS);
            }
        }
    }, true);

    input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const raw = input.value.trim();
        if (!raw) return;
        input.value = '';
        if (!isAdmin()) return closeDevConsole();
        log(raw);
        const [name, ...rest] = raw.split(/\s+/);
        const cmd = findCommand(name);
        if (!cmd) return log(`[ERROR] Unknown command "${name}". Type /help`, true);
        if (cmd.name === 'close') return closeDevConsole();
        try {
            const message = runCommand(engine, cmd, rest.join(' ') || undefined);
            if (message) log(`[SUCCESS] ${message}`);
        } catch (err) {
            log(`[ERROR] ${err.message}`, true);
        }
    });

    // Signing out (or into a non-admin account) closes everything.
    on('account:changed', () => {
        if (isAdmin()) return;
        closeDevConsole();
        closeAdminMenu();
    });
}

function log(msg, isError = false) {
    const line = document.createElement('div');
    line.textContent = `> ${msg}`;
    if (isError) line.style.color = 'red';
    $('dev-log').appendChild(line);
    $('dev-log').scrollTop = $('dev-log').scrollHeight;
}

export function closeDevConsole() {
    setVisible($('dev-console'), false);
    $('dev-input').blur();
}
