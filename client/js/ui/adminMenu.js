// The admin menu (press / twice): a button for every admin command, with tabs and a search box.
// Opening and closing is handled by ui/devConsole.js; the commands are in admin/commands.js.
import { $, escapeHtml, setVisible } from '../core/dom.js';
import { sounds } from '../core/sound.js';
import { COMMANDS, TABS, blockedReason, runCommand, findCommand } from '../admin/commands.js';

const NEED_LABELS = { match: 'IN MATCH', world: 'SOLO / HOST', solo: 'SOLO' };

let engine = null;
let tab = 'all';
let refreshTimer = null;

export const isAdminMenuOpen = () => !$('admin-menu').classList.contains('hidden');

export function initAdminMenu(gameEngine) {
    engine = gameEngine;
    $('admin-close').addEventListener('click', closeAdminMenu);
    $('admin-search').addEventListener('input', render);
    $('admin-search').addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const matches = visibleCommands();
        if (matches.length === 1) run(matches[0]);
    });
    $('admin-tabs').addEventListener('click', (e) => {
        const btn = e.target instanceof Element ? e.target.closest('[data-tab]') : null;
        if (!btn) return;
        tab = btn.dataset.tab;
        $('admin-search').value = '';
        render();
    });
    $('admin-grid').addEventListener('click', (e) => {
        const btn = e.target instanceof Element ? e.target.closest('.admin-run') : null;
        if (!btn) return;
        btn.blur(); // so Space (dash) can't press it again
        run(findCommand(btn.dataset.cmd));
    });
    $('admin-grid').addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return;
        run(findCommand(e.target.dataset.cmd));
    });
}

export function openAdminMenu() {
    setVisible($('admin-menu'), true);
    $('admin-search').value = '';
    render();
    $('admin-search').focus();
    clearInterval(refreshTimer);
    // Keep "start a match first" / ON states current while it's open.
    refreshTimer = setInterval(() => { if (isAdminMenuOpen()) refreshStates(); }, 1000);
}

export function closeAdminMenu() {
    clearInterval(refreshTimer);
    refreshTimer = null;
    setVisible($('admin-menu'), false);
    if (document.activeElement?.closest?.('#admin-menu')) document.activeElement.blur();
}

function visibleCommands() {
    const query = $('admin-search').value.trim().toLowerCase().replace(/^\//, '');
    return COMMANDS.filter(cmd => {
        if (cmd.consoleOnly) return false;
        if (query) return cmd.name.includes(query) || cmd.desc.toLowerCase().includes(query);
        return tab === 'all' || cmd.tab === tab;
    });
}

function render() {
    const searching = $('admin-search').value.trim() !== '';
    $('admin-tabs').innerHTML = TABS.map(t => {
        const count = COMMANDS.filter(c => !c.consoleOnly && (t.id === 'all' || c.tab === t.id)).length;
        const active = searching ? t.id === 'all' : t.id === tab;
        return `<button class="admin-tab ${active ? 'active' : ''}" data-tab="${t.id}">${t.label}<span>${count}</span></button>`;
    }).join('');

    const list = visibleCommands();
    $('admin-grid').innerHTML = list.length ? list.map(card).join('') : '<div class="admin-empty">No commands match your search.</div>';
    refreshStates();
}

function card(cmd) {
    const input = cmd.arg
        ? `<input class="admin-arg" data-cmd="${cmd.name}" type="${cmd.arg.type === 'number' ? 'number' : 'text'}" value="${escapeHtml(cmd.arg.default)}" placeholder="${escapeHtml(cmd.arg.hint)}" aria-label="${escapeHtml(cmd.arg.hint)}" step="any">`
        : '';
    return `
        <div class="admin-cmd ${cmd.on ? 'toggle' : ''}" data-cmd="${cmd.name}">
            <div class="admin-cmd-top">
                <span class="admin-cmd-name">/${cmd.name}</span>
                ${cmd.needs ? `<span class="admin-tag">${NEED_LABELS[cmd.needs]}</span>` : ''}
            </div>
            <div class="admin-cmd-desc">${escapeHtml(cmd.desc)}</div>
            <div class="admin-cmd-run">
                ${input}
                <button class="admin-run" data-cmd="${cmd.name}">${cmd.on ? 'OFF' : 'RUN'}</button>
            </div>
        </div>`;
}

// Toggle ON/OFF labels and which commands can't run right now.
function refreshStates() {
    for (const el of document.querySelectorAll('#admin-grid .admin-cmd')) {
        const cmd = findCommand(el.dataset.cmd);
        const blocked = blockedReason(engine, cmd);
        el.classList.toggle('blocked', !!blocked);
        el.title = blocked || '';
        if (cmd.on) {
            const isOn = !blocked && !!cmd.on(engine);
            el.classList.toggle('on', isOn);
            el.querySelector('.admin-run').textContent = isOn ? 'ON' : 'OFF';
        }
    }
}

function run(cmd) {
    if (!cmd) return;
    const input = document.querySelector(`#admin-grid .admin-arg[data-cmd="${cmd.name}"]`);
    try {
        const message = runCommand(engine, cmd, input ? input.value : undefined);
        status(message || 'Done.', false);
        sounds.play('ui_claim', { category: 'ui', volume: 0.6 });
    } catch (err) {
        status(err.message, true);
        sounds.play('ui_error', { category: 'ui' });
    }
    refreshStates();
}

function status(text, isError) {
    const el = $('admin-status');
    el.textContent = `${isError ? '✖' : '✔'} ${text}`;
    el.classList.toggle('error', isError);
    el.classList.toggle('ok', !isError);
}
