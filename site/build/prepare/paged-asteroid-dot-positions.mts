import { parseObjectDescriptor, parsePreparedWorldCameraFrame } from '@cssearth/objects';
/**
 * The asteroids that have a page and no map marker, each at its own prepared position.
 *
 * Only an asteroid that is a JPL mission target keeps a marker on the map (jpl-mission-targets.mts). Every other asteroid
 * package still has its place in the world, prepared from JPL Horizons (`properties.worldFrame.originM` of its
 * descriptor): this writes those places as `name,xKm,yKm,zKm`, relative to the Sun, for the Sun's asteroid dot bank to join
 * (packages/bake/authoring/small-body-dots/positions.mts `pagesTable`).
 *
 * Usage: node site/build/prepare/paged-asteroid-dot-positions.mts
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { isJplMissionTarget } from './jpl-mission-targets.mts';
import { plainDotBank } from './plain-dot-bank.mts';

const objects = resolve(import.meta.dirname, '../../../src/objects');
const sun = parseObjectDescriptor(JSON.parse(await readFile(resolve(objects, 'sun/object.json'), 'utf8')));
const frameOfSun = parsePreparedWorldCameraFrame(sun.properties.worldFrame);
if (!frameOfSun) throw new TypeError('The Sun needs its prepared world frame.');
const { referenceFrame, epochJdTt, originM: sunM } = frameOfSun;

const rows: string[] = [];
for (const id of (await readdir(objects)).sort()) {
  const path = resolve(objects, id, 'object.json'), text = await readFile(path, 'utf8').catch(() => null);
  if (!text?.includes('"asteroid"')) continue;
  const properties = (parseObjectDescriptor(JSON.parse(text)) as { properties?: { catalog?: { classification?: unknown; systemName?: unknown }; worldFrame?: { referenceFrame?: unknown; epochJdTt?: unknown; originM?: unknown } } }).properties;
  if (properties?.catalog?.classification !== 'asteroid' || properties.catalog.systemName !== 'Solar System' || isJplMissionTarget({ id })) continue;
  const frame = properties.worldFrame, originM = frame?.originM;
  if (frame?.referenceFrame !== referenceFrame || frame.epochJdTt !== epochJdTt || !Array.isArray(originM) || originM.length !== 3 || !originM.every(Number.isFinite)) {
    throw new TypeError(`${path} properties.worldFrame must place the asteroid in ${referenceFrame} at JD ${epochJdTt} TT, got ${JSON.stringify(frame)}.`);
  }
  rows.push(`${id},${(originM as number[]).map((value, axis) => ((value - sunM[axis]!) / 1000).toFixed(0)).join(',')}`);
}
// The bank the Sun hosts that declares its plain-dot asteroids (`properties.plainDots`).
const bank = await plainDotBank(objects, 'sun', 'asteroid');
if (bank === undefined) throw new TypeError('No catalogue point bank hosted by sun declares properties.plainDots asteroid: the paged asteroids have no bank to be dots of.');
const output = resolve(objects, bank, 'source/dots/paged-positions.csv.gz');
await writeFile(output, gzipSync(`name,xKm,yKm,zKm\n${rows.join('\n')}\n`));
console.log(`Wrote ${rows.length} positions at JD ${epochJdTt} TT to ${output}.`);
