import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorldVisibilityPolicy } from './application-world-visibility.mts';
import { worldObjects } from './world-objects.mts';
import { APPLICATION_WORLD_CONTEXT } from './world-context-plan.mts';

test('only a placed star root opens a system, including descendants in tree order', () => {
  const base = APPLICATION_WORLD_CONTEXT.bodies[0]!;
  const plan = { focus: APPLICATION_WORLD_CONTEXT.focus, bodies: [
    { ...base, id: 'fixture-star', classification: 'star', systemName: 'Fixture', inside: undefined },
    { ...base, id: 'fixture-planet', classification: 'planet', systemName: 'Fixture', inside: 'fixture-star-system' },
    { ...base, id: 'fixture-moon', classification: 'satellite', systemName: 'Fixture', inside: 'fixture-planet-system' },
    { ...base, id: 'fixture-galaxy', classification: 'galaxy', systemName: 'Fixture', inside: undefined },
    { ...base, id: 'fixture-child', classification: 'star', systemName: 'Fixture', inside: 'fixture-galaxy-system' },
  ] };
  const policy = createWorldVisibilityPolicy(worldObjects(plan), plan);
  assert.deepEqual([...policy.placedSystemOf('fixture-moon')], ['fixture-star', 'fixture-planet', 'fixture-moon']);
  assert.deepEqual([...policy.placedSystemOf('fixture-star')], ['fixture-star', 'fixture-planet', 'fixture-moon']);
  assert.deepEqual([...policy.placedSystemOf(plan.focus.id)], []);
  assert.deepEqual([...policy.placedSystemOf('fixture-child')], []);
  assert.deepEqual([...policy.placedSystemOf('unknown')], []);
});
