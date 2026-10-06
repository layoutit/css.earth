/** `telescope new-object` for the brightness maps this repository makes from a star's light in the TESS full-frame images:
 * draft a spec from the stars already reduced, and the route (maps/route.mts) that writes each map as a dataset of the
 * star's page and bakes the star. brightness-maps.mts holds the records; `archives/tess/` reduces a star.
 *
 * A brightness map never changes the axis a page draws: a light curve fixes longitudes, not the tilt. The period measured
 * on the way is written into the star's measurements record, where the metadata pass counts it among the star's periods. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isRecord, requireRecord } from '@cssearth/core';
import { notTurning } from '../../archives/tess/photometry.mts';
import { receiptPath, ROTATION_SCHEMA } from '../../archives/tess/reduce.mts';
import { readJson, type MapRoute, type RouteContext } from '../maps/route.mts';
import type { SurfaceMapChoice } from '../maps/surface-maps.mts';
import { MEASURED_PERIOD } from '../metadata/star-metadata.mts';
import { BRIGHTNESS_GENERATOR, BRIGHTNESS_MAPS, brightnessChoice, brightnessSourceRecords, monthsOf, percent, reducedBrightness, STRETCH_NAME, TESS_ARCHIVE, type BrightnessSurfaceMap } from './brightness-maps.mts';

const reduce = (host: string) => `node ${BRIGHTNESS_GENERATOR} ${host}`;
/** The light's swing as the star turns, percent of its mean, beside the measured period in the star's record. */
export const LIGHT_SWING = 'rotationLightSwingPercent';

async function reduced(root: string, host: string, choice: SurfaceMapChoice): Promise<BrightnessSurfaceMap> {
  const receipt = requireRecord(await readJson(receiptPath(host), `${host} is not reduced (${reduce(host)})`), `${host} receipt`);
  if (receipt.schema !== ROTATION_SCHEMA) throw new Error(`${host}: its receipt is of an earlier reduction; reduce it again (${reduce(host)}).`);
  const table = await readFile(resolve(root, 'output/tess', host, `${choice.program}.dat`), 'utf8').catch(() => { throw new Error(`${choice.program}: its map table is not in output/tess/${host} (${reduce(host)}).`); });
  return reducedBrightness(choice, receipt, table, await readJson(resolve(root, 'output/tess', host, `${choice.program}.curve.json`), `${choice.program}: its light curve is not in output/tess/${host} (${reduce(host)})`));
}

/** A record with `fields` set before its `shape`, as the catalogued values are; fields it already holds are replaced in place of being added. */
function beforeShape(record: Readonly<Record<string, unknown>>, fields: Readonly<Record<string, unknown>>): Record<string, unknown> { const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) { if (key === 'shape') Object.assign(out, fields); if (!(key in fields)) out[key] = value; }
  return 'shape' in record ? out : { ...out, ...fields }; }

/** The star's measurements record with the period of its newest map, the light's swing and where both come from. */
export function withMeasuredRotation(record: Readonly<Record<string, unknown>>, map: Pick<BrightnessSurfaceMap, 'periodDays' | 'sector' | 'amplitude' | 'lightPeriodDays'>): Record<string, unknown> {
  return beforeShape(record, { [MEASURED_PERIOD.days]: map.periodDays, [MEASURED_PERIOD.source]: `Measured in this project from the star's light in the TESS full-frame images of sector ${map.sector} (${BRIGHTNESS_GENERATOR}): ${map.periodDays} d, the light swinging by ${percent(map.amplitude)}% as the star turns${map.lightPeriodDays === undefined ? '' : ` (the light repeats every ${map.lightPeriodDays} d, half the catalogued rotation period, and the star is taken to turn once in two of them)`}`,
    [LIGHT_SWING]: Number((100 * map.amplitude).toFixed(2)) });
}

/** What the reduction found in a star's TESS light, for every star it looked at and not only those with a map: the verdict in
 * the reduction's own sentence, the sector read, and the scatter of the light over it. A star not read says why. */
export const TESS_LIGHT = { verdict: 'tessLight', sector: 'tessLightSector', scatter: 'tessLightScatterPercent', source: 'tessLightSource' } as const;
export function withTessLight(record: Readonly<Record<string, unknown>>, receipt: unknown, curve?: unknown): Record<string, unknown> {
  const reduced = requireRecord(receipt, 'receipt'), rotation = requireRecord(reduced.rotation, 'receipt rotation'), tried = Array.isArray(reduced.tried) ? reduced.tried.filter(isRecord).at(-1) : undefined, sector = typeof tried?.sector === 'number' ? tried.sector : undefined;
  const verdict = rotation.detected === true ? `The star's rotation is seen: ${String(rotation.periodDays)} d, the light swinging by ${percent(Number(rotation.amplitude))}%.` : typeof rotation.reason === 'string' ? rotation.reason : 'No rotation is seen.';
  const flux = isRecord(curve) && Array.isArray(curve.flux) ? curve.flux.filter((value): value is number => typeof value === 'number') : [], mean = flux.reduce((sum, value) => sum + value, 0) / (flux.length || 1);
  const scatter = flux.length > 1 && mean > 0 ? Number((100 * Math.sqrt(flux.reduce((sum, value) => sum + (value - mean) ** 2, 0) / flux.length) / mean).toFixed(2)) : undefined;
  const without = Object.fromEntries(Object.entries(record).filter(([key]) => !(Object.values(TESS_LIGHT) as readonly string[]).includes(key)));
  return beforeShape(without, { [TESS_LIGHT.verdict]: verdict, ...(sector === undefined ? {} : { [TESS_LIGHT.sector]: sector }), ...(scatter === undefined ? {} : { [TESS_LIGHT.scatter]: scatter }),
    [TESS_LIGHT.source]: sector === undefined ? `Looked at in this project before any pixel was fetched (${BRIGHTNESS_GENERATOR}); the star's TESS pixels were not read` : `Read in this project from the TESS full-frame images of sector ${sector} (${BRIGHTNESS_GENERATOR})${scatter === undefined ? '' : '; the scatter is the standard deviation of the light in 30-minute bins over the sector, as a share of its mean'}` });
}

/** `--tess-light --all | STAR_ID...`: each star the reduction has looked at gains what it found, in its measurements record. */
export async function writeTessLight(root: string, ids: readonly string[] | 'all', report: (line: string) => void): Promise<number> {
  const hosts = ids === 'all' ? (await readdir(resolve(root, 'output/tess'), { withFileTypes: true }).catch(() => [])).filter(entry => entry.isDirectory()).map(entry => entry.name).sort() : ids; let written = 0;
  for (const host of hosts) { const receipt: unknown = await readFile(receiptPath(host), 'utf8').then(text => JSON.parse(text) as unknown, () => undefined), path = resolve(root, 'src/objects', host, 'source/measurements.json');
    const record: unknown = await readFile(path, 'utf8').then(text => JSON.parse(text) as unknown, () => undefined);
    if (!isRecord(receipt) || receipt.schema !== ROTATION_SCHEMA || !isRecord(record)) { if (ids !== 'all') report(`  ${host}: not written: ${isRecord(record) ? `not reduced (${reduce(host)})` : 'no measurements record'}`); continue; }
    const last = Array.isArray(receipt.tried) ? receipt.tried.filter(isRecord).at(-1) : undefined, curve: unknown = typeof last?.lightCurve === 'string' ? await readFile(resolve(root, 'output/tess', host, last.lightCurve), 'utf8').then(text => JSON.parse(text) as unknown, () => undefined) : undefined;
    const next = `${JSON.stringify(withTessLight(record, receipt, curve), null, 2)}\n`; if (next !== await readFile(path, 'utf8')) { await writeFile(path, next); written += 1; } }
  report(`${written} record(s) changed of ${hosts.length} star(s) looked at.`); return written;
}

/** The lead every paragraph this route writes into a star's README begins with: a later run finds and replaces them by it. */
const README_LEAD = '**Brightness from TESS.**';
const NOTE = '../../../docs/stellar-brightness-maps-from-tess.md';
/** A README with `text` as the last paragraph of `section`, before the next section or the links that close the file. A README without the section is left as it is. */
function atEndOf(readme: string, section: string, text: string): string {
  const head = new RegExp(`^## ${section}\\s*$`, 'mu').exec(readme); if (!head) return readme;
  const from = head.index + head[0].length, rest = readme.slice(from), next = /^(?:## |\[Investigation ledger\])/mu.exec(rest), end = from + (next ? next.index : rest.length);
  return `${readme.slice(0, end).trimEnd()}\n\n${text}\n${next ? '\n' : ''}${readme.slice(end)}`;
}
/** The star's README with what its brightness datasets are made from, what was measured and what is not known, in the
 * sections it already has. Written again, the paragraphs are replaced, not added. */
export function withBrightnessReadme(readme: string, map: BrightnessSurfaceMap, cataloguedDays?: number): string {
  const kept = readme.split('\n\n').filter(paragraph => !paragraph.trimStart().replace(/^- /u, '').startsWith(README_LEAD)).join('\n\n'), when = monthsOf(map.fromUtc, map.toUtc);
  const beside = cataloguedDays === undefined ? 'The star\'s record holds no catalogued rotation period to set it beside.' : map.lightPeriodDays !== undefined ? `The light repeats every ${map.lightPeriodDays} d, half the ${cataloguedDays} d the star's record holds from the catalogues, so the star is taken to turn once in two of them.` : `The star's record holds ${cataloguedDays} d from the catalogues.`;
  const others = map.neighbours === 0 ? 'Gaia DR3 lists no other star within 63 arcseconds.' : `Gaia DR3 lists ${map.neighbours} other ${map.neighbours === 1 ? 'star' : 'stars'} within 63 arcseconds, giving ${map.neighbourShare < 0.001 ? 'under 0.1' : percent(map.neighbourShare)}% of the light in the star's pixels.`;
  const tilt = map.tiltFrom === 'assumed' ? `No tilt of the axis is known, so the map is made at ${map.inclinationDegrees}°, the middle tilt of axes that point at random.` : map.tiltFrom === 'record' ? `The map is made at a tilt of ${map.inclinationDegrees}°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention.` : `The map is made at the tilt the page draws, ${map.inclinationDegrees}°.`;
  const paragraphs: readonly (readonly [string, string])[] = [
    ['Sources', `${README_LEAD} The Color + brightness and Brightness map datasets are made in this project from the star's light in TESS's full-frame images of sector ${map.sector} (${when}), cut at the star's place by MAST's [TESScut](${TESS_ARCHIVE.pixels}) ([source record](../../sources/mast-tess-full-frame-images.json)). lightkurve measures the light, astropy its period, and starry (Luger et al. 2019) the map that reproduces it ([method](${NOTE})). The map's table is built by \`${BRIGHTNESS_GENERATOR}\` and restored from the source cache.`],
    ['Evidence', `${README_LEAD} In sector ${map.sector} the light swings by ${percent(map.amplitude)}% with a period of ${map.periodDays} d, and each of the sector's two orbits alone shows the same period within 20%. ${beside} The map's light curve leaves a scatter of ${percent(map.residual)}% about the light, whose own noise is ${percent(map.noise)}%. ${others}`],
    ['Known problems', `- ${README_LEAD} Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast stretched so it can be seen (the darkest part by the ${STRETCH_NAME} of its share of light lost); Brightness map has the measured values. ${tilt} The map is of ${when}: spots come and go within weeks or months.`]];
  return paragraphs.reduce((text, [section, paragraph]) => atEndOf(text, section, paragraph), kept);
}

async function starRecords(root: string, host: string, maps: readonly BrightnessSurfaceMap[]): Promise<Map<string, string>> {
  const path = `src/objects/${host}/source/measurements.json`, record = await readFile(resolve(root, path), 'utf8').then(text => JSON.parse(text) as unknown, () => undefined), newest = [...maps].sort((a, b) => a.sector - b.sector).at(-1), out = new Map<string, string>();
  if (!newest) return out;
  if (isRecord(record)) out.set(path, `${JSON.stringify(withMeasuredRotation(record, newest), null, 2)}\n`);
  const readmePath = `src/objects/${host}/README.md`, readme = await readFile(resolve(root, readmePath), 'utf8').catch(() => undefined), catalogued = isRecord(record) && typeof record.rotationPeriodDays === 'number' && !String(record.rotationPeriodSource ?? '').includes(BRIGHTNESS_GENERATOR) ? record.rotationPeriodDays : undefined;
  if (readme !== undefined) out.set(readmePath, withBrightnessReadme(readme, newest, catalogued));
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
    if (!isRecord(receipt.map) || typeof receipt.map.sector !== 'number') { unseen += 1; if (!all) report.push(`  ${host}: not drafted: ${isRecord(receipt.rotation) && typeof receipt.rotation.reason === 'string' ? receipt.rotation.reason : 'its rotation is not seen'}`); continue; }
    // A star reduced before its record held SIMBAD's type, and now known to change its light for another reason, is left out too.
    const record: unknown = await readFile(resolve(context.root, 'src/objects', host, 'source/measurements.json'), 'utf8').then(text => JSON.parse(text) as unknown, () => undefined);
    const other = isRecord(record) ? notTurning(typeof record.objectType === 'string' ? record.objectType : undefined, typeof record.objectTypePath === 'string' ? record.objectTypePath : undefined) : undefined;
    if (other) { unseen += 1; report.push(`  ${host}: not drafted: ${other}`); continue; }
    const choice = brightnessChoice(host, receipt.map.sector); brightnessMaps.push({ host, maps: [choice] }); if (!all) report.push(`  ${host}: ${choice.label} (${choice.program})`); }
  if (all) report.push(`  ${brightnessMaps.length} stars with a map; ${unseen} reduced stars whose rotation is not seen.`);
  return { stars: [], brightnessMaps, report };
}
