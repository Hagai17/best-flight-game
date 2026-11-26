// The screenshot scenes behind ?shot=takeoff|rings|drop|landing. Each one puts the real
// aeroplane and the real mission into a genuine mid-flight state and flies it forward
// with a simple autopilot for a second or two, so the frame is what the game actually
// looks like in play — same physics, same HUD, nothing staged that play cannot reach.

import { STEP, WORLD } from './config.js';
import { RINGS, DROP_ZONE } from './missions.js';
import { groundHeight } from './terrain.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function makeControl(overrides = {}) {
  return { elevator: 0, aileron: 0, rudder: 0, throttle: 0, flaps: false, brakes: false, ...overrides };
}

/** Points the autopilot at a world target: bank toward its bearing, pitch toward it. */
function steerTo(plane, control, target) {
  const dx = target[0] - plane.pos[0];
  const dy = target[1] - plane.pos[1];
  const dz = target[2] - plane.pos[2];
  const desiredHeading = Math.atan2(dx, -dz);
  let dh = desiredHeading - plane.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  control.aileron = clamp(dh * 1.7, -1, 1);
  const horiz = Math.max(20, Math.hypot(dx, dz));
  const desiredPitch = Math.atan2(dy, horiz);
  control.elevator = clamp((desiredPitch - plane.pitch) * 2.8, -1, 1);
}

function flySteps(ctx, count, controlFor) {
  for (let i = 0; i < count; i += 1) {
    const control = controlFor(i);
    ctx.stepOnce(control, STEP);
  }
}

function stageTakeoff(ctx) {
  const { plane } = ctx;
  flySteps(ctx, 214, () => makeControl({
    throttle: 1,
    elevator: plane.speed > 26 ? 0.62 : 0,
  }));
}

function stageRings(ctx) {
  const { plane, mission } = ctx;
  const ring = RINGS[2];
  mission.phase = 'rings';
  mission.ringIndex = 2;
  mission.ringsPassed = [true, true, false, false, false, false];
  mission.ringsFlown = 2;
  mission.score = 300;
  mission.started = true;
  mission.elapsed = 96;
  plane.onGround = false;
  plane.pos = [
    ring.pos[0] - ring.normal[0] * 300,
    ring.pos[1] - ring.normal[1] * 300 + 6,
    ring.pos[2] - ring.normal[2] * 300,
  ];
  plane.heading = Math.atan2(ring.normal[0], -ring.normal[2]);
  plane.pitch = 0.02;
  plane.roll = 0.24;
  plane.speed = 58;
  plane.fuel = 76;
  flySteps(ctx, 105, () => {
    const control = makeControl({ throttle: 0.74 });
    steerTo(plane, control, ring.pos);
    return control;
  });
}

function stageDrop(ctx) {
  const { plane, mission } = ctx;
  mission.phase = 'drop';
  mission.ringIndex = 6;
  mission.ringsPassed = [true, true, true, true, true, true];
  mission.ringsFlown = 6;
  mission.score = 1150;
  mission.started = true;
  mission.elapsed = 214;
  plane.onGround = false;
  plane.pos = [420, groundHeight(420, -690) + 118, -690];
  plane.heading = Math.atan2(DROP_ZONE.x - plane.pos[0], -(DROP_ZONE.z - plane.pos[2]));
  plane.pitch = -0.03;
  plane.speed = 47;
  plane.fuel = 58;
  const target = [DROP_ZONE.x, groundHeight(DROP_ZONE.x, DROP_ZONE.z) + 30, DROP_ZONE.z];
  flySteps(ctx, 110, () => {
    const control = makeControl({ throttle: 0.42 });
    steerTo(plane, control, target);
    return control;
  });
  // An earlier crate sits on the square where this run is aiming: the goal, already
  // proven reachable, framed under the marker. (A just-released crate flies in
  // formation with the aeroplane and fills the chase frame, so the still is staged
  // with the landed one instead.)
  const zoneGround = groundHeight(DROP_ZONE.x, DROP_ZONE.z);
  mission.crate = {
    pos: [DROP_ZONE.x + 16, zoneGround + 1, DROP_ZONE.z + 12],
    vel: [0, 0, 0],
    falling: false,
    landed: true,
    points: 0,
  };
}

function stageLanding(ctx) {
  const { plane, mission } = ctx;
  mission.phase = 'landing';
  mission.ringIndex = 6;
  mission.ringsPassed = [true, true, true, true, true, true];
  mission.ringsFlown = 6;
  mission.dropPoints = 235;
  mission.score = 1385;
  mission.started = true;
  mission.elapsed = 268;
  plane.onGround = false;
  plane.pos = [10, WORLD.fieldLevel + 62, 840];
  plane.heading = 0.012;
  plane.pitch = -0.055;
  plane.speed = 37;
  plane.fuel = 39;
  plane.damage = 4;
  ctx.input.setFlaps(true);
  const aim = [0, WORLD.fieldLevel + 1, 420];
  flySteps(ctx, 85, () => {
    const control = makeControl({ throttle: 0.16, flaps: true });
    steerTo(plane, control, aim);
    return control;
  });
}

const SCENES = {
  takeoff: stageTakeoff,
  rings: stageRings,
  drop: stageDrop,
  landing: stageLanding,
};

/**
 * Stages the named scene on the given game objects. Returns false for an unknown name.
 * The caller renders the frame and sets window.__shotReady.
 */
export function stageShot(name, ctx) {
  const stage = SCENES[name];
  if (!stage) return false;
  ctx.setScreen('flying');
  ctx.setCameraMode('chase');
  stage(ctx);
  return true;
}
