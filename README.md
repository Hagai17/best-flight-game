# Kestrel Valley Air Rally

[![make.fun bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Hagai17/best-flight-game/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Hagai17/best-flight-game/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

A complete little flight game in the browser, with its own hand-written 3D renderer —
no libraries, no assets, no network. You fly the Kestrel K-1, a cream-and-red bush
plane, out of a grass strip in a river valley.

**The sortie:** take off northbound, thread six rings up the valley and back down the
east ridge, drop a supply crate on Kestrel Town's square, then come home and land for a
grade — perfect, good, firm or hard. Underneath the tour sit real decisions: throttle
and turn discipline (bank steep and you sink), a stall that drops the nose and shakes
the airframe, flaps that trade speed for lift on final, a fuel gauge that punishes
joyriding, and a damage meter that remembers every tree-top and heavy arrival. A free
flight mode keeps the same valley with no clock.

**Controls:** arrows pitch and bank · A/D rudder · W/S throttle · F flaps · B or Space
brakes · X drop the crate · C chase/cockpit camera · P pause · R restart · M mute — or
steer with the mouse and roll the wheel for throttle.

## Layout

- `main.ts` — the hand-in: copies `game/` and `screenshots/` to the output directory
  and writes `dossier.json` with the kit's vendored builder.
- `game/` — the game itself. `game/index.html` opens it; `game/src/` is split one job
  per file: `terrain.js` (the valley heightfield), `renderer3d.js` (the software 3D
  renderer), `aircraft.js` (flight physics and the aeroplane), `scenery.js` (runway,
  town, rings), `missions.js` (the sortie), `hud.js` (instruments), `input.js`,
  `audio.js` (synthesised engine, wind and warnings), `main.js` (the loop).
- `screenshots/` — four stills rendered by the game's own staged-scene mode
  (`game/src/shots.js`), first is the cover.
- `serve.ts` — a tiny local server for playing during development:
  `node serve.ts` then open http://localhost:8080.

## License

MIT — see `LICENSE`.

SPDX-License-Identifier: MIT
