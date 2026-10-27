/** Reproduce the adopted table only; the historical world-frame installation remains separately recorded. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

const directory = resolve('src/objects/m45-named-stars');
const placement = requireRecord(JSON.parse(await readFile(resolve(directory, 'source/plane-placement.json'), 'utf8')));
const [ra, dec] = requireArray(placement.referenceDirectionIcrsDegrees).map(v => requireFiniteNumber(v));
assert.equal(requireArray(placement.referenceDirectionIcrsDegrees).length, 2);
const starDepth = requireFiniteNumber(placement.starNormalDepthPc);
const direction = (r: number, d: number) => [Math.cos(d * Math.PI / 180) * Math.cos(r * Math.PI / 180),
  Math.cos(d * Math.PI / 180) * Math.sin(r * Math.PI / 180), Math.sin(d * Math.PI / 180)];
const normal = direction(ra!, dec!);
const original = await readFile(resolve(directory, requireString(placement.originalTable)), 'utf8');
const lines = original.trim().split(/\r?\n/u), header = lines[0]!;
assert.equal(header, 'HIP,RArad,DErad,distpc,Hpmag,B-V');
const rows = lines.slice(1).map(line => {
  const columns = line.split(','), values = columns.map(Number);
  assert.equal(values.length, 6); assert.ok(values.every(Number.isFinite));
  // This preserved table's RA/Dec values are degrees despite its historical header names.
  const ray = direction(values[1]!, values[2]!), cosine = ray.reduce((sum, value, i) => sum + value * normal[i]!, 0);
  assert.ok(cosine > 0);
  return columns.map((value, i) => i === 3 ? (starDepth / cosine).toFixed(12) : value).join(',');
});
assert.equal(rows.length, 9);
const result = [header, ...rows].join('\n') + '\n', target = resolve(directory, requireString(placement.modeledTable));
if (process.argv.includes('--check')) assert.equal(await readFile(target, 'utf8'), result);
else await writeFile(target, result);
console.log('PLEIADES_NAMED_TABLE_VERIFIED', JSON.stringify({ rows: rows.length, check: process.argv.includes('--check') }));
