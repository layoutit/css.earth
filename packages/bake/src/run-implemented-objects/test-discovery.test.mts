import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { discoverObjectTests } from '@cssearth/bake/run-implemented-objects/source';

test('root lane globs discover newly added body and shared suites without editing the runner', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'object-test-routing-'));
  const write = (path: string, text: string) => { mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), text); };
  try {
    write('package.json', JSON.stringify({ scripts: { 'test:packages': 'node --test "packages/**/*.test.{ts,mts}"', 'test:site': 'node --test "site/**/*.test.mts" "src/**/*.test.mts"' } }));
    const shared = 'site/test/new-shared.test.mts', own = 'src/objects/earth/new-own.test.mts';
    write(shared, '// CSSEARTH_TEST_OBJECTS: selected shared suite');
    write(own, 'export {};');
    write('src/objects/mars/not-earth.test.mts', 'export {};');
    write('site/test/not-object.test.mts', 'export {};');
    assert.deepEqual(await discoverObjectTests('earth', { projectRoot: root }), [shared, own].map(file => resolve(root, file)).sort());
    write('packages/bake/src/raster/new-shared.test.ts', '// CSSEARTH_TEST_OBJECTS: shared invariant');
    assert.equal((await discoverObjectTests('earth', { projectRoot: root })).length, 3);
    await assert.rejects(discoverObjectTests('earth', { projectRoot: root + '/missing' }), /ENOENT/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
