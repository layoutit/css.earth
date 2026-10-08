#!/usr/bin/env node
/** A star's rotation and brightness map from the light curves a mission publishes of it: K2's when K2 watched the star,
 * TESS's 2-minute ones when K2 did not or its method refuses the star, and Kepler's when neither gives it a rotation.
 *
 *   node packages/telescope-cli/src/archives/tess/reduce.mts <star id>... | --all
 *
 * A star is judged by the published method made for its kind of star and of light curve (methods.mts): every light
 * curve of the star that the method's paper covers is read from MAST as the mission publishes it
 * (kepler/light-curves.mts, light-curves.mts), and the method measures and judges them. A star the method is not for, or
 * that no mission published a light curve of, is given no verdict and nothing is fetched. A TESS target whose pixels
 * the mission's input catalog says hold too much of other stars' light is not judged either (verdict.mts `blended`). A
 * star the method refuses may still be a row of a paper's own table of rotators, which is then that paper's verdict on
 * it (published.mts). A Kepler star has no method wired: its rotation is its row in the tables of Santos et al. (2019,
 * 2021), and its light the KEPSEISMIC light curve they judged, one map a quarter (kepler/santos.mts,
 * kepler/kepseismic.mts). A star still without a rotation, which the MEarth Project watched from the ground, has its
 * row in the table of Newton et al. (2018), and its light is the MEarth light curve they judged, one map a season
 * (mearth/newton.mts, mearth/light-curves.mts). Nothing of ours decides.
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
import { ASSUMED_TILT_DEGREES, brightnessMaps, brightnessTable } from './map.mts';
import { HOSTED_PLANET_IDS, hostedOrbit, hostedOrbitCentreId } from '@cssearth/astronomy';
import { kepseismicAt, readKepseismic } from '../kepler/kepseismic.mts';
import { fetchLightCurves, lightCurvesAt } from '../kepler/light-curves.mts';
import { filterFor, SANTOS, SANTOS_GRAVITY, santosStar } from '../kepler/santos.mts';
import { fetchLightCurve as fetchMearth, filesOf, MEARTH_RELEASE, parseLightCurve, southIndex } from '../mearth/light-curves.mts';
import { MEARTH_MAP_DEGREE, MEARTH_PAPERS, newtonStar, rowAt } from '../mearth/newton.mts';
import { toolchainPins as mearthPins } from '../mearth/toolchain.mts';
import { apart, contaminationRatio, sectorLightCurvesAt } from './light-curves.mts';
import { GAIA_EPOCH_YEAR, pixelLight, PIXELS, type PixelLight } from './neighbours.mts';
import { catalogueSays, filled, methodFor, METHODS, SAME_STAR_ARCSEC, type PeriodMethod, type StarKind, type StarResult, type Transit } from './methods.mts';
import { PUBLISHED } from './papers.mts';
import { keptAsPublished, publishedApart, publishedRows, ticOf, type Catalogued, type PublishedFinding, type PublishedPaper } from './published.mts';
import { besideCatalogued, blended, notTurning, withinBreakup, type Mission, type RotationVerdict } from './verdict.mts';
import { toolchainPins } from './toolchain.mts';

/** `@2`: every verdict is a published method's, or a paper's own published verdict, on the mission's own light curves. A
 * receipt of `@1` is of this repository's earlier rule on full-frame pixels, and is not read. */
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

/** Every rotation period a star's record holds from the catalogues, each with its table (new-object/metadata `--periods`). */
export async function cataloguedOf(id: string): Promise<Catalogued[]> { const record = await readJson(resolve(WORKSPACE, 'src/objects', id, 'source/measurements.json')), held = isRecord(record) && Array.isArray(record.rotationPeriodsCatalogued) ? record.rotationPeriodsCatalogued : [];
  return held.filter(isRecord).flatMap(one => typeof one.days === 'number' && typeof one.source === 'string' ? [{ days: one.days, source: one.source }] : []); }

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
export const TARGET_YEARS = { K2: [2016, 2000], TESS: [2000, 2019, 2025], Kepler: [2011, 2000], MEarth: [2000] } as const;
/** The places a star's target may be listed at by a mission. */
export const targetPlaces = (star: StarPlace, mission: Mission = 'K2') => [star, ...TARGET_YEARS[mission].map(year => placeAt(star, year))];
/** A window's name in a file: a TESS sector, a K2 campaign, a Kepler quarter, a MEarth season by its year. */
export const windowStem = (id: string, mission: Mission, window: number) => `${id}-${mission === 'TESS' ? `s${String(window).padStart(4, '0')}` : mission === 'MEarth' ? `y${window}` : `${mission === 'K2' ? 'c' : 'q'}${String(window).padStart(2, '0')}`}`;

/** The transits a star's light holds, from its planets' published orbits (packages/astronomy) and the published duration
 * each planet's transit chart is drawn with: what a method masks, as its paper masks the transits it knows of. */
export async function transitsOf(id: string): Promise<Transit[]> { const transits: Transit[] = [];
  for (const planet of HOSTED_PLANET_IDS) { if (hostedOrbitCentreId(planet) !== id) continue; const orbit = hostedOrbit(planet), charts = await readJson(resolve(WORKSPACE, 'src/objects', planet, 'source/content/charts.json'));
    const chart = isRecord(charts) && Array.isArray(charts.charts) ? charts.charts.filter(isRecord).find(one => one.kind === 'folded-transit' && typeof one.durationHours === 'number') : undefined;
    if (chart && typeof orbit.transitTimeBmjdTdb === 'number') transits.push({ periodDays: orbit.periodDays, epochBjd: orbit.transitTimeBmjdTdb + 2400000.5, durationDays: (chart.durationHours as number) / 24 }); }
  return transits; }

/** What a mission calls one of its windows. */
const WINDOW: Readonly<Record<Mission, string>> = { TESS: 'sector', K2: 'campaign', Kepler: 'quarter', MEarth: 'season' };
interface Listed { readonly window: number; readonly filename: string; readonly uri: string }
/** One mission's light curves of a star as a method judged them. */
interface Attempt { readonly mission: Mission; readonly method: PeriodMethod; readonly listed: readonly Listed[]; readonly fetched: readonly (Listed & { readonly url: string; readonly bytes: number })[]; readonly judged: StarResult }
/** Where a paper's table is kept, so every star of every run asks for it once; and the index of the MEarth release. */
const keptTable = (id: string) => resolve(WORKSPACE, 'output/tess/published', `${id}.json`), KEPT_MEARTH_INDEX = resolve(WORKSPACE, 'output/tess/published/mearth-south-index.html');
/** Whether a body is a star. A galaxy, a cluster or a nebula has a place on the sky too, and a light curve at its place is another object's. */
const isStar = async (id: string) => { const body = await readJson(resolve(WORKSPACE, 'packages/astronomy/data/bodies', `${id}.json`)); return isRecord(body) && body.classification === 'star'; };
const described = (by: PeriodMethod | PublishedPaper) => ({ id: by.id, citation: by.citation, url: by.url, where: by.where, lightCurve: by.lightCurve, asks: by.asks, reliability: by.reliability, ...('table' in by ? { published: by.table, swing: by.swing } : {}) });

/** One star, judged on the light curves the missions publish of it.
 *
 * K2's are judged first, by the method for the star's kind. TESS's 2-minute ones are judged when K2 has no campaign of
 * the star, and also when K2's method refuses it: that order is this repository's, and each method is still applied only
 * to its own paper's light curves. A star whose record holds no temperature or no surface gravity takes the missing
 * value from the catalogue the TESS method's paper uses, as the star's own light curve file carries it. When the method
 * refuses, each paper's own verdict on the star is looked up in its published table (published.mts): the first that
 * gives one is taken, at the paper's own period, and none when two papers give periods that differ. A TESS target the
 * mission's input catalog gives a contamination ratio of 0.2 or more is not judged at all, by a method or on a paper's
 * verdict: its light is too much other stars' (verdict.mts `blended`). A rotation a method or a paper gives a star
 * stays theirs, drawn or not. A star with none, which Kepler watched, is judged last by its row in the tables of Santos
 * et al. (2019, 2021), on the KEPSEISMIC light curve those papers judged: each quarter their rule keeps, and that holds
 * a turn of the star, has a map. The catalog's ratio is of TESS's pixels and is not set beside Kepler's light. A star
 * still without a rotation that MEarth-South watched is judged by its row in the table of Newton et al. (2018), on its
 * longest MEarth light curve with the baselines and common mode of the paper's model taken off by the paper's authors'
 * own code: each season that holds a turn of the star has a map, at the paper's period or not at all. `light`
 * is what Gaia says of the star's surroundings, when the caller has asked for many stars at once; it is counted for the
 * page to say, never to refuse the star. */
export async function reduceStar(id: string, light?: StarLight): Promise<Record<string, unknown>> {
  const star = await starPlace(id); if (!star) throw new Error(`${id} is not a star with a place on the sky.`);
  const run = resolve(WORKSPACE, 'output/tess', id), files = resolve(run, 'light-curves'), pins = await toolchainPins(); await mkdir(run, { recursive: true });
  const tried: Record<string, unknown>[] = [], checked = (verdict: RotationVerdict) => withinBreakup(besideCatalogued(verdict, star.cataloguedPeriodDays), star.fastestTurnDays);
  let kind: StarKind = { ...star, transits: await transitsOf(id) };
  const applies = (one: Mission) => methodFor(one, kind);
  // A mission's archive is asked only about a star whose light from that mission a method here reads.
  const reads = (one: Mission) => { const found = applies(one); return star.otherLight || 'reason' in found ? undefined : found.method; };
  const stem = (mission: Mission, window: number) => windowStem(id, mission, window);
  // A mission's light curves of the star, fetched and judged by the method for its kind; each window goes into `tried`.
  const judge = async (mission: Mission, method: PeriodMethod, listed: readonly Listed[]): Promise<Attempt> => {
    const wanted = listed.filter(one => { const left = method.covers(one.window); if (left) tried.push({ mission, window: one.window, verdict: { detected: false, reason: left } }); return !left; });
    const fetched = await fetchLightCurves(wanted, files), judged = await method.judge(fetched.map(one => one.file), kind);
    for (const window of judged.windows) { const file = fetched.find(one => one.window === window.window);
      await writeFile(resolve(run, `${stem(mission, window.window)}.curve.json`), `${JSON.stringify({ mission, window: window.window, product: 'pdcsap', time: window.time, flux: window.flux })}\n`);
      tried.push({ mission, window: window.window, method: method.id, lightCurveFile: { url: file?.url, bytes: file?.bytes, pipeline: window.pipeline, ...window.aperture }, frames: window.frames, lightCurve: `${stem(mission, window.window)}.curve.json`, analysis: window.measures, says: window.says, verdict: window.verdict }); }
    return { mission, method, listed, fetched, judged }; };
  const refused: Attempt[] = [], forK2 = reads('K2');
  const campaigns: Listed[] = forK2 ? (await lightCurvesAt(targetPlaces(star, 'K2'))).map(one => ({ window: one.campaign, filename: one.filename, uri: one.uri })) : [];
  let last = forK2 && campaigns.length ? await judge('K2', forK2, campaigns) : undefined, sectors: Listed[] = [], catalogue: Record<string, unknown> | undefined, elsewhere: string | undefined, blending: Record<string, unknown> | undefined, crowded: string | undefined;
  // A star K2 did not watch, or whose K2 light its method refuses, is judged on its TESS light. A rotation K2's method
  // accepts stays K2's, drawn or not.
  if (!last?.judged.verdict.detected) {
    // A value the record lacks is the catalogue's of the method's own paper, read from the star's first light curve file.
    const lacks = kind.effectiveTemperatureK === undefined || kind.surfaceGravityLogg === undefined, source = lacks && !star.otherLight && await isStar(id) ? METHODS.find(method => method.missions.includes('TESS') && method.catalogue)?.catalogue : undefined;
    const places = targetPlaces(star, 'TESS'), found = reads('TESS') || source ? await sectorLightCurvesAt(places) : [], target = found[0];
    // A star that comes to TESS by one of the two rules above is given a light curve only when its target lies at the
    // star's own place: within a pixel, the nearest target of a faint companion is its bright neighbour.
    const offset = target ? Number((3600 * Math.min(...places.map(place => apart(place, target)))).toFixed(1)) : 0;
    if (target && offset > SAME_STAR_ARCSEC && (last || source)) elsewhere = `The 2-minute light curve nearest the star is of a target ${offset} arcseconds from its place (TIC ${target.target}), not the star's own.`;
    else sectors = found.map(one => ({ window: one.sector, filename: one.filename, uri: one.uri }));
    if (source && sectors[0]) { const [first] = await fetchLightCurves([sectors[0]], files), from = await source.read(first!.file), filling = filled(kind, from); kind = filling.star;
      catalogue = { name: source.name, version: from.version, tic: from.tic, file: sectors[0].filename, effectiveTemperatureK: from.effectiveTemperatureK ?? null, surfaceGravityLogg: from.surfaceGravityLogg ?? null, fills: filling.fills,
        says: `The ${source.name} (v${from.version}), in the header of the star's ${WINDOW.TESS} ${sectors[0].window} light curve, gives ${catalogueSays(from)}.` }; }
    const forTess = reads('TESS'), tic = forTess && sectors[0] ? ticOf(sectors[0].filename) : undefined;
    // What the mission's input catalog says of other stars' light in the target's pixels: too much, and the light is not read.
    if (tic !== undefined) { const ratio = await contaminationRatio(tic); crowded = blended(ratio, tic); blending = { catalogue: 'TESS Input Catalog', tic, contaminationRatio: ratio ?? null }; }
    if (forTess && sectors.length && !crowded) { if (last) refused.push(last); last = await judge('TESS', forTess, sectors); } }
  let mission: Mission = last?.mission ?? 'TESS', listed: readonly { readonly window?: number; readonly filename: string }[] = last?.listed ?? sectors;
  // Why each mission gave nothing to judge: its method leaves the star out, or it publishes no light curve of it.
  const unread = (one: Mission) => { const found = applies(one), more = one === 'TESS' ? (catalogue ? ` ${String(catalogue.says)}` : elsewhere ? ` ${elsewhere}` : '') : ''; return `${'reason' in found ? found.reason : one === 'TESS' && crowded ? crowded : `${one} publishes no ${one === 'TESS' ? '2-minute ' : ''}light curve of this star.`}${more}`; };
  let rotation: RotationVerdict = { detected: false, reason: star.otherLight ?? `${unread('K2')} ${unread('TESS')}` }, by: PeriodMethod | PublishedPaper | undefined = last?.method, published: Record<string, unknown> | undefined, papers: Record<string, unknown>[] = [];
  let accepted: { window: number; time: readonly number[]; flux: readonly number[] }[] = [];
  // Why no rotation is drawn, sentence by sentence, and whether a method or a paper gives the star one all the same.
  const reasons: string[] = last ? [] : [unread('K2'), unread('TESS')]; let claimed = last?.judged.verdict.detected ?? false;
  if (last) { const { judged } = last; rotation = checked(judged.verdict);
    if (rotation.detected) accepted = judged.windows.filter(window => window.verdict.detected);
    if (!judged.verdict.detected) { reasons.push(...[...refused.map(one => one.judged.verdict.reason), judged.verdict.reason, ...(last.mission === 'K2' ? [unread('TESS')] : [])].filter(reason => reason !== undefined));
      // The method refuses: each paper's own verdict on the star, when its table lists it, on the light the paper judged.
      const tic = last.mission === 'TESS' ? ticOf(last.listed[0]?.filename ?? '') : undefined, findings: PublishedFinding[] = [];
      for (const table of tic === undefined ? [] : PUBLISHED) { const finding = table.paper.missions.includes('TESS') ? await table.find(tic!, last.listed.map(one => one.window), keptTable(table.paper.id)) : undefined; if (finding) findings.push(finding); }
      // Two papers that give the star different periods: neither is taken.
      const apart = publishedApart(findings); if (apart) reasons.push(apart);
      for (const { paper, row, judgement: said, says, measures } of findings) { const listed = { id: paper.id, citation: paper.citation, url: paper.url, table: paper.table, tic, row, verdict: said.verdict }; claimed ||= said.verdict.detected; papers.push(listed);
        if (rotation.detected) continue; published = listed; if (apart && said.verdict.detected) continue;
        const kept = said.verdict.detected ? keptAsPublished(paper, said.verdict, checked(said.verdict), star.cataloguedPeriodDays, await cataloguedOf(id)) : said.verdict;
        if (!kept.detected) { reasons.push(kept.reason!); continue; }
        const taken = judged.windows.filter(window => said.windows.includes(window.window)); accepted = taken;
        // A table that prints no swing of the light: the star's is the mean, over the sectors mapped, of the range the method's own code measured of each.
        const ranges = taken.flatMap(window => typeof window.measures.range === 'number' ? [window.measures.range] : []);
        rotation = kept.amplitude === undefined && ranges.length ? { ...kept, amplitude: Number((ranges.reduce((sum, range) => sum + range, 0) / ranges.length).toFixed(6)) } : kept; by = paper;
        for (const window of accepted) { const entry = tried.find(one => one.mission === last!.mission && one.window === window.window && one.method === last!.method.id);
          tried.push({ mission: last.mission, window: window.window, method: paper.id, lightCurveFile: entry?.lightCurveFile, frames: entry?.frames, lightCurve: entry?.lightCurve, analysis: measures, says, verdict: said.verdict }); } }
      if (!rotation.detected) rotation = { detected: false, reason: reasons.join(' ') }; } }
  // A star no method and no paper above gives a rotation: Kepler's light of it, on the verdict of Santos et al. Their
  // samples are main-sequence stars and subgiants, cut at log g 3.5; a star its record puts below is not asked for.
  if (!claimed && !star.otherLight && !((kind.surfaceGravityLogg ?? SANTOS_GRAVITY) < SANTOS_GRAVITY) && await isStar(id)) { const targets = await kepseismicAt(targetPlaces(star, 'Kepler')), kic = targets[0]?.kic; let there = false;
    for (const paper of kic === undefined ? [] : SANTOS) { const row = (await publishedRows(paper, keptTable(paper.id))).get(kic!); if (!row) continue;
      const said = paper.judge(row, []).verdict, kept = said.detected ? checked(said) : said; there = true;
      published = { id: paper.id, citation: paper.citation, url: paper.url, table: paper.table, kic, row, verdict: said };
      if (!kept.detected) { reasons.push(said.detected ? `${paper.citation} list the star with a rotation period of ${said.periodDays} d. ${kept.reason}` : kept.reason!); continue; }
      // The light the papers read a period of that length in, and each of its quarters under their rule.
      const [file] = await fetchLightCurves(targets.filter(one => one.filterDays === filterFor(said.periodDays!)), files); if (!file) throw new Error(`KEPSEISMIC lists no light curve of KIC ${kic} filtered at ${filterFor(said.periodDays!)} days.`);
      const series = readKepseismic(new Uint8Array(await readFile(file.file))), read = santosStar(row, series, kept.periodDays); published = { ...published, note: read.note };
      for (const quarter of read.quarters) { const name = `${stem('Kepler', quarter.quarter)}.curve.json`;
        await writeFile(resolve(run, name), `${JSON.stringify({ mission: 'Kepler', window: quarter.quarter, product: 'kepseismic', time: quarter.time, flux: quarter.flux })}\n`);
        tried.push({ mission: 'Kepler', window: quarter.quarter, method: paper.id, lightCurveFile: { url: file.url, bytes: file.bytes, pipeline: series.pipeline, filterDays: series.filterDays }, frames: quarter.measured, lightCurve: name,
          analysis: { ...paper.measures(row), filled: quarter.filled, spanDays: quarter.spanDays, turns: quarter.turns, varianceOverMedian: quarter.varianceOverMedian, variabilityRange: quarter.verdict.amplitude ?? null }, says: paper.says(row), verdict: quarter.verdict }); }
      if (!read.verdict.detected) { reasons.push(read.verdict.reason!); continue; }
      rotation = { ...kept, amplitude: read.verdict.amplitude }; by = paper; mission = 'Kepler'; listed = [{ filename: file.filename }];
      accepted = read.quarters.filter(quarter => quarter.verdict.detected).map(quarter => ({ window: quarter.quarter, time: quarter.time, flux: quarter.flux })); }
    if (kic !== undefined && !there) reasons.push('Santos et al. (2019, 2021) do not list the star in their rotation catalogues of Kepler stars.');
    if (kic !== undefined && !rotation.detected) rotation = { detected: false, reason: reasons.join(' ') }; }
  // A star still without a rotation, which MEarth-South watched: the verdict of Newton et al. (2018), on the light they judged.
  if (!claimed && !rotation.detected && !star.otherLight && await isStar(id)) { const place = placeAt(star, 2000);
    for (const paper of MEARTH_PAPERS) { const row = rowAt((await publishedRows(paper, keptTable(paper.id))).values(), place, SAME_STAR_ARCSEC); if (!row) continue;
      const said = paper.judge(row, []).verdict, kept = said.detected ? keptAsPublished(paper, said, checked(said), star.cataloguedPeriodDays, await cataloguedOf(id)) : said; claimed ||= said.detected;
      published = { id: paper.id, citation: paper.citation, url: paper.url, table: paper.table, twomass: row.twomass, row, verdict: said };
      if (!kept.detected) { reasons.push(kept.reason!); rotation = { detected: false, reason: reasons.join(' ') }; continue; }
      // Every light curve the release holds of the star, one a telescope; the paper's model is fitted to the longest.
      const fetched = await Promise.all(filesOf(await southIndex(KEPT_MEARTH_INDEX), row.twomass).map(name => fetchMearth(name, files)));
      const read = await newtonStar(row, await Promise.all(fetched.map(async one => ({ filename: one.filename, curve: parseLightCurve(await readFile(one.file, 'utf8')) }))), place), file = fetched.find(one => one.filename === read.filename);
      published = { ...published, ...(read.note ? { note: read.note } : {}) };
      for (const season of read.seasons) { const name = `${stem('MEarth', season.season)}.curve.json`;
        await writeFile(resolve(run, name), `${JSON.stringify({ mission: 'MEarth', window: season.season, product: 'mearth', time: season.time, flux: season.flux })}\n`);
        tried.push({ mission: 'MEarth', window: season.season, method: paper.id, lightCurveFile: { url: file?.url, bytes: file?.bytes, pipeline: MEARTH_RELEASE.name, ...read.file }, frames: season.nights, lightCurve: name,
          analysis: { ...paper.measures(row), ...read.fitted, exposures: season.exposures, spanDays: season.spanDays, turns: season.turns }, says: paper.says(row), verdict: season.verdict }); }
      if (!read.verdict.detected) { reasons.push(read.verdict.reason!); rotation = { detected: false, reason: reasons.join(' ') }; continue; }
      rotation = kept; by = paper; mission = 'MEarth'; listed = file ? [{ filename: file.filename }] : [];
      accepted = read.seasons.filter(season => season.verdict.detected).map(season => ({ window: season.season, time: season.time, flux: season.flux })); } }
  // The caller's counts are within TESS's radius and K2's; a star read from the ground is counted within its own aperture's.
  const own = light === undefined || mission === 'MEarth' ? (await lightOf([star], false, PIXELS[mission].radiusArcsec)).get(id) : (mission === 'TESS' ? light.wide : light.near) ?? undefined;
  await rm(files, { recursive: true, force: true });
  // What was tried before and refused, oldest first: an earlier mission's method and, when a paper's verdict decides, the method run on the same light.
  const before = [...refused, ...(last && by !== last.method ? [last] : [])].map(one => ({ mission: one.mission, method: described(one.method), lightCurves: one.listed.map(file => ({ window: file.window, file: file.filename })),
    ...(one.judged.whole ? { whole: { analysis: one.judged.whole.measures, says: one.judged.whole.says, verdict: one.judged.whole.verdict } } : {}), rotation: one.judged.verdict }));
  const whole = last && by === last.method ? last.judged.whole : undefined;
  // The codes that read and prepared the light: MEarth's are its own toolchain's.
  const codes = mission === 'MEarth' ? await mearthPins() : pins;
  const receipt: Record<string, unknown> = { schema: ROTATION_SCHEMA, star, ...(own ? { light: own } : {}), mission, lightCurves: listed.map(one => ({ window: one.window, file: one.filename })), ...(catalogue ? { inputCatalogue: catalogue } : {}), ...(elsewhere ? { elsewhere } : {}), ...(blending ? { blending } : {}), tried,
    ...(whole ? { whole: { analysis: whole.measures, says: whole.says, verdict: whole.verdict } } : {}), ...(before.length ? { refused: before } : {}), ...(published ? { published } : {}), ...(papers.length > 1 ? { papers } : {}), ...(by ? { method: described(by) } : {}), rotation, toolchain: { id: codes.id, requirements: codes.entry.requirements } };
  // One map for each window whose light was accepted, all at the star's one period.
  const maps: Record<string, unknown>[] = [];
  const made = accepted.length ? await brightnessMaps(accepted, rotation.periodDays!, Math.min(star.tiltDegrees ?? ASSUMED_TILT_DEGREES, 90), mission === 'MEarth' ? MEARTH_MAP_DEGREE : undefined) : [];
  for (const [index, read] of accepted.entries()) { const map = made[index]!, table = `${stem(mission, read.window)}.dat`, flat = map.values.flat();
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
