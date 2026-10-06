#!/usr/bin/env node
/** A star's rotation and brightness map from its TESS full-frame pixels.
 *
 *   node packages/telescope-cli/src/archives/tess/reduce.mts <star id>... [--keep-pixels]
 *   node packages/telescope-cli/src/archives/tess/reduce.mts --all [--keep-pixels]
 *
 * For each star already in the tree: the sectors that imaged its place, newest first; its pixels in a sector (pixels.mts);
 * its light curve and the period of its light (photometry.mts); and, when the rotation is seen, the brightness map that
 * reproduces the light curve (map.mts). A period one sector cannot vouch for is looked for in the next sector, and kept
 * when both agree. At most SECTORS_TRIED sectors are read for a star.
 *
 * The result is a receipt, output/tess/<star id>/rotation.json: every sector tried with its pinned request, what was
 * measured and why a rotation was or was not accepted, and the codes' versions. A map is written beside it as the table the
 * star pages read. Receipts are results: they stay in ignored output/ (docs/provenance/CONTRACT.md). `--all` skips a star
 * that already has a receipt. Pixels are deleted once measured unless `--keep-pixels`. */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isRecord } from '@cssearth/core';
import { WORKSPACE } from '@cssearth/telescope/node';
import { ASSUMED_TILT_DEGREES, brightnessMap, brightnessTable } from './map.mts';
import { ONE_SECTOR_DAYS, rotationVerdict, sectorLightCurve, type RotationVerdict } from './photometry.mts';
import { cadenceMinutes, fetchCutout, sectorsAt } from './pixels.mts';
import { toolchainPins } from './toolchain.mts';

export const ROTATION_SCHEMA = 'cssearth-tess-rotation@1';
/** How many sectors are read for one star, and how closely two sectors' periods must agree to confirm a long one. */
export const SECTORS_TRIED = 2, SECTOR_AGREEMENT = 0.1;
export const receiptPath = (id: string) => resolve(WORKSPACE, 'output/tess', id, 'rotation.json');

export interface StarPlace { readonly id: string; readonly name: string; readonly raDegrees: number; readonly decDegrees: number; readonly tiltDegrees?: number; readonly tiltSource?: string }
const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8').catch(() => 'null')) as unknown;

/** A star's place at J2000, where the mission's frames are indexed, and the tilt its record holds. */
export async function starPlace(id: string): Promise<StarPlace | undefined> {
  const body = await readJson(resolve(WORKSPACE, 'packages/astronomy/data/bodies', `${id}.json`)), record = await readJson(resolve(WORKSPACE, 'src/objects', id, 'source/measurements.json'));
  if (!isRecord(body) || !isRecord(body.star) || typeof body.star.rightAscensionDegrees !== 'number' || typeof body.star.declinationDegrees !== 'number') return undefined;
  const star = body.star, years = (typeof star.positionEpochJulianYear === 'number' ? star.positionEpochJulianYear : 2000) - 2000, motion = (key: string) => typeof star[key] === 'number' ? star[key] * years / 3.6e6 : 0;
  const dec = star.declinationDegrees as number - motion('properMotionDecMasPerYear'), ra = star.rightAscensionDegrees as number - motion('properMotionRaMasPerYear') / Math.cos(dec * Math.PI / 180);
  const tilt = isRecord(record) && typeof record.spinInclinationDegrees === 'number' ? { tiltDegrees: record.spinInclinationDegrees, tiltSource: `src/objects/${id}/source/measurements.json, spinInclinationDegrees` } : {};
  return { id, name: isRecord(body.physical) && typeof body.physical.name === 'string' ? body.physical.name : id, raDegrees: Number(ra.toFixed(6)), decDegrees: Number(dec.toFixed(6)), ...tilt };
}

/** The rotation two sectors agree on, when the first sector's period is too long for one sector to vouch for. */
export function confirmed(first: RotationVerdict, second: RotationVerdict | undefined): RotationVerdict {
  if (first.detected || first.periodDays === undefined || first.periodDays <= ONE_SECTOR_DAYS) return first;
  if (second?.periodDays !== undefined && Math.abs(second.periodDays - first.periodDays) <= SECTOR_AGREEMENT * first.periodDays) return { detected: true, periodDays: first.periodDays, ...(first.amplitude === undefined ? {} : { amplitude: first.amplitude }) };
  return { ...first, reason: `${first.reason ?? ''} ${second?.periodDays === undefined ? 'No second sector shows a period.' : `The next sector shows ${second.periodDays} d.`}`.trim() };
}

export async function reduceStar(id: string, keepPixels = false): Promise<Record<string, unknown>> {
  const star = await starPlace(id); if (!star) throw new Error(`${id} is not a star with a place on the sky.`);
  const run = resolve(WORKSPACE, 'output/tess', id), pixels = resolve(run, 'pixels'), pins = await toolchainPins(); await mkdir(run, { recursive: true });
  const sectors = (await sectorsAt(star.raDegrees, star.decDegrees)).reverse(), tried: Record<string, unknown>[] = [], curves: { sector: number; verdict: RotationVerdict; time: readonly number[]; flux: readonly number[]; amplitude: number }[] = [];
  for (const { sector } of sectors.slice(0, SECTORS_TRIED)) {
    const cutout = await fetchCutout(star.raDegrees, star.decDegrees, sector, pixels), curve = await sectorLightCurve(cutout.file);
    const verdict: RotationVerdict = curve ? rotationVerdict(curve) : { detected: false, reason: 'No pixel stands above the sky at the star.' };
    tried.push({ sector, cadenceMinutes: Number(cadenceMinutes(sector).toFixed(2)), pixels: { url: cutout.url, bytes: cutout.bytes }, ...(curve ? { frames: curve.frames, aperturePixels: curve.aperturePixels, saturated: curve.saturated, strongest: curve.whole, orbits: curve.halves } : {}), verdict });
    if (curve) curves.push({ sector, verdict, time: curve.time, flux: curve.flux, amplitude: curve.whole.amplitude });
    // One sector settles it when the rotation is seen, or when nothing in it could be a long period awaiting a second sector.
    if (verdict.detected || verdict.periodDays === undefined) break;
  }
  if (!keepPixels) await rm(pixels, { recursive: true, force: true });
  const rotation = curves[0] ? confirmed(curves[0].verdict, curves[1]?.verdict) : { detected: false, reason: sectors.length ? 'No pixel stands above the sky at the star.' : 'TESS has not imaged this place.' } satisfies RotationVerdict;
  const receipt: Record<string, unknown> = { schema: ROTATION_SCHEMA, star, sectorsImaged: sectors.map(sector => sector.sector), tried, rotation, toolchain: { id: pins.id, requirements: pins.entry.requirements } };
  if (rotation.detected && curves[0]) { const tilt = star.tiltDegrees ?? ASSUMED_TILT_DEGREES, map = await brightnessMap(curves[0], rotation.periodDays!, Math.min(tilt, 90)), table = `${id}-s${String(curves[0].sector).padStart(4, '0')}.dat`, flat = map.values.flat();
    await writeFile(resolve(run, table), brightnessTable(`Brightness map of ${star.name} from its light in TESS sector ${curves[0].sector} (period ${rotation.periodDays} d)`, map));
    receipt.map = { sector: curves[0].sector, table, degree: map.degree, inclinationDegrees: map.inclinationDegrees, inclinationSource: star.tiltSource ?? `assumed: the record holds no tilt, and ${ASSUMED_TILT_DEGREES} degrees is what the mapping papers take then`,
      periodDays: map.periodDays, residual: Number(map.residual.toFixed(5)), noise: Number(map.noise.toFixed(5)), darkestPercent: Number((100 * Math.min(...flat)).toFixed(1)), brightestPercent: Number((100 * Math.max(...flat)).toFixed(1)), starry: map.starry }; }
  await writeFile(receiptPath(id), `${JSON.stringify(receipt, null, 1)}\n`);
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), keep = args.includes('--keep-pixels'), named = args.filter(argument => !argument.startsWith('--'));
  if (!named.length && !args.includes('--all')) throw new TypeError('Usage: reduce.mts <star id>... | --all [--keep-pixels]');
  const ids = named.length ? named : (await readdir(resolve(WORKSPACE, 'src/objects'))).sort();
  for (const id of ids) {
    if (!named.length && (await readJson(receiptPath(id)) !== null || !(await starPlace(id)))) continue;
    try { const receipt = await reduceStar(id, keep), rotation = receipt.rotation as RotationVerdict; console.log(`${id}: ${rotation.detected ? `rotation ${rotation.periodDays} d, ${(100 * (rotation.amplitude ?? 0)).toFixed(2)}% swing${receipt.map ? '; map written' : ''}` : rotation.reason}`); }
    catch (error) { console.log(`${id}: failed: ${String(error instanceof Error ? error.message : error).split('\n')[0]!.slice(0, 200)}`); }
  }
}
