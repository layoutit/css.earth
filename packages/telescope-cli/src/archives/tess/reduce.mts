#!/usr/bin/env node
/** A star's rotation and brightness map from the light curves a mission publishes of it: K2's when K2 watched the star,
 * else TESS's 2-minute ones.
 *
 *   node packages/telescope-cli/src/archives/tess/reduce.mts <star id>... | --all
 *
 * A star is judged by the published method made for its kind of star and of light curve (methods.mts): every light
 * curve of the star that the method's paper covers is read from MAST as the mission publishes it
 * (kepler/light-curves.mts, light-curves.mts), and the method measures and judges them. A star the method is not for, or
 * that no mission published a light curve of, is given no verdict and nothing is fetched. Nothing of ours decides.
 *
 * When a rotation is accepted, starry makes the brightness map that reproduces each accepted light curve (map.mts). The
 * result is a receipt, output/tess/<star id>/rotation.json: the star, the Gaia sources around it, each window with its
 * pinned request, the method, what it measured and why a rotation was or was not accepted, and the codes' versions. Each
 * light curve is kept beside it as the method prepared it, and a map is written as the table the star pages read.
 * Receipts are results: they stay in ignored output/ (docs/provenance/CONTRACT.md). `--all` skips a star already
 * judged this way, and keeps Gaia's answers in output/tess/gaia-neighbours.csv, so a star is asked once. */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isRecord } from '@cssearth/core';
import { WORKSPACE } from '@cssearth/telescope/node';
import { ASSUMED_TILT_DEGREES, brightnessMap, brightnessTable } from './map.mts';
import { HOSTED_PLANET_IDS, hostedOrbit, hostedOrbitCentreId } from '@cssearth/astronomy';
import { fetchLightCurve, lightCurvesAt } from '../kepler/light-curves.mts';
import { sectorLightCurvesAt } from './light-curves.mts';
import { GAIA_EPOCH_YEAR, pixelLight, PIXELS, type PixelLight } from './neighbours.mts';
import { methodFor, type PeriodMethod, type StarKind, type Transit } from './methods.mts';
import { besideCatalogued, notTurning, withinBreakup, type Mission, type RotationVerdict } from './verdict.mts';
import { toolchainPins } from './toolchain.mts';

/** `@2`: every verdict is a published method's, on the mission's own light curves. A receipt of `@1` is of this repository's
 * earlier rule on full-frame pixels, and is not read. */
export const ROTATION_SCHEMA = 'cssearth-tess-rotation@2';
export const receiptPath = (id: string) => resolve(WORKSPACE, 'output/tess', id, 'rotation.json');

/** Where a map's tilt comes from: the axis the star's page draws from a measurement, the tilt its record works out from its rotation, or none. */
export type TiltFrom = 'page' | 'record' | 'assumed';
/** A star's place at `epochYear` and how it moves on the sky, degrees a year (the motion in right ascension as an arc on the sky). */
export interface StarPlace extends StarKind { readonly id: string; readonly name: string; readonly raDegrees: number; readonly decDegrees: number; readonly epochYear: number; readonly motionRaDegreesPerYear: number; readonly motionDecDegreesPerYear: number;
  /** The rotation period the star's record holds from the catalogues. */ readonly cataloguedPeriodDays?: number; /** The period of an orbit at the star's surface, from its recorded radius and mass: it cannot turn faster. */ readonly fastestTurnDays?: number; /** Why SIMBAD's type of the star rules out reading a rotation in its light, when it does. */ readonly otherLight?: string; readonly tiltDegrees?: number; readonly tiltSource?: string; readonly tiltFrom: TiltFrom }
/** Where the star is in a given year. A nearby star crosses a TESS pixel in a few years. */
export function placeAt(star: Pick<StarPlace, 'raDegrees' | 'decDegrees' | 'epochYear' | 'motionRaDegreesPerYear' | 'motionDecDegreesPerYear'>, year: number): { readonly raDegrees: number; readonly decDegrees: number } {
  const years = year - star.epochYear, dec = star.decDegrees + star.motionDecDegreesPerYear * years;
  return { raDegrees: Number((((star.raDegrees + star.motionRaDegreesPerYear * years / Math.cos(dec * Math.PI / 180)) % 360 + 360) % 360).toFixed(6)), decDegrees: Number(dec.toFixed(6)) }; }
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
    motionRaDegreesPerYear: motion('properMotionRaMasPerYear'), motionDecDegreesPerYear: motion('properMotionDecMasPerYear'),
    ...(isRecord(record) && typeof record.effectiveTemperatureK === 'number' ? { effectiveTemperatureK: record.effectiveTemperatureK } : {}), ...(isRecord(record) && typeof record.surfaceGravityLogg === 'number' ? { surfaceGravityLogg: record.surfaceGravityLogg } : {}),
    ...(isRecord(record) && typeof record.rotationPeriodDays === 'number' && record.rotationPeriodDays > 0 ? { cataloguedPeriodDays: record.rotationPeriodDays } : {}),
    ...(() => { const other = isRecord(record) ? notTurning(typeof record.objectType === 'string' ? record.objectType : undefined, typeof record.objectTypePath === 'string' ? record.objectTypePath : undefined) : undefined; return other ? { otherLight: other } : {}; })(),
    ...(isRecord(body.physical) && typeof body.physical.meanRadiusKm === 'number' && typeof body.physical.gravitationalParameterKm3PerS2 === 'number' && body.physical.gravitationalParameterKm3PerS2 > 0 ? { fastestTurnDays: Number((2 * Math.PI * Math.sqrt(body.physical.meanRadiusKm ** 3 / body.physical.gravitationalParameterKm3PerS2) / 86400).toFixed(4)) } : {}), ...tilt };
}

/** Each star's own and neighbouring light from Gaia, by star id: the stars are asked at their places at Gaia's epoch. Gaia's
 * answer for every star is one request of some ten minutes, so `--all` keeps it under output/tess. `radiusArcsec` is how far
 * a neighbour counts: each mission's own (neighbours.mts PIXELS). */
const KEPT_LIGHT = { csv: resolve(WORKSPACE, 'output/tess/gaia-neighbours.csv'), asked: resolve(WORKSPACE, 'output/tess/gaia-neighbours.asked.txt') };
export const lightOf = (stars: readonly StarPlace[], keep = false, radiusArcsec: number = PIXELS.TESS.radiusArcsec) => pixelLight(stars.map(star => ({ id: star.id, ...placeAt(star, GAIA_EPOCH_YEAR) })), keep ? KEPT_LIGHT : undefined, radiusArcsec);
/** The Gaia sources around a star, counted within TESS's radius and within K2's; `null` where Gaia has no source at its place. */
export interface StarLight { readonly wide: PixelLight | null; readonly near: PixelLight | null }
/** The years a mission's target is looked for at, beside the star's recorded place. K2's target list took its places
 * from surveys of about 2000 and its campaigns ran from 2014 to 2018. TESS has watched since 2018, and MAST lists its
 * targets where its input catalogue has them, in 2000: Barnard's Star's sector 80 light curve is listed 166 arcseconds
 * from the star's place in 2016. */
export const TARGET_YEARS = { K2: [2016, 2000], TESS: [2000, 2019, 2025] } as const;
/** The places a star's target may be listed at by a mission. */
export const targetPlaces = (star: StarPlace, mission: Mission = 'K2') => [star, ...TARGET_YEARS[mission].map(year => placeAt(star, year))];
/** A window's name in a file: a TESS sector, a K2 campaign. */
export const windowStem = (id: string, mission: Mission, window: number) => `${id}-${mission === 'TESS' ? `s${String(window).padStart(4, '0')}` : `c${String(window).padStart(2, '0')}`}`;

/** The transits a star's light holds, from its planets' published orbits (packages/astronomy) and the published duration
 * each planet's transit chart is drawn with: what a method masks, as its paper masks the transits it knows of. */
export async function transitsOf(id: string): Promise<Transit[]> { const transits: Transit[] = [];
  for (const planet of HOSTED_PLANET_IDS) { if (hostedOrbitCentreId(planet) !== id) continue; const orbit = hostedOrbit(planet), charts = await readJson(resolve(WORKSPACE, 'src/objects', planet, 'source/content/charts.json'));
    const chart = isRecord(charts) && Array.isArray(charts.charts) ? charts.charts.filter(isRecord).find(one => one.kind === 'folded-transit' && typeof one.durationHours === 'number') : undefined;
    if (chart && typeof orbit.transitTimeBmjdTdb === 'number') transits.push({ periodDays: orbit.periodDays, epochBjd: orbit.transitTimeBmjdTdb + 2400000.5, durationDays: (chart.durationHours as number) / 24 }); }
  return transits; }

/** What a mission calls one of its windows. */
const WINDOW: Readonly<Record<Mission, string>> = { TESS: 'sector', K2: 'campaign' };
interface Listed { readonly window: number; readonly filename: string; readonly uri: string }

/** One star, judged by the published method for its kind of star on the light curves a mission publishes of it: K2's when
 * K2 watched it, else TESS's 2-minute ones. `light` is what Gaia says of its surroundings, when the caller has asked for
 * many stars at once; it is counted for the page to say, never to refuse the star. */
export async function reduceStar(id: string, light?: StarLight): Promise<Record<string, unknown>> {
  const star = await starPlace(id); if (!star) throw new Error(`${id} is not a star with a place on the sky.`);
  const run = resolve(WORKSPACE, 'output/tess', id), files = resolve(run, 'light-curves'), pins = await toolchainPins(); await mkdir(run, { recursive: true });
  const tried: Record<string, unknown>[] = [], accepted: { window: number; time: readonly number[]; flux: readonly number[] }[] = [];
  const kind = { ...star, transits: await transitsOf(id) }, applies = (one: Mission) => methodFor(one, kind);
  // A mission's archive is asked only about a star whose light from that mission a method here reads.
  const reads = (one: Mission) => { const found = applies(one); return star.otherLight || 'reason' in found ? undefined : found.method; };
  const campaigns: Listed[] = reads('K2') ? (await lightCurvesAt(targetPlaces(star, 'K2'))).map(one => ({ window: one.campaign, filename: one.filename, uri: one.uri })) : [];
  const sectors: Listed[] = !campaigns.length && reads('TESS') ? (await sectorLightCurvesAt(targetPlaces(star, 'TESS'))).map(one => ({ window: one.sector, filename: one.filename, uri: one.uri })) : [];
  const mission: Mission = campaigns.length ? 'K2' : 'TESS', listed = campaigns.length ? campaigns : sectors, stem = (window: number) => windowStem(id, mission, window);
  const own = light === undefined ? (await lightOf([star], false, PIXELS[mission].radiusArcsec)).get(id) : (mission === 'K2' ? light.near : light.wide) ?? undefined;
  // Why each mission gave nothing to judge: its method leaves the star out, or it publishes no light curve of it.
  const unread = (one: Mission) => { const found = applies(one); return 'reason' in found ? found.reason : `${one} publishes no ${one === 'TESS' ? '2-minute ' : ''}light curve of this star.`; };
  let rotation: RotationVerdict = { detected: false, reason: star.otherLight ?? `${unread('K2')} ${unread('TESS')}` }, whole: Record<string, unknown> | undefined;
  const method: PeriodMethod | undefined = listed.length ? reads(mission) : undefined;
  if (method) { const covered: (Listed & { file: string; url: string; bytes: number })[] = [];
      for (const one of listed) { const left = method.covers(one.window);
        if (left) tried.push({ mission, window: one.window, verdict: { detected: false, reason: left } }); else covered.push({ ...one, ...await fetchLightCurve(one, files) }); }
      const judged = await method.judge(covered.map(one => one.file), kind);
      for (const window of judged.windows) { const file = covered.find(one => one.window === window.window);
        await writeFile(resolve(run, `${stem(window.window)}.curve.json`), `${JSON.stringify({ mission, window: window.window, product: 'pdcsap', time: window.time, flux: window.flux })}\n`);
        tried.push({ mission, window: window.window, method: method.id, lightCurveFile: { url: file?.url, bytes: file?.bytes, pipeline: window.pipeline }, frames: window.frames, lightCurve: `${stem(window.window)}.curve.json`, analysis: window.measures, says: window.says, verdict: window.verdict }); }
      if (judged.whole) whole = { analysis: judged.whole.measures, says: judged.whole.says, verdict: judged.whole.verdict };
      rotation = withinBreakup(besideCatalogued(judged.verdict, star.cataloguedPeriodDays), star.fastestTurnDays);
      if (rotation.detected) accepted.push(...judged.windows.filter(window => window.verdict.detected).map(window => ({ window: window.window, time: window.time, flux: window.flux }))); }
  await rm(files, { recursive: true, force: true });
  const receipt: Record<string, unknown> = { schema: ROTATION_SCHEMA, star, ...(own ? { light: own } : {}), mission, lightCurves: listed.map(one => ({ window: one.window, file: one.filename })), tried, ...(whole ? { whole } : {}),
    ...(method ? { method: { id: method.id, citation: method.citation, url: method.url, where: method.where, lightCurve: method.lightCurve, asks: method.asks, reliability: method.reliability } } : {}), rotation, toolchain: { id: pins.id, requirements: pins.entry.requirements } };
  // One map for each window whose light was accepted, all at the star's one period.
  const maps: Record<string, unknown>[] = [];
  for (const read of accepted) { const tilt = star.tiltDegrees ?? ASSUMED_TILT_DEGREES, map = await brightnessMap(read, rotation.periodDays!, Math.min(tilt, 90)), table = `${stem(read.window)}.dat`, flat = map.values.flat();
    await writeFile(resolve(run, table), brightnessTable(`Brightness map of ${star.name} from its light in ${mission} ${WINDOW[mission]} ${read.window} (period ${rotation.periodDays} d)`, map));
    maps.push({ mission, window: read.window, table, degree: map.degree, inclinationDegrees: map.inclinationDegrees, inclinationFrom: star.tiltFrom, inclinationSource: star.tiltSource ?? `assumed: no tilt of the star is known, and ${ASSUMED_TILT_DEGREES} degrees is the middle tilt of axes that point at random`,
      periodDays: map.periodDays, residual: Number(map.residual.toFixed(5)), noise: Number(map.noise.toFixed(5)), darkestPercent: Number((100 * Math.min(...flat)).toFixed(1)), brightestPercent: Number((100 * Math.max(...flat)).toFixed(1)), starry: map.starry }); }
  if (maps.length) receipt.maps = maps;
  await writeFile(receiptPath(id), `${JSON.stringify(receipt, null, 1)}\n`);
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), named = args.filter(argument => !argument.startsWith('--')), all = !named.length;
  if (all && !args.includes('--all')) throw new TypeError('Usage: reduce.mts <star id>... | --all [--shard=K/N]');
  // `--shard=K/N` takes every Nth star, starting at the Kth: N runs side by side share the stars between them. MAST answers
  // requests sent side by side (measured: eight files at once in 2 s, eight position queries at once, none refused).
  const shard = args.find(argument => argument.startsWith('--shard='))?.slice(8).split('/').map(Number);
  if (shard && !(shard.length === 2 && Number.isInteger(shard[0]) && Number.isInteger(shard[1]) && shard[1]! > 0 && shard[0]! >= 0 && shard[0]! < shard[1]!)) throw new TypeError('--shard=K/N needs 0 <= K < N.');
  const stars: StarPlace[] = [];
  for (const id of all ? (await readdir(resolve(WORKSPACE, 'src/objects'))).sort() : named) { const star = await starPlace(id); if (star) stars.push(star); else if (!all) console.log(`${id}: not a star with a place on the sky.`); }
  const wide = await lightOf(stars, true), near = await lightOf(stars, true, PIXELS.K2.radiusArcsec);
  for (const [index, star] of stars.entries()) {
    if (shard && index % shard[1]! !== shard[0]) continue;
    // `--all` leaves a star alone once it has been judged this way.
    const held = all ? await readJson(receiptPath(star.id)) : null; if (isRecord(held) && held.schema === ROTATION_SCHEMA) continue;
    try { const receipt = await reduceStar(star.id, { wide: wide.get(star.id) ?? null, near: near.get(star.id) ?? null }), rotation = receipt.rotation as RotationVerdict, maps = Array.isArray(receipt.maps) ? receipt.maps.length : 0;
      console.log(`${star.id}: ${rotation.detected ? `rotation ${rotation.periodDays} d, ${(100 * (rotation.amplitude ?? 0)).toFixed(2)}% swing${maps ? `; ${maps} map${maps === 1 ? '' : 's'} written` : ''}` : rotation.reason}`); }
    catch (error) { console.log(`${star.id}: failed: ${String(error instanceof Error ? error.message : error).split('\n')[0]!.slice(0, 200)}`); }
  }
}
