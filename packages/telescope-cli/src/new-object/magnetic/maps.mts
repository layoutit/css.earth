/** `telescope new-object` for magnetic maps this repository reduced from archived spectra: draft a spec from the reduced
 * programs of a star, write each map as a dataset of the star's page, and bake the star (map-datasets.mts holds the
 * records; `archives/espadons/` reduces a program). The spec may be run again: the records follow it. */
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { isRecord, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { MAP_SCHEMA, PROGRAMS, receiptPath } from '../../archives/espadons/program.mts';
import { readStar } from '../corona/corona.mts';
import { isConventionOnly, magneticMapFiles, mapSourceRecords, parseMagneticMaps, reducedMap, tiltedRotation, type MagneticMapEntry, type ReducedMap } from './map-datasets.mts';

interface Context { readonly root: string; readonly progress: (line: string) => void }
export interface MagneticMapResult { readonly host: string; readonly maps: number; readonly files: number; /** The page's axis was a convention and now carries the maps' tilt. */ readonly tilted?: boolean; readonly report?: string; readonly failed?: string }
/** A map fitted for one tilt is not drawn on a star the page tilts otherwise: the two may differ by this many degrees. */
export const TILT_TOLERANCE_DEGREES = 5;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const reason = (error: unknown) => (error as Error).message.split('\n')[0]!;
const readJson = async (path: string, what: string): Promise<unknown> => { try { return JSON.parse(await readFile(path, 'utf8')); } catch { throw new Error(`${what}: ${path} does not exist or is not JSON.`); } };
const reduce = (program: string) => `node packages/telescope-cli/src/archives/espadons/reduce.mts ${program}`;

async function reduced(root: string, choice: MagneticMapEntry['maps'][number]): Promise<ReducedMap> {
  const receipt = requireRecord(await readJson(receiptPath(choice.program), `${choice.program} is not reduced (${reduce(choice.program)})`), `${choice.program} receipt`);
  if (receipt.schema !== MAP_SCHEMA) throw new Error(`${choice.program}: its receipt is of an earlier reduction; reduce it again (${reduce(choice.program)}).`);
  const table = await readFile(resolve(root, 'output/espadons', choice.program, `${choice.program}.dat`), 'utf8').catch(() => { throw new Error(`${choice.program}: its map table is not in output/espadons (${reduce(choice.program)}).`); });
  return reducedMap(choice, receipt, await readJson(resolve(PROGRAMS, `${choice.program}.json`), `${choice.program}: no such program`), table);
}

async function writeMaps(entry: MagneticMapEntry, { root }: Context): Promise<MagneticMapResult> {
  const { star, content, text, manifest, raster } = await readStar(root, entry.host), maps: ReducedMap[] = [];
  for (const choice of entry.maps) maps.push(await reduced(root, choice));
  // A page that draws the axis by convention alone is given the tilt its maps are fitted with; one that draws a measured
  // tilt keeps it, and its maps must have been fitted with it.
  const rotationPath = resolve(root, star.rotationRecord), rotation = requireRecord(await readJson(rotationPath, `${entry.host}: no rotation record`), star.rotationRecord), convention = isConventionOnly(rotation), tilt = convention ? maps[0]!.inclinationDegrees : star.inclinationDegrees;
  for (const map of maps) if (Math.abs(map.inclinationDegrees - tilt) > TILT_TOLERANCE_DEGREES) throw new Error(convention ? `${entry.host}: its maps are fitted with different tilts (${maps.map(one => `${one.choice.program} ${one.inclinationDegrees}°`).join(', ')}); a page draws one.`
    : `${map.choice.program} was mapped for a tilt of ${map.inclinationDegrees}°, and the page draws ${star.name} tilted ${star.inclinationDegrees.toFixed(1)}° (${star.rotationRecord}): reduce a program whose star block holds the page's tilt.`);
  const distance = Math.hypot(...star.originM), place = { rightAscensionDegrees: (Math.atan2(star.originM[1], star.originM[0]) * 180 / Math.PI + 360) % 360, declinationDegrees: Math.asin(star.originM[2] / distance) * 180 / Math.PI };
  const descriptor = requireRecord(await readJson(resolve(root, `src/objects/${entry.host}/object.json`), `${entry.host}: no descriptor`), `${entry.host} descriptor`);
  const { files, report } = magneticMapFiles(entry, star, maps, { content, text, manifest, raster, descriptor });
  if (convention) files.set(star.rotationRecord, `${JSON.stringify(tiltedRotation(rotation, place, maps[0]!), null, 2)}\n`);
  // The two catalogue records the maps are bound to are written once and then kept, with the day they were checked.
  for (const [path, value] of mapSourceRecords(new Date().toISOString().slice(0, 10))) if (!await stat(resolve(root, path)).then(() => true, () => false)) files.set(path, value);
  for (const [path, value] of files) { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), value); }
  return { host: entry.host, maps: maps.length, files: files.size, ...(convention ? { tilted: true } : {}), report: convention ? `${report}; the page's axis is now tilted ${maps[0]!.inclinationDegrees}° as the maps are` : report };
}

/** Every star of a spec file, written. One that fails is reported with its reason and the rest go on. */
export async function runMagneticMaps(specPath: string, context: Context): Promise<MagneticMapResult[]> {
  const entries = parseMagneticMaps(JSON.parse(await readFile(resolve(specPath), 'utf8'))), results: MagneticMapResult[] = [];
  for (const entry of entries) {
    try { const result = await writeMaps(entry, context); results.push(result); context.progress(`  ${entry.host}: written; ${result.report}`); }
    catch (error) { results.push({ host: entry.host, maps: entry.maps.length, files: 0, failed: reason(error) }); context.progress(`  ${entry.host}: FAILED, not written: ${reason(error)}`); }
  }
  return results;
}

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

/** Bake the stars whose maps were written: each star's chain through its page text, since a map is a new surface image.
 * A star whose default view is unchanged is then pinned: the steps between (markers, arrival billboard, world context,
 * systems, catalogues) show that view. A star whose axis was tilted has a new default view, so its stored arrival picture
 * is removed before the bake (the catalogue step refuses a picture of another view) and the rest of its chain is left to
 * run once the site is restarted: the running site holds the reader text it started with. */
export async function bakeMagneticMaps(results: readonly MagneticMapResult[], { root, progress }: Context): Promise<boolean> {
  const hosts = [...new Set(results.map(result => result.host))], tilted = [...new Set(results.filter(result => result.tilted).map(result => result.host))], kept = hosts.filter(host => !tilted.includes(host));
  for (const host of tilted) await rm(resolve(root, 'src/objects', host, 'prepared/arrival-billboard.json'), { force: true });
  for (const args of [['packages/bake/cli/prepare-object.mts', ...hosts, '--to', 'text'], ...(kept.length ? [['packages/bake/cli/prepare-object.mts', ...kept, '--from', 'pins']] : [])]) {
    progress(`== ${args.join(' ')}`);
    const code = await new Promise<number | null>(done => { spawn('node', args, { cwd: root, stdio: ['ignore', 2, 2] }).on('error', () => done(null)).on('close', done); });
    if (code !== 0) { progress(`FAILED: node ${args.join(' ')}`); return false; }
  }
  if (tilted.length) progress(`The axis of ${tilted.join(', ')} changed. Restart the running site, then: node packages/bake/cli/prepare-object.mts ${tilted.join(' ')} --from billboard`);
  return true;
}

export const formatMagneticMaps = (results: readonly MagneticMapResult[], spec: string, baked: boolean) => `${results.map(result => result.failed ? `${result.host} (magnetic maps): FAILED, not written: ${result.failed}`
  : `${result.host}: ${result.files} files. ${result.report}`).join('\n')}\n${baked ? `${results.filter(result => !result.failed).length} star(s) baked.` : `Then bake: telescope new-object ${spec} --bake`}\n`;
