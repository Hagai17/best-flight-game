// Kestrel Valley Air Rally — boot and the one loop. The world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one); input is gathered once a frame;
// the renderer paints terrain, scenery, rings and the aeroplane into one polygon queue;
// the HUD draws the instruments over it. Four screens: title, flying, paused, and the
// end of a sortie (finished or crashed).
//
// ?seed=N fixes the scenery scatter. ?shot=takeoff|rings|drop|landing (with &seed=N)
// stages that scene instead of running the loop, paints it and sets window.__shotReady
// for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createRenderer, createCamera } from './renderer3d.js';
import { drawTerrain, groundHeight } from './terrain.js';
import { drawRunway, drawWindsock, drawTown, drawTrees, drawClouds, drawRing, drawDropZone, drawCrate } from './scenery.js';
import { createAircraft, stepAircraft, drawAircraft, planeBasis } from './aircraft.js';
import { createMission, updateMission, releaseDrop, currentTarget, RINGS } from './missions.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { drawHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261126;
createRandom(seed); // the seed is accepted for symmetry with the staging; scatter is hash-based

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
renderer.resize();
window.addEventListener('resize', () => renderer.resize());

const input = createInput(canvas);
const audio = createAudio();

let screen = 'title';
let mode = 'circuit';
let plane = createAircraft();
let mission = createMission('circuit');
let cameraMode = 'chase';
let time = 0;
let best = readBest();
let isBest = false;
let vsi = 0;
let camPos = [plane.pos[0] - 14, plane.pos[1] + 5, plane.pos[2] + 16];
let camera = null;
let snapCam = false;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    /* private mode: the best is kept for the session only */
  }
}

function startFlight(nextMode) {
  mode = nextMode;
  plane = createAircraft();
  mission = createMission(nextMode);
  cameraMode = 'chase';
  isBest = false;
  vsi = 0;
  camPos = [plane.pos[0] - 14, plane.pos[1] + 5, plane.pos[2] + 16];
  screen = 'flying';
}

/** One fixed step of the whole world under a given control object. */
function stepOnce(control, dt) {
  const prevPos = [plane.pos[0], plane.pos[1], plane.pos[2]];
  const prevY = plane.pos[1];
  const flightEvents = stepAircraft(plane, control, dt);
  updateMission(mission, plane, flightEvents, prevPos, dt);
  vsi = vsi * 0.85 + ((plane.pos[1] - prevY) / dt) * 0.15;
  for (const event of mission.events.splice(0, mission.events.length)) {
    if (event === 'ring') audio.ring();
    else if (event === 'drop') audio.drop();
    else if (event === 'crateDown') audio.crateDown();
    else if (event === 'crash') audio.crash();
    else if (event === 'finished') audio.finish();
  }
  if (flightEvents.tookOff) audio.takeoff();
  if (flightEvents.landing) audio.touchdown(flightEvents.landing.grade);
  if (flightEvents.crashed && screen === 'flying') {
    screen = 'crashed';
    announce(`Down. ${mission.crashReason ?? ''}`);
  }
  if (mission.finished && mission.mode === 'circuit' && !mission.crashReason && screen === 'flying') {
    screen = 'finished';
    if (mission.score > best) {
      best = mission.score;
      isBest = true;
      saveBest(best);
    }
    announce(`Sortie complete. Score ${mission.score}.`);
  }
}

function announce(message) {
  if (status) status.textContent = message;
}

function handleActions() {
  for (const action of input.drainActions()) {
    if (action === 'pointer') audio.unlock();
    if (screen === 'title') {
      if (action === 'mode1' || action === 'confirm') {
        audio.unlock();
        startFlight(action === 'mode2' ? 'free' : 'circuit');
      } else if (action === 'mode2') {
        audio.unlock();
        startFlight('free');
      }
    } else if (screen === 'flying') {
      if (action === 'drop') releaseDrop(mission, plane);
      else if (action === 'camera') cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
      else if (action === 'pause') screen = 'paused';
      else if (action === 'restart') startFlight(mode);
      else if (action === 'mute') audio.setMuted(!audio.isMuted());
    } else if (screen === 'paused') {
      if (action === 'pause') screen = 'flying';
      else if (action === 'restart') startFlight(mode);
      else if (action === 'mute') audio.setMuted(!audio.isMuted());
    } else if (screen === 'finished' || screen === 'crashed') {
      if (action === 'restart') startFlight(mode);
      else if (action === 'confirm') screen = 'title';
      else if (action === 'mute') audio.setMuted(!audio.isMuted());
    }
  }
}

/** Builds the frame's camera for the current screen and camera mode. */
function buildCamera(dt) {
  const { width, height } = renderer;
  const basis = planeBasis(plane);
  if (screen === 'title') {
    const cx = plane.pos[0] + Math.sin(time * 0.07) * 17;
    const cz = plane.pos[2] + Math.cos(time * 0.07) * 17;
    return createCamera([cx, plane.pos[1] + 4.2, cz], [plane.pos[0], plane.pos[1] + 0.8, plane.pos[2]], [0, 1, 0], 55, width, height);
  }
  if (screen === 'finished' || screen === 'crashed') {
    const cx = plane.pos[0] + Math.sin(time * 0.12) * 15;
    const cz = plane.pos[2] + Math.cos(time * 0.12) * 15;
    return createCamera([cx, plane.pos[1] + 5, cz], [plane.pos[0], plane.pos[1] + 0.6, plane.pos[2]], [0, 1, 0], 55, width, height);
  }
  if (cameraMode === 'cockpit') {
    const head = [
      plane.pos[0] + basis.u[0] * 1.02 + basis.f[0] * 0.55,
      plane.pos[1] + basis.u[1] * 1.02 + basis.f[1] * 0.55,
      plane.pos[2] + basis.u[2] * 1.02 + basis.f[2] * 0.55,
    ];
    const look = [
      head[0] + basis.f[0] * 120,
      head[1] + basis.f[1] * 120,
      head[2] + basis.f[2] * 120,
    ];
    camPos = head;
    return createCamera(head, look, basis.u, 68, width, height);
  }
  // Chase: a smoothed position behind and above, looking ahead of the nose.
  const shakeAmp = plane.shake * 0.14;
  const desired = [
    plane.pos[0] - basis.f[0] * 11.5 + basis.u[0] * 3.1 + (Math.random() - 0.5) * shakeAmp,
    plane.pos[1] - basis.f[1] * 11.5 + basis.u[1] * 3.1 + (Math.random() - 0.5) * shakeAmp,
    plane.pos[2] - basis.f[2] * 11.5 + basis.u[2] * 3.1 + (Math.random() - 0.5) * shakeAmp,
  ];
  const k = snapCam ? 1 : 1 - Math.exp(-dt * 6.5);
  camPos = [
    camPos[0] + (desired[0] - camPos[0]) * k,
    camPos[1] + (desired[1] - camPos[1]) * k,
    camPos[2] + (desired[2] - camPos[2]) * k,
  ];
  const groundY = groundHeight(camPos[0], camPos[2]) + 1.6;
  if (camPos[1] < groundY) camPos[1] = groundY;
  const look = [
    plane.pos[0] + basis.f[0] * 20,
    plane.pos[1] + basis.f[1] * 20 + 0.8,
    plane.pos[2] + basis.f[2] * 20,
  ];
  const upHint = [
    basis.u[0] * 0.32,
    1 + basis.u[1] * 0.32,
    basis.u[2] * 0.32,
  ];
  return createCamera(camPos, look, upHint, 62, width, height);
}

/** Projects a world point through the current camera for the HUD's target marker. */
function project(point) {
  if (!camera) return null;
  const rel = [
    point[0] - camera.position[0],
    point[1] - camera.position[1],
    point[2] - camera.position[2],
  ];
  const cx = rel[0] * camera.right[0] + rel[1] * camera.right[1] + rel[2] * camera.right[2];
  const cy = rel[0] * camera.up[0] + rel[1] * camera.up[1] + rel[2] * camera.up[2];
  const cz = rel[0] * camera.forward[0] + rel[1] * camera.forward[1] + rel[2] * camera.forward[2];
  if (cz <= 0.5) return { x: 0, y: 0, behind: true, bearing: Math.atan2(cx, cz) };
  return {
    x: camera.width / 2 + (cx * camera.scale) / cz,
    y: camera.height / 2 - (cy * camera.scale) / cz,
    behind: false,
    bearing: Math.atan2(cx, cz),
  };
}

/** Paints one whole frame: world first, then the instruments. */
function render() {
  const target = screen === 'flying' ? currentTarget(mission) : null;
  renderer.beginFrame(camera);
  drawClouds(renderer, time);
  drawTerrain(renderer, camera.position[0], camera.position[2]);
  drawRunway(renderer);
  drawWindsock(renderer, time);
  drawTown(renderer, camera.position[0], camera.position[2]);
  drawTrees(renderer, camera.position[0], camera.position[2]);
  RINGS.forEach((ring, i) => {
    let state = 'todo';
    if (mission.ringsPassed[i]) state = 'done';
    else if (mission.mode === 'circuit' && mission.phase === 'rings' && i === mission.ringIndex) state = 'next';
    else if (mission.mode === 'free' && i === mission.ringsPassed.findIndex((p) => !p)) state = 'next';
    drawRing(renderer, ring, state, time);
  });
  const dropActive = mission.mode === 'free' ? mission.dropPoints === null : mission.phase === 'drop';
  drawDropZone(renderer, { x: 760, z: -980, radius: 42 }, time, dropActive);
  if (mission.crate) drawCrate(renderer, mission.crate);
  if (cameraMode === 'chase' || screen !== 'flying') drawAircraft(renderer, plane);
  renderer.flush();
  if (screen === 'flying' && cameraMode === 'cockpit') drawCockpitCowl();
  const projected = target ? project(target.pos) : null;
  drawHud(renderer.ctx, {
    width: renderer.width,
    height: renderer.height,
    plane,
    mission,
    screen: screen === 'flying' || screen === 'paused' ? screen : screen,
    time,
    vsi,
    cameraMode,
    muted: audio.isMuted(),
    best,
    isBest,
    target,
    project: (p) => project(p),
    targetBearingAngle: projected ? projected.bearing : 0,
    alerts: { pullUp: computePullUp() },
  });
}

/** The cockpit view's nose cowl and panel brow, painted in screen space. */
function drawCockpitCowl() {
  const { ctx, width: w, height: h } = renderer;
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h);
  ctx.quadraticCurveTo(w * 0.5, h * 0.8, w * 0.72, h);
  ctx.closePath();
  ctx.fillStyle = '#7d2020';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.9);
  ctx.quadraticCurveTo(w * 0.5, h * 0.8, w, h * 0.9);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = 'rgba(14,20,28,0.92)';
  ctx.fill();
}

function computePullUp() {
  if (plane.onGround || plane.dead) return false;
  const basis = planeBasis(plane);
  const aheadX = plane.pos[0] + basis.f[0] * 130;
  const aheadZ = plane.pos[2] + basis.f[2] * 130;
  const clearance = plane.pos[1] - groundHeight(aheadX, aheadZ);
  return clearance < 42 && vsi < 0.5;
}

// --- The loop, or the staged screenshot -------------------------------------

if (shot) {
  const staged = stageShot(shot, {
    plane,
    mission,
    input,
    stepOnce,
    setScreen: (value) => { screen = value; },
    setCameraMode: (value) => { cameraMode = value; },
  });
  if (staged) {
    // The frame clock follows the mission clock, so message banners staged mid-sortie
    // (their windows are set in mission time) show as they would in play.
    time = mission.elapsed + 0.05;
    snapCam = true; // the chase camera starts converged on the staged aeroplane
    camera = buildCamera(1 / 30);
    render();
    camera = buildCamera(1 / 30);
    render();
    window.__shotReady = true;
  }
} else {
  let last = performance.now();
  let accumulator = 0;
  const frame = (nowMs) => {
    const frameDt = Math.min(MAX_FRAME, (nowMs - last) / 1000);
    last = nowMs;
    time += frameDt;
    handleActions();
    if (screen === 'flying') {
      input.update(frameDt);
      accumulator += frameDt;
      while (accumulator >= STEP) {
        stepOnce(input.control, STEP);
        accumulator -= STEP;
        if (screen !== 'flying') {
          accumulator = 0;
          break;
        }
      }
      audio.update(frameDt, plane);
    }
    camera = buildCamera(frameDt);
    render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
