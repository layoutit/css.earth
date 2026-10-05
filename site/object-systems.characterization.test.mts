import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planetarySystems } from './object-systems.mts';
import { APPLICATION_WORLD_CONTEXT as plan } from './world-context-plan.mts';
import { WORLD_OBJECTS } from './world-objects.mts';
import { SYSTEM_FRAMING_RADII } from './system-framing.mts';

test('systems require a solar radius, placed hosts and placed members, but exclude unregistered hosts', () => {
  assert.throws(() => planetarySystems(WORLD_OBJECTS, plan, new Map()), /The Solar System requires its prepared framing radius\./);
  const sunRadius = SYSTEM_FRAMING_RADII.get('sun')!;
  const candidates = [{ id: 'not-placed', memberIds: [] }];
  const missing = { id: 'not-placed', name: 'Missing', systemName: 'Missing system', route: '/missing/', classification: 'star' as const };
  const radii = new Map([['sun', sunRadius], ['not-placed', 10]]);
  assert.throws(() => planetarySystems([missing], plan, radii, candidates), /Planetary system not-placed is a star the world context does not place/);
  assert.deepEqual(planetarySystems([], plan, radii, candidates), []);
  assert.throws(() => planetarySystems(WORLD_OBJECTS, plan, SYSTEM_FRAMING_RADII, [{ id: 'sun', memberIds: ['not-placed'] }]), /Planetary system sun lists not-placed/);
  assert.throws(() => planetarySystems(WORLD_OBJECTS, plan, new Map([['sun', sunRadius], ['trappist-1', 0]]), [{ id: 'trappist-1', memberIds: [] }]), /requires a registered star and a framing radius/);
});

test('a partial registry without authored world frames uses the plan positions and immutable member lists', () => {
  const objects = WORLD_OBJECTS.filter(object => object.id === 'sun').map(({ worldFrame: _frame, ...object }) => object);
  const systems = planetarySystems(objects, plan, SYSTEM_FRAMING_RADII, [{ id: 'sun', memberIds: ['earth'] }]);
  assert.deepEqual(systems[0]?.originM, plan.focus.positionM);
  assert.deepEqual(systems[0]?.memberIds, ['earth']); assert.ok(Object.isFrozen(systems)); assert.ok(Object.isFrozen(systems[0])); assert.ok(Object.isFrozen(systems[0]?.memberIds));
});
