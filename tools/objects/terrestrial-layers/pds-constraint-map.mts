import {decodeProfile} from './source-records.mts';
import {shape,number,text,optional,array,dictionary} from '@cssearth/core';
interface ConstraintMesh {
  coordinates?: readonly number[][]; constraintFlags?: ArrayLike<number>; faceProvenance?: ArrayLike<number>;
  indices?: readonly number[][]; hit?(longitude: number, latitude: number): {faceId: number} | null;
}
const constraintRecipe = shape({kind: optional(text),width: number,height: number,stepDegrees: number,colors: dictionary(text),gridFlags: optional(array(number))});
const plateRecipe = shape({width: number,height: number,observedColor: text});
function validFlags(flags: ArrayLike<number>, allowed: readonly number[]) {
  for (let i=0; i<flags.length; i++) if (!allowed.includes(flags[i])) return false;
  return true;
}
import sharp from 'sharp';
import { paintMissingCoverage } from '@cssearth/bake/raster';

/** Map the archive's categorical vertex flags, with nearest-grid sampling.
 * Colours are an authored legend, never a surface photograph or albedo map. */
export async function preparePdsConstraintMap(mesh: ConstraintMesh, value: unknown) {
  const kind = shape({kind: optional(text)})(value).kind;
  if (kind === 'plate-coverage') return preparePlateCoverage(mesh, value);
  const recipe = decodeProfile(constraintRecipe,value,'Invalid PDS constraint map recipe.');
  const { width, height, stepDegrees, colors, gridFlags = [] } = recipe;
  if (!Number.isInteger(width) || width !== height * 2 || width < 16 || width > 4096 ||
      !(stepDegrees > 0) || 180 % stepDegrees || !mesh.coordinates || !mesh.constraintFlags ||
      ![1, 2, 3].every(flag => /^#[0-9a-f]{6}$/i.test(colors?.[flag])) ||
      !Array.isArray(gridFlags) || new Set(gridFlags).size !== gridFlags.length ||
      gridFlags.some(flag => ![1, 2, 3].includes(flag))) throw new TypeError('Invalid PDS constraint map recipe.');
  const cells = new Map<string, number>();
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
    if (flag === undefined || !palette[flag]) throw new Error(`Missing PDS constraint cell ${latitude},${longitude}.`);
    palette[flag].copy(data, (y * width + x) * 3);
    if (gridded) gridded[y * width + x] = Number(gridFlags.includes(flag));
  }
  const raw = { width, height, channels: 3 as const };
  return sharp(gridded ? paintMissingCoverage(data, raw, gridded) : data, { raw }).png().toBuffer();
}

/** Source plate flags own the coverage boundary. The shared gap grid marks
 * both the fitted ellipsoid and its artificial joins, never observed terrain.
 * Sampling and painting happen before any material filtering or lighting. */
async function preparePlateCoverage(mesh: ConstraintMesh, value: unknown) {
  const {width,height,observedColor} = decodeProfile(plateRecipe,value,'Invalid PDS plate coverage recipe.');
  if (!Number.isInteger(width) || !Number.isInteger(height) || width !== height * 2 || width < 16 || width > 4096 ||
      !/^#[0-9a-f]{6}$/i.test(observedColor) || typeof mesh.hit !== 'function' ||
      !mesh.faceProvenance?.length || mesh.faceProvenance.length !== mesh.indices?.length ||
      !validFlags(mesh.faceProvenance, [0, 1, 2])) throw new TypeError('Invalid PDS plate coverage recipe.');
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
  const raw = { width, height, channels: 3 as const };
  return sharp(paintMissingCoverage(data, raw, missing), { raw }).png().toBuffer();
}
