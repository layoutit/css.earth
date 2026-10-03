/**
 * The stars that have a page and no map marker, each at its own prepared position, for the Milky Way's dots.
 *
 * The map names a star only when it is featured, has imagery or hosts a body that does (prepare-spatial-context.ts); every
 * other star package is a plain dot. Such a star is one more star of the galaxy: this writes each one within the
 * galaxy's reach as `name,xKpc,yKpc,zKpc,color`, relative to the Sun, for the `milky-way-volume` dots to join
 * (packages/bake/cli/prepare-packaged-points.mts, then each dot bank's merge). The color is the star's dot color: its
 * prepared color dimmed by its luminosity where its package cites a radius and temperature.
 *
 * It reads the prepared world context, so it runs after `pnpm prepare:world-context`.
 *
 * Usage: node site/build/prepare/paged-star-dot-positions.mts
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const KPC_M = 3.0856775814913673e19;
/** The galaxy's reach from its centre: its disc and halo. The nearest star packages beyond it are the Magellanic Clouds'
 * Cepheids, 35 kpc from the Sun and more than 40 from the centre; presentation choice, 2026-10-02. */
const REACH_KPC = 30;
const objects = resolve(import.meta.dirname, '../../../src/objects');
const worldPath = resolve(objects, 'sun/prepared/world-context.json');
const world = JSON.parse(await readFile(worldPath, 'utf8')) as { frame: { referenceFrame: string; epochJdTt: number; originM: number[] };
  bodies: { id: string; classification?: string; plainDot?: boolean; orbit?: unknown; boundTo?: { hostId: string }; positionM: number[]; color: string; dotColor?: string }[] };
const volume = JSON.parse(await readFile(resolve(objects, 'milky-way-volume/prepared/volume.json'), 'utf8')) as { data: { frame: { referenceFrame: string; epochJdTt: number; originM: number[] } } };
const centre = volume.data.frame;
if (centre.referenceFrame !== world.frame.referenceFrame || centre.epochJdTt !== world.frame.epochJdTt) {
  throw new TypeError(`src/objects/milky-way-volume/prepared/volume.json frames the galaxy in ${centre.referenceFrame} at JD ${centre.epochJdTt}; the world context is in ${world.frame.referenceFrame} at JD ${world.frame.epochJdTt}.`);
}
// The same stars the world summary leaves to its dot banks (packages/bake/src/world-context/summary.ts `plainStar`).
const bound = new Set(world.bodies.flatMap(body => body.boundTo ? [body.boundTo.hostId] : []));
const rows: string[] = [];
let beyond = 0;
for (const body of [...world.bodies].sort((a, b) => a.id < b.id ? -1 : 1)) {
  if (body.classification !== 'star' || body.plainDot !== true || body.orbit || body.boundTo || bound.has(body.id)) continue;
  if (Math.hypot(...body.positionM.map((value, axis) => value - centre.originM[axis]!)) / KPC_M > REACH_KPC) { beyond++; continue; }
  const color = body.dotColor ?? body.color;
  if (!/^#[0-9a-f]{6}$/u.test(color)) throw new TypeError(`${worldPath}: ${body.id} has color ${JSON.stringify(color)}, not #rrggbb.`);
  rows.push(`${body.id},${body.positionM.map((value, axis) => ((value - world.frame.originM[axis]!) / KPC_M).toFixed(4)).join(',')},${color}`);
}
const output = resolve(objects, 'milky-way-volume/source/packaged-stars/positions.csv.gz');
await writeFile(output, gzipSync(`name,xKpc,yKpc,zKpc,color\n${rows.join('\n')}\n`, { level: 9 }));
console.log(`Wrote ${rows.length} stars within ${REACH_KPC} kpc of the galaxy's centre at JD ${world.frame.epochJdTt} TT to ${output}; ${beyond} lie beyond it.`);
