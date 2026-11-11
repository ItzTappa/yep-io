// Lobby invite popups from friends ("LOBBY INVITE - From: name - JOIN LOBBY").
import { $ } from '../core/dom.js';
import { slideIn } from '../core/dom.js';
import { state } from '../core/state.js';
import { on } from '../core/events.js';
import { sounds } from '../core/sound.js';
import { activeInvites, clearInvites } from '../services/friends.js';
import { requireClass, switchTab } from './menu.js';
import { joinLobby } from './lobbyScreen.js';
import { showError } from './toast.js';

const shown = new Set();

export function initInvites() {
    on('social:changed', () => {
        for (const invite of activeInvites()) {
            const key = `${invite.fromUid}:${invite.timestamp}`;
            if (shown.has(key)) continue;
            shown.add(key);
            showInvite(invite);
        }
        clearInvites(); // tidy up expired invites in the background
    });
}

function showInvite(invite) {
    const box = $('invite-template').content.firstElementChild.cloneNode(true);
    box.querySelector('.invite-sender-name').textContent = `From: ${invite.fromName}`;
    const btn = box.querySelector('.accept-invite-btn');
    btn.addEventListener('click', async () => {
        if (await joinInvite(invite, btn)) box.hideNotif?.();
    });
    // In a match the popup joins the HUD notifications; otherwise it shows over the menu.
    (state.inMatch ? $('notif-queue') : $('menu-invite-queue')).appendChild(box);
    sounds.play('notification', { category: 'alert' });
    slideIn(box, 15000, { removeWhenDone: true });
}

export async function joinInvite(invite, button) {
    if (state.inMatch) {
        showError('FINISH YOUR MATCH FIRST');
        return false;
    }
    if (!state.selectedClass) {
        switchTab('lobby');   // the class buttons are on the Lobby tab
        requireClass();       // shows "PLEASE SELECT A CLASS FIRST!"
        return false;
    }
    const joined = await joinLobby(invite.code, button);
    if (joined) clearInvites(invite.fromUid);
    return joined;
}
