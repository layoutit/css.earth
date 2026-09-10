import {parseImageDemProfile,decodeProfile} from './source-records.mts';
import { readFile } from 'node:fs/promises';
import { createIndexedShape } from './obj-shape.mts';

/** Released Cartesian elevation samples in an image plane. Missing rows remain
 * missing surface; connectivity never bridges a vacant grid cell. The explicit
 * affine XY conversion puts independent releases in one documented metre frame.
 * Z retains its source datum, apart from an authored presentation translation. */
export async function loadImageDem(path: string, profile: unknown) {
  return parseImageDem(await readFile(path, 'utf8'), profile);
}

export function parseImageDem(text: string, value: unknown) {
  const profile=decodeProfile(parseImageDemProfile,value,"Invalid image DEM grid or frame.");
  const { columns, step, xyTransform: t, zOffsetMeters, expectedVertices, expectedFaces } = profile;
  if (![3, 6].includes(columns) || !(step > 0) || !Number.isFinite(step) ||
      !Array.isArray(t) || t.length !== 6 || !t.every(Number.isFinite) ||
      !Number.isFinite(zOffsetMeters) || !Number.isSafeInteger(expectedVertices) || expectedVertices < 3 ||
      !Number.isSafeInteger(expectedFaces) || expectedFaces < 1) throw new TypeError('Invalid image DEM grid or frame.');
  const determinant = t[0] * t[4] - t[1] * t[3];
  if (Math.abs(determinant) < 1e-12) throw new TypeError('Image DEM frame is singular.');
  const rows = text.trim().split(/\r?\n/).map(line => line.trim().split(/\s+/).map(Number));
  if (rows.length !== expectedVertices || rows.some(row => row.length !== columns || !row.every(Number.isFinite))) {
    throw new TypeError('Image DEM sample dimensions or values changed.');
  }
  const minimum = [Infinity, Infinity], maximum = [-Infinity, -Infinity];
  for (const row of rows) for (let axis = 0; axis < 2; axis++) {
    minimum[axis] = Math.min(minimum[axis], row[axis]); maximum[axis] = Math.max(maximum[axis], row[axis]);
  }
  const dimensions = maximum.map((v, i) => Math.round((v - minimum[i]) / step) + 1);
  if (dimensions.some(n => n < 2 || n > 32768) || dimensions[0] * dimensions[1] > 16_000_000) {
    throw new RangeError('Image DEM grid dimensions are invalid.');
  }
  const [width, height] = dimensions, ids = new Int32Array(width * height).fill(-1);
  const positions = rows.map(([x, y, z], id) => {
    const cell = [x, y].map((v, i) => (v - minimum[i]) / step);
    if (cell.some(v => Math.abs(v - Math.round(v)) > 1e-7)) throw new TypeError('Off-grid image DEM sample.');
    const address = Math.round(cell[1]) * width + Math.round(cell[0]);
    if (ids[address] !== -1) throw new TypeError('Duplicate image DEM sample.');
    ids[address] = id;
    return [t[0] * x + t[1] * y + t[2], t[3] * x + t[4] * y + t[5], z + zOffsetMeters];
  });
  const indices: number[][] = [], cells = new Map<number,number[][]>();
  const add = (face: number[], cell: number) => {
    if (determinant < 0) face = [face[0], face[2], face[1]];
    indices.push(face);
    if (!cells.has(cell)) cells.set(cell, []);
    cells.get(cell)!.push(face);
  };
  for (let y = 0; y < height - 1; y++) for (let x = 0; x < width - 1; x++) {
    const address = y * width + x;
    const corners = [ids[address], ids[address + 1], ids[address + width + 1], ids[address + width]];
    const valid = corners.filter(i => i >= 0);
    if (valid.length === 4) {
      add([corners[0], corners[1], corners[2]], address);
      add([corners[0], corners[2], corners[3]], address);
    } else if (valid.length === 3) add(valid, address);
  }
  const mesh = createIndexedShape(positions, indices, { metersPerUnit: 1, expectedVertices, expectedFaces });
  /** Interpolate only inside a released surface triangle, preserving zero and
   * negative heights. No radial projection or bounding-box gap filling. */
  function heightAt(x: number, y: number) {
    if (![x, y].every(Number.isFinite)) return null;
    const dx = x - t[2], dy = y - t[5];
    const sx = ((t[4] * dx - t[1] * dy) / determinant - minimum[0]) / step;
    const sy = ((t[0] * dy - t[3] * dx) / determinant - minimum[1]) / step;
    if (sx < 0 || sy < 0 || sx > width - 1 || sy > height - 1) return null;
    const ix = Math.min(width - 2, Math.floor(sx)), iy = Math.min(height - 2, Math.floor(sy));
    for (const face of cells.get(iy * width + ix) ?? []) {
      const [a, b, c] = face.map(i => positions[i]);
      const abx = b[0] - a[0], aby = b[1] - a[1], acx = c[0] - a[0], acy = c[1] - a[1];
      const d = abx * acy - aby * acx;
      const u = ((x - a[0]) * acy - (y - a[1]) * acx) / d;
      const v = (abx * (y - a[1]) - aby * (x - a[0])) / d;
      if (u >= -1e-9 && v >= -1e-9 && u + v <= 1 + 1e-9) {
        return a[2] * (1 - u - v) + b[2] * u + c[2] * v - zOffsetMeters;
      }
    }
    return null;
  }
  return { ...mesh, heightAt,
    imagePlaneCoordinates: rows.map(row => [(row[0] - minimum[0]) / step,
      Math.sign(determinant) * (row[1] - minimum[1]) / step, 0]),
    imageGrid: { width, height, minimum, step, xyTransform: t, zOffsetMeters },
    coverage: { model: 'image-plane-dem', sourceVertices: rows.length, sourceFaces: indices.length,
      interpretation: 'Observed Cartesian surface only. Missing samples and the unobserved side remain open.' } };
}
