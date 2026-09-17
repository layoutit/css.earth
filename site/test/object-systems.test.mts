import assert from 'node:assert/strict';
import test from 'node:test';
import { SCENE_OBJECTS } from '../objects.mts';
import { SOLAR_SYSTEM_ID, allPlanetarySystems, planetarySystems, systemById, systemOfObject } from '../object-systems.mts';

test('planetary systems follow prepared orbit chains to their stars', () => {
  const systems = allPlanetarySystems(SCENE_OBJECTS);
  assert.deepEqual(systems.map(system => [system.id, system.name, system.route]),
    [[SOLAR_SYSTEM_ID, 'Solar System', '/sun/'], ['wasp-43', 'WASP-43 system', '/wasp-43/']]);
  for (const [id, system] of [['earth', 'sun'], ['moon', 'sun'], ['comet-3i', 'sun'], ['sun', 'sun'], ['wasp-43b', 'wasp-43'], ['wasp-43', 'wasp-43']] as const) {
    assert.equal(systemOfObject(SCENE_OBJECTS, id)?.id, system, id);
  }
  assert.equal(systemOfObject(SCENE_OBJECTS, 'betelgeuse'), null, 'A star without orbiting bodies belongs to no system');
  assert.equal(systemById(SCENE_OBJECTS, 'jupiter'), null, "A planet's moons are not a planetary system");
  assert.deepEqual(systemById(SCENE_OBJECTS, 'wasp-43')!.memberIds, ['wasp-43b']);
});

test("a system's exit distance scales the Sun's 100 AU by the prepared framing radius", () => {
  const au = 149_597_870_700, sun = systemById(SCENE_OBJECTS, SOLAR_SYSTEM_ID)!, wasp = systemById(SCENE_OBJECTS, 'wasp-43')!;
  assert.equal(sun.exitDistanceM, 100 * au);
  assert.ok(Math.abs(wasp.exitDistanceM / wasp.radiusM - sun.exitDistanceM / sun.radiusM) < 1e-9);
  assert.ok(wasp.exitDistanceM > wasp.radiusM && wasp.exitDistanceM < .1 * au);
});

test('every member names its star’s system', () => {
  const renamed = SCENE_OBJECTS.map(object => object.id === 'wasp-43b' ? { ...object, systemName: 'Sextans' } : object);
  assert.throws(() => planetarySystems(renamed), /wasp-43b orbits WASP-43 but names its system Sextans, not WASP-43 system/u);
});
