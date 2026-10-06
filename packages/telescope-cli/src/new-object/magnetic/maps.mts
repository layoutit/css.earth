/** `telescope new-object` for magnetic maps this repository reduced from archived spectra: draft a spec from the reduced
 * programs of a star, and the route (maps/route.mts) that writes each map as a dataset of the star's page and bakes the
 * star. map-datasets.mts holds the records; `archives/espadons/` reduces a program. */
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isRecord, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { MAP_SCHEMA, PROGRAMS, receiptPath } from '../../archives/espadons/program.mts';
import { readStar } from '../corona/corona.mts';
import { bakeSurfaceMaps, formatSurfaceMaps, readJson, runSurfaceMaps, TILT_TOLERANCE_DEGREES, type MapRoute, type RouteContext, type SurfaceMapResult } from '../maps/route.mts';
import { isConventionOnly, type SurfaceMapChoice } from '../maps/surface-maps.mts';
import { MAGNETIC_MAPS, mapSourceRecords, reducedMap, tiltedRotation, type ReducedMap } from './map-datasets.mts';

export { TILT_TOLERANCE_DEGREES } from '../maps/route.mts';
type Context = RouteContext;
export type MagneticMapResult = SurfaceMapResult;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const reason = (error: unknown) => (error as Error).message.split('\n')[0]!;
const reduce = (program: string) => `node packages/telescope-cli/src/archives/espadons/reduce.mts ${program}`;

async function reduced(root: string, _host: string, choice: SurfaceMapChoice): Promise<ReducedMap> {
  const receipt = requireRecord(await readJson(receiptPath(choice.program), `${choice.program} is not reduced (${reduce(choice.program)})`), `${choice.program} receipt`);
  if (receipt.schema !== MAP_SCHEMA) throw new Error(`${choice.program}: its receipt is of an earlier reduction; reduce it again (${reduce(choice.program)}).`);
  const table = await readFile(resolve(root, 'output/espadons', choice.program, `${choice.program}.dat`), 'utf8').catch(() => { throw new Error(`${choice.program}: its map table is not in output/espadons (${reduce(choice.program)}).`); });
  return reducedMap(choice, receipt, await readJson(resolve(PROGRAMS, `${choice.program}.json`), `${choice.program}: no such program`), table);
}

/** A page that draws its axis by convention is given the tilt its magnetic maps are fitted with. */
export const MAGNETIC_ROUTE: MapRoute<ReducedMap> = { kind: MAGNETIC_MAPS, specKey: 'magneticMaps', name: 'magnetic maps', reduced, sourceRecords: mapSourceRecords, tiltedRotation };
export const runMagneticMaps = (specPath: string, context: Context) => runSurfaceMaps(MAGNETIC_ROUTE, specPath, context);

/** Whether a reduced run is a star's: a program that names its star belongs to that star alone (two stars a few arcseconds
 * apart each have their own runs); any other belongs to the star at its place. */
export const isRunOf = (run: { readonly object?: string; readonly ra: number; readonly dec: number }, host: string, raDegrees: number, decDegrees: number) =>
  run.object ? run.object === host : Math.hypot((run.ra - raDegrees) * Math.cos(decDegrees * Math.PI / 180), run.dec - decDegrees) < 0.02;

/** `--from-spectra HOST...`: one entry a star, with every reduced program whose target lies at the star's place, oldest
 * first; a map's label is the month and year of the middle of its run. */
export async function draftsFromReducedPrograms(names: readonly string[], context: Context): Promise<{ readonly stars: readonly unknown[]; readonly magneticMaps: readonly unknown[]; readonly report: readonly string[] }> {
  const magneticMaps: unknown[] = [], report: string[] = [], receipts: { program: string; object?: string; ra: number; dec: number; mjd: number; tilt: number; refused?: string }[] = [];
  for (const name of (await readdir(PROGRAMS)).filter(file => file.endsWith('.json')).sort()) { const receipt: unknown = await readFile(receiptPath(name.slice(0, -'.json'.length)), 'utf8').then(text => JSON.parse(text) as unknown, () => undefined);
    if (!isRecord(receipt) || receipt.schema !== MAP_SCHEMA || !isRecord(receipt.target) || !isRecord(receipt.map)) continue;
    // A program that names its star belongs to that star alone: two stars a few arcseconds apart each have their own runs.
    const program = await readJson(resolve(PROGRAMS, name), name), object = isRecord(program) && isRecord(program.target) && typeof program.target.object === 'string' ? program.target.object : undefined;
    receipts.push({ program: requireString(receipt.program, 'program'), ...(object ? { object } : {}), ra: requireFiniteNumber(receipt.target.raDegrees, 'raDegrees'), dec: requireFiniteNumber(receipt.target.decDegrees, 'decDegrees'), mjd: requireFiniteNumber(receipt.map.middleMjd, 'middleMjd'), tilt: requireFiniteNumber(requireRecord(requireRecord(receipt.map.star, 'map star').inclinationDegrees, 'inclination').value, 'inclination'),
      ...(isRecord(receipt.map.verdict) && receipt.map.verdict.mapped === true ? {} : { refused: isRecord(receipt.map.verdict) ? requireString(receipt.map.verdict.reason, 'verdict reason') : 'reduced before maps carried a verdict; reduce it again' }) }); }
  for (const host of names) {
    try { const { star } = await readStar(context.root, host), distance = Math.hypot(...star.originM), ra = (Math.atan2(star.originM[1], star.originM[0]) * 180 / Math.PI + 360) % 360, dec = Math.asin(star.originM[2] / distance) * 180 / Math.PI;
      const near = receipts.filter(receipt => isRunOf(receipt, host, ra, dec)).sort((a, b) => a.mjd - b.mjd), left: string[] = [];
      const convention = isConventionOnly(requireRecord(await readJson(resolve(context.root, star.rotationRecord), `${host}: no rotation record`), star.rotationRecord));
      const mapped = near.filter(receipt => { const why = !convention && Math.abs(receipt.tilt - star.inclinationDegrees) > TILT_TOLERANCE_DEGREES ? `mapped for a tilt of ${receipt.tilt}°, the page draws ${star.inclinationDegrees.toFixed(1)}°` : receipt.refused ?? '';
        if (why) left.push(`${receipt.program}: ${why}`); return !why; });
      if (left.length) report.push(`  ${host}, left out: ${left.join('; ')}`);
      if (!mapped.length) throw new Error(`${host}: no reduced program at its place has a map to draw.`);
      const maps = mapped.map(receipt => { const middle = new Date((receipt.mjd - 40587) * 86400000), month = MONTHS[middle.getUTCMonth()]!;
        return { program: receipt.program, id: `radial-field-${middle.getUTCFullYear()}-${String(middle.getUTCMonth() + 1).padStart(2, '0')}`, label: `${month} ${middle.getUTCFullYear()}` }; });
      magneticMaps.push({ host, maps }); report.push(`  ${host}: ${maps.map(map => `${map.label} (${map.program})`).join(', ')}`); }
    catch (error) { report.push(`  ${host}: not drafted: ${reason(error)}`); }
  }
  return { stars: [], magneticMaps, report };
}

export const bakeMagneticMaps = bakeSurfaceMaps;
export const formatMagneticMaps = (results: readonly MagneticMapResult[], spec: string, baked: boolean) => formatSurfaceMaps(MAGNETIC_ROUTE.name, results, spec, baked);
