// Everything bolted to the valley that is not terrain or the aeroplane: the home strip
// with its markings and windsock, Kestrel Town's rooftops, the pine woods, drifting
// clouds, the course rings and the supply-drop marker. All of it is pushed into the
// same polygon queue as the terrain, so it sorts and fogs with the world.

import { COLORS, RUNWAY, WORLD } from './config.js';
import { hashCell, createRandom } from './random.js';
import { groundHeight } from './terrain.js';

const FIELD_Y = WORLD.fieldLevel;

/** A flat quad lying on the ground plane at height y. */
function groundQuad(renderer, x0, z0, x1, z1, y, color, options) {
  renderer.addPoly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], color, options ?? { flat: true });
}

/** An axis-aligned box sitting on the ground at (x, z), drawn with shaded faces. */
function drawBox(renderer, x, z, w, h, d, color, baseY) {
  const y0 = baseY ?? groundHeight(x, z);
  const y1 = y0 + h;
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const z0 = z - d / 2;
  const z1 = z + d / 2;
  const c = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const faces = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7]];
  for (const face of faces) renderer.addPoly(face.map((i) => c[i]), color);
}

/** The home strip: mowed grass, asphalt, threshold bars, centreline and PAPI lights. */
export function drawRunway(renderer) {
  const y = FIELD_Y + 0.12;
  groundQuad(renderer, -34, RUNWAY.zFar - 60, 34, RUNWAY.zNear + 60, FIELD_Y + 0.05, [104, 156, 78], { flat: true });
  groundQuad(renderer, -RUNWAY.width / 2, RUNWAY.zFar - 30, RUNWAY.width / 2, RUNWAY.zNear + 30, y, COLORS.asphalt, { flat: true });
  // Threshold bars at both ends.
  for (const end of [RUNWAY.zNear - 14, RUNWAY.zFar + 14]) {
    for (let i = 0; i < 4; i += 1) {
      const bx = -12 + i * 6.4;
      groundQuad(renderer, bx, end - 5, bx + 3.4, end + 5, y + 0.03, COLORS.marking, { flat: true });
    }
  }
  // Centreline dashes.
  for (let z = RUNWAY.zFar + 40; z < RUNWAY.zNear - 40; z += 46) {
    groundQuad(renderer, -0.8, z, 0.8, z + 22, y + 0.03, COLORS.marking, { flat: true });
  }
  // PAPI lights beside the south threshold: two white, two red, as they should be.
  const papi = [[255, 255, 255], [255, 255, 255], [230, 60, 50], [230, 60, 50]];
  papi.forEach((color, i) => {
    renderer.addDisc([-24 - i * 3.2, FIELD_Y + 1.1, RUNWAY.zNear - 26], 0.85, 0.85, color, 0.95);
  });
  // A hangar and fuel drums east of the strip.
  drawBox(renderer, 68, 330, 34, 9, 26, [150, 96, 74]);
  drawBox(renderer, 68, 330, 36, 2.2, 28, [96, 88, 84], FIELD_Y + 9);
  drawBox(renderer, 46, 292, 3, 2.2, 3, COLORS.planeRed);
  drawBox(renderer, 50, 292, 3, 2.2, 3, [70, 90, 130]);
}

/** The windsock by the strip, leaning with a slow swing. */
export function drawWindsock(renderer, time) {
  const x = -30;
  const z = 300;
  const top = FIELD_Y + 9;
  renderer.addPoly([[x - 0.18, FIELD_Y, z], [x + 0.18, FIELD_Y, z], [x + 0.18, top, z], [x - 0.18, top, z]], [210, 210, 210], { flat: true });
  const sway = Math.sin(time * 0.7) * 0.5;
  const dir = [Math.cos(sway) * 0.9, -0.18, Math.sin(sway) * 0.9];
  const tip = [x + dir[0] * 4.4, top + dir[1] * 4.4, z + dir[2] * 4.4];
  renderer.addPoly([[x, top, z], tip, [tip[0], tip[1] - 1.1, tip[2]]], [232, 120, 40], { flat: true });
  renderer.addPoly([[x, top - 1.3, z], tip, [tip[0], tip[1] - 1.1, tip[2]]], [240, 240, 240], { flat: true });
}

/** Kestrel Town: a few dozen pastel houses and one church tower on the east bench. */
export function drawTown(renderer, camX, camZ) {
  if (Math.hypot(760 - camX, -980 - camZ) > 2600) return;
  const wallColors = [[216, 196, 164], [198, 164, 138], [224, 216, 200], [188, 178, 168], [206, 182, 150]];
  const roofColors = [[140, 74, 58], [96, 100, 108], [120, 84, 62]];
  // Two roads crossing at the square.
  groundQuad(renderer, 640, -996, 880, -964, 15.15, [88, 86, 84], { flat: true });
  groundQuad(renderer, 744, -1180, 776, -780, 15.15, [88, 86, 84], { flat: true });
  for (let i = 0; i < 30; i += 1) {
    const hx = hashCell(i, 77);
    const hz = hashCell(31, i);
    const x = 640 + hx * 240;
    const z = -1180 + hz * 400;
    if (Math.abs(x - 760) < 26 && Math.abs(z + 980) < 26) continue; // the square stays clear
    if (Math.abs(x - 760) < 20 || Math.abs(z + 980) < 20) continue; // and so do the roads
    const w = 15 + hashCell(i, 5) * 15;
    const d = 13 + hashCell(9, i) * 12;
    const h = 7 + hashCell(i, 11) * 13;
    const base = groundHeight(x, z);
    drawBox(renderer, x, z, w, h, d, wallColors[i % wallColors.length], base);
    drawBox(renderer, x, z, w + 2.5, 2.4, d + 2.5, roofColors[i % roofColors.length], base + h);
  }
  // The church: a taller nave and a tower with a spire.
  drawBox(renderer, 700, -1080, 16, 13, 26, [228, 222, 208]);
  drawBox(renderer, 700, -1080, 18, 2.6, 28, [110, 96, 88], groundHeight(700, -1080) + 13);
  drawBox(renderer, 688, -1092, 7, 24, 7, [228, 222, 208]);
  const spireBase = groundHeight(688, -1092) + 24;
  renderer.addPoly([[684, spireBase, -1096], [692, spireBase, -1096], [688, spireBase + 8, -1092]], [110, 96, 88]);
  renderer.addPoly([[692, spireBase, -1096], [692, spireBase, -1088], [688, spireBase + 8, -1092]], [110, 96, 88]);
  renderer.addPoly([[692, spireBase, -1088], [684, spireBase, -1088], [688, spireBase + 8, -1092]], [110, 96, 88]);
  renderer.addPoly([[684, spireBase, -1088], [684, spireBase, -1096], [688, spireBase + 8, -1092]], [110, 96, 88]);
}

/**
 * The pine woods: hash-scattered trees on the lower slopes, drawn only near the camera.
 * A tree is a trunk and two stacked four-sided cones; from the air they read as forest.
 */
export function drawTrees(renderer, camX, camZ) {
  const CELL = 95;
  const RADIUS = 10;
  const ci = Math.round(camX / CELL);
  const cj = Math.round(camZ / CELL);
  for (let j = cj - RADIUS; j <= cj + RADIUS; j += 1) {
    for (let i = ci - RADIUS; i <= ci + RADIUS; i += 1) {
      const density = hashCell(i * 3 + 1, j * 7 + 2);
      if (density < 0.52) continue;
      const x = i * CELL + (hashCell(i, j) - 0.5) * 60;
      const z = j * CELL + (hashCell(j, i) - 0.5) * 60;
      if (Math.abs(x) < 90 && Math.abs(z) < 620) continue; // not on the strip
      if (Math.hypot(x - 760, z + 980) < 300) continue; // not in town
      const h = groundHeight(x, z);
      if (h < WORLD.waterLevel + 1.5 || h > 150) continue;
      const s = 0.8 + hashCell(i + 40, j + 9) * 0.7;
      drawTree(renderer, x, z, h, s);
    }
  }
}

function drawTree(renderer, x, z, base, s) {
  const trunkTop = base + 3.2 * s;
  renderer.addPoly(
    [[x - 0.5 * s, base, z], [x + 0.5 * s, base, z], [x + 0.35 * s, trunkTop, z], [x - 0.35 * s, trunkTop, z]],
    COLORS.treeTrunk,
  );
  cone(renderer, x, trunkTop - 0.5, z, 4.6 * s, 7.5 * s);
  cone(renderer, x, trunkTop + 3.4 * s, z, 3.3 * s, 6 * s);
}

function cone(renderer, x, yBase, z, radius, height) {
  const apex = [x, yBase + height, z];
  const corners = [
    [x + radius, yBase, z], [x, yBase, z + radius], [x - radius, yBase, z], [x, yBase, z - radius],
  ];
  for (let i = 0; i < 4; i += 1) {
    renderer.addPoly([corners[i], corners[(i + 1) % 4], apex], COLORS.tree);
  }
}

// Clouds are placed once from a fixed seed and drift a few metres a minute.
const CLOUDS = (() => {
  const rand = createRandom(7);
  const list = [];
  for (let i = 0; i < 42; i += 1) {
    list.push({
      x: (rand() - 0.5) * 5600,
      y: 400 + rand() * 190,
      z: (rand() - 0.5) * 5600,
      s: 60 + rand() * 130,
    });
  }
  return list;
})();

/** Soft white cloud puffs: three overlapping discs each, drifting slowly east. */
export function drawClouds(renderer, time) {
  for (const cloud of CLOUDS) {
    const x = cloud.x + ((time * 2.2) % 400);
    renderer.addDisc([x, cloud.y, cloud.z], cloud.s, cloud.s * 0.32, [255, 255, 255], 0.62);
    renderer.addDisc([x - cloud.s * 0.5, cloud.y - 6, cloud.z + 10], cloud.s * 0.62, cloud.s * 0.22, [255, 255, 255], 0.5);
    renderer.addDisc([x + cloud.s * 0.55, cloud.y - 4, cloud.z - 8], cloud.s * 0.55, cloud.s * 0.2, [248, 250, 252], 0.5);
  }
}

/**
 * One course ring: a ribbon torus facing its course direction. `state` is 'next'
 * (amber, pulsing), 'todo' (pale), 'done' (green) or 'idle' for free flight.
 */
export function drawRing(renderer, ring, state, time) {
  const [t1, t2] = ringTangents(ring.normal);
  const color = state === 'done' ? COLORS.ringDone : state === 'next' ? COLORS.ring : [214, 200, 168];
  const pulse = state === 'next' ? 1 + Math.sin(time * 5) * 0.05 : 1;
  const radius = ring.radius * pulse;
  const SEGMENTS = 14;
  for (let i = 0; i < SEGMENTS; i += 1) {
    const a0 = (i / SEGMENTS) * Math.PI * 2;
    const a1 = ((i + 1) / SEGMENTS) * Math.PI * 2;
    const ringPoint = (a, rr) => [
      ring.pos[0] + (t1[0] * Math.cos(a) + t2[0] * Math.sin(a)) * rr,
      ring.pos[1] + (t1[1] * Math.cos(a) + t2[1] * Math.sin(a)) * rr,
      ring.pos[2] + (t1[2] * Math.cos(a) + t2[2] * Math.sin(a)) * rr,
    ];
    renderer.addPoly(
      [ringPoint(a0, radius - 1.15), ringPoint(a1, radius - 1.15), ringPoint(a1, radius + 1.15), ringPoint(a0, radius + 1.15)],
      color,
      { flat: true },
    );
  }
  if (state === 'next') {
    // A faint amber wash inside the ring, so the target reads at a distance.
    renderer.addDisc(ring.pos, ring.radius * 0.94, ring.radius * 0.94, COLORS.ring, 0.07);
  }
}

/** Two unit tangents spanning the plane a ring faces along `normal`. */
export function ringTangents(normal) {
  const helper = Math.abs(normal[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const t1raw = [
    helper[1] * normal[2] - helper[2] * normal[1],
    helper[2] * normal[0] - helper[0] * normal[2],
    helper[0] * normal[1] - helper[1] * normal[0],
  ];
  const len = Math.hypot(t1raw[0], t1raw[1], t1raw[2]) || 1;
  const t1 = [t1raw[0] / len, t1raw[1] / len, t1raw[2] / len];
  const t2 = [
    normal[1] * t1[2] - normal[2] * t1[1],
    normal[2] * t1[0] - normal[0] * t1[2],
    normal[0] * t1[1] - normal[1] * t1[0],
  ];
  return [t1, t2];
}

/** The supply crate, falling or fallen: a small box under a round canopy. */
export function drawCrate(renderer, crate) {
  const [x, y, z] = crate.pos;
  drawBox(renderer, x, z, 1.6, 1.4, 1.6, [168, 132, 84], y - 0.7);
  if (!crate.landed) {
    renderer.addDisc([x, y + 2.6, z], 2.6, 0.8, [232, 120, 40], 0.9);
    renderer.addPoly([[x - 2.2, y + 2.4, z], [x, y, z], [x + 0.4, y + 2.5, z]], [210, 210, 210], { flat: true });
    renderer.addPoly([[x + 2.2, y + 2.4, z], [x, y, z], [x - 0.4, y + 2.5, z]], [210, 210, 210], { flat: true });
  }
}

/** The supply-drop target: a ground circle and a pillar of light over the town square. */
export function drawDropZone(renderer, zone, time, active) {
  const y = groundHeight(zone.x, zone.z);
  const color = active ? COLORS.dropZone : [200, 170, 160];
  const SEGMENTS = 16;
  for (let i = 0; i < SEGMENTS; i += 1) {
    const a0 = (i / SEGMENTS) * Math.PI * 2;
    const a1 = ((i + 1) / SEGMENTS) * Math.PI * 2;
    renderer.addPoly(
      [
        [zone.x + Math.cos(a0) * (zone.radius - 2), y + 0.3, zone.z + Math.sin(a0) * (zone.radius - 2)],
        [zone.x + Math.cos(a1) * (zone.radius - 2), y + 0.3, zone.z + Math.sin(a1) * (zone.radius - 2)],
        [zone.x + Math.cos(a1) * zone.radius, y + 0.3, zone.z + Math.sin(a1) * zone.radius],
        [zone.x + Math.cos(a0) * zone.radius, y + 0.3, zone.z + Math.sin(a0) * zone.radius],
      ],
      color,
      { flat: true },
    );
  }
  if (active) {
    const pulse = 0.1 + 0.045 * Math.sin(time * 3.2);
    for (const [ox, oz] of [[zone.radius, 0], [-zone.radius, 0], [0, zone.radius], [0, -zone.radius]]) {
      renderer.addPoly(
        [
          [zone.x + ox * 0.94, y + 0.3, zone.z + oz * 0.94],
          [zone.x + ox, y + 0.3, zone.z + oz],
          [zone.x + ox, y + 120, zone.z + oz],
          [zone.x + ox * 0.94, y + 120, zone.z + oz * 0.94],
        ],
        color,
        { flat: true, alpha: pulse },
      );
    }
  }
}
