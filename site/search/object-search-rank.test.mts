import assert from 'node:assert/strict';
import test from 'node:test';
import { designationNames, searchObjects } from './object-search.mts';

const label = (name: string) => ({ name, names: [name], illustration: false, classification: 'body', classificationName: 'moon', systemName: '' });

test('a typed name lists exact names, then names that begin with it, then the rest, each in catalogue order', () => {
  const items = [label('52 europa'), label('europa regio'), label('europa')];
  assert.deepEqual(searchObjects(items, 'Europa').matches.map(item => item.name), ['europa', 'europa regio', '52 europa']);
  assert.deepEqual(searchObjects(items, 'rop').matches.map(item => item.name), ['52 europa', 'europa regio', 'europa']);
});

test("a system's name lists its members and the body that has that very name", () => {
  const items = [{ ...label('m87'), systemName: 'virgo cluster' }, { ...label('m87*'), systemName: 'm87' }, label('m870')];
  assert.deepEqual(searchObjects(items, 'M87').matches.map(item => item.name), ['m87', 'm87*']);
});

test('a body answers to the catalogue designation its id spells', () => {
  const items = [{ ...label('55 cnc'), names: designationNames('hd-75732', '55 Cnc') }, { ...label('mars'), names: designationNames('mars', 'Mars') }];
  assert.deepEqual(items[1]!.names, []);
  for (const query of ['HD 75732', '75732']) assert.deepEqual(searchObjects(items, query).matches.map(item => item.name), ['55 cnc'], query);
});

test('spaces and hyphens in a typed designation do not decide the match', () => {
  const items = [label('hd 189733 companion'), label('hd 189733b'), label('wasp-121b'), label('trappist-1'), label('trappist-1b'), label('mars')];
  const found = (query: string) => searchObjects(items, query).matches.map(item => item.name);
  assert.deepEqual(found('HD 189733 b'), ['hd 189733b']);
  assert.deepEqual(found('hd189733'), ['hd 189733 companion', 'hd 189733b']);
  for (const query of ['wasp 121 b', 'WASP-121 b', 'wasp121b']) assert.deepEqual(found(query), ['wasp-121b'], query);
  // The exact joined name leads, as an exact typed name does.
  assert.deepEqual(found('trappist1'), ['trappist-1', 'trappist-1b']);
  // Under four joined characters a query matches only as typed: "st1" spans the hyphen of "trappist-1".
  assert.deepEqual(found('st1'), []);
  assert.deepEqual(found('ist1'), ['trappist-1', 'trappist-1b']);
});

test("a system's name also lists a body that has it as a whole word of its own name", () => {
  const items = [{ ...label('betelgeuse'), systemName: 'orion' }, { ...label('orion nebula'), systemName: 'milky way' }, label('orionid')];
  assert.deepEqual(searchObjects(items, 'Orion').matches.map(item => item.name), ['betelgeuse', 'orion nebula']);
});
