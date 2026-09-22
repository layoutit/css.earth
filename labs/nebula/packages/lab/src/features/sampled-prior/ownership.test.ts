import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sampledOwnerPins } from './ownership.ts';

const recipe = 'labs/nebula/models/example/sampled.json';
const pin = (path: string, sha256 = 'a'.repeat(64)) => ({ path, sha256 });
const method = () => ({ inputPins: [pin(recipe), pin('labs/nebula/models/example/evidence.json', 'b'.repeat(64)), pin('.local/nebula-lab/points.fits', 'c'.repeat(64))],
  extraImplementation: [pin('labs/nebula/packages/volume-core/src/fields/sampled.ts')],
  sampledPrior: { recipe: pin('.local/nebula-lab/compiler/example/sampled-recipe.json'),
    evidence: pin('.local/nebula-lab/compiler/example/physical-evidence.json', 'b'.repeat(64)), source: pin('.local/nebula-lab/points.fits', 'c'.repeat(64)) } });

test('a sampled publication cannot silently drop or relabel its qualified source and implementation pins', () => {
  assert.equal(sampledOwnerPins(method(), recipe).length, 4);
  for (let index = 0; index < 3; index++) {
    const changed = method(); changed.inputPins.splice(index, 1);
    assert.throws(() => sampledOwnerPins(changed, recipe));
  }
  const changed = method(); changed.sampledPrior.source.sha256 = 'd'.repeat(64);
  assert.throws(() => sampledOwnerPins(changed, recipe), /differ/);
  const missingOwner = method(); missingOwner.extraImplementation = [];
  assert.throws(() => sampledOwnerPins(missingOwner, recipe), /ownership/);
  const outside = method(); outside.extraImplementation[0]!.path = 'labs/nebula/src/reconstruction/sampled-prior/../secret.ts';
  assert.throws(() => sampledOwnerPins(outside, recipe), /owner/);
});

test('the shared FITS decoder is a pinned preparation owner, not an arbitrary tools path', () => {
  const shared = method(); shared.extraImplementation.push(pin('tools/fits/fits.mts'));
  assert.equal(sampledOwnerPins(shared, recipe).length, 5);
  shared.extraImplementation[1]!.path = 'tools/other.mts';
  assert.throws(() => sampledOwnerPins(shared, recipe), /owner|path/);
});


test('relocated sampled owners and historical receipts remain readable without allowing unrelated package code', () => {
  for (const path of [
    'labs/nebula/src/reconstruction/sampled-prior/field.ts',
    'labs/nebula/packages/reconstruction/src/methods/sampled/material-solver.ts',
    'labs/nebula/packages/volume-bake/src/compact-inputs/sampled.ts',
    'labs/nebula/packages/volume-core/src/contracts/sampled-recipe.ts',
  ]) {
    const value = method(); value.extraImplementation = [pin(path)];
    assert.equal(sampledOwnerPins(value, recipe).length, 4);
  }
  for (const path of [
    'labs/nebula/packages/volume-core/src/fields/emission.ts',
    'labs/nebula/packages/reconstruction/src/methods/sampled/not-an-owner.ts',
    'labs/nebula/packages/volume-bake/src/compact-inputs/../sampled.ts',
    'labs/nebula/packages/volume-core/src/fields/sampled.test.ts',
  ]) {
    const value = method(); value.extraImplementation = [pin(path)];
    assert.throws(() => sampledOwnerPins(value, recipe), /owner|path/);
  }
});
