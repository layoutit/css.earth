import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { OBJECTS } from '../objects.mjs';
import { auditGenericOrbitOwnership, inspectObjectOrbitModule } from '../../tools/generic-orbit-contract.mjs';

const root = resolve(import.meta.dirname, '../..');
test('every registered runtime delegates orbit ownership to one shared implementation', async () => {
  const report = await auditGenericOrbitOwnership({ root });
  assert.deepEqual(report.entries.map(({ id }) => id), OBJECTS.map(({ id }) => id));
});

for (const source of [
  'import { createPolyOrbitControls as hiddenControls } from "@layoutit/polycss"; hiddenControls(scene);',
  'import * as controls from "@layoutit/polycss"; controls.createPolyOrbitControls(scene);',
  'window.addEventListener("resize", refit);',
  'input.addEventListener("wheel", zoom);',
]) test(`rejects object-owned input wiring: ${source}`, () => {
  assert.throws(() => inspectObjectOrbitModule(source, 'src/planets/probe/runtime/client.mjs', root), /belongs to the shared controller/);
});

test('rejects a registered object that stops constructing the common controller', async () => {
  const target = resolve(root, `src/planets/${OBJECTS[0].id}/runtime/client.mjs`);
  await assert.rejects(auditGenericOrbitOwnership({ root, readText: async (path) => {
    const source = await readFile(path, 'utf8');
    return path === target ? source.replace(/createRetainedCubicSkyOrbit\(/g, 'replacementOrbit(') : source;
  } }), /exactly one shared orbit construction/);
});
