/**
 * The stars that have a page and no map marker, each at its own prepared position, for the dots of the galaxy they are in.
 *
 * The map names a star only when it is featured, has imagery or hosts a body that does (prepare-spatial-context.ts); every
 * other star package is a plain dot. Such a star is one more star of its galaxy. A bank that draws a galaxy and merges its
 * star packages into its dots declares a `source/packaged-stars/points.json` (the Milky Way's volume does): this writes,
 * for each such bank, the plain stars inside the object it hosts (`properties.host`) in the object tree, as
 * `name,xKpc,yKpc,zKpc,color`, relative to the Sun (packages/bake/cli/prepare-packaged-points.mts, then each dot bank's
 * merge). The color is the star's dot color: its prepared color dimmed by its luminosity where its package cites a radius
 * and temperature. Every other plain star is a dot of the object it is inside, written by the world step.
 *
 * It reads the prepared world context, so it runs after `pnpm prepare:world-context`.
 *
 * Usage: node site/build/prepare/paged-star-dot-positions.mts
 */
import { readPackagedPointsFrame, OBJECT_TREE_ROOT, systemHostId, parsePreparedWorldContextPlan } from '@cssearth/objects';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { hasErrorCode, isRecord } from '@cssearth/core';
import { readObjectDescriptors } from '@cssearth/objects/node';

const KPC_M = 3.0856775814913673e19;
const objects = resolve(import.meta.dirname, '../../../src/objects');
const worldPath = resolve(objects, OBJECT_TREE_ROOT, 'prepared/world-context.json');
const world = parsePreparedWorldContextPlan(JSON.parse(await readFile(worldPath, 'utf8')));
const bodies = new Map(world.bodies.map(body => [body.id, body]));
/** The object a body is inside past any system: its own, or the one of the star it is bound to (each row's `inside`,
 * packages/objects/src/prepared-data/world/world-holders.ts `insideOf`). */
const holderOf = (id: string): string | undefined => {
  let at = bodies.get(id)?.inside;
  for (let host = at === undefined ? null : systemHostId(at); host !== null; host = at === undefined ? null : systemHostId(at)) at = bodies.get(host)?.inside;
  return at;
};
let banks = 0;
for (const [bankId, descriptor] of await readObjectDescriptors(objects)) {
  const recipePath = resolve(objects, bankId, 'source/packaged-stars/points.json');
  const recipe = await readFile(recipePath, 'utf8').then(text => readPackagedPointsFrame(JSON.parse(text)),
    (error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
  if (recipe === null) continue;
  const host = isRecord(descriptor) && isRecord(descriptor.properties) ? descriptor.properties.host : undefined;
  if (typeof host !== 'string') throw new TypeError(`src/objects/${bankId}/object.json: properties.host must name the object whose star packages are this bank's dots.`);
  if (recipe.frame?.referenceFrame !== world.frame.referenceFrame || recipe.frame.epochJdTt !== world.frame.epochJdTt) {
    throw new TypeError(`${recipePath} frames its table in ${String(recipe.frame?.referenceFrame)} at JD ${String(recipe.frame?.epochJdTt)}; the world context is in ${world.frame.referenceFrame} at JD ${world.frame.epochJdTt}.`);
  }
  // The same stars the world leaves to its dot banks (packages/objects/src/prepared-data/world/world-holders.ts `plainStar`).
  const rows: string[] = [];
  for (const body of [...world.bodies].sort((a, b) => a.id < b.id ? -1 : 1)) {
    if (body.classification !== 'star' || body.plainDot !== true || body.orbit || holderOf(body.id) !== host) continue;
    const color = body.dotColor ?? body.color;
    if (!/^#[0-9a-f]{6}$/u.test(color)) throw new TypeError(`${worldPath}: ${body.id} has color ${JSON.stringify(color)}, not #rrggbb.`);
    rows.push(`${body.id},${body.positionM.map((value, axis) => ((value - world.frame.originM[axis]!) / KPC_M).toFixed(4)).join(',')},${color}`);
  }
  const output = resolve(objects, bankId, 'source/packaged-stars/positions.csv.gz');
  await writeFile(output, gzipSync(`name,xKpc,yKpc,zKpc,color\n${rows.join('\n')}\n`, { level: 9 }));
  console.log(`Wrote ${rows.length} stars inside ${host} at JD ${world.frame.epochJdTt} TT to ${output}.`);
  banks++;
}
if (!banks) throw new TypeError('No bank declares source/packaged-stars/points.json: no galaxy merges its star packages into its dots.');
