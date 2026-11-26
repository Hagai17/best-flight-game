// A small software 3D renderer on a 2D canvas: a camera with a near plane, a queue of
// world-space polygons that are clipped, projected, flat-shaded against the sun, hazed
// with distance fog and painted far-to-near. Everything in the game — terrain, runway,
// the aircraft, the rings — is polygons pushed into this queue each frame, so the whole
// scene shares one depth order and nothing needs a library.

import { COLORS } from './config.js';

const NEAR = 0.6;
const FOG_NEAR = 550;
const FOG_FAR = 2600;
/** Direction toward the sun (late afternoon, west and a little north). */
export const SUN_DIR = normalize([-0.55, 0.62, -0.45]);

function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(a, b, t) {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}

function css(rgb, alpha) {
  return `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${alpha})`;
}

/**
 * A camera at `position` looking at `target`, with `upHint` resolving the roll.
 * Precomputes the view basis and the projection scale for a canvas of the given size.
 */
export function createCamera(position, target, upHint, fovDeg, width, height) {
  const forward = normalize([target[0] - position[0], target[1] - position[1], target[2] - position[2]]);
  const right = normalize(cross(forward, upHint));
  const up = cross(right, forward);
  const scale = (height / 2) / Math.tan((fovDeg * Math.PI) / 360);
  return { position, forward, right, up, scale, width, height };
}

/** Creates the renderer bound to a canvas. Call beginFrame, push shapes, then flush. */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let camera = null;
  let queue = [];

  /** Projects a world point to camera space [right, up, forward-depth]. */
  function toCamera(p) {
    const rel = [p[0] - camera.position[0], p[1] - camera.position[1], p[2] - camera.position[2]];
    return [dot(rel, camera.right), dot(rel, camera.up), dot(rel, camera.forward)];
  }

  function toScreen(c) {
    return [camera.width / 2 + (c[0] * camera.scale) / c[2], camera.height / 2 - (c[1] * camera.scale) / c[2], c[2]];
  }

  /** Clips a camera-space polygon against the near plane, Sutherland–Hodgman style. */
  function clipNear(poly) {
    const out = [];
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const aIn = a[2] >= NEAR;
      const bIn = b[2] >= NEAR;
      if (aIn) out.push(a);
      if (aIn !== bIn) {
        const t = (NEAR - a[2]) / (b[2] - a[2]);
        out.push([mix(a[0], b[0], t), mix(a[1], b[1], t), NEAR]);
      }
    }
    return out;
  }

  function fogged(rgb, depth) {
    const t = Math.min(1, Math.max(0, (depth - FOG_NEAR) / (FOG_FAR - FOG_NEAR)));
    return mixColor(rgb, COLORS.fog, t * t * 0.9);
  }

  return {
    canvas,
    ctx,

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
    },

    get width() {
      return canvas.width;
    },

    get height() {
      return canvas.height;
    },

    /**
     * Starts a frame: paints the sky as a gradient hung on the camera's pitch, with the
     * sun's disc and glow where the sun direction projects, and empties the queue.
     */
    beginFrame(cam) {
      camera = cam;
      queue = [];
      const { width, height } = canvas;
      const horizonY = height / 2 - (cam.forward[1] * cam.scale);
      const grad = ctx.createLinearGradient(0, Math.max(0, horizonY - height * 0.9), 0, Math.min(height, horizonY + height * 0.35));
      grad.addColorStop(0, css(COLORS.skyTop, 1));
      grad.addColorStop(1, css(COLORS.skyHorizon, 1));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      // The sun: project its direction far away and paint a glow and a disc.
      const sunPoint = [
        cam.position[0] + SUN_DIR[0] * 4000,
        cam.position[1] + SUN_DIR[1] * 4000,
        cam.position[2] + SUN_DIR[2] * 4000,
      ];
      const sc = toCamera(sunPoint);
      if (sc[2] > NEAR) {
        const [sx, sy] = toScreen(sc);
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, height * 0.36);
        glow.addColorStop(0, 'rgba(255,240,205,0.55)');
        glow.addColorStop(1, 'rgba(255,240,205,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = css(COLORS.sun, 0.95);
        ctx.beginPath();
        ctx.arc(sx, sy, height * 0.028, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    /**
     * Queues a world-space polygon. Unless `flat` is set, its colour is flat-shaded by
     * its face normal against the sun; `alpha` under 1 blends it; fog applies by depth.
     */
    addPoly(points, rgb, options = {}) {
      if (!camera || points.length < 3) return;
      let cam1 = points.map(toCamera);
      if (cam1.every((c) => c[2] < NEAR)) return;
      cam1 = clipNear(cam1);
      if (cam1.length < 3) return;
      let depth = 0;
      for (const c of cam1) depth += c[2];
      depth /= cam1.length;
      let color = rgb;
      if (!options.flat) {
        const a = points[0];
        const b = points[1];
        const c = points[2];
        const n = normalize(cross(
          [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
          [c[0] - a[0], c[1] - a[1], c[2] - a[2]],
        ));
        const light = 0.52 + 0.55 * Math.abs(dot(n, SUN_DIR));
        color = [color[0] * light, color[1] * light, color[2] * light];
      }
      const screen = cam1.map(toScreen);
      queue.push({
        depth,
        draw() {
          ctx.beginPath();
          ctx.moveTo(screen[0][0], screen[0][1]);
          for (let i = 1; i < screen.length; i += 1) ctx.lineTo(screen[i][0], screen[i][1]);
          ctx.closePath();
          ctx.fillStyle = css(fogged(color, depth), options.alpha ?? 1);
          ctx.fill();
          if (options.stroke) {
            ctx.strokeStyle = css(fogged(options.stroke, depth), options.alpha ?? 1);
            ctx.lineWidth = options.strokeWidth ?? 2;
            ctx.stroke();
          }
        },
      });
    },

    /** Queues a camera-facing soft disc (clouds, the propeller blur) at a world point. */
    addDisc(center, radiusX, radiusY, rgb, alpha) {
      if (!camera) return;
      const c = toCamera(center);
      if (c[2] < NEAR) return;
      const [sx, sy] = toScreen(c);
      const rx = (radiusX * camera.scale) / c[2];
      const ry = (radiusY * camera.scale) / c[2];
      queue.push({
        depth: c[2],
        draw() {
          ctx.beginPath();
          ctx.ellipse(sx, sy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
          ctx.fillStyle = css(fogged(rgb, c[2]), alpha);
          ctx.fill();
        },
      });
    },

    /** Paints everything queued, far to near. */
    flush() {
      queue.sort((a, b) => b.depth - a.depth);
      for (const item of queue) item.draw();
      queue = [];
    },
  };
}
