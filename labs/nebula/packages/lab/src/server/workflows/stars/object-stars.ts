/** `stars <id>`: the real stars on a nebula's picture. The telescope's `gaia-cone` asks Gaia DR3 for the cone that holds the
 * bank's field (`src/objects/<id>/.local/stars-cone.json`). The lab draws each star on its own sight line where that line
 * crosses the nebula's sky plane, with the site's catalogue renderer: seen from Earth it lands where the photograph shows
 * it, at every depth. A star's distance is not drawn: the inspection camera sits a few bank radii from the nebula, where
 * stars at their Gaia distances fall behind it or far outside its view (a sphere of them around Cas A held 7 stars, one on
 * screen). Stars are viewing context: nothing here is baked. */
import { isRecord } from '@cssearth/core';
import { parseDensityVolumeFrame, type DensityVolumeFrame, type PreparedCataloguePoint } from '@cssearth/objects';
import { gaiaBpRpDisplayColor } from '@cssearth/bake/nebula';
import { rotateWorldPosition, transposeWorldRotation, worldRotationFromQuaternion } from '@cssearth/engine';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { LabObject } from '../lab-objects.ts';

const METERS_PER_PARSEC = 3.0856775814913673e16;
export const conePath = (object: LabObject) => `${object.object}/.local/stars-cone.json`;
/** The widest cone asked: a nearby nebula's field would otherwise ask for a large part of the sky. */
export const MOST_CONE_DEG = 3;
/** The field drawn: the bank's reach on the sky, and this much beyond it, where a photograph's corners still hold stars. */
export const FIELD_MARGIN = 1.5;
/** The faintest star drawn: a photograph of a nebula shows stars well below the naked eye's limit. */
export const MAGNITUDE_LIMIT = 17;

/** The bank's frame from `object.json`: an image-layer bank's `properties.frame`, a volume's `properties.volume`. */
export function objectFrame(descriptor: unknown): DensityVolumeFrame {
  const properties = isRecord(descriptor) && isRecord(descriptor.properties) ? descriptor.properties : null;
  const frame = properties ? properties.frame ?? properties.volume : undefined;
  if (frame === undefined) throw new TypeError('object.json names no frame (properties.frame or properties.volume).');
  return parseDensityVolumeFrame(frame);
}
/** Where the object is: its frame's origin seen from the Sun, and how far its bounds reach, in parsecs. */
export function objectSky(frame: DensityVolumeFrame) {
  if (frame.referenceFrame !== 'sun-icrf') throw new TypeError(`Stars need a Sun-centred ICRS frame, not ${frame.referenceFrame}.`);
  const [x, y, z] = frame.originM, metres = Math.hypot(x, y, z);
  if (!(metres > 0)) throw new TypeError('The frame has no distance from the Sun.');
  const raDeg = ((Math.atan2(y, x) * 180 / Math.PI) % 360 + 360) % 360, decDeg = Math.asin(z / metres) * 180 / Math.PI;
  const extentPc = Math.max(...[...frame.boundsUnits.min, ...frame.boundsUnits.max].map(Math.abs)) * frame.metersPerUnit / METERS_PER_PARSEC;
  return { raDeg, decDeg, distancePc: metres / METERS_PER_PARSEC, extentPc };
}
/** The field's radius on the sky, in degrees: the bank's reach and its margin, at most `MOST_CONE_DEG`. */
export function fieldRadiusDeg(sky: { distancePc: number; extentPc: number }) {
  return Math.min(MOST_CONE_DEG, Math.atan(FIELD_MARGIN * sky.extentPc / sky.distancePc) * 180 / Math.PI);
}

interface ConeStar { sourceId: string; raDeg: number; decDeg: number; pmRaMasYr: number | null; pmDecMasYr: number | null; parallaxMas: number | null; parallaxErrorMas: number | null;
  photGMeanMag: number; bpRp: number | null; ruwe: number | null; distancePc: number | null; distanceLowerPc: number | null; distanceUpperPc: number | null }
interface Cone { query: string; service: string; retrievedAt: string; truncated: boolean; stars: ConeStar[] }
/** The answer `telescope gaia-cone --out` just wrote. The telescope owns its format; the lab reads the fields it uses
 * and checks each star's, without naming the format a second time. */
export function readCone(value: unknown): Cone {
  if (!isRecord(value) || !Array.isArray(value.stars) || typeof value.query !== 'string' || typeof value.service !== 'string' || typeof value.retrievedAt !== 'string' || typeof value.truncated !== 'boolean')
    throw new TypeError('Expected the telescope\'s gaia-cone answer (stars, query, service, retrievedAt, truncated).');
  const number = (item: unknown) => typeof item === 'number' && Number.isFinite(item), maybe = (item: unknown) => item === null || number(item);
  value.stars.forEach((star, index) => {
    if (!isRecord(star) || typeof star.sourceId !== 'string' || !number(star.raDeg) || !number(star.decDeg) || !number(star.photGMeanMag) ||
        !['pmRaMasYr', 'pmDecMasYr', 'parallaxMas', 'parallaxErrorMas', 'bpRp', 'ruwe', 'distancePc', 'distanceLowerPc', 'distanceUpperPc'].every(key => maybe(star[key])))
      throw new TypeError(`gaia-cone star ${index} lacks an identity, a position, a G magnitude or a numeric field.`);
  });
  return value as unknown as Cone;
}
const direction = (raDeg: number, decDeg: number) => { const ra = raDeg * Math.PI / 180, dec = decDeg * Math.PI / 180; return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)] as const; };

/** Runs `telescope gaia-cone` for the field's cone. */
export async function fetchObjectStars(root: string, object: LabObject, options: { radiusDeg?: number; magnitudeLimit?: number },
  stage: (message: string, fraction: number) => void) {
  stage('Reading the object frame', .05);
  const sky = objectSky(objectFrame(JSON.parse(await readFile(resolve(root, object.object, 'object.json'), 'utf8'))));
  const radiusDeg = options.radiusDeg ?? fieldRadiusDeg(sky), magnitudeLimit = options.magnitudeLimit ?? MAGNITUDE_LIMIT;
  if (!(radiusDeg > 0 && radiusDeg <= MOST_CONE_DEG)) throw new RangeError(`--radius-deg must be above 0 and at most ${MOST_CONE_DEG}.`);
  stage(`Gaia DR3 cone · ${radiusDeg.toFixed(3)}° · G < ${magnitudeLimit}`, .1);
  await mkdir(resolve(root, object.object, '.local'), { recursive: true });
  await telescope(root, ['gaia-cone', `${sky.raDeg.toFixed(6)},${sky.decDeg.toFixed(6)},${radiusDeg.toPrecision(6)}`, '--magnitude-limit', String(magnitudeLimit), '--limit', '8000', '--out', resolve(root, conePath(object))],
    line => stage(line.slice(0, 120), .5));
  stage('Reading the cone', .9);
  const cone = readCone(JSON.parse(await readFile(resolve(root, conePath(object)), 'utf8')));
  if (!cone.stars.length) throw new Error(`${object.id}: Gaia holds no star brighter than G ${magnitudeLimit} within ${radiusDeg.toFixed(3)}° of the object.`);
  return { stars: cone.stars.length, truncated: cone.truncated, radiusDeg, magnitudeLimit, path: conePath(object) };
}

function telescope(root: string, args: string[], log: (line: string) => void): Promise<void> {
  return new Promise((accept, reject) => {
    const child = spawn(process.execPath, [resolve(root, 'packages/telescope-cli/run-typed-module.mjs'), resolve(root, 'packages/telescope-cli/src/cli.mts'), ...args],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    const read = (bytes: Buffer) => { const text = bytes.toString(); tail = (tail + text).slice(-4000); for (const line of text.split('\n')) if (line.trim()) log(line.trim()); };
    child.stdout.on('data', read); child.stderr.on('data', read);
    child.once('error', reject);
    child.once('close', code => code === 0 ? accept() : reject(new Error(`telescope gaia-cone exited ${code}: ${tail.trim().split('\n').at(-1) ?? ''}`)));
  });
}

/** A star's size on screen, in pixels, by its G magnitude: 9 px at G 8, 2 px from G 15. */
export function viewingSizePx(gMagnitude: number) {
  return Math.min(9, Math.max(2, 9 - (gMagnitude - 8)));
}
/** The cone's stars inside the bank's field, each where its sight line crosses the nebula's sky plane, in the bank's frame. */
export function fieldStarPoints(frame: DensityVolumeFrame, cone: Cone): PreparedCataloguePoint[] {
  const sky = objectSky(frame), radius = fieldRadiusDeg(sky) * Math.PI / 180, toObject = direction(sky.raDeg, sky.decDeg);
  const inverse = transposeWorldRotation(worldRotationFromQuaternion(frame.localToReferenceXyzw)), distanceM = sky.distancePc * METERS_PER_PARSEC;
  return cone.stars.flatMap(star => {
    const at = direction(star.raDeg, star.decDeg), along = at[0] * toObject[0] + at[1] * toObject[1] + at[2] * toObject[2];
    if (!(Math.acos(Math.min(1, along)) <= radius)) return [];
    // The sight line meets the plane through the origin square to the line toward the object at distance / cos(angle).
    const reach = distanceM / along, offset = at.map((value, axis) => (value * reach - frame.originM[axis]!) / frame.metersPerUnit) as [number, number, number];
    return [{ id: `gaia-dr3:${star.sourceId}`, positionUnits: rotateWorldPosition(inverse, offset), sizePx: viewingSizePx(star.photGMeanMag),
      colorCss: gaiaBpRpDisplayColor(star.bpRp).colorCss, opacity: 1 }];
  });
}
/** The fetched stars as the site's catalogue points in the object's bank frame, or null before `stars <id>` has run. */
export async function objectStarPoints(root: string, object: LabObject): Promise<{ frame: DensityVolumeFrame; points: readonly PreparedCataloguePoint[]; count: number } | null> {
  let text: string;
  try { text = await readFile(resolve(root, conePath(object)), 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  const frame = objectFrame(JSON.parse(await readFile(resolve(root, object.object, 'object.json'), 'utf8')));
  const points = fieldStarPoints(frame, readCone(JSON.parse(text)));
  return { frame, points, count: points.length };
}
