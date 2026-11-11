// Name pools for bots. Most get a "real" name or a gamer tag; a few get a joke or super-rare name.
const REAL_NAMES = ["John", "Sarah", "Mike", "Emily", "David", "Jessica", "Chris", "Ashley", "Matthew", "Amanda", "Joshua", "Megan", "Andrew", "Brittany", "James", "Samantha", "Daniel", "Lauren", "Joseph", "Nicole", "Kevin", "Kayla", "Jason", "Tyler", "Brian", "Rachel", "Eric", "Elizabeth", "Ryan", "Jacob", "Gary", "Nicholas", "Adam", "Justin", "Brandon", "Kelly", "Frank", "Christina", "Scott", "Melissa", "Larry", "Rebecca", "Stephen", "Victoria", "Timothy", "Stephanie", "Richard", "Amy", "Patrick", "Laura", "Edward", "Mary", "Colin", "Michelle", "Peter", "Tiffany", "Mark", "Katherine", "Walter", "Andrea"];
const GAMER_TAGS = ["ProGamer", "Sniper", "Shadow", "Vortex", "Rogue", "Noob", "King", "Queen", "Titan", "Spectre", "Ghost", "Dragon", "Wolf", "Demon", "Angel", "Slayer", "Hunter", "Warrior", "Tank", "Healer", "Ninja", "Samurai", "Pirate", "Cyborg", "Alien", "Mutant", "Zombie", "Vampire", "Reaper", "Death", "Chaos", "Havoc", "Phantom", "Spirit", "Soul", "TTV_Sweat", "discord_mod", "hacker_man", "aimbot.exe", "wallhack", "pay_to_win"];
const FUNNY_NAMES = ["I_LAG_A_LOT", "mom_pull_the_plug", "ur_trash_kid", "free_xp", "plz_dont_kill", "touch_grass", "ping_999", "skill_issue", "Error_404", "NoobSlayer9000", "ctrl_alt_del", "try_harder", "qwerty", "asdfgh", "123456", "user7712", "guest_999", "bruh"];
const SUPER_RARE = ["A", "X", "Z", "7", "Q", "God", "Omega"];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function randomBotName() {
    const roll = Math.random();
    if (roll < 0.01) return pick(SUPER_RARE);
    if (roll < 0.15) return pick(FUNNY_NAMES);
    if (roll < 0.50) {
        const tag = pick(GAMER_TAGS);
        return Math.random() > 0.5 ? tag + Math.floor(Math.random() * 9999) : tag;
    }
    const name = pick(REAL_NAMES);
    return Math.random() > 0.7 ? name + Math.floor(Math.random() * 99) : name;
}
