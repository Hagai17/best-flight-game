// The Kestrel K-1: a high-wing bush plane drawn from flat-shaded boxes, and the flight
// model that moves it. The model is an arcade model with real discipline in it — speed
// bleeds in a climb, the wing stalls if you haul back slow, a banked wing turns the nose
// at a rate set by the bank and the speed, and the ground judges every arrival by sink
// rate, bank and where the wheels meet it.

import { COLORS, PLANE, RUNWAY, WORLD } from './config.js';
import { groundHeight } from './terrain.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** The plane's orthonormal basis from heading, pitch and bank. Forward is -z local. */
export function planeBasis(state) {
  const { heading, pitch, roll } = state;
  const cp = Math.cos(pitch);
  const f = [Math.sin(heading) * cp, Math.sin(pitch), -Math.cos(heading) * cp];
  const r0 = [Math.cos(heading), 0, Math.sin(heading)];
  const u0 = [
    r0[1] * f[2] - r0[2] * f[1],
    r0[2] * f[0] - r0[0] * f[2],
    r0[0] * f[1] - r0[1] * f[0],
  ];
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const r = [r0[0] * cr - u0[0] * sr, r0[1] * cr - u0[1] * sr, r0[2] * cr - u0[2] * sr];
  const u = [r0[0] * sr + u0[0] * cr, r0[1] * sr + u0[1] * cr, r0[2] * sr + u0[2] * cr];
  return { f, r, u };
}

/** A fresh Kestrel on the south end of the strip, engine idling, tanks full. */
export function createAircraft() {
  return {
    pos: [RUNWAY.x, WORLD.fieldLevel + PLANE.gearHeight, 380],
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    flaps: false,
    brakes: false,
    onGround: true,
    fuel: PLANE.fuelCapacity,
    damage: 0,
    propAngle: 0,
    stalled: false,
    shake: 0,
    dead: false,
  };
}

/** Whether a point is over the strip's paved bounds (with a small margin). */
export function overRunway(x, z) {
  return Math.abs(x - RUNWAY.x) <= RUNWAY.width / 2 + 3 && z <= RUNWAY.zNear + 8 && z >= RUNWAY.zFar - 8;
}

/** Ground slope at a point, 0 flat to ~1 vertical, from finite differences. */
function groundSlope(x, z) {
  const d = 6;
  const gx = (groundHeight(x + d, z) - groundHeight(x - d, z)) / (2 * d);
  const gz = (groundHeight(x, z + d) - groundHeight(x, z - d)) / (2 * d);
  return Math.hypot(gx, gz);
}

/**
 * Advances the flight model one step. `control` is { elevator, aileron, rudder,
 * throttle, flaps, brakes } with surfaces in [-1, 1]. Returns an events object:
 * { tookOff, landing, crashed } — landing carries { grade, sink, speed, onRunway },
 * crashed carries { reason }.
 */
export function stepAircraft(state, control, dt) {
  const events = { tookOff: false, landing: null, crashed: null };
  if (state.dead) return events;
  state.throttle = clamp(control.throttle, 0, 1);
  state.flaps = control.flaps;
  state.brakes = control.brakes;
  const engineOut = state.fuel <= 0;
  const throttle = engineOut ? 0 : state.throttle;

  // Fuel burns with the throttle; the gauge, not the calendar, ends a sortie.
  state.fuel = Math.max(0, state.fuel - PLANE.fuelBurn * (0.12 + throttle) * dt);
  state.propAngle += (2 + throttle * 55 + state.speed * 0.12) * dt;

  const stallSpeed = state.flaps ? PLANE.stallSpeedFlaps : PLANE.stallSpeed;
  const authority = clamp(state.speed / PLANE.cruiseSpeed, 0.3, 1.1);

  if (state.onGround) {
    // Rolling: the nose follows the elevator only once the tail has air over it.
    state.roll *= Math.max(0, 1 - 6 * dt);
    const groundSteer = control.rudder * 0.5 + control.aileron * 0.12;
    state.heading += groundSteer * dt * clamp(state.speed * 0.05, 0, 0.6);
    if (state.speed > PLANE.rotateSpeed * 0.55) {
      state.pitch = clamp(state.pitch + control.elevator * PLANE.pitchRate * 0.7 * dt, -0.02, 0.3);
    } else {
      state.pitch = Math.max(0, state.pitch - 1.2 * dt);
    }
  } else {
    // Banking: the ailerons set a target bank, the wing follows, the bank turns the nose.
    const targetRoll = control.aileron * 1.02;
    const rollStep = clamp(targetRoll - state.roll, -PLANE.rollRate * dt, PLANE.rollRate * dt);
    state.roll += rollStep;
    state.heading += (9.81 * Math.tan(state.roll)) / Math.max(state.speed, 16) * 1.12 * dt
      + control.rudder * PLANE.rudderRate * dt;
    state.pitch = clamp(
      state.pitch + control.elevator * PLANE.pitchRate * authority * dt,
      -0.52,
      0.44,
    );
    // A banked wing also drops the nose a little; the elevator has to hold it.
    state.pitch -= Math.abs(state.roll) * 0.055 * dt;
  }

  // Speed: thrust against drag, and gravity trading speed for height both ways.
  const dragK = state.flaps ? 0.0033 : 0.0022;
  let accel = throttle * PLANE.maxThrustAccel
    - PLANE.idleDrag * 0.3
    - dragK * state.speed * state.speed
    - 9.81 * Math.sin(state.pitch) * 0.92;
  if (state.onGround) {
    accel -= 0.35; // rolling resistance
    if (state.brakes) accel -= 4.2;
    if (state.flaps) accel -= 0.4;
  }
  state.speed = clamp(state.speed + accel * dt, 0, PLANE.maxSpeed + 18);

  // Stall: below the speed the wing lets go — the nose drops and the sink builds.
  state.stalled = !state.onGround && state.speed < stallSpeed;
  let extraSink = 0;
  if (state.stalled) {
    const depth = (stallSpeed - state.speed) / stallSpeed;
    state.pitch = Math.max(-0.5, state.pitch - depth * 0.85 * dt);
    extraSink = depth * 13;
    state.shake = Math.min(1, state.shake + depth * 4 * dt);
  } else {
    state.shake = Math.max(0, state.shake - 3 * dt);
  }

  const { f } = planeBasis(state);
  const wasAirborne = !state.onGround;
  state.pos[0] += f[0] * state.speed * dt;
  state.pos[1] += f[1] * state.speed * dt - extraSink * dt;
  state.pos[2] += f[2] * state.speed * dt;
  state.pos[0] = clamp(state.pos[0], -WORLD.halfSize, WORLD.halfSize);
  state.pos[2] = clamp(state.pos[2], -WORLD.halfSize, WORLD.halfSize);

  const ground = groundHeight(state.pos[0], state.pos[2]);
  const floorY = Math.max(ground, ground < WORLD.waterLevel ? WORLD.waterLevel : ground);
  const gearY = floorY + PLANE.gearHeight;

  if (state.onGround) {
    state.pos[1] = gearY;
    // Liftoff: enough speed and a raised nose, and the wing takes the weight.
    if (state.speed >= PLANE.rotateSpeed && state.pitch >= 0.07 && ground >= WORLD.waterLevel) {
      state.onGround = false;
      events.tookOff = true;
    }
    // Rolling off a cliff edge or into the lake ends the roll.
    if (ground < WORLD.waterLevel - 0.4 && state.pos[1] <= WORLD.waterLevel + PLANE.gearHeight + 0.01 && groundHeight(state.pos[0], state.pos[2]) < WORLD.waterLevel - 0.4) {
      state.dead = true;
      events.crashed = { reason: 'You rolled into the water.' };
    }
  } else if (state.pos[1] <= gearY) {
    // Touchdown: judge the arrival.
    const sink = -(f[1] * state.speed - extraSink);
    const onStrip = overRunway(state.pos[0], state.pos[2]);
    const slope = groundSlope(state.pos[0], state.pos[2]);
    const inWater = ground < WORLD.waterLevel - 0.4;
    state.pos[1] = gearY;
    if (inWater) {
      state.dead = true;
      state.damage = 100;
      events.crashed = { reason: 'You ditched in the water.' };
    } else if (sink > 7.5 || Math.abs(state.roll) > 0.52 || (slope > 0.42 && state.speed > 34)) {
      state.dead = true;
      state.damage = 100;
      events.crashed = {
        reason: sink > 7.5
          ? `You hit the ground at ${sink.toFixed(1)} m/s down. The gear folded.`
          : Math.abs(state.roll) > 0.52
            ? 'A wingtip caught the ground first.'
            : 'The hillside was steeper than the landing.',
      };
    } else {
      let grade = 'firm';
      let hurt = 6;
      if (onStrip && sink <= 2.3 && state.speed <= 41) { grade = 'perfect'; hurt = 0; }
      else if (onStrip && sink <= 3.9 && state.speed <= 49) { grade = 'good'; hurt = 2; }
      else if (sink <= 5.6) { grade = 'firm'; hurt = 9; }
      else { grade = 'hard'; hurt = 20; }
      if (!onStrip) hurt += 6;
      state.damage = Math.min(100, state.damage + hurt);
      state.onGround = true;
      state.pitch = Math.max(0, state.pitch * 0.3);
      state.roll *= 0.3;
      events.landing = { grade, sink, speed: state.speed, onRunway: onStrip };
      if (state.damage >= 100) {
        state.dead = true;
        events.crashed = { reason: 'The airframe gave up under the accumulated damage.' };
      }
    }
  } else if (wasAirborne && state.pos[1] < ground + 0.4 && f[1] * state.speed > 2) {
    // Flying up into rising ground that the gear check stepped over.
    state.dead = true;
    state.damage = 100;
    events.crashed = { reason: 'The valley wall arrived before the sky did.' };
  }
  return events;
}

// --- Drawing ---------------------------------------------------------------

/** One box of the airframe, in local space (x right, y up, z toward the tail). */
const PARTS = [
  // [centre, size, colour]
  [[0, 0, -1.75], [0.92, 0.88, 1.3], COLORS.planeCream], // engine cowl
  [[0, 0, -2.52], [0.36, 0.36, 0.34], COLORS.planeRed], // spinner
  [[0, 0.08, -0.35], [1.02, 0.98, 1.7], COLORS.planeCream], // cabin
  [[0, -0.08, -0.35], [1.05, 0.24, 1.72], COLORS.planeRed], // cheatline stripe
  [[0, 0.55, -0.55], [0.74, 0.48, 1.15], COLORS.canopy], // canopy glass
  [[0, 0.22, 1.35], [0.52, 0.55, 2.0], COLORS.planeCream], // tail boom
  [[0, 0.3, 2.52], [0.3, 0.36, 0.5], COLORS.planeCream], // tail cone
  [[0, 0.64, -0.55], [7.4, 0.13, 1.35], COLORS.planeCream], // main wing
  [[-3.48, 0.64, -0.55], [0.55, 0.14, 1.35], COLORS.planeRed], // left tip
  [[3.48, 0.64, -0.55], [0.55, 0.14, 1.35], COLORS.planeRed], // right tip
  [[0, 0.44, 2.55], [2.7, 0.1, 0.85], COLORS.planeCream], // tailplane
  [[0, 0.98, 2.5], [0.12, 1.05, 1.0], COLORS.planeRed], // fin and rudder
  [[-0.55, -0.6, -0.55], [0.12, 0.55, 0.12], COLORS.planeDark], // left gear leg
  [[0.55, -0.6, -0.55], [0.12, 0.55, 0.12], COLORS.planeDark], // right gear leg
  [[-0.58, -0.98, -0.55], [0.2, 0.52, 0.54], COLORS.planeDark], // left wheel
  [[0.58, -0.98, -0.55], [0.2, 0.52, 0.54], COLORS.planeDark], // right wheel
  [[0, -0.62, -1.8], [0.1, 0.4, 0.1], COLORS.planeDark], // nose gear leg
  [[0, -0.92, -1.8], [0.16, 0.4, 0.42], COLORS.planeDark], // nose wheel
];

const BOX_FACES = [
  [0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0],
];

function localToWorld(state, basis, p) {
  return [
    state.pos[0] + basis.r[0] * p[0] + basis.u[0] * p[1] - basis.f[0] * p[2],
    state.pos[1] + basis.r[1] * p[0] + basis.u[1] * p[1] - basis.f[1] * p[2],
    state.pos[2] + basis.r[2] * p[0] + basis.u[2] * p[1] - basis.f[2] * p[2],
  ];
}

/** Pushes the aircraft — airframe boxes, spinning propeller and its ground shadow. */
export function drawAircraft(renderer, state) {
  const basis = planeBasis(state);
  // A soft shadow lying flat on the ground below: the landing pilot's best height cue.
  const gy = groundHeight(state.pos[0], state.pos[2]);
  const heightAbove = state.pos[1] - gy;
  if (heightAbove < 160) {
    const alpha = 0.3 * (1 - heightAbove / 160);
    const right = [basis.r[0], 0, basis.r[2]];
    const fwd = [basis.f[0], 0, basis.f[2]];
    const rl = Math.hypot(right[0], right[2]) || 1;
    const fl = Math.hypot(fwd[0], fwd[2]) || 1;
    const shadow = [];
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      shadow.push([
        state.pos[0] + (right[0] / rl) * Math.cos(a) * 3.6 + (fwd[0] / fl) * Math.sin(a) * 4.8,
        gy + 0.35,
        state.pos[2] + (right[2] / rl) * Math.cos(a) * 3.6 + (fwd[2] / fl) * Math.sin(a) * 4.8,
      ]);
    }
    renderer.addPoly(shadow, [20, 26, 20], { flat: true, alpha });
  }
  for (const [centre, size, color] of PARTS) {
    const hx = size[0] / 2;
    const hy = size[1] / 2;
    const hz = size[2] / 2;
    const corners = [];
    for (const [sx, sy, sz] of [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]) {
      corners.push(localToWorld(state, basis, [centre[0] + sx * hx, centre[1] + sy * hy, centre[2] + sz * hz]));
    }
    for (const face of BOX_FACES) {
      renderer.addPoly(face.map((i) => corners[i]), color);
    }
  }
  // The propeller: a translucent blur disc and two blades turning with the engine.
  const hub = localToWorld(state, basis, [0, 0, -2.62]);
  renderer.addDisc(hub, 1.18, 1.18, [30, 30, 34], 0.16);
  for (const flip of [0, Math.PI]) {
    const a = state.propAngle + flip;
    const tip = [
      hub[0] + (basis.r[0] * Math.cos(a) + basis.u[0] * Math.sin(a)) * 1.12,
      hub[1] + (basis.r[1] * Math.cos(a) + basis.u[1] * Math.sin(a)) * 1.12,
      hub[2] + (basis.r[2] * Math.cos(a) + basis.u[2] * Math.sin(a)) * 1.12,
    ];
    const side = [
      (basis.r[0] * -Math.sin(a) + basis.u[0] * Math.cos(a)) * 0.09,
      (basis.r[1] * -Math.sin(a) + basis.u[1] * Math.cos(a)) * 0.09,
      (basis.r[2] * -Math.sin(a) + basis.u[2] * Math.cos(a)) * 0.09,
    ];
    renderer.addPoly(
      [
        [hub[0] - side[0], hub[1] - side[1], hub[2] - side[2]],
        [tip[0] - side[0], tip[1] - side[1], tip[2] - side[2]],
        [tip[0] + side[0], tip[1] + side[1], tip[2] + side[2]],
        [hub[0] + side[0], hub[1] + side[1], hub[2] + side[2]],
      ],
      COLORS.planeDark,
      { flat: true },
    );
  }
}
