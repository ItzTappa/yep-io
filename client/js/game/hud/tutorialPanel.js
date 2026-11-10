// The tutorial box (see game/tutorial.js): step counter, title, explanation and its buttons.
//   CONTINUE (or Enter)   on explanation-only steps
//   SKIP TUTORIAL         goes straight into a real match
//   PLAY A MATCH / BACK TO MENU   when it's finished
import { $, setVisible } from '../../core/dom.js';

let actionHandler = null;
const ACTION_BUTTONS = { 'tut-skip-btn': 'skip', 'tut-next-btn': 'next', 'tut-play-btn': 'play', 'tut-menu-btn': 'menu' };

export function initTutorialPanel() {
    for (const [id, action] of Object.entries(ACTION_BUTTONS)) {
        $(id).addEventListener('click', (e) => {
            e.currentTarget.blur(); // so Space (dash) can't press it again
            actionHandler?.(action);
        });
    }
    window.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !actionHandler || $('tutorial-panel').classList.contains('hidden')) return;
        if (!$('tut-next-btn').classList.contains('hidden')) actionHandler('next');
        else if (!$('tut-play-btn').classList.contains('hidden')) actionHandler('play');
    });
}

// fn(action) with action = 'skip' | 'next' | 'play' | 'menu' (null to stop listening).
export function onTutorialAction(fn) {
    actionHandler = fn;
}

// html may contain <kbd>/<b>; it only ever comes from game/tutorial.js, never from players.
export function showTutorialStep({ step, total, title, html, info = false, last = false }) {
    const panel = $('tutorial-panel');
    $('tut-step').textContent = last ? 'TRAINING COMPLETE' : `STEP ${step} OF ${total}`;
    $('tut-title').textContent = title;
    $('tut-text').innerHTML = html;
    setVisible($('tut-skip-btn'), !last);
    setVisible($('tut-next-btn'), info);
    setVisible($('tut-play-btn'), last);
    setVisible($('tut-menu-btn'), last);
    setVisible($('tut-actions'), info || last);
    panel.classList.remove('done');
    panel.classList.toggle('last', last);
    setVisible(panel, true);
    panel.classList.remove('pop');
    void panel.offsetWidth; // replay the pop-in for every new step
    panel.classList.add('pop');
}

export function markTutorialStepDone() {
    $('tutorial-panel').classList.add('done');
}

export function hideTutorial() {
    setVisible($('tutorial-panel'), false);
}
