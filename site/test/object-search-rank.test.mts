import assert from 'node:assert/strict';
import test from 'node:test';
import { searchObjects } from '../object-search.mts';

const label = (name: string) => ({ name, names: [name], illustration: false, candidate: false, classification: 'body', classificationName: 'moon', systemName: '' });

test('a typed name lists exact names, then names that begin with it, then the rest, each in catalogue order', () => {
  const items = [label('52 europa'), label('europa regio'), label('europa')];
  assert.deepEqual(searchObjects(items, 'Europa').matches.map(item => item.name), ['europa', 'europa regio', '52 europa']);
  assert.deepEqual(searchObjects(items, 'rop').matches.map(item => item.name), ['52 europa', 'europa regio', 'europa']);
});
