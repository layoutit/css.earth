import assert from 'node:assert/strict';
import { test } from 'vitest';
import { discoveryVisibility } from './object-discovery.js';

const star = (id: string, discovery: { featured?: boolean; imagery?: boolean } = {}) => ({ id, classification: 'star',
  discovery: { featured: discovery.featured ?? false, imagery: discovery.imagery ?? false, illustration: false, sourceColor: true as const } });

test('a star is named where there is more to find; every other star is an unnamed dot that stays on the map', () => {
  const objects = [star('sirius', { featured: true }), star('betelgeuse', { featured: true, imagery: true }), star('wasp-121'),
    star('m4-v69-b'), star('epic-201541578'), star('w-gem'), { id: 'wasp-121-b', classification: 'planet', discovery: { featured: false, imagery: false, illustration: false } }];
  const { hiddenBodies, hiddenLabels } = discoveryVisibility(objects, { illustrations: false, defaultFeatures: new Set(),
    systemMembers: new Set(['wasp-121', 'wasp-121-b', 'm4-v69-a', 'm4-v69-b']) });
  assert.deepEqual(hiddenLabels, ['epic-201541578', 'w-gem'], 'a notable star, a planet host, a binary member and the planet keep their names');
  assert.deepEqual(hiddenBodies, [], 'an unnamed star is still drawn, and names itself on hover');
});

test('an extreme trans-Neptunian object stays on the map as a named dot while its page is only an illustration', () => {
  const illustration = (id: string) => ({ id, classification: 'trans-neptunian', discovery: { featured: false, imagery: false, illustration: true } });
  const objects = [illustration('sedna'), illustration('quaoar')];
  const options = { illustrations: false, defaultFeatures: new Set(['sedna']), orbitFeatures: new Set(['sedna']) };
  const { hiddenBodies, hiddenLabels } = discoveryVisibility(objects, options);
  assert.deepEqual(hiddenBodies, ['quaoar'], 'an ordinary illustration waits for the illustration setting');
  assert.deepEqual(hiddenLabels, ['quaoar'], 'the orbit feature keeps its name');
});
