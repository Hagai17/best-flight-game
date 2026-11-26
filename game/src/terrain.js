// The valley itself: an analytic heightfield (so the flight model and the renderer always
// agree on where the ground is) with a river carved down its middle, a lake basin in the
// north-west, a flat airport plateau at the origin and a town bench to the east. Colour is
// decided per quad from height, slope and a field-parcel hash, which is what makes the
// farmland patchwork read from the air.

import { COLORS, WORLD } from './config.js';
import { hashCell, valueNoise } from './random.js';
import { SUN_DIR } from './renderer3d.js';

/** Flat-shades a colour by a face normal against the sun, the renderer's own formula. */
function shadeByNormal(rgb, nx, ny, nz) {
  const len = Math.hypot(nx, ny, nz) || 1;
  const d = Math.abs((nx * SUN_DIR[0] + ny * SUN_DIR[1] + nz * SUN_DIR[2]) / len);
  const light = 0.52 + 0.55 * d;
  return [rgb[0] * light, rgb[1] * light, rgb[2] * light];
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edgeFar, edgeNear, v) {
  const t = clamp((edgeFar - v) / (edgeFar - edgeNear), 0, 1);
  return t * t * (3 - 2 * t);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(a, b, t) {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}

/** The river's centreline: it wanders east of the strip and north up the valley. */
export function valleyCenterX(z) {
  return 620 + 380 * Math.sin(z * 0.0006) + 150 * Math.sin(z * 0.0017);
}

/** Ground height in metres at a world point. The one source of truth for terrain. */
export function groundHeight(x, z) {
  const vx = valleyCenterX(z);
  const dv = Math.abs(x - vx);
  let h = 30
    + 20 * Math.sin(x * 0.0016 + 1.7) * Math.cos(z * 0.0013 - 0.6)
    + 26 * valueNoise(x, z, 700)
    + 9 * valueNoise(x, z, 260);
  // The valley floor: pulled down toward the river.
  const valley = smoothstep(520, 60, dv);
  h = mix(h, 4.2 + 2.4 * valueNoise(x, z, 300), valley * 0.94);
  // Hills climbing away from the valley on both sides.
  const rise = smoothstep(450, 2400, dv);
  h += rise * rise * (250 + 170 * valueNoise(x + 900, z, 800));
  // The rim mountains at the edge of the world.
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += smoothstep(2100, 3100, edge) * 430;
  // The airport plateau: an ellipse around the strip, flat at field level.
  const da = Math.hypot(x * 1.25, z * 0.8);
  h = mix(h, WORLD.fieldLevel, smoothstep(780, 330, da));
  // The approach corridor: a flat swathe along the strip's axis both ways, so a
  // glide path in or a climb-out away never meets a hillside the strip cannot explain.
  const corridor = smoothstep(170, 70, Math.abs(x)) * smoothstep(1750, 1000, Math.abs(z));
  h = mix(h, WORLD.fieldLevel, corridor * 0.92);
  // The town bench, east of the strip.
  const dt = Math.hypot(x - 760, z + 980);
  h = mix(h, 15, smoothstep(430, 200, dt));
  // The lake basin, north-west.
  const dl = Math.hypot(x + 1500, z + 1500);
  h = mix(h, 3.0, smoothstep(560, 260, dl));
  return h;
}

/** True when the ground at a point lies under the water level (river or lake bed). */
export function isWater(x, z) {
  return groundHeight(x, z) < WORLD.waterLevel - 0.4;
}

/** The parcel palette for the valley farmland. */
const FIELD_COLORS = [COLORS.grassLight, COLORS.grassDark, COLORS.fieldTan, COLORS.fieldPlough, COLORS.grassLight];

/**
 * The unshaded colour of a terrain quad from its centre height, its slope (0 = flat,
 * 1 = vertical) and where it sits: sand at the waterline, farmland parcels on the valley
 * floor, grass on the hills, rock where it is steep, snow on the high rim.
 */
export function groundColor(x, z, h, slope) {
  if (h < WORLD.waterLevel + 1.6) return COLORS.sand;
  const dv = Math.abs(x - valleyCenterX(z));
  let color;
  if (dv < 520 && h < 46) {
    const parcel = hashCell(Math.floor(x / 170), Math.floor(z / 170));
    color = FIELD_COLORS[Math.floor(parcel * FIELD_COLORS.length) % FIELD_COLORS.length];
    color = mixColor(color, COLORS.grassDark, valueNoise(x, z, 90) * 0.35);
  } else {
    color = mixColor(COLORS.grassDark, COLORS.grassLight, valueNoise(x, z, 160));
  }
  if (slope > 0.32) color = mixColor(color, COLORS.rock, clamp((slope - 0.32) * 2.4, 0, 0.9));
  if (h > 300) color = mixColor(color, COLORS.snow, clamp((h - 300) / 160, 0, 1) * (0.5 + 0.5 * valueNoise(x, z, 120)));
  return color;
}

const CELL = 55;
const HALF_CELLS = 30;

/**
 * Pushes the terrain around the camera into the renderer's polygon queue: a grid of
 * quads, each split into two flat-shaded triangles, plus flat water quads wherever the
 * ground dips under the water level. Corner heights are sampled once per grid node.
 */
export function drawTerrain(renderer, camX, camZ) {
  const baseIx = Math.round(camX / CELL);
  const baseIz = Math.round(camZ / CELL);
  const heights = new Float32Array((HALF_CELLS * 2 + 1) * (HALF_CELLS * 2 + 1));
  const stride = HALF_CELLS * 2 + 1;
  for (let j = 0; j < stride; j += 1) {
    for (let i = 0; i < stride; i += 1) {
      heights[j * stride + i] = groundHeight((baseIx + i - HALF_CELLS) * CELL, (baseIz + j - HALF_CELLS) * CELL);
    }
  }
  const heightAt = (i, j) => heights[j * stride + i];
  for (let j = 0; j < HALF_CELLS * 2; j += 1) {
    for (let i = 0; i < HALF_CELLS * 2; i += 1) {
      const x0 = (baseIx + i - HALF_CELLS) * CELL;
      const z0 = (baseIz + j - HALF_CELLS) * CELL;
      const x1 = x0 + CELL;
      const z1 = z0 + CELL;
      const h00 = heightAt(i, j);
      const h10 = heightAt(i + 1, j);
      const h01 = heightAt(i, j + 1);
      const h11 = heightAt(i + 1, j + 1);
      const cx = x0 + CELL / 2;
      const cz = z0 + CELL / 2;
      const hc = (h00 + h10 + h01 + h11) / 4;
      // Slope from the diagonal gradient, 0 flat to ~1 vertical.
      const slope = clamp(Math.hypot(h10 - h00 + h11 - h01, h01 - h00 + h11 - h10) / (2 * CELL) / 1.4, 0, 1);
      // One normal for the whole quad, so its two triangles shade as one facet and the
      // diagonal between them never shows.
      const shaded = shadeByNormal(
        groundColor(cx, cz, hc, slope),
        -(h10 - h00 + h11 - h01) / 2,
        CELL,
        -(h01 - h00 + h11 - h10) / 2,
      );
      renderer.addPoly([[x0, h00, z0], [x1, h10, z0], [x1, h11, z1]], shaded, { flat: true });
      renderer.addPoly([[x0, h00, z0], [x1, h11, z1], [x0, h01, z1]], shaded, { flat: true });
      if (hc < WORLD.waterLevel) {
        const w = WORLD.waterLevel;
        renderer.addPoly([[x0, w, z0], [x1, w, z0], [x1, w, z1], [x0, w, z1]], COLORS.water, { flat: true, alpha: 0.94 });
      }
    }
  }
}
