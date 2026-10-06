/** The way any kind of surface map this repository reduces gets onto a star's page: read a spec, write each star's maps
 * as datasets, bake.
 *
 * A kind's route supplies what is its own: the kind (surface-maps.mts), how one chosen map's reduction is read, the
 * catalogue records its maps are bound to, and two choices. A route with `tiltedRotation` gives a page that draws its axis
 * by convention the tilt its maps are fitted with, and refuses a map fitted for another tilt than a page measures; a route
 * without it leaves the page's axis as it is. `starRecords` are other records of the star a map brings with it. The spec may
 * be run again: the records follow it. */
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { requireRecord } from '@cssearth/core';
import { readStar } from '../corona/corona.mts';
import { isConventionOnly, parseSurfaceMaps, surfaceMapFiles, type MapKind, type SurfaceMap, type SurfaceMapChoice, type SurfaceMapEntry } from './surface-maps.mts';

type Json = Record<string, unknown>;
export interface RouteContext { readonly root: string; readonly progress: (line: string) => void }
export interface SurfaceMapResult { readonly host: string; readonly maps: number; readonly files: number; /** The page's axis was a convention and now carries the maps' tilt. */ readonly tilted?: boolean; readonly report?: string; readonly failed?: string }
export interface SkyPlace { readonly rightAscensionDegrees: number; readonly declinationDegrees: number }
export interface MapRoute<M extends SurfaceMap> {
  readonly kind: MapKind<M>;
  /** The key of a spec that lists this kind's maps, and what the maps are called in a report. */ readonly specKey: string; readonly name: string;
  /** One chosen map's reduction, read and checked; it throws with the command that makes what is missing. */
  reduced(root: string, host: string, choice: SurfaceMapChoice): Promise<M>;
  /** The records of the source catalogue the kind's maps are bound to, written once and then kept. */
  sourceRecords(checkedOn: string): Map<string, string>;
  /** The rotation record of a page whose axis was a convention, with the tilt its maps are fitted with. */
  tiltedRotation?(previous: Json, place: SkyPlace, map: M): Json;
  /** Other records of the star that its maps bring with them, by path. */
  starRecords?(root: string, host: string, maps: readonly M[]): Promise<Map<string, string>>;
}

/** A map fitted for one tilt is not drawn on a star the page tilts otherwise: the two may differ by this many degrees. */
export const TILT_TOLERANCE_DEGREES = 5;
const reason = (error: unknown) => (error as Error).message.split('\n')[0]!;
export const readJson = async (path: string, what: string): Promise<unknown> => { try { return JSON.parse(await readFile(path, 'utf8')); } catch { throw new Error(`${what}: ${path} does not exist or is not JSON.`); } };

async function writeMaps<M extends SurfaceMap>(route: MapRoute<M>, entry: SurfaceMapEntry, { root }: RouteContext): Promise<SurfaceMapResult> {
  const { star, content, text, manifest, raster } = await readStar(root, entry.host), maps: M[] = [];
  for (const choice of entry.maps) maps.push(await route.reduced(root, entry.host, choice));
  // A page that draws the axis by convention alone is given the tilt its maps are fitted with; one that draws a measured
  // tilt keeps it, and its maps must have been fitted with it.
  const rotation = requireRecord(await readJson(resolve(root, star.rotationRecord), `${entry.host}: no rotation record`), star.rotationRecord), convention = isConventionOnly(rotation), tilts = convention && route.tiltedRotation !== undefined;
  if (route.tiltedRotation) { const tilt = convention ? maps[0]!.inclinationDegrees : star.inclinationDegrees;
    for (const map of maps) if (Math.abs(map.inclinationDegrees - tilt) > TILT_TOLERANCE_DEGREES) throw new Error(convention ? `${entry.host}: its maps are fitted with different tilts (${maps.map(one => `${one.choice.program} ${one.inclinationDegrees}°`).join(', ')}); a page draws one.`
      : `${map.choice.program} was mapped for a tilt of ${map.inclinationDegrees}°, and the page draws ${star.name} tilted ${star.inclinationDegrees.toFixed(1)}° (${star.rotationRecord}): reduce a program whose star block holds the page's tilt.`); }
  const distance = Math.hypot(...star.originM), place = { rightAscensionDegrees: (Math.atan2(star.originM[1], star.originM[0]) * 180 / Math.PI + 360) % 360, declinationDegrees: Math.asin(star.originM[2] / distance) * 180 / Math.PI };
  const descriptor = requireRecord(await readJson(resolve(root, `src/objects/${entry.host}/object.json`), `${entry.host}: no descriptor`), `${entry.host} descriptor`);
  const { files, report } = surfaceMapFiles(route.kind, entry, star, maps, { content, text, manifest, raster, descriptor });
  if (tilts) files.set(star.rotationRecord, `${JSON.stringify(route.tiltedRotation!(rotation, place, maps[0]!), null, 2)}\n`);
  // The catalogue records the maps are bound to are written once and then kept, with the day they were checked.
  for (const [path, value] of route.sourceRecords(new Date().toISOString().slice(0, 10))) if (!await stat(resolve(root, path)).then(() => true, () => false)) files.set(path, value);
  for (const [path, value] of await route.starRecords?.(root, entry.host, maps) ?? []) files.set(path, value);
  for (const [path, value] of files) { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), value); }
  return { host: entry.host, maps: maps.length, files: files.size, ...(tilts ? { tilted: true } : {}), report: tilts ? `${report}; the page's axis is now tilted ${maps[0]!.inclinationDegrees}° as the maps are` : report };
}

/** Every star of a spec file, written. One that fails is reported with its reason and the rest go on. */
export async function runSurfaceMaps<M extends SurfaceMap>(route: MapRoute<M>, specPath: string, context: RouteContext): Promise<SurfaceMapResult[]> {
  const entries = parseSurfaceMaps(JSON.parse(await readFile(resolve(specPath), 'utf8')), route.specKey, route.name.replace(/s$/u, '')), results: SurfaceMapResult[] = [];
  for (const entry of entries) {
    try { const result = await writeMaps(route, entry, context); results.push(result); context.progress(`  ${entry.host}: written; ${result.report}`); }
    catch (error) { results.push({ host: entry.host, maps: entry.maps.length, files: 0, failed: reason(error) }); context.progress(`  ${entry.host}: FAILED, not written: ${reason(error)}`); }
  }
  return results;
}

/** How many stars one bake command takes: a command line stays short, and a failure costs one group. */
export const BAKE_GROUP = 40;
/** Bake the stars whose maps were written: their source downloads restored, then each star's chain through its page text,
 * since a map is a new surface image.
 * A star whose default view is unchanged is then pinned: the steps between (markers, arrival billboard, world context,
 * systems, catalogues) show that view. A star whose axis was tilted has a new default view, so its stored arrival picture
 * is removed before the bake (the catalogue step refuses a picture of another view) and the rest of its chain is left to
 * run once the site is restarted: the running site holds the reader text it started with. */
export async function bakeSurfaceMaps(results: readonly SurfaceMapResult[], { root, progress }: RouteContext): Promise<boolean> {
  const hosts = [...new Set(results.map(result => result.host))], tilted = [...new Set(results.filter(result => result.tilted).map(result => result.host))], kept = hosts.filter(host => !tilted.includes(host));
  for (const host of tilted) await rm(resolve(root, 'src/objects', host, 'prepared/arrival-billboard.json'), { force: true });
  const groups = (ids: readonly string[]) => Array.from({ length: Math.ceil(ids.length / BAKE_GROUP) }, (_, i) => ids.slice(i * BAKE_GROUP, (i + 1) * BAKE_GROUP));
  // A star's bake reads every input its manifest declares: the downloads a checkout does not hold are restored first.
  for (const args of [...groups(hosts).map(group => ['packages/bake/cli/restore-source-inputs.mts', ...group.map(host => `--object=${host}`)]), ...groups(hosts).map(group => ['packages/bake/cli/prepare-object.mts', ...group, '--to', 'text']), ...groups(kept).map(group => ['packages/bake/cli/prepare-object.mts', ...group, '--from', 'pins'])]) {
    progress(`== ${args.join(' ')}`);
    const code = await new Promise<number | null>(done => { spawn('node', args, { cwd: root, stdio: ['ignore', 2, 2] }).on('error', () => done(null)).on('close', done); });
    if (code !== 0) { progress(`FAILED: node ${args.join(' ')}`); return false; }
  }
  if (tilted.length) progress(`The axis of ${tilted.join(', ')} changed. Restart the running site, then: node packages/bake/cli/prepare-object.mts ${tilted.join(' ')} --from billboard`);
  return true;
}

export const formatSurfaceMaps = (name: string, results: readonly SurfaceMapResult[], spec: string, baked: boolean) => `${results.map(result => result.failed ? `${result.host} (${name}): FAILED, not written: ${result.failed}`
  : `${result.host}: ${result.files} files. ${result.report}`).join('\n')}\n${baked ? `${results.filter(result => !result.failed).length} star(s) baked.` : `Then bake: telescope new-object ${spec} --bake`}\n`;

/** Every kind of map a spec may list, by the spec's key. */
export const MAP_ROUTES: Readonly<Record<string, { readonly name: string; readonly run: (spec: string, context: RouteContext) => Promise<SurfaceMapResult[]> }>> = {
  // Magnetic maps reduced from archived polarised spectra (magnetic/maps.mts).
  magneticMaps: { name: 'magnetic maps', run: async (spec, context) => runSurfaceMaps((await import('../magnetic/maps.mts')).MAGNETIC_ROUTE, spec, context) },
  // Brightness maps made from a star's light in the TESS full-frame images (brightness/brightness.mts).
  brightnessMaps: { name: 'brightness maps', run: async (spec, context) => runSurfaceMaps((await import('../brightness/brightness.mts')).BRIGHTNESS_ROUTE, spec, context) },
};
