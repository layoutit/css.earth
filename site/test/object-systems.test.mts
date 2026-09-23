import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { SCENE_OBJECTS } from '../objects.mts';
import { SOLAR_SYSTEM_ID, allPlanetarySystems, planetarySystems, systemById, systemOfObject } from '../object-systems.mts';

test('planetary systems follow prepared orbit chains to their stars', () => {
  const systems = allPlanetarySystems(SCENE_OBJECTS);
  assert.deepEqual(systems.map(system => [system.id, system.name, system.route]),
    [[SOLAR_SYSTEM_ID, 'Solar System', '/sun/'], ['wasp-43', 'WASP-43 system', '/wasp-43/'], ['hd-189733', 'HD 189733 system', '/hd-189733/'],
      ['hd-209458', 'HD 209458 system', '/hd-209458/'], ['k2-18', 'K2-18 system', '/k2-18/'], ['kepler-186', 'Kepler-186 system', '/kepler-186/'],
      ['kepler-452', 'Kepler-452 system', '/kepler-452/'], ['trappist-1', 'TRAPPIST-1 system', '/trappist-1/'],
      ['wasp-39', 'WASP-39 system', '/wasp-39/'], ['beta-pictoris', 'Beta Pictoris system', '/beta-pictoris/'], ['hr-8799', 'HR 8799 system', '/hr-8799/'],
      ['sgr-a-star', 'Galactic Centre', '/sgr-a-star/'], ['hd-110067', 'HD 110067 system', '/hd-110067/'], ['hd-29391', '51 Eridani system', '/hd-29391/'],
      ['kepler-16-a', 'Kepler-16 system', '/kepler-16-a/'], ['kelt-9', 'KELT-9 system', '/kelt-9/'], ['wasp-76', 'WASP-76 system', '/wasp-76/'], ['wasp-18', 'WASP-18 system', '/wasp-18/']]);
  // HD 189733 B has no measured orbit; it belongs to the system through the candidate orbits its measurements allow.
  for (const [id, system] of [['earth', 'sun'], ['moon', 'sun'], ['comet-3i', 'sun'], ['sun', 'sun'], ['wasp-43b', 'wasp-43'], ['wasp-43', 'wasp-43'],
    ['hd-189733b', 'hd-189733'], ['hd-189733-companion', 'hd-189733'], ['hd-189733', 'hd-189733'],
    ['trappist-1e', 'trappist-1'], ['trappist-1h', 'trappist-1'], ['trappist-1', 'trappist-1'],
    ['beta-pictoris-b', 'beta-pictoris'], ['beta-pictoris-d', 'beta-pictoris'], ['hr-8799-b', 'hr-8799'], ['hr-8799-e', 'hr-8799'], ['hd-29391-b', 'hd-29391'],
    ['kelt-9b', 'kelt-9'], ['kelt-9', 'kelt-9'], ['wasp-76b', 'wasp-76'], ['wasp-76', 'wasp-76'], ['wasp-18b', 'wasp-18']] as const) {
    assert.equal(systemOfObject(SCENE_OBJECTS, id)?.id, system, id);
  }
  assert.equal(systemOfObject(SCENE_OBJECTS, 'betelgeuse'), null, 'A star without orbiting bodies belongs to no system');
  assert.equal(systemById(SCENE_OBJECTS, 'jupiter'), null, "A planet's moons are not a planetary system");
  assert.deepEqual(systemById(SCENE_OBJECTS, 'wasp-43')!.memberIds, ['wasp-43b']);
  assert.deepEqual(systemById(SCENE_OBJECTS, 'hd-189733')!.memberIds, ['hd-189733b', 'hd-189733-companion']);
  // Seven planets around one star: the largest system this application holds after the Solar System.
  assert.deepEqual(systemById(SCENE_OBJECTS, 'trappist-1')!.memberIds,
    ['trappist-1b', 'trappist-1c', 'trappist-1d', 'trappist-1e', 'trappist-1f', 'trappist-1g', 'trappist-1h']);
  assert.deepEqual(systemById(SCENE_OBJECTS, 'beta-pictoris')!.memberIds,
    ['beta-pictoris-b', 'beta-pictoris-c', 'beta-pictoris-d']);
  assert.deepEqual(systemById(SCENE_OBJECTS, 'hd-110067')!.memberIds,
    ['hd-110067b', 'hd-110067c', 'hd-110067d', 'hd-110067e', 'hd-110067f', 'hd-110067g']);
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
