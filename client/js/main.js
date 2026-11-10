// yep.io entry point: starts the arena behind the menu, sets up every menu, connects to the game
// server and Firebase, and switches between the menus and matches.
import { $, setVisible } from './core/dom.js';
import { state } from './core/state.js';
import { emit, on } from './core/events.js';
import { settings } from './core/settings.js';
import { sounds } from './core/sound.js';
import { DEV_TOOLS_ENABLED } from './config.js';
import { GameEngine } from './game/GameEngine.js';
import { applyHudSettings } from './game/hud/hud.js';
import { network } from './services/network.js';
import { initAccount, setInGame } from './services/account.js';
import { addAccountXP, recordMatch, setTutorialDone, grantItem, grantOwnerBanner } from './services/profile.js';
import { startQuestMatch, trackQuestStat, reportQuestBest, endQuestMatch } from './services/quests.js';
import { startShopClock } from './services/shop.js';
import { initMenu, switchTab } from './ui/menu.js';
import { initLobbyScreen, setModeListOpen } from './ui/lobbyScreen.js';
import { initLocker, lockerCategory } from './ui/locker.js';
import { initStores } from './ui/stores.js';
import { initStats } from './ui/stats.js';
import { initQuests } from './ui/quests.js';
import { initTutorialPanel } from './game/hud/tutorialPanel.js';
import { initPreviews, closePreview, isPreviewOpen } from './ui/previews.js';
import { initAccountModal, closeAccountModal } from './ui/accountModal.js';
import { initInvites } from './ui/invites.js';
import { initSettingsModal, applyAndClose, isSettingsOpen } from './ui/settingsModal.js';
import { initMasteryModal, closeMasteryModal } from './ui/masteryModal.js';
import { playSlotMachine, hideSlotMachine } from './ui/slotMachineUI.js';
import { initDevConsole } from './ui/devConsole.js';

sounds.setVolume(settings.volume);

const engine = new GameEngine($('gameCanvas'), {
    addAccountXP,
    onMatchStart: (info) => startQuestMatch(info),
    onStat: (stat, amount) => trackQuestStat(stat, amount),
    onStatBest: (stat, value) => reportQuestBest(stat, value),
    onMatchQuests: (summary) => endQuestMatch(summary),
    onMatchEnd: (summary) => recordMatch(summary),
    onSlotMachine: () => playSlotMachine(engine),
    localName: () => state.account.username || '',
    // Finishing the tutorial gives the Graduate banner; skipping or leaving just marks it seen.
    onTutorialDone: (completed) => {
        setTutorialDone(true);
        if (completed) grantItem('t_graduate');
    },
    onTutorialExit: (choice) => {
        hideSlotMachine();
        if (choice === 'play') startSolo(engine.player?.type || state.selectedClass || 'circle');
        else returnToMenu();
    }
});
if (DEV_TOOLS_ENABLED) window.game = engine; // handy in the browser console while developing
engine.startDemo();

// ---------- menus <-> matches ----------

function enterMatch() {
    state.inMatch = true;
    closePreview();
    setVisible($('main-menu'), false);
    setInGame(true);
}

// PLAY: new players go to the training arena first.
function startSolo(classType) {
    if (!state.profile.tutorialDone) return startTutorial(classType);
    enterMatch();
    engine.startSolo(classType, { equipped: state.profile.equipped });
}

function startTutorial(classType) {
    enterMatch();
    engine.startTutorial(classType, { equipped: state.profile.equipped });
}

function startMultiplayerMatch(match) {
    if (!state.lobby) return;
    enterMatch();
    engine.startMultiplayer(match, network, { equipped: state.profile.equipped });
}

function returnToMenu() {
    // Back to where the match started from: the multiplayer lobby, or the main lobby for solo
    // (you can be sitting in a multiplayer lobby while playing solo).
    const fromLobby = engine.isMultiplayer && !!state.lobby;
    state.inMatch = false;
    hideSlotMachine();
    engine.startDemo();
    setVisible($('main-menu'), true);
    setInGame(false);
    if (fromLobby) {
        network.returnedToLobby();
        switchTab('multiplayer');
    } else {
        switchTab('lobby');
    }
    emit('profile:changed');
}

$('return-lobby-btn').addEventListener('click', returnToMenu);
network.on('match:hostChanged', ({ hostId }) => engine.net?.onHostChanged(hostId));
network.on('match:playerLeft', ({ id }) => engine.net?.onPlayerLeft(id));
network.on('disconnected', () => engine.onConnectionLost());

// Esc closes whatever popup is open; in a match it asks to leave (press twice).
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (isPreviewOpen()) return closePreview();
    if (!$('mastery-modal').classList.contains('hidden')) return closeMasteryModal();
    if (!$('account-modal').classList.contains('hidden')) return closeAccountModal();
    if (isSettingsOpen()) return applyAndClose();
    if (!$('mode-options').classList.contains('hidden')) return setModeListOpen(false);
    if (state.inMatch) engine.requestForfeit();
});

// ---------- start everything ----------

initMenu({ onPlay: startSolo });
initLobbyScreen({ onMatchStart: startMultiplayerMatch });
initLocker();
initStores();
initStats();
initQuests();
initTutorialPanel();
initPreviews({ getLockerCategory: lockerCategory });
initAccountModal();
initInvites();
initSettingsModal({
    onApply: () => {
        applyHudSettings();
        if (state.inMatch) engine.refreshBadges();
    },
    onPlayTutorial: () => {
        if (!state.inMatch) startTutorial(state.selectedClass || 'circle');
    }
});
initMasteryModal();
initDevConsole(engine);
startShopClock();
network.connect();
initAccount();
on('account:changed', grantOwnerBanner);
