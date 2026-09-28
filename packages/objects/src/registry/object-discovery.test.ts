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
