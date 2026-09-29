import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sampledOwnerPins } from './ownership.ts';

const recipe = 'labs/nebula/models/example/sampled.json';
const pin = (path: string) => ({ path });
const method = () => ({ inputPins: [pin(recipe), pin('labs/nebula/models/example/evidence.json'), pin('.local/nebula-lab/points.fits')],
  sampledPrior: { recipe: pin('.local/nebula-lab/compiler/example/sampled-recipe.json'),
    evidence: pin('.local/nebula-lab/compiler/example/physical-evidence.json'), source: pin('.local/nebula-lab/points.fits') } });

test('a sampled publication cannot silently drop or relabel its qualified source owners', () => {
  assert.equal(sampledOwnerPins(method(), recipe).length, 3);
  for (let index = 0; index < 3; index++) {
    const changed = method(); changed.inputPins.splice(index, 1);
    assert.throws(() => sampledOwnerPins(changed, recipe));
  }
  const changed = method(); changed.sampledPrior.source = pin('.local/nebula-lab/other.fits');
  assert.throws(() => sampledOwnerPins(changed, recipe), /differ/);
  const outside = method(); outside.inputPins[1] = pin('labs/nebula/models/example/../secret.json');
  assert.throws(() => sampledOwnerPins(outside, recipe), /owner/);
  const duplicated = method(); duplicated.inputPins.push(pin(recipe));
  assert.throws(() => sampledOwnerPins(duplicated, recipe), /Duplicate/);
});

test('owners are named by path only', () => {
  const recorded = { ...method(), inputPins: [{ path: recipe, bytes: 1 }, ...method().inputPins.slice(1)] };
  assert.throws(() => sampledOwnerPins(recorded, recipe), /owner/);
});
