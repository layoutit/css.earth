import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('world places keep root-first file order, optional rows and sorted unique category holders, with no file for a row', t => {
  const directory = mkdtempSync(join(tmpdir(), 'cssearth-world-places-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const [id, value] of [['root', { anywhere: true, places: true }], ['earth', { anywhere: false }], ['holder', { places: true }]] as const) {
    const prepared = join(directory, 'src', 'objects', id, 'prepared');
    mkdirSync(prepared, { recursive: true });
    writeFileSync(join(prepared, 'members.json'), JSON.stringify(value));
  }
  // This Node-only reader has no injected root. Run with a real temporary cwd;
  // the fixture mirrors its public prepared-file contract without mocking cwd.
  const script = join(directory, 'places.mts');
  writeFileSync(script, `import assert from 'node:assert/strict';
import { mock } from 'node:test';
const fileOf = new Map([['moon', 'earth'], ['plain', 'plain'], ['remote', 'holder'], ['root-body', 'root']]);
mock.module(${JSON.stringify(new URL('../directory/world-context-plan.mts', import.meta.url).href)}, { namedExports: {
  APPLICATION_WORLD_INDEX: { files: ['root', 'earth', 'holder'], rows: { plain: { id: 'plain' } } }, APPLICATION_WORLD_FILE_OF: fileOf,
} });
mock.module(${JSON.stringify(new URL('../directory/objects.mts', import.meta.url).href)}, { namedExports: { OBJECTS: [
  { id: 'root' }, { id: 'earth', parent: 'root' }, { id: 'moon', parent: 'earth' }, { id: 'remote', parent: 'root' },
] } });

const { worldFiles, worldPlaceFiles, worldAnywhereFiles, worldPlaceOf, worldStartupFiles, worldFilesOf } = await import(${JSON.stringify(new URL('./world-places.mts', import.meta.url).href)});
  assert.deepEqual(worldFiles(), ['root', 'earth', 'holder']);
  assert.deepEqual(worldPlaceFiles(), ['root', 'holder']);
  assert.deepEqual(worldAnywhereFiles(), ['root']);
  assert.deepEqual(worldPlaceOf('moon'), { files: ['root', 'earth'] });
  assert.deepEqual(worldPlaceOf('plain'), { files: [], row: { id: 'plain' } });
  assert.deepEqual(worldPlaceOf('remote'), { files: ['root', 'holder'] });
  assert.equal(worldPlaceOf('unknown'), null);
  assert.deepEqual(worldStartupFiles('moon'), ['earth']);
  assert.deepEqual(worldFilesOf(['remote', 'moon', 'remote', 'unknown', 'root-body']), ['earth', 'holder']);
  // A plain-dot star that is its own holder of one row publishes no members.json: it names no file and reads none.
  assert.deepEqual(worldFilesOf(['plain', 'moon']), ['earth']);
  assert.deepEqual(worldFilesOf([]), []);
  assert.deepEqual(worldPlaceFiles(), ['root', 'holder']);

console.log('WORLD_PLACES_OK');
`);
  const result = spawnSync(process.execPath, ['--experimental-test-module-mocks', script], {
    cwd: directory, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'WORLD_PLACES_OK');
});
