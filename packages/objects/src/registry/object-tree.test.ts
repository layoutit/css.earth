import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkObjectTree, objectAncestors, objectChildren } from './object-tree.js';

const tree = [
  { id: 'observable-universe' }, { id: 'milky-way', parent: 'observable-universe' }, { id: 'solar-system', parent: 'milky-way' },
  { id: 'earth-system', parent: 'solar-system' }, { id: 'earth', parent: 'earth-system' }, { id: 'moon', parent: 'earth-system' },
];

describe('the object tree', () => {
  it('accepts objects that each name the one object they are inside, under the root', () => {
    checkObjectTree(tree);
  });

  it('refuses a missing parent, an unknown parent, a parent on the root, a loop and a missing root, naming the object and its file', () => {
    assert.throws(() => checkObjectTree([...tree, { id: 'ceres' }]), /src\/objects\/ceres\/object\.json: every object names the one object it is inside \(a top-level "parent"\); ceres names none/);
    assert.throws(() => checkObjectTree([...tree, { id: 'ceres', parent: 'asteroid-belt' }]), /src\/objects\/ceres\/object\.json: parent "asteroid-belt" is no object of the registry/);
    assert.throws(() => checkObjectTree([{ id: 'observable-universe', parent: 'milky-way' }, tree[1]!]), /the root of the object tree has no parent; got "milky-way"/);
    assert.throws(() => checkObjectTree([tree[0]!, { id: 'a', parent: 'b' }, { id: 'b', parent: 'a' }]), /src\/objects\/a\/object\.json: its parents loop \(a > b > a\)/);
    assert.throws(() => checkObjectTree(tree.slice(1)), /The object tree has no root: src\/objects\/observable-universe\/object\.json is missing/);
  });

  it('reads an object\'s ancestors from the root down and each object\'s children', () => {
    const byId = new Map(tree.map(object => [object.id, object]));
    assert.deepEqual(objectAncestors(byId, 'moon'), ['observable-universe', 'milky-way', 'solar-system', 'earth-system']);
    assert.deepEqual(objectAncestors(byId, 'observable-universe'), []);
    assert.deepEqual(objectChildren(tree).get('earth-system'), ['earth', 'moon']);
    assert.equal(objectChildren(tree).get('moon'), undefined);
  });
});
