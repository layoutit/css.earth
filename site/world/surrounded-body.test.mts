import assert from 'node:assert/strict';
import { test } from 'node:test';
import { surroundedBody, surroundingHosts } from './surrounded-body.mts';

const at = (x: number) => ({ worldFrame: { originM: [x, 0, 0] } });
const objects = [{ id: 'nebula', ...at(100) }, { id: 'star', parent: 'nebula', ...at(101) }, { id: 'far-star', parent: 'nebula', ...at(140) },
  { id: 'galaxy', ...at(500) }, { id: 'galaxy-star', parent: 'galaxy', ...at(500) },
  { id: 'shell', ...at(900) }, { id: 'pair-system', parent: 'shell', system: { host: 'pair' }, ...at(900) }, { id: 'pair', parent: 'pair-system', ...at(902) },
  { id: 'empty', ...at(1200) }];
const surrounding = surroundingHosts({
  'nebula-layers': { id: 'nebula-layers', properties: { host: 'nebula', surrounds: true } },
  'galaxy-layers': { id: 'galaxy-layers', properties: { host: 'galaxy' } },
  'shell-layers': { id: 'shell-layers', properties: { host: 'shell', surrounds: true } },
  'empty-layers': { id: 'empty-layers', properties: { host: 'empty', surrounds: true } },
});

test('the body an object\'s walls surround is the object inside it nearest its centre', () => {
  assert.equal(surroundedBody(objects, surrounding, 'nebula'), 'star');
  assert.equal(surroundedBody(objects, surrounding, 'shell'), 'pair', 'a system inside it stands for its host');
});

test('an object whose picture is not on walls, or with nothing inside it, names none', () => {
  assert.equal(surroundedBody(objects, surrounding, 'galaxy'), undefined);
  assert.equal(surroundedBody(objects, surrounding, 'empty'), undefined);
  assert.equal(surroundedBody(objects, surrounding, 'star'), undefined);
  assert.equal(surroundedBody(objects, surrounding, 'unknown'), undefined);
});
