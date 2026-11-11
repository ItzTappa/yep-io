// The ship you control.
import { Entity } from './Entity.js';
import { bodyColorFor, loadoutForClass } from '../data/items.js';

export class Player extends Entity {
    constructor(x, y, type, name = '', equipped = null) {
        super(x, y, type);
        this.name = name;
        this.isPlayer = true;
        this.team = 'players';
        this.setLoadout(equipped);
    }

    setLoadout(equipped) {
        this.equipped = loadoutForClass(equipped, this.type);
        this.color = bodyColorFor(this.equipped);
    }
}
