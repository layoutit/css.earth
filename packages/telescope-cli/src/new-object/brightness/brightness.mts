/** `telescope new-object` for the brightness maps this repository makes from a star's light in a space telescope's light
 * curves (a Kepler quarter, a K2 campaign, a TESS sector):
 * draft a spec from the stars already reduced, and the route (maps/route.mts) that writes each map as a dataset of the
 * star's page and bakes the star. brightness-maps.mts holds the records; `archives/tess/` reduces a star.
 *
 * A brightness map never changes the axis a page draws: a light curve fixes longitudes, not the tilt. The period measured
 * on the way is written into the star's measurements record, where the metadata pass counts it among the star's periods. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isRecord, requireRecord } from '@cssearth/core';
import { notTurning } from '../../archives/tess/verdict.mts';
import { receiptPath, ROTATION_SCHEMA } from '../../archives/tess/reduce.mts';
import { readJson, type MapRoute, type RouteContext } from '../maps/route.mts';
import type { SurfaceMapChoice } from '../maps/surface-maps.mts';
import { MEASURED_PERIOD } from '../metadata/star-metadata.mts';
import { BRIGHTNESS_GENERATOR, BRIGHTNESS_MAPS, brightnessChoice, brightnessSourceRecords, missionOf, MISSIONS, monthsOf, percent, reducedBrightness, windowName, type BrightnessSurfaceMap, type LightMission } from './brightness-maps.mts';

const reduce = (host: string) => `node ${BRIGHTNESS_GENERATOR} ${host}`;
/** The light's swing as the star turns, percent of its mean, beside the measured period in the star's record. */
export const LIGHT_SWING = 'rotationLightSwingPercent';

async function reduced(root: string, host: string, choice: SurfaceMapChoice): Promise<BrightnessSurfaceMap> {
  const receipt = requireRecord(await readJson(receiptPath(host), `${host} is not reduced (${reduce(host)})`), `${host} receipt`);
  if (receipt.schema !== ROTATION_SCHEMA) throw new Error(`${host}: its receipt is of an earlier reduction; reduce it again (${reduce(host)}).`);
  const table = await readFile(resolve(root, 'output/tess', host, `${choice.program}.dat`), 'utf8').catch(() => { throw new Error(`${choice.program}: its map table is not in output/tess/${host} (${reduce(host)}).`); });
  return reducedBrightness(choice, receipt, table, await readJson(resolve(root, 'output/tess', host, `${choice.program}.curve.json`), `${choice.program}: its light curve is not in output/tess/${host} (${reduce(host)})`));
}

/** A record with `fields`: a field it already holds keeps its place, a new one is set before its `shape`, as the catalogued
 * values are. Written again, the record does not move. */
function beforeShape(record: Readonly<Record<string, unknown>>, fields: Readonly<Record<string, unknown>>): Record<string, unknown> { const out: Record<string, unknown> = {}, pending = new Map(Object.entries(fields));
  const rest = () => { for (const [key, value] of pending) out[key] = value; pending.clear(); };
  for (const [key, value] of Object.entries(record)) { if (key === 'shape') for (const [name, next] of [...pending]) if (!(name in record)) { out[name] = next; pending.delete(name); }
    if (pending.has(key)) { out[key] = pending.get(key); pending.delete(key); } else out[key] = value; }
  rest(); return out; }

/** The star's measurements record with the period of its newest map, the light's swing and where both come from. */
type Measured = Pick<BrightnessSurfaceMap, 'periodDays' | 'mission' | 'window' | 'amplitude' | 'lightPeriodDays' | 'method'>;
/** "5, 16 and 18". */
const listed = (items: readonly (string | number)[]) => items.join(', ').replace(/, ([^,]*)$/u, ' and $1');
/** A campaign's own period by its method: the mean of the three methods' periods. */
const ownDays = (map: Pick<BrightnessSurfaceMap, 'method'>) => Number((map.method.periodsDays!.reduce((sum, days) => sum + days, 0) / 3).toFixed(2));
/** `all` is every map of the star, when it has several: a star observed in several campaigns has one period, the mean of theirs. */
export function withMeasuredRotation(record: Readonly<Record<string, unknown>>, map: Measured, all: readonly Measured[] = [map]): Record<string, unknown> { const several = all.length > 1, from = MISSIONS[map.mission];
  return beforeShape(record, { [MEASURED_PERIOD.days]: map.periodDays, [MEASURED_PERIOD.source]: `Measured in this project from the ${from.name} mission's own ${from.cadence}${several ? `light curves of ${from.window}s ${listed(all.map(one => one.window))}` : `light curve of ${from.window} ${map.window}`} (${BRIGHTNESS_GENERATOR}), by the method and criteria of ${map.method.citation}: ${map.periodDays} d${several && map.method.periodsDays ? `, the mean of the ${from.window}s' ${listed(all.map(ownDays))} d` : ''}, the light swinging by ${percent(map.amplitude)}% as the star turns${map.lightPeriodDays === undefined ? '' : ` (the light repeats every ${map.lightPeriodDays} d, half the catalogued rotation period, and the star is taken to turn once in two of them)`}`,
    [LIGHT_SWING]: Number((100 * map.amplitude).toFixed(2)) });
}

/** What the reduction found in a star's light, for every star it looked at and not only those with a map: the verdict in
 * the reduction's own sentence, the mission and window read, and the scatter of the light over it. A star not read says why. */
export const PIXEL_LIGHT = { verdict: 'pixelLight', mission: 'pixelLightMission', window: 'pixelLightWindow', scatter: 'pixelLightScatterPercent', source: 'pixelLightSource' } as const;
export function withPixelLight(record: Readonly<Record<string, unknown>>, receipt: unknown, curve?: unknown): Record<string, unknown> {
  const reduced = requireRecord(receipt, 'receipt'), rotation = requireRecord(reduced.rotation, 'receipt rotation'), tried = Array.isArray(reduced.tried) ? reduced.tried.filter(isRecord).at(-1) : undefined;
  // A receipt from before K2 was read names a TESS sector alone.
  const window = typeof tried?.window === 'number' ? tried.window : typeof tried?.sector === 'number' ? tried.sector : undefined, mission = missionOf(tried?.mission), from = MISSIONS[mission];
  const verdict = rotation.detected === true ? `The star's rotation is seen: ${String(rotation.periodDays)} d, the light swinging by ${percent(Number(rotation.amplitude))}%.` : typeof rotation.reason === 'string' ? rotation.reason : 'No rotation is seen.';
  const flux = isRecord(curve) && Array.isArray(curve.flux) ? curve.flux.filter((value): value is number => typeof value === 'number') : [], mean = flux.reduce((sum, value) => sum + value, 0) / (flux.length || 1);
  const scatter = flux.length > 1 && mean > 0 ? Number((100 * Math.sqrt(flux.reduce((sum, value) => sum + (value - mean) ** 2, 0) / flux.length) / mean).toFixed(2)) : undefined;
  const fields: Record<string, unknown> = { [PIXEL_LIGHT.verdict]: verdict, ...(window === undefined ? {} : { [PIXEL_LIGHT.mission]: mission, [PIXEL_LIGHT.window]: window }), ...(scatter === undefined ? {} : { [PIXEL_LIGHT.scatter]: scatter }),
    [PIXEL_LIGHT.source]: window === undefined ? `Looked at in this project before any pixel was fetched (${BRIGHTNESS_GENERATOR}); the star's pixels were not read` : `Read in this project from the ${from.name} ${from.pixels} of ${from.window} ${window} (${BRIGHTNESS_GENERATOR})${scatter === undefined ? '' : `; the scatter is the standard deviation of the light ${mission === 'TESS' ? 'in 30-minute bins ' : ''}over the ${from.window}, as a share of its mean`}` };
  // A field of an earlier look that this one does not have (a window, a scatter) goes; the others keep their place.
  return beforeShape(Object.fromEntries(Object.entries(record).filter(([key]) => !(Object.values(PIXEL_LIGHT) as readonly string[]).includes(key) || key in fields)), fields);
}

/** `--pixel-light --all | STAR_ID...`: each star the reduction has looked at gains what it found, in its measurements record. */
export async function writePixelLight(root: string, ids: readonly string[] | 'all', report: (line: string) => void): Promise<number> {
  const hosts = ids === 'all' ? (await readdir(resolve(root, 'output/tess'), { withFileTypes: true }).catch(() => [])).filter(entry => entry.isDirectory()).map(entry => entry.name).sort() : ids; let written = 0;
  for (const host of hosts) { const receipt: unknown = await readFile(receiptPath(host), 'utf8').then(text => JSON.parse(text) as unknown, () => undefined), path = resolve(root, 'src/objects', host, 'source/measurements.json');
    const record: unknown = await readFile(path, 'utf8').then(text => JSON.parse(text) as unknown, () => undefined);
    if (!isRecord(receipt) || receipt.schema !== ROTATION_SCHEMA || !isRecord(record)) { if (ids !== 'all') report(`  ${host}: not written: ${isRecord(record) ? `not reduced (${reduce(host)})` : 'no measurements record'}`); continue; }
    const last = Array.isArray(receipt.tried) ? receipt.tried.filter(isRecord).at(-1) : undefined, curve: unknown = typeof last?.lightCurve === 'string' ? await readFile(resolve(root, 'output/tess', host, last.lightCurve), 'utf8').then(text => JSON.parse(text) as unknown, () => undefined) : undefined;
    const next = `${JSON.stringify(withPixelLight(record, receipt, curve), null, 2)}\n`; if (next !== await readFile(path, 'utf8')) { await writeFile(path, next); written += 1; } }
  report(`${written} record(s) changed of ${hosts.length} star(s) looked at.`); return written;
}

/** The lead every paragraph this route writes into a star's README begins with, by mission: a later run finds and replaces them by it. */
const leadOf = (mission: LightMission) => `**Brightness from ${MISSIONS[mission].name}.**`, README_LEADS = (Object.keys(MISSIONS) as LightMission[]).map(leadOf);
const NOTE = '../../../docs/stellar-brightness-maps-from-tess.md';
/** A README with `text` as the last paragraph of `section`, before the next section or the links that close the file. A README without the section is left as it is. */
function atEndOf(readme: string, section: string, text: string): string {
  const head = new RegExp(`^## ${section}\\s*$`, 'mu').exec(readme); if (!head) return readme;
  const from = head.index + head[0].length, rest = readme.slice(from), next = /^(?:## |\[Investigation ledger\])/mu.exec(rest), end = from + (next ? next.index : rest.length);
  return `${readme.slice(0, end).trimEnd()}\n\n${text}\n${next ? '\n' : ''}${readme.slice(end)}`;
}
/** The star's README with what its brightness datasets are made from, what was measured and what is not known, in the
 * sections it already has. Written again, the paragraphs are replaced, not added. */
export function withBrightnessReadme(readme: string, map: BrightnessSurfaceMap, cataloguedDays?: number, all: readonly BrightnessSurfaceMap[] = [map]): string {
  const kept = readme.split('\n\n').filter(paragraph => !README_LEADS.some(lead => paragraph.trimStart().replace(/^- /u, '').startsWith(lead))).join('\n\n'), when = monthsOf(map.fromUtc, map.toUtc), from = MISSIONS[map.mission], README_LEAD = leadOf(map.mission), { method } = map;
  const several = all.length > 1, windows = listed(all.map(one => one.window)), varies = `The light varies by ${percent(map.amplitude)}% (the range between its 5th and 95th percentiles${several && method.periodsDays ? `, the mean of the ${from.window}s'` : ''}).`;
  const beside = cataloguedDays === undefined ? 'The star\'s record holds no catalogued rotation period to set it beside.' : map.lightPeriodDays !== undefined ? `The light repeats every ${map.lightPeriodDays} d, half the ${cataloguedDays} d the star's record holds from the catalogues, so the star is taken to turn once in two of them.` : `The star's record holds ${cataloguedDays} d from the catalogues.`;
  const others = map.neighbours === undefined || map.neighbourShare === undefined ? '' : map.neighbours === 0 ? ` Gaia DR3 lists no other star within ${from.radiusArcsec} arcseconds.` : ` Gaia DR3 lists ${map.neighbours} other ${map.neighbours === 1 ? 'star' : 'stars'} within ${from.radiusArcsec} arcseconds, with ${map.neighbourShare < 0.001 ? 'under 0.1' : percent(map.neighbourShare)}% of their light and the star's together.`;
  const tilt = map.tiltFrom === 'assumed' ? `No tilt of the axis is known, so the map is made at ${map.inclinationDegrees}°, the middle tilt of axes that point at random.` : map.tiltFrom === 'record' ? `The map is made at a tilt of ${map.inclinationDegrees}°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention.` : `The map is made at the tilt the page draws, ${map.inclinationDegrees}°.`;
  // What the method measured, in its own terms: Reinhold & Hekker's three periods a campaign, or the method's own sentence a window.
  const three = (one: BrightnessSurfaceMap) => listed(one.method.periodsDays!.map(days => days.toFixed(2))), period = map.lightPeriodDays ?? map.periodDays;
  // A paper's own verdict: what its table gives; then every method run here before, with the mission it read and its refusal.
  const before = (method.refused ?? []).map(one => ` The criteria of ${one.citation}, applied here to the star's ${MISSIONS[one.mission].name} light, are not met: ${one.reason}`).join('');
  // What the paper's entry says of the light read and of the windows left without a map.
  const unmapped = method.note ? ` ${method.note}` : '';
  const measured = method.published ? `${method.citation} ask ${method.asks}. Their table (${method.published}) gives ${method.says}: the star's period is ${period} d, as published, and no criteria were applied to it here. The light varies by ${percent(map.amplitude)}% (the range between its 5th and 95th percentiles, ${method.swing ?? 'as the table prints it'}).${unmapped}`
    : !method.periodsDays ? `${method.citation} ask ${method.asks}. ${all.map(one => `${from.window[0]!.toUpperCase()}${from.window.slice(1)} ${one.window} gives ${one.method.says}`).join('; ')}${method.read > all.length ? `; ${method.read - all.length} more of the star's ${method.read} ${from.window}s ${method.read - all.length === 1 ? 'does' : 'do'} not meet the criteria` : ''}.${method.wholeSays ? ` All ${method.read} together give ${method.wholeSays}, which is the star's period: ${period} d.` : ` The star's period is ${period} d.`} ${varies}`
    : several ? `K2 observed the star in ${from.window}s ${windows}, and the light of each meets what ${method.citation} ask of a rotation (the three methods' periods within a day of each other under 10 days, two days to 20 and five beyond; a periodogram peak over 0.3): ${all.map(one => `${from.window} ${one.window} gives ${three(one)} d with a peak of ${one.method.peakHeight!.toFixed(2)}`).join('; ')}. The star's period is the mean of the ${from.window}s' ${listed(all.map(ownDays))} d: ${period} d, as the paper takes it for a star observed more than once. ${varies}`
    : `In ${windowName(map.mission, map.window)} the light varies by ${percent(map.amplitude)}% (the range between its 5th and 95th percentiles). The periodogram, the wavelet and the autocorrelation give ${three(map)} d, and the periodogram's peak has a height of ${method.peakHeight!.toFixed(2)}: within what ${method.citation} ask of a rotation (the three within ${method.periodsDays[0] < 10 ? 'a day' : method.periodsDays[0] < 20 ? 'two days' : 'five days'} of each other, a peak over 0.3). The period is their mean, ${period} d.`;
  // Whose light curve it is: the mission's own of each window, or the windows of one KEPSEISMIC light curve of the star.
  const whole = from.product === 'KEPSEISMIC', light = whole ? `${several ? `${from.window}s ${windows}` : `${from.window} ${map.window}`} of the star's KEPSEISMIC light curve (${several ? 'the newest' : 'it is'} of ${when}), which its authors make from the ${from.name} mission's pixels and keep at [MAST](${from.archive})`
    : `the ${from.name} mission's own ${from.cadence}${several ? `light curves of ${from.window}s ${windows} (the newest of ${when}; their` : `light curve of ${from.window} ${map.window} (${when}; its`} PDC-MAP flux, kept at [MAST](${from.archive}))`;
  const paragraphs: readonly (readonly [string, string])[] = [
    ['Sources', `${README_LEAD} The Color + brightness and Brightness map datasets are made in this project from ${light} ([source record](../../sources/${from.record}.json)). ${method.published && whole ? `It is the light curve [${method.citation}](${method.url}) judge, and the star's row in their table (${method.published}) is their verdict that it shows the star turning: the period is theirs and nothing is judged here` : method.published ? `${several ? 'They are' : 'It is'} among the light curves [${method.citation}](${method.url}) searched for rotation, and the star's row in their table (${method.published}) is their verdict that ${several ? 'each' : 'it'} shows the star turning: the period is theirs and nothing is judged here` : `${several ? 'They are the light curves' : 'It is the light curve'} [${method.citation}](${method.url}) use, and their criteria decide whether ${several ? 'each' : 'it'} shows the star turning: ${method.periodsDays ? 'astropy and star-privateer compute their three periods' : 'SpinSpotter, their code, measures it'}`}, and starry (Luger et al. 2019) makes the map that reproduces ${several ? 'each' : 'it'} ([method](${NOTE})). The map's table is built by \`${BRIGHTNESS_GENERATOR}\` and restored from the source cache.`],
    ['Evidence', `${README_LEAD} ${measured} ${method.reliability}${before}${map.kindFrom ? ` ${map.kindFrom}` : ''} ${beside} The map's light curve leaves a scatter of ${percent(map.residual)}% about the light, whose own noise is ${percent(map.noise)}%.${others}`],
    ['Known problems', `- ${README_LEAD} Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. ${tilt} The map is of ${when}: spots come and go within weeks or months.`]];
  return paragraphs.reduce((text, [section, paragraph]) => atEndOf(text, section, paragraph), kept);
}

async function starRecords(root: string, host: string, maps: readonly BrightnessSurfaceMap[]): Promise<Map<string, string>> {
  const path = `src/objects/${host}/source/measurements.json`, record = await readFile(resolve(root, path), 'utf8').then(text => JSON.parse(text) as unknown, () => undefined), ordered = [...maps].sort((a, b) => a.toUtc.localeCompare(b.toUtc)), newest = ordered.at(-1), out = new Map<string, string>();
  if (!newest) return out;
  // A period a paper published is not one measured here: the record gains a measured period only from a method run here.
  if (isRecord(record) && !newest.method.published) out.set(path, `${JSON.stringify(withMeasuredRotation(record, newest, ordered), null, 2)}\n`);
  const readmePath = `src/objects/${host}/README.md`, readme = await readFile(resolve(root, readmePath), 'utf8').catch(() => undefined), catalogued = isRecord(record) && typeof record.rotationPeriodDays === 'number' && !String(record.rotationPeriodSource ?? '').includes(BRIGHTNESS_GENERATOR) ? record.rotationPeriodDays : undefined;
  if (readme !== undefined) out.set(readmePath, withBrightnessReadme(readme, newest, catalogued, ordered));
  return out;
}

export const BRIGHTNESS_ROUTE: MapRoute<BrightnessSurfaceMap> = { kind: BRIGHTNESS_MAPS, specKey: 'brightnessMaps', name: 'brightness maps', reduced, sourceRecords: brightnessSourceRecords, starRecords };

/** `--from-pixels all | HOST...`: one entry a star whose reduction holds a map; `all` is every star reduced so far. A star
 * whose rotation is not seen is reported with the reduction's reason and left out. */
export async function draftsFromReducedPixels(names: readonly string[], context: RouteContext): Promise<{ readonly stars: readonly unknown[]; readonly brightnessMaps: readonly unknown[]; readonly report: readonly string[] }> {
  const all = names.length === 1 && names[0] === 'all', hosts = all ? (await readdir(resolve(context.root, 'output/tess'), { withFileTypes: true }).catch(() => [])).filter(entry => entry.isDirectory()).map(entry => entry.name).sort() : names;
  const brightnessMaps: unknown[] = [], report: string[] = []; let unseen = 0;
  for (const host of hosts) { const receipt: unknown = await readFile(receiptPath(host), 'utf8').then(text => JSON.parse(text) as unknown, () => undefined);
    if (!isRecord(receipt) || receipt.schema !== ROTATION_SCHEMA) { if (!all) report.push(`  ${host}: not drafted: not reduced (${reduce(host)})`); continue; }
    // A receipt holds one map for each window accepted; one from before K2 was read holds a single map.
    const maps = (Array.isArray(receipt.maps) ? receipt.maps : isRecord(receipt.map) ? [receipt.map] : []).filter(isRecord).flatMap(map => { const window = map.window ?? map.sector; return typeof window === 'number' ? [brightnessChoice(host, missionOf(map.mission), window)] : []; });
    if (!maps.length) { unseen += 1; if (!all) report.push(`  ${host}: not drafted: ${isRecord(receipt.rotation) && typeof receipt.rotation.reason === 'string' ? receipt.rotation.reason : 'its rotation is not seen'}`); continue; }
    // A star reduced before its record held SIMBAD's type, and now known to change its light for another reason, is left out too.
    const record: unknown = await readFile(resolve(context.root, 'src/objects', host, 'source/measurements.json'), 'utf8').then(text => JSON.parse(text) as unknown, () => undefined);
    const other = isRecord(record) ? notTurning(typeof record.objectType === 'string' ? record.objectType : undefined, typeof record.objectTypePath === 'string' ? record.objectTypePath : undefined) : undefined;
    if (other) { unseen += 1; report.push(`  ${host}: not drafted: ${other}`); continue; }
    brightnessMaps.push({ host, maps }); if (!all) report.push(`  ${host}: ${maps.map(choice => `${choice.label} (${choice.program})`).join(', ')}`); }
  if (all) report.push(`  ${brightnessMaps.length} stars with a map; ${unseen} reduced stars whose rotation is not seen.`);
  return { stars: [], brightnessMaps, report };
}
