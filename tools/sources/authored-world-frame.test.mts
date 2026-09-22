import { fixtureRecord } from '../contract/test-values.mts';
import { requireArray, requireFiniteNumber } from './source-values.mts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, type FileHandle } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SCENE_OBJECTS } from '../../site/objects.mts';
import { requireAuthoredWorldFrame } from './authored-world-frame.mts';
import type { PathLike } from 'node:fs';

const readText = (path: string) => readFile(path, 'utf8');
async function inputs(id: string) {
  const directory = resolve('src/objects', id);
  const read = async (name: string) => JSON.parse(await readText(resolve(directory, name)));
  return { directory, descriptor: await read('object.json'), scene: await read('prepared/scene.json'),
    runtime: await read('prepared/runtime.json'), readText };
}
test('every authored object closes over its numerical publication stage', async () => {
  for (const object of SCENE_OBJECTS) await requireAuthoredWorldFrame(await inputs(object.id));
});
test('final numerical stage rejects mutated frame, scene scale and removed receipt', async () => {
  let input;
  for (const object of SCENE_OBJECTS) {
    const descriptor = JSON.parse(await readText(resolve('src/objects', object.id, 'object.json')));
    if (!requireArray(fixtureRecord(descriptor, 'properties', 'recipe').sources).some(source => fixtureRecord(source).id === 'world-context')) {
      input = await inputs(object.id);
      break;
    }
  }
  assert.ok(input, 'The registry contains a body with a numerical publication stage.');
  const path = resolve(input.directory, 'prepared/world-navigation.json');
  const receipt = JSON.parse(await readText(path));
  for (const mutate of [
(value: unknown) => { const frame = fixtureRecord(value, 'frame'); frame.bodyRadiusM = requireFiniteNumber(frame.bodyRadiusM) + 1; },
(value: unknown) => { const record = fixtureRecord(value); record.sceneScale = requireFiniteNumber(record.sceneScale) * 2; },
    (value: unknown) => { delete fixtureRecord(value).frame; },
  ]) {
    const changed = structuredClone(receipt); mutate(changed);
    await assert.rejects(requireAuthoredWorldFrame({ ...input,
      readText: target => target === path ? JSON.stringify(changed) : readText(target) }), /physical frame/);
  }
});
