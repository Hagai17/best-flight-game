// The instrument panel and every word the game says, drawn over the 3D scene: a compass
// tape and digital altitude, speed and heading readouts up top; three round gauges —
// altimeter, attitude ball and airspeed — along the bottom; throttle, fuel and damage
// bars; the sortie panel; warnings; the target marker; and the title, pause, finish
// and crash screens. If it is text or a dial, it lives here and nowhere else.

import { PLANE, SCORE } from './config.js';

const INK = 'rgba(238,244,248,0.96)';
const DIM = 'rgba(200,214,224,0.75)';
const PANEL = 'rgba(10,18,28,0.55)';
const AMBER = '#ffb020';
const RED = '#ff5348';
const GREEN = '#6fd67a';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function panel(ctx, x, y, w, h) {
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = PANEL;
  ctx.fill();
}

function text(ctx, str, x, y, size, color, align = 'left', weight = 600) {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** A round gauge shell with a needle; `drawFace` paints ticks inside the dial. */
function gauge(ctx, cx, cy, r, label, digital, drawFace, needleAngle) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(12,20,30,0.78)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(220,232,240,0.5)';
  ctx.stroke();
  drawFace(cx, cy, r);
  const nx = cx + Math.sin(needleAngle) * r * 0.72;
  const ny = cy - Math.cos(needleAngle) * r * 0.72;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffd75e';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  text(ctx, label, cx, cy + r * 0.36, r * 0.21, DIM, 'center');
  text(ctx, digital, cx, cy + r * 0.72, r * 0.3, INK, 'center', 700);
}

function drawAltimeter(ctx, cx, cy, r, altitudeFt) {
  gauge(ctx, cx, cy, r, 'ALT FT', `${Math.round(altitudeFt)}`, (x, y, rr) => {
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      const x1 = x + Math.sin(a) * rr * 0.8;
      const y1 = y - Math.cos(a) * rr * 0.8;
      const x2 = x + Math.sin(a) * rr * 0.92;
      const y2 = y - Math.cos(a) * rr * 0.92;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = DIM;
      ctx.stroke();
      text(ctx, `${i}`, x + Math.sin(a) * rr * 0.62, y - Math.cos(a) * rr * 0.62 + 4, rr * 0.22, DIM, 'center');
    }
  }, (altitudeFt / 1000) * Math.PI * 2);
}

function drawAirspeed(ctx, cx, cy, r, knots) {
  const maxKt = 170;
  const sweep = Math.PI * 1.5;
  const start = -Math.PI * 0.75;
  const angleFor = (kt) => start + (clamp(kt, 0, maxKt) / maxKt) * sweep;
  gauge(ctx, cx, cy, r, 'SPEED KT', `${Math.round(knots)}`, (x, y, rr) => {
    // Coloured arcs: white flap range, green normal, red beyond the line.
    const arc = (from, to, color) => {
      ctx.beginPath();
      ctx.arc(x, y, rr * 0.86, angleFor(from) - Math.PI / 2, angleFor(to) - Math.PI / 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = color;
      ctx.stroke();
    };
    arc(38, 62, 'rgba(240,240,240,0.85)');
    arc(48, 118, 'rgba(111,214,122,0.8)');
    arc(140, maxKt, 'rgba(255,83,72,0.85)');
    for (let kt = 0; kt <= 160; kt += 20) {
      const a = angleFor(kt);
      const x1 = x + Math.sin(a) * rr * 0.78;
      const y1 = y - Math.cos(a) * rr * 0.78;
      const x2 = x + Math.sin(a) * rr * 0.92;
      const y2 = y - Math.cos(a) * rr * 0.92;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = DIM;
      ctx.stroke();
      text(ctx, `${kt}`, x + Math.sin(a) * rr * 0.6, y - Math.cos(a) * rr * 0.6 + 4, rr * 0.2, DIM, 'center');
    }
  }, angleFor(knots));
}

function drawAttitude(ctx, cx, cy, r, pitch, roll) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(12,20,30,0.78)';
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.translate(cx, cy);
  ctx.rotate(-roll);
  const pitchPx = clamp(pitch, -0.5, 0.5) * r * 1.5;
  ctx.fillStyle = '#5d94c9';
  ctx.fillRect(-r * 1.6, -r * 1.6 + pitchPx, r * 3.2, r * 1.6);
  ctx.fillStyle = '#8a6b48';
  ctx.fillRect(-r * 1.6, pitchPx, r * 3.2, r * 1.6);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 1.6, pitchPx);
  ctx.lineTo(r * 1.6, pitchPx);
  ctx.stroke();
  for (const deg of [-20, -10, 10, 20]) {
    const y = pitchPx - (deg * Math.PI / 180) * r * 1.5;
    const w = deg % 20 === 0 ? r * 0.34 : r * 0.2;
    ctx.beginPath();
    ctx.moveTo(-w, y);
    ctx.lineTo(w, y);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(220,232,240,0.5)';
  ctx.stroke();
  // The fixed aeroplane symbol.
  ctx.strokeStyle = '#ffd75e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy);
  ctx.lineTo(cx - r * 0.16, cy);
  ctx.lineTo(cx, cy + r * 0.14);
  ctx.lineTo(cx + r * 0.16, cy);
  ctx.lineTo(cx + r * 0.55, cy);
  ctx.stroke();
  text(ctx, 'ATT', cx, cy + r + 14, 11, DIM, 'center');
}

function drawCompass(ctx, w, headingDeg) {
  const cx = w / 2;
  const tapeW = 380;
  panel(ctx, cx - tapeW / 2, 12, tapeW, 40);
  ctx.save();
  roundRect(ctx, cx - tapeW / 2, 12, tapeW, 40, 10);
  ctx.clip();
  const pxPerDeg = 3.4;
  const firstDeg = Math.floor((headingDeg - 60) / 5) * 5;
  for (let abs = firstDeg; abs <= headingDeg + 60; abs += 5) {
    const deg = ((abs % 360) + 360) % 360;
    const d = abs - headingDeg;
    const x = cx + d * pxPerDeg;
    const major = deg % 30 === 0;
    ctx.beginPath();
    ctx.moveTo(x, 44);
    ctx.lineTo(x, major ? 32 : 38);
    ctx.lineWidth = 2;
    ctx.strokeStyle = DIM;
    ctx.stroke();
    if (major) {
      const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
      text(ctx, names[deg] ?? `${deg / 10}`, x, 28, 13, INK, 'center', 700);
    }
  }
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(cx, 52);
  ctx.lineTo(cx - 6, 60);
  ctx.lineTo(cx + 6, 60);
  ctx.closePath();
  ctx.fillStyle = AMBER;
  ctx.fill();
  text(ctx, `${String(Math.round(headingDeg) % 360).padStart(3, '0')}°`, cx, 82, 17, INK, 'center', 700);
}

function drawBar(ctx, x, y, w, label, fraction, color, valueText) {
  text(ctx, label, x, y + 4, 11, DIM, 'left', 700);
  roundRect(ctx, x + 40, y - 6, w, 10, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fill();
  roundRect(ctx, x + 40, y - 6, Math.max(6, w * clamp(fraction, 0, 1)), 10, 5);
  ctx.fillStyle = color;
  ctx.fill();
  if (valueText) text(ctx, valueText, x + 48 + w, y + 4, 11, INK, 'left', 600);
}

function drawTargetMarker(ctx, view) {
  const target = view.target;
  if (!target || view.screen !== 'flying') return;
  const p = view.project(target.pos);
  const dist = Math.hypot(
    target.pos[0] - view.plane.pos[0],
    target.pos[1] - view.plane.pos[1],
    target.pos[2] - view.plane.pos[2],
  );
  const distText = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`;
  const { width: w, height: h } = view;
  if (p && !p.behind) {
    const x = clamp(p.x, 30, w - 30);
    const y = clamp(p.y, 70, h - 30);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.restore();
    text(ctx, target.label, x, y - 18, 13, AMBER, 'center', 700);
    text(ctx, distText, x, y + 30, 12, INK, 'center', 600);
  } else {
    // Off-screen or behind: an arrow on the screen edge pointing the way.
    const angle = view.targetBearingAngle ?? 0;
    const x = w / 2 + Math.sin(angle) * (w * 0.36);
    const y = h / 2 - Math.cos(angle) * (h * 0.3);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(9, 10);
    ctx.lineTo(-9, 10);
    ctx.closePath();
    ctx.fillStyle = AMBER;
    ctx.fill();
    ctx.restore();
    text(ctx, `${target.label} ${distText}`, x, y + 30, 12, AMBER, 'center', 700);
  }
}

/** Draws everything over the scene for one frame. `view` carries the whole game state. */
export function drawHud(ctx, view) {
  const { width: w, height: h, plane, mission } = view;
  const altitudeFt = plane.pos[1] * 3.281;
  const knots = plane.speed * 1.944;
  const headingDeg = ((plane.heading * 180 / Math.PI) % 360 + 360) % 360;
  const vsi = view.vsi ?? 0;

  if (view.screen === 'flying' || view.screen === 'paused') {
    drawCompass(ctx, w, headingDeg);
    // Digital readouts under the tape.
    text(ctx, `ALT ${Math.round(altitudeFt)} FT`, w / 2 - 128, 82, 14, INK, 'center', 700);
    text(ctx, `SPD ${Math.round(knots)} KT`, w / 2 + 128, 82, 14, INK, 'center', 700);

    // The sortie panel, top-left.
    panel(ctx, 14, 12, 252, mission.mode === 'circuit' ? 108 : 84);
    const phaseNames = {
      takeoff: 'TAKE OFF', rings: 'RING CIRCUIT', drop: 'SUPPLY DROP', landing: 'FINAL — LAND', done: 'SORTIE COMPLETE', free: 'FREE FLIGHT',
    };
    text(ctx, phaseNames[mission.phase] ?? '', 28, 38, 15, AMBER, 'left', 800);
    text(ctx, `SCORE ${mission.score}`, 28, 62, 14, INK, 'left', 700);
    text(ctx, `TIME ${formatTime(mission.elapsed)}`, 140, 62, 14, INK, 'left', 600);
    if (mission.mode === 'circuit') {
      for (let i = 0; i < 6; i += 1) {
        ctx.beginPath();
        ctx.arc(36 + i * 22, 88, 7, 0, Math.PI * 2);
        ctx.fillStyle = mission.ringsPassed[i] ? GREEN : i === mission.ringIndex && mission.phase === 'rings' ? AMBER : 'rgba(255,255,255,0.22)';
        ctx.fill();
      }
      text(ctx, 'RINGS', 176, 92, 11, DIM, 'left', 700);
      text(ctx, `FUEL ${Math.round(plane.fuel)}%`, 28, 112, 12, plane.fuel < 25 ? RED : DIM, 'left', 700);
    }

    // Gauges along the bottom.
    const gy = h - 86;
    drawAltimeter(ctx, 92, gy, 62, altitudeFt);
    text(ctx, `VSI ${vsi >= 0 ? '+' : ''}${vsi.toFixed(1)}`, 92, gy + 84, 12, DIM, 'center', 700);
    drawAttitude(ctx, w / 2, gy + 6, 52, plane.pitch, plane.roll);
    drawAirspeed(ctx, w - 92, gy, 62, knots);

    // Bars bottom-centre-left: throttle, fuel, damage, and the lever lights.
    const bx = w / 2 + 84;
    drawBar(ctx, bx, gy - 26, 120, 'THR', plane.throttle, '#7fb2e0', `${Math.round(plane.throttle * 100)}%`);
    drawBar(ctx, bx, gy + 2, 120, 'FUEL', plane.fuel / PLANE.fuelCapacity, plane.fuel < 25 ? RED : '#8fd07a', '');
    drawBar(ctx, bx, gy + 30, 120, 'DMG', plane.damage / 100, plane.damage > 50 ? RED : '#d08a7a', `${Math.round(plane.damage)}%`);
    if (plane.flaps) text(ctx, 'FLAPS', bx + 4, gy + 62, 12, GREEN, 'left', 800);
    if (plane.brakes && plane.onGround) text(ctx, 'BRAKES', bx + 64, gy + 62, 12, AMBER, 'left', 800);
    if (view.cameraMode === 'cockpit') text(ctx, 'COCKPIT CAM', bx + 150, gy + 62, 12, DIM, 'left', 700);

    // The crosshair, when airborne in chase view.
    if (view.cameraMode === 'chase') {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 11, 0, Math.PI * 2);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fill();
    }

    drawTargetMarker(ctx, view);

    // The mission message banner.
    if (mission.message && view.time < mission.messageUntil) {
      ctx.font = '700 17px system-ui, sans-serif';
      const tw = ctx.measureText(mission.message).width + 36;
      panel(ctx, w / 2 - tw / 2, 96, tw, 34);
      text(ctx, mission.message, w / 2, 119, 17, INK, 'center', 700);
    }

    // Warnings, centre screen, in priority order.
    const alerts = [];
    if (plane.stalled) alerts.push(['STALL', RED]);
    if (view.alerts.pullUp) alerts.push(['PULL UP', RED]);
    if (plane.fuel <= 0 && !plane.onGround) alerts.push(['ENGINE OUT — GLIDE', RED]);
    else if (plane.fuel < 25 && plane.fuel > 0) alerts.push(['LOW FUEL', AMBER]);
    alerts.forEach(([label, color], i) => {
      if (color === RED && Math.floor(view.time * 3) % 2 === 0 && label === 'STALL') return; // the stall warning flashes
      text(ctx, label, w / 2, h * 0.3 + i * 26, 21, color, 'center', 800);
    });

    if (view.muted) text(ctx, 'SOUND OFF (M)', w - 16, 26, 12, DIM, 'right', 700);
  }

  if (view.screen === 'title') drawTitle(ctx, view);
  if (view.screen === 'paused') {
    shade(ctx, w, h, 0.45);
    text(ctx, 'PAUSED', w / 2, h / 2 - 10, 34, INK, 'center', 800);
    text(ctx, 'P to resume · R to restart · M sound', w / 2, h / 2 + 26, 16, DIM, 'center', 600);
  }
  if (view.screen === 'finished') drawFinish(ctx, view);
  if (view.screen === 'crashed') drawCrash(ctx, view);
}

function shade(ctx, w, h, alpha) {
  ctx.fillStyle = `rgba(6,12,20,${alpha})`;
  ctx.fillRect(0, 0, w, h);
}

function drawTitle(ctx, view) {
  const { width: w, height: h } = view;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(6,12,20,0.5)');
  grad.addColorStop(0.55, 'rgba(6,12,20,0.08)');
  grad.addColorStop(1, 'rgba(6,12,20,0.62)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  text(ctx, 'KESTREL VALLEY', w / 2, h * 0.2, 54, INK, 'center', 800);
  text(ctx, 'AIR RALLY', w / 2, h * 0.2 + 52, 54, AMBER, 'center', 800);
  text(ctx, 'One valley. Six rings. One crate. Bring her home.', w / 2, h * 0.2 + 86, 17, DIM, 'center', 600);
  panel(ctx, w / 2 - 300, h * 0.52, 600, 128);
  text(ctx, '1 — CIRCUIT SORTIE', w / 2 - 272, h * 0.52 + 38, 19, INK, 'left', 800);
  text(ctx, 'Take off, run the rings, drop the crate, land for a grade.', w / 2 - 272, h * 0.52 + 62, 14, DIM, 'left', 500);
  text(ctx, '2 — FREE FLIGHT', w / 2 - 272, h * 0.52 + 94, 19, INK, 'left', 800);
  text(ctx, 'The same valley, no clock. The rings still pay.', w / 2 - 272, h * 0.52 + 118, 14, DIM, 'left', 500);
  text(ctx, '↑ ↓ pitch · ← → bank · A D rudder · W S throttle · F flaps · B brakes · X drop crate · C camera · P pause', w / 2, h * 0.52 + 158, 13.5, DIM, 'center', 600);
  text(ctx, '…or steer with the mouse, and roll the wheel for throttle.', w / 2, h * 0.52 + 180, 13.5, DIM, 'center', 600);
  if (view.best > 0) text(ctx, `BEST SORTIE ${view.best}`, w / 2, h * 0.52 + 214, 15, AMBER, 'center', 800);
}

function drawFinish(ctx, view) {
  const { width: w, height: h, mission, plane } = view;
  shade(ctx, w, h, 0.5);
  panel(ctx, w / 2 - 250, h / 2 - 168, 500, 336);
  text(ctx, 'SORTIE COMPLETE', w / 2, h / 2 - 122, 27, AMBER, 'center', 800);
  const landing = mission.landing;
  const gradeNames = { perfect: 'PERFECT', good: 'GOOD', firm: 'FIRM', hard: 'HARD' };
  const rows = [
    [`Rings — ${mission.ringsFlown} of 6`, `${mission.ringsFlown * SCORE.ring}`],
    ['Ring time bonus', `${mission.timeBonus}`],
    ['Supply drop', mission.dropPoints === null ? '—' : `${mission.dropPoints}`],
    [`Landing — ${landing ? gradeNames[landing.grade] : '—'}${landing ? ` (${landing.sink.toFixed(1)} m/s)` : ''}`, `${mission.landingPoints}`],
    ['Damage penalty', `−${Math.round(plane.damage) * SCORE.damagePerPoint}`],
  ];
  rows.forEach(([label, value], i) => {
    const y = h / 2 - 76 + i * 32;
    text(ctx, label, w / 2 - 210, y, 16, INK, 'left', 600);
    text(ctx, value, w / 2 + 210, y, 16, INK, 'right', 700);
  });
  text(ctx, `TOTAL ${mission.score}`, w / 2, h / 2 + 96, 26, INK, 'center', 800);
  if (view.isBest) text(ctx, 'NEW BEST', w / 2, h / 2 + 122, 14, GREEN, 'center', 800);
  text(ctx, 'R — fly it again · Enter — title', w / 2, h / 2 + 152, 14, DIM, 'center', 600);
}

function drawCrash(ctx, view) {
  const { width: w, height: h, mission } = view;
  shade(ctx, w, h, 0.55);
  text(ctx, 'DOWN', w / 2, h / 2 - 60, 44, RED, 'center', 800);
  text(ctx, mission.crashReason ?? 'The flight ended in the terrain.', w / 2, h / 2 - 16, 18, INK, 'center', 600);
  text(ctx, `Score when it ended: ${mission.score} · Rings: ${mission.ringsFlown} of 6`, w / 2, h / 2 + 18, 16, DIM, 'center', 600);
  text(ctx, 'R — fly again · Enter — title', w / 2, h / 2 + 58, 15, DIM, 'center', 600);
}
