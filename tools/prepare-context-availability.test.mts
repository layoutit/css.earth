import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { inspectContextAvailability, prepareContextAvailability } from './prepare-context-availability.mts';
import { parseContextAvailability } from '../src/platform/context-availability.mts';
import { writeContextPackage } from '../tests/fixtures/context-package.mts';

test('a missing bank isolates one object; restoring it admits the complete package on the next startup', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-availability-')); t.after(() => rm(root, { recursive: true, force: true }));
  const helix = await writeContextPackage(root, 'helix'); await writeContextPackage(root, 'lmc');
  const file = resolve(helix.directory, 'prepared/lenses.json'), bytes = await readFile(file);
  await rm(file);
  const { availability } = await prepareContextAvailability({ projectRoot: root });
  assert.equal(availability.helix.available, false); assert.equal(availability.lmc.available, true);
  assert.deepEqual(parseContextAvailability(availability), availability);
  await assert.rejects(prepareContextAvailability({ projectRoot: root, strict: true }), /helix: Missing .*helix\/prepared\/lenses.json/);
  await writeFile(file, bytes);
  assert.deepEqual((await prepareContextAvailability({ projectRoot: root, strict: true })).availability, { helix: { available: true }, lmc: { available: true } });
});

for (const path of ['prepared/slice.webp', 'prepared/presentation.json', 'prepared/provenance.json', '../../../public/scenes/helix/preview.webp']) {
  test(`partial package is unavailable when ${path} is missing`, async t => {
    const root = await mkdtemp(resolve(tmpdir(), 'cssearth-availability-')); t.after(() => rm(root, { recursive: true, force: true }));
    const f = await writeContextPackage(root, 'helix'); await writeContextPackage(root, 'lmc');
    await rm(resolve(f.directory, path));
    const state = await inspectContextAvailability(root);
    assert.equal(state.helix.available, false); assert.equal(state.lmc.available, true);
    await assert.rejects(prepareContextAvailability({ projectRoot: root, strict: true }), /helix: Missing/);
  });
}

for (const path of ['prepared/lenses.json', 'prepared/slice.webp', '../../../public/scenes/helix/preview.webp']) {
  test(`changed ${path} fails its existing identity check without disabling another package`, async t => {
    const root = await mkdtemp(resolve(tmpdir(), 'cssearth-availability-')); t.after(() => rm(root, { recursive: true, force: true }));
    const f = await writeContextPackage(root, 'helix'); await writeContextPackage(root, 'lmc');
    await writeFile(resolve(f.directory, path), 'tampered');
    const state = await inspectContextAvailability(root);
    assert.equal(state.helix.available, false); assert.equal(state.lmc.available, true);
    await assert.rejects(prepareContextAvailability({ projectRoot: root, strict: true }), /identity mismatch/i);
  });
}

test('invalid presentation and provenance cannot become available merely because their files exist', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-availability-')); t.after(() => rm(root, { recursive: true, force: true }));
  const f = await writeContextPackage(root, 'helix');
  await writeFile(resolve(f.directory, 'prepared/presentation.json'), JSON.stringify({ ...f.presentation, objectId: 'different' }));
  assert.equal((await inspectContextAvailability(root)).helix.available, false);
  await writeContextPackage(root, 'helix');
  await writeFile(resolve(f.directory, 'prepared/provenance.json'), JSON.stringify({ ...f.provenance, objectId: 'different' }));
  assert.equal((await inspectContextAvailability(root)).helix.available, false);
  assert.throws(() => parseContextAvailability({ helix: { available: 'true' } }));
  assert.throws(() => parseContextAvailability({ helix: { available: false } }));
});
