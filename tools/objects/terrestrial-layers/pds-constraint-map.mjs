import sharp from 'sharp';
import { paintMissingCoverage } from '../../../src/platform/prepare-missing-coverage.mjs';

/** Map the archive's categorical vertex flags, with nearest-grid sampling.
 * Colours are an authored legend, never a surface photograph or albedo map. */
export async function preparePdsConstraintMap(mesh, recipe) {
  if (recipe.kind === 'plate-coverage') return preparePlateCoverage(mesh, recipe);
  const { width, height, stepDegrees, colors, gridFlags = [] } = recipe;
  if (!Number.isInteger(width) || width !== height * 2 || width < 16 || width > 4096 ||
      !(stepDegrees > 0) || 180 % stepDegrees || !mesh.coordinates || !mesh.constraintFlags ||
      ![1, 2, 3].every(flag => /^#[0-9a-f]{6}$/i.test(colors?.[flag])) ||
      !Array.isArray(gridFlags) || new Set(gridFlags).size !== gridFlags.length ||
      gridFlags.some(flag => ![1, 2, 3].includes(flag))) throw new TypeError('Invalid PDS constraint map recipe.');
  const cells = new Map();
  for (const [i, [latitude, longitude]] of mesh.coordinates.entries()) {
    const key = `${latitude},${longitude}`;
    if (latitude % stepDegrees || longitude % stepDegrees || cells.has(key)) throw new Error('PDS constraint grid is not unique and regular.');
    cells.set(key, mesh.constraintFlags[i]);
  }
  const palette = Object.fromEntries([1, 2, 3].map(flag => [flag, Buffer.from(colors[flag].slice(1), 'hex')]));
  const data = Buffer.alloc(width * height * 3);
  const gridded = gridFlags.length ? new Uint8Array(width * height) : null;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const latitude = Math.round((90 - (y + .5) * 180 / height) / stepDegrees) * stepDegrees;
    const longitude = Math.abs(latitude) === 90 ? 0 : (Math.round((x + .5) * 360 / width / stepDegrees) * stepDegrees) % 360;
    const flag = cells.get(`${latitude},${longitude}`);
    if (!palette[flag]) throw new Error(`Missing PDS constraint cell ${latitude},${longitude}.`);
    palette[flag].copy(data, (y * width + x) * 3);
    if (gridded) gridded[y * width + x] = Number(gridFlags.includes(flag));
  }
  const raw = { width, height, channels: 3 };
  return sharp(gridded ? paintMissingCoverage(data, raw, gridded) : data, { raw }).png().toBuffer();
}

/** Source plate flags own the coverage boundary. The shared gap grid marks
 * both the fitted ellipsoid and its artificial joins, never observed terrain.
 * Sampling and painting happen before any material filtering or lighting. */
async function preparePlateCoverage(mesh, { width, height, observedColor }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width !== height * 2 || width < 16 || width > 4096 ||
      !/^#[0-9a-f]{6}$/i.test(observedColor) || typeof mesh.hit !== 'function' ||
      !mesh.faceProvenance?.length || mesh.faceProvenance.length !== mesh.indices?.length ||
      mesh.faceProvenance.some(flag => ![0, 1, 2].includes(flag))) throw new TypeError('Invalid PDS plate coverage recipe.');
  const color = Buffer.from(observedColor.slice(1), 'hex');
  const data = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const longitude = (x + .5) * 360 / width, latitude = 90 - (y + .5) * 180 / height;
    const hit = mesh.hit(longitude, latitude);
    if (!hit || !Number.isInteger(hit.faceId) || mesh.faceProvenance[hit.faceId] === undefined) {
      throw new Error(`Missing PDS plate coverage at ${longitude},${latitude}.`);
    }
    const i = y * width + x;
    color.copy(data, i * 3);
    missing[i] = Number(mesh.faceProvenance[hit.faceId] !== 0);
  }
  const raw = { width, height, channels: 3 };
  return sharp(paintMissingCoverage(data, raw, missing), { raw }).png().toBuffer();
}
