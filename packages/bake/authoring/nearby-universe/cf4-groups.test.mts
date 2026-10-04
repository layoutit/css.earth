import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

test('CF4 regeneration updates existing group columns and is repeatable', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'cf4-groups-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const table = resolve(root, 'galaxies.gz'), groups = resolve(root, 'groups.gz'), distances = resolve(root, 'distances.gz');
  await writeFile(table, gzipSync('PGC,DM\n1,30\n2,31\n'));
  await writeFile(groups, gzipSync('      1       9\n      2       8\n'));
  await writeFile(distances, gzipSync('      9  32.00\n'));
  const run = () => execFileSync(process.execPath, [resolve(import.meta.dirname, 'cf4-groups.mts'), groups, distances, table], { encoding: 'utf8' });
  assert.equal(JSON.parse(run()).rows, 2);
  const first = gunzipSync(await readFile(table)).toString();
  assert.equal(first, 'PGC,DM,G1PGC,GDMzp\n1,30,9,32.00\n2,31,8,\n');
  run(); assert.equal(gunzipSync(await readFile(table)).toString(), first);
  await writeFile(distances, gzipSync('      9  33.00\n'));
  run(); assert.match(gunzipSync(await readFile(table)).toString(), /1,30,9,33.00/u);
  await writeFile(table, gzipSync('PGC,DM,G1PGC\n1,30,9\n'));
  assert.throws(run, /group columns must be the trailing/u);
  await writeFile(table, gzipSync('PGC,DM\n1\n'));
  assert.throws(run, /row width differs/u);
});
