// A small seeded random source (mulberry32) plus a 2D value-noise helper built on cell
// hashing. Deterministic from the seed, so a screenshot scene staged from a seed is the
// same frame every time, and the valley's trees and clouds sit still between visits.

/** Returns a function giving the next random number in [0, 1) from `seed`. */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable hash of an integer cell coordinate, in [0, 1). Same cell, same value, always. */
export function hashCell(ix, iz) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise over the plane: bilinear blend of cell hashes with a soft curve. */
export function valueNoise(x, z, cellSize) {
  const fx = x / cellSize;
  const fz = z / cellSize;
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = fx - ix;
  const tz = fz - iz;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const a = hashCell(ix, iz);
  const b = hashCell(ix + 1, iz);
  const c = hashCell(ix, iz + 1);
  const d = hashCell(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
