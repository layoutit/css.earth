/** `telescope new-object` for the brightness maps this repository makes from a star's light in the TESS full-frame images:
 * draft a spec from the stars already reduced, and the route (maps/route.mts) that writes each map as a dataset of the
 * star's page and bakes the star. brightness-maps.mts holds the records; `archives/tess/` reduces a star.
 *
 * A brightness map never changes the axis a page draws: a light curve fixes longitudes, not the tilt. The period measured
 * on the way is written into the star's measurements record, where the metadata pass counts it among the star's periods. */
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isRecord, requireRecord } from '@cssearth/core';
import { receiptPath, ROTATION_SCHEMA } from '../../archives/tess/reduce.mts';
import { readJson, type MapRoute, type RouteContext } from '../maps/route.mts';
import type { SurfaceMapChoice } from '../maps/surface-maps.mts';
import { MEASURED_PERIOD } from '../metadata/star-metadata.mts';
import { BRIGHTNESS_GENERATOR, BRIGHTNESS_MAPS, brightnessChoice, brightnessSourceRecords, percent, reducedBrightness, type BrightnessSurfaceMap } from './brightness-maps.mts';

const reduce = (host: string) => `node ${BRIGHTNESS_GENERATOR} ${host}`;
/** The light's swing as the star turns, percent of its mean, beside the measured period in the star's record. */
export const LIGHT_SWING = 'rotationLightSwingPercent';

async function reduced(root: string, host: string, choice: SurfaceMapChoice): Promise<BrightnessSurfaceMap> {
  const receipt = requireRecord(await readJson(receiptPath(host), `${host} is not reduced (${reduce(host)})`), `${host} receipt`);
  if (receipt.schema !== ROTATION_SCHEMA) throw new Error(`${host}: its receipt is of an earlier reduction; reduce it again (${reduce(host)}).`);
  const table = await readFile(resolve(root, 'output/tess', host, `${choice.program}.dat`), 'utf8').catch(() => { throw new Error(`${choice.program}: its map table is not in output/tess/${host} (${reduce(host)}).`); });
  return reducedBrightness(choice, receipt, table);
}

/** The star's measurements record with the period of its newest map, the light's swing and where both come from, set before
 * the record's `shape` as the catalogued values are. */
export function withMeasuredRotation(record: Readonly<Record<string, unknown>>, map: Pick<BrightnessSurfaceMap, 'periodDays' | 'sector' | 'amplitude'>): Record<string, unknown> {
  const fields = { [MEASURED_PERIOD.days]: map.periodDays, [MEASURED_PERIOD.source]: `Measured in this project from the star's light in the TESS full-frame images of sector ${map.sector} (${BRIGHTNESS_GENERATOR}): ${map.periodDays} d, the light swinging by ${percent(map.amplitude)}% as the star turns`,
    [LIGHT_SWING]: Number((100 * map.amplitude).toFixed(2)) }, out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) { if (key === 'shape') Object.assign(out, fields); if (!(key in fields)) out[key] = value; }
  return 'shape' in record ? out : { ...out, ...fields };
}

async function starRecords(root: string, host: string, maps: readonly BrightnessSurfaceMap[]): Promise<Map<string, string>> {
  const path = `src/objects/${host}/source/measurements.json`, record = await readFile(resolve(root, path), 'utf8').then(text => JSON.parse(text) as unknown, () => undefined), newest = [...maps].sort((a, b) => a.sector - b.sector).at(-1);
  return isRecord(record) && newest ? new Map([[path, `${JSON.stringify(withMeasuredRotation(record, newest), null, 2)}\n`]]) : new Map();
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
    const choice = brightnessChoice(host, receipt.map.sector); brightnessMaps.push({ host, maps: [choice] }); if (!all) report.push(`  ${host}: ${choice.label} (${choice.program})`); }
  if (all) report.push(`  ${brightnessMaps.length} stars with a map; ${unseen} reduced stars whose rotation is not seen.`);
  return { stars: [], brightnessMaps, report };
}
