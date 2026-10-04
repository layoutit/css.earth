import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { checkSourceRatchets, growthFindings, parseRatchet, RATCHET_PATH, sourceRatchetSignals } from './source-ratchets.mts';

test('new math, partitioning and cwd calls are ratcheted; comments and tests are excluded', () => {
  assert.deepEqual(sourceRatchetSignals('packages/objects/src/new.ts', 'Math.sqrt(3); values.sort((a,b)=>a-b)'), ['objects']);
  assert.deepEqual(sourceRatchetSignals('packages/bake/src/new.ts', 'resolve(process.cwd(), "src")'), ['cwd']);
  assert.deepEqual(sourceRatchetSignals('packages/objects/src/new.test.ts', 'Math.sqrt(3); process.cwd()'), []);
  assert.deepEqual(sourceRatchetSignals('packages/bake/src/new.ts', '// process.cwd()'), []);
  assert.equal(growthFindings({ 'new.ts': 'reason' }, {}).length, 1);
  assert.deepEqual(growthFindings({}, { 'old.ts': 'reason' }), []);
  assert.throws(() => parseRatchet({ 'new.ts': '' }), /requires a reason/u);
});
test('real-tree budget is current and new source mutations fail then clear', () => {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'packages', '.github/scripts/architecture/source-ratchets.json']).toString().trim().split('\n');
  assert.deepEqual(checkSourceRatchets(process.cwd(), files), []);
  const root = mkdtempSync(resolve(tmpdir(), 'source-ratchets-'));
  const write = (path: string, text: string) => { mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), text); };
  try {
    write(RATCHET_PATH, '{"objects":{},"cwd":{}}');
    const object = 'packages/objects/src/new.ts', command = 'packages/bake/src/new.ts';
    write(object, 'export const x = Math.sqrt(4);'); write(command, 'export const root = process.cwd();');
    assert.equal(checkSourceRatchets(root, [object, command]).length, 2, 'mutation red');
    rmSync(resolve(root, RATCHET_PATH));
    assert.match(checkSourceRatchets(root, [object, command])[0]!, /missing source ratchet budget/u, 'deleting the budget must not disable the rule');
    write(RATCHET_PATH, '{"objects":{},"cwd":{}}');
    assert.equal(checkSourceRatchets(root, [object, command]).length, 2, 'restoring the budget enforces the same allowances');
    write(object, 'export const x = 4;'); write(command, 'export const root = import.meta.dirname;');
    assert.deepEqual(checkSourceRatchets(root, [object, command]), [], 'mutation green');
    rmSync(resolve(root, RATCHET_PATH));
    assert.deepEqual(checkSourceRatchets(root, [object, command]), [], 'synthetic roots without signals need no budget');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
