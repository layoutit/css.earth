import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

const repository = resolve(import.meta.dirname, '../../..');
const objects = resolve(repository, 'tools/objects');

async function modules(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? modules(resolve(directory, entry.name))
    : entry.name.endsWith('.mts') ? [resolve(directory, entry.name)] : []));
  return nested.flat();
}

test('the ownership record matches the pinned packages and retained boundaries', async () => {
  const ownership = JSON.parse(await readFile(resolve(import.meta.dirname, 'ownership.json'), 'utf8')) as {
    schema: string; owners: { package: string; version: string }[]; retained: { mechanic: string; implementation: string; reason: string }[] };
  const toolchain = JSON.parse(await readFile(resolve(import.meta.dirname, 'toolchain.json'), 'utf8')) as Record<string, string>;
  const pdsToolchain = JSON.parse(await readFile(resolve(import.meta.dirname, 'pds-toolchain.json'), 'utf8')) as Record<string, string>;
  assert.equal(ownership.schema, 'cssearth-astronomy-package-ownership@1');
  for (const name of ['astroquery', 'pyvo']) assert.ok(ownership.owners.some(owner => owner.package === name && owner.version === toolchain[name]));
  for (const name of ['batman-package', 'scipy']) {
    const key = name === 'batman-package' ? 'batman' : name;
    assert.ok(ownership.owners.some(owner => owner.package === name && owner.version === toolchain[key]));
  }
  for (const name of ['pds.peppi', 'pdr']) assert.ok(ownership.owners.some(owner => owner.package === name && owner.version === pdsToolchain[name === 'pds.peppi' ? 'peppi' : name]));
  for (const mechanic of ['PDS layouts not supported by pdr', 'SPICE kernel evaluation', 'streaming FITS and in-process WCS reads'])
    assert.ok(ownership.retained.some(entry => entry.mechanic === mechanic && entry.implementation && entry.reason));
});

test('generic TAP is implemented only by the PyVO boundary', async () => {
  const offenders: string[] = [];
  for (const path of await modules(objects)) {
    if (path.startsWith(import.meta.dirname)) continue;
    const text = await readFile(path, 'utf8');
    if (/REQUEST=doQuery|FORMAT=(?:csv|json|text\/csv)/u.test(text)) offenders.push(relative(repository, path));
  }
  assert.deepEqual(offenders, []);
});

test('the only retained direct Horizons route is the whole SPHERE pinned-table implementation', async () => {
  const owners: string[] = [];
  for (const path of await modules(objects)) {
    if (path.endsWith('.test.mts') || path.startsWith(import.meta.dirname)) continue;
    const text = await readFile(path, 'utf8');
    if (text.includes('ssd.jpl.nasa.gov/api/horizons.api')) owners.push(relative(repository, path));
  }
  assert.deepEqual(owners, ['tools/objects/sphere-horizons.mts']);
});

test('archive packages cross only their explicit process boundaries', async () => {
  const imports: string[] = [];
  for (const path of await modules(objects)) {
    if (path.startsWith(import.meta.dirname)) continue;
    const text = await readFile(path, 'utf8');
    if (/\b(?:import|from) (?:astroquery|pyvo|pdr|pds\.peppi)\b/u.test(text)) imports.push(relative(repository, path));
  }
  assert.deepEqual(imports, []);
});
