import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { projectRoot } from '@cssearth/core/node';

const root = projectRoot(import.meta.url), run = (...args: string[]) => promisify(execFile)(process.execPath, [resolve(import.meta.dirname, 'index.mts'), ...args], { cwd: root });

test('the command reads a tracked body: its inventory against a revision, its manifest, and a value in its records', async t => {
  // A sparse checkout holds no body package; the lookups themselves are tested beside their modules.
  if (!existsSync(resolve(root, 'src/objects/moon/inventory.json'))) return t.skip('src/objects/moon is not in this checkout');
  assert.match((await run('inventory', 'moon', '--search=runtime.json', '--location=prepared')).stdout, /^moon: 1 of \d+ files \(prepared, matching "runtime\.json"\), [\d,]+ bytes\nprepared +[\d,]+ {2}runtime\.json\n$/u);
  const listed = JSON.parse((await run('inventory', 'moon', '--search=runtime.json', '--json')).stdout) as { files: { url: string }[] }[];
  assert.match(listed[0].files[0].url, /^https:\/\/[^/]+\/runtime-assets\/[0-9a-f]+\/runtime\.json$/u);
  assert.match((await run('manifest', 'moon', '--kind=generated')).stdout, /^moon: \d+ of \d+ entries \(generated\): generated \d+\ngenerated {2}/u);
  await assert.rejects(run('inventory', 'moon', '--since=no-such-revision'), /Not a git revision: no-such-revision/u);
  await assert.rejects(run('inventory', 'no-such-body'), /No object package src\/objects\/no-such-body/u);
  assert.match((await run('records', 'moon', '--search=bodyRadiusM', '--file=object.json')).stdout,
    /^moon: 1 of [\d,]+ entries \(in files named "object\.json", matching "bodyRadiusM"\) in 1 of \d+ JSON files\nobject\.json {2}\.properties\.worldFrame {2}bodyRadiusM: 1737400, /u);
  assert.match((await run('records', 'moon')).stdout, /^moon: [\d,]+ entries in \d+ JSON files\n(?:.*\n)* *\d+ {2}object\.json\n/u);
  // Every object at once: one list of rows, each led by its object id.
  assert.match((await run('records', '--every', '--file=object.json', '--search=bodyRadiusM: 1737400')).stdout,
    /^\d+ of [\d,]+ objects hold \d+ entries \(in files named "object\.json", matching "bodyRadiusM: 1737400"\); [\d,]+ JSON files read\n(?:.*\n)*moon {2}object\.json {2}\.properties\.worldFrame {2}bodyRadiusM: 1737400, /u);
  await assert.rejects(run('files', 'moon'), /Usage: pnpm lookup <inventory\|manifest\|records\|prepared>/u);
});

test('an inventory compared with the commit it is checked out at has no differences', async t => {
  if (!existsSync(resolve(root, 'src/objects/moon/inventory.json'))) return t.skip('src/objects/moon is not in this checkout');
  // A working tree that edits the Moon's inventory is the one case that differs from HEAD, so the comparison is asked of the tracked state only.
  const { stdout: dirty } = await promisify(execFile)('git', ['status', '--porcelain', '--', 'src/objects/moon/inventory.json'], { cwd: root });
  if (dirty.trim()) return t.skip('the Moon inventory is modified in this working tree');
  assert.match((await run('inventory', 'moon', '--since=HEAD')).stdout, /^moon since HEAD: 0 added \(0 bytes\), 0 removed \(0 bytes\), 0 changed \(0 bytes\), \d+ unchanged\n$/u);
});

test('the restored bake is read like the records, and an object without one says how to restore it', async t => {
  if (!existsSync(resolve(root, 'src/objects/moon/inventory.json'))) return t.skip('src/objects/moon is not in this checkout');
  const restored = existsSync(resolve(root, 'src/objects/moon/prepared/runtime.json')), { stdout } = await run('prepared', 'moon', '--file=runtime.json', '--search=minimumDiameter');
  if (restored) assert.match(stdout, /^moon: \d+ of [\d,]+ entries \(in files named "runtime\.json", matching "minimumDiameter"\) in 1 of \d+ JSON files\nprepared\/runtime\.json {2}\S+ {2}minimumDiameter: /u);
  else assert.match(stdout, /^moon: nothing is restored under prepared\/; pnpm setup:assets --object=moon restores it\n$/u);
});
