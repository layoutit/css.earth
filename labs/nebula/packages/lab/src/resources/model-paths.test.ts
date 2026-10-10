import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseLabModelJson, resolveLabModelPath } from './model-paths.ts';

test('historical model locations resolve without changing unrelated paths or caller JSON bytes', () => {
  const text = '{"path":"labs/nebula/models/lmc-clouds/object.json","note":"original-note","native":".local/nebula-lab/input.png"}';
  assert.equal(resolveLabModelPath('labs/nebula/models/lmc-clouds.json'), 'src/objects/lmc-volume/source/clouds.json');
  assert.equal(resolveLabModelPath('labs/nebula/models/smc-particles/object.json'), 'src/objects/smc-volume/source/particles/object.json');
  assert.equal(resolveLabModelPath('labs/nebula/models/tarantula-coherent.json'), 'src/objects/lmc-volume/source/research/tarantula-coherent.json');
  assert.equal(resolveLabModelPath('src/objects/orion/object.json'), 'src/objects/orion/object.json');
  assert.equal(parseLabModelJson(text).path, 'src/objects/lmc-volume/source/clouds/object.json');
  assert.equal(parseLabModelJson(text).note, 'original-note');
  assert.equal(JSON.parse(text).path, 'labs/nebula/models/lmc-clouds/object.json');
});
