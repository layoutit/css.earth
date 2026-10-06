import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { projectRoot } from '@cssearth/core/node';

const root = projectRoot(import.meta.url), run = (...args: string[]) => promisify(execFile)(process.execPath, [resolve(import.meta.dirname, 'index.mts'), ...args], { cwd: root });

test('the command reads a tracked body: its inventory against a revision, and its manifest', async t => {
  // A sparse checkout holds no body package; the lookups themselves are tested beside their modules.
  if (!existsSync(resolve(root, 'src/objects/moon/inventory.json'))) return t.skip('src/objects/moon is not in this checkout');
  assert.match((await run('inventory', 'moon', '--search=runtime.json', '--location=prepared')).stdout, /^moon: 1 of \d+ files \(prepared, matching "runtime\.json"\), [\d,]+ bytes\nprepared +[\d,]+ {2}runtime\.json\n$/u);
  const listed = JSON.parse((await run('inventory', 'moon', '--search=runtime.json', '--json')).stdout) as { files: { url: string }[] }[];
  assert.match(listed[0].files[0].url, /^https:\/\/[^/]+\/runtime-assets\/[0-9a-f]+\/runtime\.json$/u);
  assert.match((await run('manifest', 'moon', '--kind=generated')).stdout, /^moon: \d+ of \d+ entries \(generated\): generated \d+\ngenerated {2}/u);
  await assert.rejects(run('inventory', 'moon', '--since=no-such-revision'), /Not a git revision: no-such-revision/u);
  await assert.rejects(run('inventory', 'no-such-body'), /No object package src\/objects\/no-such-body/u);
  await assert.rejects(run('files', 'moon'), /Usage: pnpm lookup <inventory\|manifest>/u);
});

test('an inventory compared with the commit it is checked out at has no differences', async t => {
  if (!existsSync(resolve(root, 'src/objects/moon/inventory.json'))) return t.skip('src/objects/moon is not in this checkout');
  // A working tree that edits the Moon's inventory is the one case that differs from HEAD, so the comparison is asked of the tracked state only.
  const { stdout: dirty } = await promisify(execFile)('git', ['status', '--porcelain', '--', 'src/objects/moon/inventory.json'], { cwd: root });
  if (dirty.trim()) return t.skip('the Moon inventory is modified in this working tree');
  assert.match((await run('inventory', 'moon', '--since=HEAD')).stdout, /^moon since HEAD: 0 added \(0 bytes\), 0 removed \(0 bytes\), 0 changed \(0 bytes\), \d+ unchanged\n$/u);
});
