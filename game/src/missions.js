// The sortie: one flight with a shape to it. Take off northbound from the home strip,
// run six rings up the valley and back down its east side, drop a supply crate on the
// town square, then come home and land — the landing graded like everything else.
// Fuel and damage run underneath the whole thing, so the fast line and the safe line
// are rarely the same line. Free flight keeps the same valley and rings with no shape
// imposed: it just counts what you fly through.

import { SCORE, WORLD } from './config.js';
import { groundHeight, valleyCenterX } from './terrain.js';

/** The supply-drop target: the town square at Kestrel Town. */
export const DROP_ZONE = { x: 760, z: -980, radius: 42 };

/** The six course rings: up the river valley, then back down the east ridge. */
export const RINGS = buildRings();

function buildRings() {
  const points = [
    [valleyCenterX(-800), 128, -800],
    [valleyCenterX(-1350), 172, -1350],
    [valleyCenterX(-1900), 214, -1900],
    [valleyCenterX(-2450), 188, -2450],
    [980, 160, -1750],
    [880, 126, -1150],
  ];
  const route = [[0, 12, 380], ...points, [DROP_ZONE.x, 60, DROP_ZONE.z]];
  return points.map((pos, i) => {
    const prev = route[i];
    const next = route[i + 2];
    const dir = [next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]];
    const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    return { pos, normal: [dir[0] / len, dir[1] / len, dir[2] / len], radius: 27 };
  });
}

/** A new mission. `mode` is 'circuit' (the full sortie) or 'free' (just flying). */
export function createMission(mode) {
  return {
    mode,
    phase: mode === 'circuit' ? 'takeoff' : 'free',
    ringIndex: 0,
    ringsPassed: RINGS.map(() => false),
    ringsFlown: 0,
    score: 0,
    elapsed: 0,
    ringsTime: 0,
    started: false,
    finished: false,
    crashReason: null,
    landing: null,
    landingPoints: 0,
    timeBonus: 0,
    dropPoints: null,
    crate: null,
    message: mode === 'circuit'
      ? 'Full throttle when ready — take off to the north.'
      : 'Free flight. The rings are lit if you want them.',
    messageUntil: 6,
    events: [],
  };
}

function ringCrossed(ring, prevPos, pos) {
  const rel = (p) => [p[0] - ring.pos[0], p[1] - ring.pos[1], p[2] - ring.pos[2]];
  const a = rel(prevPos);
  const b = rel(pos);
  const sa = a[0] * ring.normal[0] + a[1] * ring.normal[1] + a[2] * ring.normal[2];
  const sb = b[0] * ring.normal[0] + b[1] * ring.normal[1] + b[2] * ring.normal[2];
  if (sa === sb) return false;
  if ((sa < 0 && sb < 0) || (sa > 0 && sb > 0)) {
    // No plane crossing this step; still credit a pass straight through the middle.
    const d = Math.hypot(b[0], b[1], b[2]);
    return Math.abs(sb) < 6 && d < ring.radius * 0.92;
  }
  const t = sa / (sa - sb);
  const cross = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  return Math.hypot(cross[0], cross[1], cross[2]) < ring.radius;
}

function say(mission, text, seconds, now) {
  mission.message = text;
  mission.messageUntil = now + seconds;
}

/** Releases the supply crate from the plane, if the sortie is at the drop phase. */
export function releaseDrop(mission, plane) {
  if (mission.crate || mission.dropPoints !== null) return false;
  if (mission.mode === 'circuit' && mission.phase !== 'drop') return false;
  const speed = plane.speed;
  const cp = Math.cos(plane.pitch);
  mission.crate = {
    pos: [plane.pos[0], plane.pos[1] - 1.4, plane.pos[2]],
    vel: [
      Math.sin(plane.heading) * cp * speed,
      Math.sin(plane.pitch) * speed - 1,
      -Math.cos(plane.heading) * cp * speed,
    ],
    landed: false,
  };
  mission.events.push('drop');
  return true;
}

function updateCrate(mission, dt) {
  const crate = mission.crate;
  if (!crate || crate.landed) return;
  crate.vel[1] -= 9.81 * dt;
  crate.pos[0] += crate.vel[0] * dt;
  crate.pos[1] += crate.vel[1] * dt;
  crate.pos[2] += crate.vel[2] * dt;
  const ground = groundHeight(crate.pos[0], crate.pos[2]);
  if (crate.pos[1] <= ground + 0.5) {
    crate.pos[1] = ground + 0.5;
    crate.landed = true;
    const dist = Math.hypot(crate.pos[0] - DROP_ZONE.x, crate.pos[2] - DROP_ZONE.z);
    mission.dropPoints = Math.max(0, Math.round(SCORE.dropMax * (1 - dist / (DROP_ZONE.radius * 2.4))));
    mission.score += mission.dropPoints;
    mission.events.push('crateDown');
    if (mission.mode === 'circuit') {
      mission.phase = 'landing';
      say(mission, dist <= DROP_ZONE.radius
        ? `Crate on the square — ${mission.dropPoints} points. Now bring her home and land northbound.`
        : `Crate down ${Math.round(dist)} m from the square — ${mission.dropPoints} points. Home and land northbound.`, 7, mission.elapsed);
    }
  }
}

/**
 * Advances the mission one step against the plane's new state and the flight events.
 * Sound-worthy happenings are pushed onto mission.events for the caller to drain.
 */
export function updateMission(mission, plane, flightEvents, prevPos, dt) {
  if (mission.finished) return;
  if (mission.started) mission.elapsed += dt;
  updateCrate(mission, dt);

  if (flightEvents.crashed) {
    mission.finished = true;
    mission.crashReason = flightEvents.crashed.reason;
    mission.events.push('crash');
    return;
  }

  if (mission.mode === 'free') {
    RINGS.forEach((ring, i) => {
      if (!mission.ringsPassed[i] && !plane.onGround && ringCrossed(ring, prevPos, plane.pos)) {
        mission.ringsPassed[i] = true;
        mission.ringsFlown += 1;
        mission.score += SCORE.ring;
        mission.events.push('ring');
        say(mission, `Ring ${mission.ringsFlown} — ${SCORE.ring} points.`, 3.5, mission.elapsed);
      }
    });
    if (flightEvents.landing) mission.events.push('landed');
    return;
  }

  // The circuit, phase by phase.
  if (mission.phase === 'takeoff') {
    if (flightEvents.tookOff) {
      mission.phase = 'rings';
      mission.started = true;
      say(mission, 'Airborne. Ring 1 is up the valley — follow the amber.', 5, mission.elapsed);
    }
    return;
  }
  if (mission.phase === 'rings') {
    mission.ringsTime += dt;
    const ring = RINGS[mission.ringIndex];
    if (ring && ringCrossed(ring, prevPos, plane.pos)) {
      mission.ringsPassed[mission.ringIndex] = true;
      mission.ringsFlown += 1;
      mission.score += SCORE.ring;
      mission.events.push('ring');
      mission.ringIndex += 1;
      if (mission.ringIndex >= RINGS.length) {
        mission.phase = 'drop';
        const bonus = Math.max(0, Math.round(SCORE.ringTimeBonusMax * (1 - mission.ringsTime / 330)));
        mission.timeBonus = bonus;
        mission.score += bonus;
        say(mission, `All six rings${bonus ? ` — time bonus ${bonus}` : ''}. East now: drop the crate on the town square (X).`, 7, mission.elapsed);
      } else {
        say(mission, `Ring ${mission.ringsFlown} of 6. Next ring marked.`, 3.5, mission.elapsed);
      }
    }
    return;
  }
  if (mission.phase === 'drop') {
    return; // the crate's landing advances the phase, in updateCrate
  }
  if (mission.phase === 'landing' && flightEvents.landing) {
    const landing = flightEvents.landing;
    mission.landing = landing;
    const points = landing.grade === 'perfect' ? SCORE.landingPerfect
      : landing.grade === 'good' ? SCORE.landingGood
        : landing.grade === 'firm' ? SCORE.landingFirm : 30;
    mission.landingPoints = points;
    mission.score += points;
    mission.score = Math.max(0, mission.score - Math.round(plane.damage) * SCORE.damagePerPoint);
    mission.phase = 'done';
    mission.finished = true;
    mission.events.push('finished');
  }
}

/** The current objective for the HUD: where to go, and what it is called. */
export function currentTarget(mission) {
  if (mission.mode === 'free') {
    const next = RINGS.findIndex((ring, i) => !mission.ringsPassed[i]);
    if (next === -1) return null;
    return { pos: RINGS[next].pos, label: `Ring ${next + 1}` };
  }
  if (mission.phase === 'rings') {
    return { pos: RINGS[mission.ringIndex].pos, label: `Ring ${mission.ringIndex + 1}` };
  }
  if (mission.phase === 'drop') {
    return { pos: [DROP_ZONE.x, groundHeight(DROP_ZONE.x, DROP_ZONE.z) + 4, DROP_ZONE.z], label: 'Drop zone' };
  }
  if (mission.phase === 'landing') {
    return { pos: [0, WORLD.fieldLevel + 2, 300], label: 'Home strip' };
  }
  return null;
}
