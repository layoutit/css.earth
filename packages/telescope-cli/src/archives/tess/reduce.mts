#!/usr/bin/env node
/** A star's rotation and brightness map from its TESS full-frame pixels.
 *
 *   node packages/telescope-cli/src/archives/tess/reduce.mts <star id>... [--keep-pixels]
 *   node packages/telescope-cli/src/archives/tess/reduce.mts --all [--keep-pixels]
 *
 * For each star already in the tree: whose light its pixels hold (neighbours.mts); the sectors that imaged its place; its
 * pixels in one of them (pixels.mts; `pickSector` says which), cut where the star was that year; its light curve and the period of its light
 * (photometry.mts); and, when the rotation is seen, the brightness map that reproduces the light curve (map.mts). One sector
 * is read for a star: the rule that accepts a rotation is settled on single sectors. A star too faint, or whose pixels hold
 * too much of other stars' light, is not fetched.
 *
 * The result is a receipt, output/tess/<star id>/rotation.json: the star's and its neighbours' light, the sector with its
 * pinned request, what was measured and why a rotation was or was not accepted, and the codes' versions. The light curve is
 * kept beside it, so nothing has to be fetched again to look at the star's light another way, and a map is written as the
 * table the star pages read. Receipts are results: they stay in ignored output/ (docs/provenance/CONTRACT.md). `--all`
 * skips a star that already has a receipt, and keeps Gaia's answers in output/tess/gaia-neighbours.csv, so a star is asked once.
 * Pixels are deleted once measured unless `--keep-pixels`. */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isRecord } from '@cssearth/core';
import { WORKSPACE } from '@cssearth/telescope/node';
import { ASSUMED_TILT_DEGREES, brightnessMap, brightnessTable } from './map.mts';
import { fetchPixelFile, pickFile, pixelFilesAt } from '../kepler/pixels.mts';
import { GAIA_EPOCH_YEAR, lightRefusal, pixelLight, PIXELS, type PixelLight } from './neighbours.mts';
import { besideCatalogued, BIN_DAYS, LIMITS, notTurning, rotationVerdict, sectorLightCurve, withinBreakup, type Mission, type RotationVerdict } from './photometry.mts';
import { cadenceMinutes, fetchCutout, sectorsAt, type ImagedSector } from './pixels.mts';
import { toolchainPins } from './toolchain.mts';

export const ROTATION_SCHEMA = 'cssearth-tess-rotation@1';
export const receiptPath = (id: string) => resolve(WORKSPACE, 'output/tess', id, 'rotation.json');

/** Where a map's tilt comes from: the axis the star's page draws from a measurement, the tilt its record works out from its rotation, or none. */
export type TiltFrom = 'page' | 'record' | 'assumed';
/** A star's place at `epochYear` and how it moves on the sky, degrees a year (the motion in right ascension as an arc on the sky). */
export interface StarPlace { readonly id: string; readonly name: string; readonly raDegrees: number; readonly decDegrees: number; readonly epochYear: number; readonly motionRaDegreesPerYear: number; readonly motionDecDegreesPerYear: number;
  /** The rotation period the star's record holds from the catalogues. */ readonly cataloguedPeriodDays?: number; /** The period of an orbit at the star's surface, from its recorded radius and mass: it cannot turn faster. */ readonly fastestTurnDays?: number; /** Why SIMBAD's type of the star rules out reading a rotation in its light, when it does. */ readonly otherLight?: string; readonly tiltDegrees?: number; readonly tiltSource?: string; readonly tiltFrom: TiltFrom }
/** Where the star is in a given year. A nearby star crosses a TESS pixel in a few years. */
export function placeAt(star: Pick<StarPlace, 'raDegrees' | 'decDegrees' | 'epochYear' | 'motionRaDegreesPerYear' | 'motionDecDegreesPerYear'>, year: number): { readonly raDegrees: number; readonly decDegrees: number } {
  const years = year - star.epochYear, dec = star.decDegrees + star.motionDecDegreesPerYear * years;
  return { raDegrees: Number((((star.raDegrees + star.motionRaDegreesPerYear * years / Math.cos(dec * Math.PI / 180)) % 360 + 360) % 360).toFixed(6)), decDegrees: Number(dec.toFixed(6)) }; }
/** The middle of a sector as a year: sector 1 began on 25 July 2018, and a sector lasts two orbits of 13.7 days. */
export const sectorYear = (sector: number) => 2018.56 + (sector - 0.5) * 27.4 / 365.25;
/** The sector read for a star: the newest imaged every ten minutes (sectors 27 to 55) when there is one, else the newest of
 * all. A ten-minute sector's pixels arrive in some 5 seconds and a 200-second sector's in 85 (60 MB for one star, measured
 * 2026-10-06), and the rule that believes a rotation holds as well on them (photometry.mts). */
export const pickSector = (sectors: readonly ImagedSector[]): ImagedSector | undefined => sectors.filter(one => one.sector >= 27 && one.sector <= 55).at(-1) ?? sectors.at(-1);
/** The year the sectors that imaged a place are asked for: the middle of the mission so far. */
const MISSION_YEAR = 2022;
/** The angle between a pole and the line of sight to a place, degrees: the tilt a page draws. */
export function tiltOfPole(poleRaDegrees: number, poleDecDegrees: number, raDegrees: number, decDegrees: number): number { const rad = Math.PI / 180;
  const dot = Math.sin(poleDecDegrees * rad) * Math.sin(decDegrees * rad) + Math.cos(poleDecDegrees * rad) * Math.cos(decDegrees * rad) * Math.cos((poleRaDegrees - raDegrees) * rad);
  return Number((Math.acos(Math.max(-1, Math.min(1, -dot))) / rad).toFixed(1)); }
const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8').catch(() => 'null')) as unknown;

/** A star's place and motion from its astronomy record, and the tilt its page or its record holds. */
export async function starPlace(id: string): Promise<StarPlace | undefined> {
  const body = await readJson(resolve(WORKSPACE, 'packages/astronomy/data/bodies', `${id}.json`)), record = await readJson(resolve(WORKSPACE, 'src/objects', id, 'source/measurements.json'));
  if (!isRecord(body) || !isRecord(body.star) || typeof body.star.rightAscensionDegrees !== 'number' || typeof body.star.declinationDegrees !== 'number') return undefined;
  const star = body.star, motion = (key: string) => typeof star[key] === 'number' ? star[key] / 3.6e6 : 0;
  // A page that measures its star's axis draws it tilted: the map is made at that tilt. Any other page draws the axis by convention.
  const rotationPath = `src/objects/${id}/source/preparation/rotation.json`, rotation = await readJson(resolve(WORKSPACE, rotationPath));
  const drawn = isRecord(rotation) && /inclination/iu.test(String(rotation.source ?? '')) && typeof rotation.rightAscensionDegrees === 'number' && typeof rotation.declinationDegrees === 'number' ? tiltOfPole(rotation.rightAscensionDegrees, rotation.declinationDegrees, star.rightAscensionDegrees as number, star.declinationDegrees as number) : undefined;
  const tilt = drawn !== undefined && drawn <= 90 ? { tiltDegrees: drawn, tiltSource: `${rotationPath}: the measured axis the star's page draws`, tiltFrom: 'page' as const }
    : isRecord(record) && typeof record.spinInclinationDegrees === 'number' ? { tiltDegrees: record.spinInclinationDegrees, tiltSource: `src/objects/${id}/source/measurements.json, spinInclinationDegrees`, tiltFrom: 'record' as const } : { tiltFrom: 'assumed' as const };
  return { id, name: isRecord(body.physical) && typeof body.physical.name === 'string' ? body.physical.name : id, raDegrees: star.rightAscensionDegrees as number, decDegrees: star.declinationDegrees as number, epochYear: typeof star.positionEpochJulianYear === 'number' ? star.positionEpochJulianYear : 2000,
    motionRaDegreesPerYear: motion('properMotionRaMasPerYear'), motionDecDegreesPerYear: motion('properMotionDecMasPerYear'), ...(isRecord(record) && typeof record.rotationPeriodDays === 'number' && record.rotationPeriodDays > 0 ? { cataloguedPeriodDays: record.rotationPeriodDays } : {}),
    ...(() => { const other = isRecord(record) ? notTurning(typeof record.objectType === 'string' ? record.objectType : undefined, typeof record.objectTypePath === 'string' ? record.objectTypePath : undefined) : undefined; return other ? { otherLight: other } : {}; })(),
    ...(isRecord(body.physical) && typeof body.physical.meanRadiusKm === 'number' && typeof body.physical.gravitationalParameterKm3PerS2 === 'number' && body.physical.gravitationalParameterKm3PerS2 > 0 ? { fastestTurnDays: Number((2 * Math.PI * Math.sqrt(body.physical.meanRadiusKm ** 3 / body.physical.gravitationalParameterKm3PerS2) / 86400).toFixed(4)) } : {}), ...tilt };
}

/** Each star's own and neighbouring light from Gaia, by star id: the stars are asked at their places at Gaia's epoch. Gaia's
 * answer for every star is one request of some ten minutes, so `--all` keeps it under output/tess. `radiusArcsec` is how far
 * a neighbour counts: each mission's own (neighbours.mts PIXELS). */
const KEPT_LIGHT = { csv: resolve(WORKSPACE, 'output/tess/gaia-neighbours.csv'), asked: resolve(WORKSPACE, 'output/tess/gaia-neighbours.asked.txt') };
export const lightOf = (stars: readonly StarPlace[], keep = false, radiusArcsec: number = PIXELS.TESS.radiusArcsec) => pixelLight(stars.map(star => ({ id: star.id, ...placeAt(star, GAIA_EPOCH_YEAR) })), keep ? KEPT_LIGHT : undefined, radiusArcsec);
/** A star's light counted at TESS's radius and at Kepler's; `null` where Gaia has no source at its place. */
export interface StarLight { readonly wide: PixelLight | null; readonly near: PixelLight | null }
/** The years Kepler and K2 targets are looked for at, beside the star's recorded place: between Kepler's field (2009 to 2013)
 * and K2's campaigns (2014 to 2018), and 2000, the epoch of the surveys the missions' target lists took their places from
 * (Kepler-42 moves 0.4 arcseconds a year and its target sits 7 arcseconds from where Gaia has it in 2016). */
export const KEPLER_YEARS = [2014, 2000] as const;
/** The places a star's Kepler or K2 target may be listed at. */
export const targetPlaces = (star: StarPlace) => [star, ...KEPLER_YEARS.map(year => placeAt(star, year))];
/** A window's name in a file: a TESS sector, a K2 campaign, a Kepler quarter. */
export const windowStem = (id: string, mission: Mission, window: number) => `${id}-${mission === 'TESS' ? `s${String(window).padStart(4, '0')}` : mission === 'K2' ? `c${String(window).padStart(2, '0')}` : `q${String(window).padStart(2, '0')}`}`;

/** One star, reduced. Its Kepler or K2 pixels are read when the mission watched it: months of light in pixels a neighbour
 * seldom shares. Any other star is read from one TESS sector. `light` is what Gaia says of its pixels, when the caller has
 * asked for many stars at once; `earlier` is the star's receipt from before Kepler and K2 were asked, kept when neither watched it. */
export async function reduceStar(id: string, keepPixels = false, light?: StarLight, earlier?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const star = await starPlace(id); if (!star) throw new Error(`${id} is not a star with a place on the sky.`);
  const run = resolve(WORKSPACE, 'output/tess', id), pixels = resolve(run, 'pixels'), pins = await toolchainPins(); await mkdir(run, { recursive: true });
  const near = light === undefined ? (await lightOf([star], false, PIXELS.Kepler.radiusArcsec)).get(id) : light.near ?? undefined, tried: Record<string, unknown>[] = [];
  // Kepler and K2 are asked only for a star their pixels could follow as its own.
  const files = star.otherLight || lightRefusal(near, 'Kepler') ? [] : await pixelFilesAt(targetPlaces(star)), file = pickFile(files);
  if (!file && earlier) { const kept = { ...earlier, pixelFiles: [] }; await writeFile(receiptPath(id), `${JSON.stringify(kept, null, 1)}\n`); return kept; }
  const mission: Mission = file ? file.mission : 'TESS', own = file ? near : light === undefined ? (await lightOf([star])).get(id) : light.wide ?? undefined, refusal = star.otherLight ?? lightRefusal(own, mission);
  let rotation: RotationVerdict = { detected: false, reason: refusal ?? 'TESS has not imaged this place.' }, seen: { window: number; time: readonly number[]; flux: readonly number[] } | undefined;
  const judged = (curve: Awaited<ReturnType<typeof sectorLightCurve>>) => curve ? withinBreakup(besideCatalogued(rotationVerdict(curve, mission), star.cataloguedPeriodDays), star.fastestTurnDays) : { detected: false, reason: 'No pixel stands above the sky at the star.' } satisfies RotationVerdict;
  const keep = async (window: number, curve: NonNullable<Awaited<ReturnType<typeof sectorLightCurve>>>) => { seen = { window, time: curve.time, flux: curve.flux }; await writeFile(resolve(run, `${windowStem(id, mission, window)}.curve.json`), `${JSON.stringify({ mission, window, binDays: BIN_DAYS, time: curve.time, flux: curve.flux, ...(curve.measured ? { measured: curve.measured } : {}) })}\n`); };
  const measured = (curve: Awaited<ReturnType<typeof sectorLightCurve>>, window: number) => curve ? { frames: curve.frames, aperturePixels: curve.aperturePixels, saturated: curve.saturated, strongest: curve.whole, [LIMITS[mission].pieces]: curve.halves, lightCurve: `${windowStem(id, mission, window)}.curve.json` } : {};
  let sectors: ImagedSector[] = [];
  // The campaign or quarter is the one the file's own header names; the archive's name for it stands when no light was measured.
  if (file) { const held = await fetchPixelFile(file, pixels), curve = await sectorLightCurve(held.file, mission), window = curve?.window ?? file.window; rotation = judged(curve);
    tried.push({ mission, window, cadenceMinutes: 30, pixels: { url: held.url, bytes: held.bytes }, ...measured(curve, window), verdict: rotation }); if (curve) await keep(window, curve); }
  else if (!refusal) { sectors = await sectorsAt(...Object.values(placeAt(star, MISSION_YEAR)) as [number, number]); const picked = pickSector(sectors), newest = sectors.at(-1);
    // A sector in which no pixel stands above the sky at the star (the star at a detector's edge, a frame full of scattered
    // light) holds no light curve to judge: the newest sector is read in its place.
    for (const { sector } of [...new Set([picked, newest].filter((one): one is ImagedSector => one !== undefined))]) { const place = placeAt(star, sectorYear(sector)), cutout = await fetchCutout(place.raDegrees, place.decDegrees, sector, pixels), curve = await sectorLightCurve(cutout.file); rotation = judged(curve);
      tried.push({ mission, window: sector, sector, cadenceMinutes: Number(cadenceMinutes(sector).toFixed(2)), pixels: { url: cutout.url, bytes: cutout.bytes }, ...measured(curve, sector), verdict: rotation });
      if (curve) { await keep(sector, curve); break; } } }
  if (!keepPixels) await rm(pixels, { recursive: true, force: true });
  const receipt: Record<string, unknown> = { schema: ROTATION_SCHEMA, star, ...(own ? { light: own } : {}), pixelFiles: files.map(one => ({ mission: one.mission, window: one.window, ...(one.days === undefined ? {} : { days: one.days }) })), sectorsImaged: sectors.map(sector => sector.sector), tried, rotation, toolchain: { id: pins.id, requirements: pins.entry.requirements } };
  const read = seen as { window: number; time: readonly number[]; flux: readonly number[] } | undefined;
  if (rotation.detected && read) { const tilt = star.tiltDegrees ?? ASSUMED_TILT_DEGREES, map = await brightnessMap(read, rotation.periodDays!, Math.min(tilt, 90)), table = `${windowStem(id, mission, read.window)}.dat`, flat = map.values.flat();
    await writeFile(resolve(run, table), brightnessTable(`Brightness map of ${star.name} from its light in ${mission} ${LIMITS[mission].window} ${read.window} (period ${rotation.periodDays} d)`, map));
    receipt.map = { mission, window: read.window, ...(mission === 'TESS' ? { sector: read.window } : {}), table, degree: map.degree, inclinationDegrees: map.inclinationDegrees, inclinationFrom: star.tiltFrom, inclinationSource: star.tiltSource ?? `assumed: no tilt of the star is known, and ${ASSUMED_TILT_DEGREES} degrees is the middle tilt of axes that point at random`,
      periodDays: map.periodDays, residual: Number(map.residual.toFixed(5)), noise: Number(map.noise.toFixed(5)), darkestPercent: Number((100 * Math.min(...flat)).toFixed(1)), brightestPercent: Number((100 * Math.max(...flat)).toFixed(1)), starry: map.starry }; }
  await writeFile(receiptPath(id), `${JSON.stringify(receipt, null, 1)}\n`);
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), keep = args.includes('--keep-pixels'), named = args.filter(argument => !argument.startsWith('--')), all = !named.length;
  if (all && !args.includes('--all')) throw new TypeError('Usage: reduce.mts <star id>... | --all [--keep-pixels]');
  const stars: StarPlace[] = [];
  for (const id of all ? (await readdir(resolve(WORKSPACE, 'src/objects'))).sort() : named) { const star = await starPlace(id); if (star) stars.push(star); else if (!all) console.log(`${id}: not a star with a place on the sky.`); }
  const wide = await lightOf(stars, true), near = await lightOf(stars, true, PIXELS.Kepler.radiusArcsec);
  for (const star of stars) {
    // `--all` leaves a star alone once Kepler and K2 have been asked about it. A receipt from before they were is asked
    // now, named or not, and kept when neither mission watched the star: its TESS sector is not read twice.
    const held = await readJson(receiptPath(star.id)), asked = isRecord(held) && Array.isArray(held.pixelFiles); if (all && asked) continue;
    try { const receipt = await reduceStar(star.id, keep, { wide: wide.get(star.id) ?? null, near: near.get(star.id) ?? null }, isRecord(held) && !asked ? held : undefined), rotation = receipt.rotation as RotationVerdict; console.log(`${star.id}: ${rotation.detected ? `rotation ${rotation.periodDays} d, ${(100 * (rotation.amplitude ?? 0)).toFixed(2)}% swing${receipt.map ? '; map written' : ''}` : rotation.reason}`); }
    catch (error) { console.log(`${star.id}: failed: ${String(error instanceof Error ? error.message : error).split('\n')[0]!.slice(0, 200)}`); }
  }
}
