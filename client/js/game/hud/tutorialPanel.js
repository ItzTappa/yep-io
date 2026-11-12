// The tutorial box at the top of the screen (see game/tutorial.js).
import { $, setVisible } from '../../core/dom.js';

let skipHandler = null;

export function initTutorialPanel() {
    $('tut-skip-btn').addEventListener('click', () => skipHandler?.());
}

export function onTutorialSkip(fn) {
    skipHandler = fn;
}

// html may contain <kbd> key caps; it only ever comes from game/tutorial.js, never from players.
export function showTutorialStep({ step, total, title, html, done = false, last = false }) {
    const panel = $('tutorial-panel');
    $('tut-step').textContent = last ? 'TUTORIAL COMPLETE' : `STEP ${step} / ${total}`;
    $('tut-title').textContent = title;
    $('tut-text').innerHTML = html;
    setVisible($('tut-skip-btn'), !last);
    panel.classList.toggle('done', done);
    panel.classList.toggle('last', last);
    if (panel.classList.contains('hidden')) {
        setVisible(panel, true);
        panel.classList.remove('pop');
        requestAnimationFrame(() => panel.classList.add('pop'));
    }
}

export function markTutorialStepDone() {
    $('tutorial-panel').classList.add('done');
}

export function hideTutorial() {
    setVisible($('tutorial-panel'), false);
}
