# yep.io

A browser arena shooter. Pick a class (Jet, Tank, Soldier), collect orbs, choose upgrades, and fight
bots solo or with friends (battle royale teams or 1v1 duels). Progress, cosmetics and friends are
saved with Firebase.

## Run it on your computer

```bash
npm install
npm start          # or: npm run dev   (restarts when server files change)
```

Then open http://localhost:3000.

**Admin tools:** sign in as an admin account (`ADMIN_USERNAMES` in `client/js/config.js`, currently
`chase`). Press `/` once for the console (type `/help`), or `/` twice quickly for the admin menu: buttons
for all 70 commands with tabs (Player, Match, Fun, Progress) and a search box. Works on the live site
too; guests and other accounts can't open either. Commands are listed in `client/js/admin/commands.js`.

## Deploy (Render)

Render runs `npm install` then `npm start`. Nothing else is needed. Notes:

- The free plan sleeps after 15 minutes without visitors, so the first visit after that is slow.
  `GET /health` returns server status if you want an uptime monitor to keep it awake.
- Lobbies live in server memory, so a deploy or restart ends any lobbies in progress.

## Firebase

Accounts are Firebase email/password users (`<username>@yepio.game`); each player's data is the
Firestore document `users/<uid>`. The web keys in `client/js/services/firebase.js` are meant to be public.
What protects the data is **`firestore.rules`**. Paste it into Firebase console > Firestore Database >
Rules and click Publish. If Firebase can't be reached, the game still works for guests.

## Where things are

```
server/
  server.js            Starts Express (serves client/) and socket.io
  config.js            Lobby sizes, countdown length, message rate limits
  lobbyManager.js      Multiplayer lobbies: create/join/leave, ready, mode, match start/end, host hand-off
  matchRelay.js        Forwards in-match messages between the players of a lobby
  sanitize.js          Cleans player names/loadouts before other players see them

client/
  index.html           All screens (menu tabs, popups, in-match HUD)
  css/                 base, menu, lobby, store (stats/locker/shops), quests, modals, hud, admin, mobile
  assets/sounds/       Sound effects
  js/
    main.js            Entry point: wires everything together, switches menu <-> match
    config.js          Gameplay numbers (map sizes, bot counts, storm speed, network rates...)

    data/              Pure data, no logic
      classes.js         Class stats and descriptions
      upgrades.js        Every upgrade and ability (+ tier colours)
      items.js           Every cosmetic (season, hourly shop, mastery skins)
      quests.js          Daily/weekly quest pools, XP rewards and the weekly Bonus Goals
      botNames.js        Bot name pools

    core/              Small shared helpers
      state.js           Shared app state (profile, account, lobby, selected class)
      events.js          Event bus (profile:changed, lobby:changed, ...)
      settings.js        Player settings + key bindings (saved in the browser)
      sound.js           Sound effects player
      math.js, dom.js    Helpers

    entities/          Things in the arena
      Entity.js          Base ship: stats, upgrades, dash, abilities, movement
      Player.js          Your ship
      Bot.js             Bot ships + bot AI
      RemotePlayer.js    Other people in multiplayer (mirrored from their computer)
      Projectile.js      Bullets, missiles, shrapnel, nuke, railgun
      SafeZone.js        Safe zones
      pickups.js         Orbs, particles, Lucky Slot Machine
      upgradePicker.js   Picks the 3 upgrade cards
      geometry.js        Ability durations, orbiter/blade-ring positions (shared by drawing + gameplay)
      render/            How ships look: entityRenderer.js (draw order), skins.js, trails.js,
                         finishes.js (colour paints), upgradeParts.js (guns, pods, auras...), shapes.js

    game/              The match itself
      GameEngine.js      Starts matches, 60 Hz loop, damage/death rules, match results, upgrade cards
      combat.js          Teams, immunity, shot spread, kill XP
      abilities.js       What each E-key ability does (+ shockwave/afterburner)
      input.js           Keyboard, mouse, touch joystick, mobile buttons
      tutorial.js        The training arena (first PLAY, or Settings > Play Tutorial): spawns what
                         each step teaches; you can't die there
      systems/           One file per mechanic: playerControl, bots, collisions (spikes/orbiters),
                         projectiles, orbs, zones (safe zones + storm), slotMachines
      net/matchSync.js   Multiplayer sync (who controls what is explained at the top)
      render/            World drawing, minimap, teammate arrows, damage numbers
      hud/               Points bar, leaderboard, badges, notifications, kill feed, upgrade cards,
                         tutorial box, game over

    admin/             Admin tools (signed-in admins only)
      commands.js        Every admin command (name, tab, input, what it does)
      effects.js         Ongoing command effects: black hole, meteors, rainbow, slow motion...

    services/          Talking to the outside world
      network.js         socket.io client (lobbies + match messages)
      firebase.js        Loads Firebase
      account.js         Login/register/logout and saving progress
      profile.js         XP/levels, match results, claiming/equipping cosmetics
      friends.js         Friend requests, invites, friend profiles
      shop.js            Hourly rotating shop (same items for everyone each hour)
      quests.js          Quest progress: today's/this week's quests, Bonus Goals, what a match adds

    ui/                One file per menu screen or popup
      menu.js            Tabs, class select, PLAY, season level box
      lobbyScreen.js     Multiplayer tab + match countdown
      quests.js          Quests tab (daily, weekly, Bonus Goals, class mastery)
      locker.js, stores.js, stats.js, previews.js
      accountModal.js, invites.js, settingsModal.js, masteryModal.js
      devConsole.js      Admin console (/) and the double-/ shortcut; adminMenu.js is the menu
      slotMachineUI.js, toast.js

firestore.rules        Firestore security rules (publish in the Firebase console)
```

## How multiplayer works

- Lobbies are created on the game server (socket.io). Opening the Multiplayer tab gives you a lobby
  code; friends join with the code or an invite. Leaving or closing the tab removes you instantly.
- In a match, **each player's computer controls their own ship** (movement, health, death) and
  sends it to the others about 20 times a second.
- The **match host** (lobby leader) runs the bots and safe zones and sends them to everyone. Your
  hits on bots are reported to the host, who applies them and announces kills. If the host leaves,
  the server hands the job to another player and the match carries on.
- The storm shrinks by real time, so it is the same size for everyone.
