import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { OBJECTS } from '../site/objects.mts';
import { requireAuthoredWorldFrame } from './authored-world-frame.mts';

const readText = path => readFile(path, 'utf8');
async function inputs(id) {
  const directory = resolve('src/planets', id);
  const read = async name => JSON.parse(await readText(resolve(directory, name)));
  return { directory, descriptor: await read('object.json'), scene: await read('prepared/scene.json'),
    runtime: await read('prepared/runtime.json'), readText };
}
test('every authored object closes over its numerical publication stage', async () => {
  for (const object of OBJECTS) await requireAuthoredWorldFrame(await inputs(object.id));
});
test('final numerical stage rejects mutated frame, source pins, scene scale and removed receipt', async () => {
  let input;
  for (const object of OBJECTS) {
    const descriptor = JSON.parse(await readText(resolve('src/planets', object.id, 'object.json')));
    if (!descriptor.properties.recipe.sources.some(source => source.id === 'world-context')) {
      input = await inputs(object.id);
      break;
    }
  }
  assert.ok(input, 'The registry contains a body with a numerical publication stage.');
  const path = resolve(input.directory, 'prepared/world-navigation.json');
  const receipt = JSON.parse(await readText(path));
  for (const mutate of [
    value => { value.frame.bodyRadiusM += 1; },
    value => { value.sources[0].sha256 = '0'.repeat(64); },
    value => { value.sceneScale *= 2; },
    value => { delete value.frame; },
  ]) {
    const changed = structuredClone(receipt); mutate(changed);
    await assert.rejects(requireAuthoredWorldFrame({ ...input,
      readText: target => target === path ? JSON.stringify(changed) : readText(target) }), /physical frame/);
  }
});
