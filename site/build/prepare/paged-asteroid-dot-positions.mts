/**
 * The asteroids that have a page and no map marker, each at its own prepared position.
 *
 * Only an asteroid that is a JPL mission target keeps a marker on the map (jpl-mission-targets.mts). Every other asteroid
 * package still has its place in the world, prepared from JPL Horizons (`properties.worldFrame.originM` of its
 * descriptor): this writes those places as `name,xKm,yKm,zKm`, relative to the Sun, for the `paged-asteroid-dots` bank.
 *
 * Usage: node site/build/prepare/paged-asteroid-dot-positions.mts
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { isJplMissionTarget } from './jpl-mission-targets.mts';

const objects = resolve(import.meta.dirname, '../../../src/objects');
const sun = JSON.parse(await readFile(resolve(objects, 'sun/object.json'), 'utf8')) as { properties: { worldFrame: { referenceFrame: string; epochJdTt: number; originM: number[] } } };
const { referenceFrame, epochJdTt, originM: sunM } = sun.properties.worldFrame;
const rows: string[] = [];
for (const id of (await readdir(objects)).sort()) {
  const path = resolve(objects, id, 'object.json'), text = await readFile(path, 'utf8').catch(() => null);
  if (!text?.includes('"asteroid"')) continue;
  const properties = (JSON.parse(text) as { properties?: { catalog?: { classification?: unknown; systemName?: unknown }; worldFrame?: { referenceFrame?: unknown; epochJdTt?: unknown; originM?: unknown } } }).properties;
  if (properties?.catalog?.classification !== 'asteroid' || properties.catalog.systemName !== 'Solar System' || isJplMissionTarget({ id })) continue;
  const frame = properties.worldFrame, originM = frame?.originM;
  if (frame?.referenceFrame !== referenceFrame || frame.epochJdTt !== epochJdTt || !Array.isArray(originM) || originM.length !== 3 || !originM.every(Number.isFinite)) {
    throw new TypeError(`${path} properties.worldFrame must place the asteroid in ${referenceFrame} at JD ${epochJdTt} TT, got ${JSON.stringify(frame)}.`);
  }
  rows.push(`${id},${(originM as number[]).map((value, axis) => ((value - sunM[axis]!) / 1000).toFixed(0)).join(',')}`);
}
const output = resolve(objects, 'paged-asteroid-dots/source/dots/positions.csv.gz');
await writeFile(output, gzipSync(`name,xKm,yKm,zKm\n${rows.join('\n')}\n`));
console.log(`Wrote ${rows.length} positions at JD ${epochJdTt} TT to ${output}.`);
