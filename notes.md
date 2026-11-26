# Design notes — Kestrel Valley Air Rally

## What the game is

An original 3D flight game for the browser, written from scratch for this bounty:
a hand-rolled software 3D renderer on a 2D canvas (perspective projection, near-plane
clipping, painter's-algorithm depth sort, sun flat-shading, distance fog), an analytic
terrain heightfield, a small flight model, and a complete sortie structure. No game
engine, no libraries, no copied code — the only vendored file is the kit's own
`vendor/makefun-game.ts`, copied unchanged as the format requires.

## The sortie

1. **Take off** northbound from the home strip (rotate at 27 m/s, mind the trees).
2. **Six rings**: up the river valley climbing, then back down the east ridge. Each
   ring pays points; finishing the set quickly pays a time bonus.
3. **Supply drop**: release the crate (X) over Kestrel Town's square; it keeps the
   aeroplane's velocity and falls under gravity, scored by distance from the centre.
4. **Land** back on the strip, northbound, and stop: graded perfect / good / firm /
   hard by sink rate, with penalties for landing off the strip or arriving bent.

Free flight mode: same valley, rings pay as you find them, land whenever.

## Flight model decisions

- Banked turns use the real relation (turn rate ∝ tan(roll) / speed), so steep banks
  at low speed genuinely cost height — the core skill of the ring course.
- Lift scales with speed² against a stall speed that flaps lower (25 → 19.5 m/s);
  a stall drops the nose, adds sink and shakes the airframe, with a beeper.
- Fuel burns with throttle; damage accrues from terrain scrapes, hard arrivals and
  flying through trees, and is charged against the final score.
- Touchdown grading reads sink rate, bank, slope and strip position at the moment of
  contact, so a greased landing and a slammed one feel — and pay — differently.

## How it answers the judging criteria

1. **A complete flight game in the stills** — cover: just airborne off the strip,
   gear down, instruments lit, first ring marked ahead. Then: the ring course, the
   town drop approach, and a flaps-down final with the runway, threshold bars and
   PAPI lights ahead. HUD shows altitude, speed and heading throughout.
2. **Fun and depth** — a four-leg sortie with different goals per leg, plus fuel,
   damage, stall and landing-grade decisions underneath.
3. **Feel and polish** — smoothed chase camera with stall shake, a cockpit view,
   synthesised engine/wind audio, a ground shadow as a height cue, PULL UP and STALL
   warnings, graded landings and a full score breakdown.
4. **Look and originality** — one flat-shaded low-poly style end to end; the K-1 is
   built from parts (high wing, struts, spatted gear, spinning prop with blur disc);
   the gauges are drawn as instruments, not text readouts.
5. **Structure** — `game/src/` is one job per file, named for what it does:
   terrain, renderer, aircraft, scenery, missions, HUD, input, audio.

## Screenshot staging

`game/src/shots.js` flies the real simulation with a small autopilot into the four
cover scenes (takeoff, rings, drop, landing); the screenshots are unretouched renders
of the game's own code at 1280×720, produced by loading `?shot=<name>` URLs.
