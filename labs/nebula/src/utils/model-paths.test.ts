import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { parseLabModelJson, resolveLabModelPath } from './model-paths.js';

test('historical model locations resolve without changing unrelated paths or caller JSON bytes', () => {
  const text = '{"path":"labs/nebula/models/lmc-clouds/object.json","sha256":"original-pin","native":".local/nebula-lab/input.png"}';
  assert.equal(resolveLabModelPath('labs/nebula/models/lmc-clouds.json'), 'labs/nebula/models/lmc/clouds.json');
  assert.equal(resolveLabModelPath('labs/nebula/models/smc-particles/object.json'), 'labs/nebula/models/smc/particles/object.json');
  assert.equal(resolveLabModelPath('labs/nebula/models/tarantula-coherent.json'), 'labs/nebula/models/lmc/research/tarantula-coherent.json');
  assert.equal(resolveLabModelPath('src/objects/orion/object.json'), 'src/objects/orion/object.json');
  assert.equal(parseLabModelJson(text).path, 'labs/nebula/models/lmc/clouds/object.json');
  assert.equal(parseLabModelJson(text).sha256, 'original-pin');
  assert.equal(JSON.parse(text).path, 'labs/nebula/models/lmc-clouds/object.json');
});

test('moved native volume recipe keeps sibling grid and provenance bytes under their original pins', async () => {
  const recipePath = resolveLabModelPath('labs/nebula/models/lmc-full-density/source/volume.json');
  const recipe = parseLabModelJson(await readFile(recipePath, 'utf8'));
  for (const pin of [recipe.grid, recipe.provenance]) {
    const bytes = await readFile(resolve(dirname(recipePath), pin.path));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256);
  }
});
