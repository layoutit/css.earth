import assert from "node:assert/strict";
import test from "node:test";
import { prepareFrameLookup } from "./index.ts";
import { parsePreparedObjectRuntime } from '@cssearth/objects';
import { loadObjectTestDefinition } from '@cssearth/objects/node/contract';

test('prepared numeric phase mappings pass the objects runtime parser in both directions', async () => {
  const definition = parsePreparedObjectRuntime(await loadObjectTestDefinition('venus'));
  const track = definition.materials[0];
  assert.ok(track);
  const count = track.banks[0]!.frames.length;
  assert.deepEqual(track.frame, prepareFrameLookup(32, z => Math.max(0, Math.min(30, Math.round((z + .98) / 1.96 * 30)))),
    'published Venus lookup follows the source directional phase mapping');
  for (const ascending of [true, false]) {
    const frame = prepareFrameLookup(count, z => Math.round((ascending ? z + 1 : 1 - z) * (count - 1) / 2));
    const prepared = parsePreparedObjectRuntime({ ...definition, materials: [{ ...track, frame }] });
    assert.deepEqual(prepared.materials[0]?.frame, frame);
    assert.equal(frame.indices[0], ascending ? 0 : count - 1);
    assert.equal(frame.indices.at(-1), ascending ? count - 1 : 0);
  }
});

test("invalid material mappings fail before lookup expansion", () => {
  for (const value of [NaN, Infinity, -1, .5, 4]) {
    assert.throws(() => prepareFrameLookup(4, () => value), /inside its prepared bank/);
  }
  assert.throws(() => prepareFrameLookup(0, () => 0), /positive frame count/);
  assert.throws(() => prepareFrameLookup(4, z => z === -1 ? 0 : z === 1 ? 3 : NaN), /inside its prepared bank/);
});
