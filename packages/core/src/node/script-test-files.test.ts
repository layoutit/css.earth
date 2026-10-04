import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { scriptTestFiles, testLaneFiles } from './script-test-files.ts';

test('caller-supplied scripts collect quoted globs, deduplicate and pick up new tests', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'script-test-files-'));
  try {
    mkdirSync(resolve(root, 'checks'));
    const manifest = { scripts: { 'test:checks': 'node --test "checks/*.test.ts" "checks/*.test.ts"' } };
    writeFileSync(resolve(root, 'checks/first.test.ts'), '');
    assert.deepEqual(scriptTestFiles(root, manifest, ['test:checks']).get('test:checks'), ['checks/first.test.ts']);
    writeFileSync(resolve(root, 'checks/second.test.ts'), '');
    assert.equal(scriptTestFiles(root, manifest, ['test:checks']).get('test:checks')?.length, 2);
    for (const invalid of [null, {}, { scripts: null }]) assert.throws(() => scriptTestFiles(root, invalid, []), /no scripts/u);
    assert.throws(() => scriptTestFiles(root, { scripts: {} }, ['test:checks']), /no test:checks/u);
    assert.throws(() => scriptTestFiles(root, { scripts: { 'test:checks': 'node --test checks' } }, ['test:checks']), /no test globs/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('lane routing uses only the caller manifest and names', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'test-lanes-'));
  try {
    mkdirSync(resolve(root, 'checks'));
    writeFileSync(resolve(root, 'checks/first.test.ts'), '');
    const manifest = { scripts: { unit: 'node --test "checks/*.test.ts"', browser: 'node --test "absent/*.test.ts"' } };
    assert.deepEqual(testLaneFiles(root, manifest, ['unit', 'browser']), { packages: ['checks/first.test.ts'], site: [] });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
