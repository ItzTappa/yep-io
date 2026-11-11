// The "CHOOSE UPGRADE" cards (press 1 / 2 / 3, or tap a card).
import { $, setVisible } from '../../core/dom.js';
import { abilityName } from '../../data/upgrades.js';

export function showUpgradeCards(choices, player) {
    for (let i = 0; i < 3; i++) {
        const choice = choices[i];
        const card = $(`card-${i + 1}`);
        if (!choice) {
            card.style.display = 'none';
            continue;
        }
        card.className = 'card';
        const title = $(`title-${i + 1}`);
        if (choice.isActiveAbility) {
            card.classList.add('ability-card');
            title.innerHTML = '⭐ ABILITY:<br/>';
            title.append(abilityName(choice.id).toUpperCase());
        } else {
            const tier = player.upgrades[choice.id] || 0;
            if (tier > 0) card.classList.add(`card-t${Math.min(4, tier)}`);
            title.textContent = `${choice.title} [T${tier + 1}]`;
        }
        $(`desc-${i + 1}`).textContent = choice.desc;
        card.style.display = 'block';
    }
    setVisible($('upgrade-ui'), true);
}

export function hideUpgradeCards() {
    setVisible($('upgrade-ui'), false);
}
