// Arrows at the edge of the screen pointing to off-screen teammates.
import { $ } from '../../core/dom.js';
import { distance } from '../../core/math.js';

const pointers = new Map(); // teammate uid -> { arrow, label }

function pointerFor(mate) {
    let ptr = pointers.get(mate.uid);
    if (!ptr) {
        const arrow = document.createElement('div');
        arrow.className = 'teammate-arrow';
        const label = document.createElement('div');
        label.className = 'teammate-label';
        $('teammate-pointers').append(arrow, label);
        ptr = { arrow, label };
        pointers.set(mate.uid, ptr);
    }
    return ptr;
}

export function clearTeammatePointers() {
    for (const { arrow, label } of pointers.values()) {
        arrow.remove();
        label.remove();
    }
    pointers.clear();
}

export function drawTeammatePointers(engine) {
    const p = engine.player;
    const show = !engine.intro.active && p && !p.isDead;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const radius = Math.min(cx, cy) - 60;
    const viewRadius = (engine.width / 2) / engine.camera.zoom;
    const seen = new Set();

    for (const mate of engine.remotes) {
        if (!mate.isTeammate) continue;
        seen.add(mate.uid);
        const ptr = pointerFor(mate);
        const visible = show && !mate.isDead && distance(p.x, p.y, mate.x, mate.y) > viewRadius * 0.9;
        ptr.arrow.style.display = visible ? 'block' : 'none';
        ptr.label.style.display = visible ? 'block' : 'none';
        if (!visible) continue;

        const angle = Math.atan2(mate.y - p.y, mate.x - p.x);
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        ptr.arrow.style.left = `${px}px`;
        ptr.arrow.style.top = `${py}px`;
        ptr.arrow.style.borderBottomColor = mate.color;
        ptr.arrow.style.transform = `translate(-50%, -50%) rotate(${angle + Math.PI / 2}rad)`;
        ptr.label.style.left = `${px - Math.cos(angle) * 35}px`;
        ptr.label.style.top = `${py - Math.sin(angle) * 35}px`;
        ptr.label.style.color = mate.color;
        if (ptr.label.textContent !== mate.name) ptr.label.textContent = mate.name;
    }

    for (const [uid, ptr] of pointers) {
        if (seen.has(uid)) continue;
        ptr.arrow.remove();
        ptr.label.remove();
        pointers.delete(uid);
    }
}
