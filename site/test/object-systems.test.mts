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
      ['kepler-16-a', 'Kepler-16 system', '/kepler-16-a/'], ['wd-1856-534', 'WD 1856+534 system', '/wd-1856-534/'], ['kelt-9', 'KELT-9 system', '/kelt-9/'],
      ['vhs-1256-1257', 'VHS 1256-1257 system', '/vhs-1256-1257/'], ['gq-lup', 'GQ Lup system', '/gq-lup/'], ['dh-tau', 'DH Tau system', '/dh-tau/'],
      ['roxs-42b', 'ROXs 42B system', '/roxs-42b/'], ['wasp-76', 'WASP-76 system', '/wasp-76/'], ['pds-70', 'PDS 70 system', '/pds-70/'], ['wasp-18', 'WASP-18 system', '/wasp-18/'], ['wasp-121', 'WASP-121 system', '/wasp-121/'], ['luhman-16', 'Luhman 16 system', '/luhman-16/'],
      ['hip-65426', 'HIP 65426 system', '/hip-65426/'], ['af-lep', 'AF Lep system', '/af-lep/'], ['ab-pic', 'AB Pic system', '/ab-pic/'], ['yses-1', 'YSES 1 system', '/yses-1/'],
      ['hd-206893', 'HD 206893 system', '/hd-206893/'], ['hd-95086', 'HD 95086 system', '/hd-95086/'], ['gj-504', 'GJ 504 system', '/gj-504/'], ['hd-135344-a', 'HD 135344 A system', '/hd-135344-a/'],
      ['eps-indi-a', 'Epsilon Indi system', '/eps-indi-a/']]);
  // HD 189733 B has no measured orbit; it belongs to the system through the Gaia measurement that binds it to A (boundTo).
  // VHS 1256-1257 B and ROXs 42B B do have one: each circles A on its measured orbit, and the planet circles the pair.
  for (const [id, system] of [['earth', 'sun'], ['moon', 'sun'], ['comet-3i', 'sun'], ['sun', 'sun'], ['wasp-43b', 'wasp-43'], ['wasp-43', 'wasp-43'],
    ['hd-189733b', 'hd-189733'], ['hd-189733-companion', 'hd-189733'], ['hd-189733', 'hd-189733'],
    ['trappist-1e', 'trappist-1'], ['trappist-1h', 'trappist-1'], ['trappist-1', 'trappist-1'],
    ['beta-pictoris-b', 'beta-pictoris'], ['beta-pictoris-d', 'beta-pictoris'], ['hr-8799-b', 'hr-8799'], ['hr-8799-e', 'hr-8799'], ['hd-29391-b', 'hd-29391'],
    ['kelt-9b', 'kelt-9'], ['kelt-9', 'kelt-9'], ['wasp-76b', 'wasp-76'], ['wasp-76', 'wasp-76'], ['pds-70-b', 'pds-70'], ['pds-70-c', 'pds-70'], ['pds-70', 'pds-70'], ['wasp-18b', 'wasp-18'], ['wasp-121b', 'wasp-121'], ['wasp-121', 'wasp-121'], ['luhman-16b', 'luhman-16'], ['luhman-16', 'luhman-16'],
    ['vhs-1256-1257-companion', 'vhs-1256-1257'], ['vhs-1256-1257-b', 'vhs-1256-1257'], ['gq-lup-b', 'gq-lup'], ['dh-tau-b', 'dh-tau'],
    ['roxs-42b-companion', 'roxs-42b'], ['roxs-42b-b', 'roxs-42b'],
    ['hip-65426-b', 'hip-65426'], ['af-lep-b', 'af-lep'], ['ab-pic-b', 'ab-pic'], ['yses-1-b', 'yses-1'],
    ['hd-206893-b', 'hd-206893'], ['hd-206893-c', 'hd-206893'], ['hd-95086-b', 'hd-95086'], ['gj-504-b', 'gj-504'], ['hd-135344-ab', 'hd-135344-a'],
    ['eps-indi-ab', 'eps-indi-a'], ['eps-indi-ba', 'eps-indi-a'], ['eps-indi-bb', 'eps-indi-a']] as const) {
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
  assert.deepEqual(systemById(SCENE_OBJECTS, 'wd-1856-534')!.memberIds, ['wd-1856-534b']);
  // Epsilon Indi Ba is bound to A and Bb circles Ba: one system, whose host is A; Ba does not open a system of its own.
  assert.deepEqual([...systemById(SCENE_OBJECTS, 'eps-indi-a')!.memberIds].sort(), ['eps-indi-ab', 'eps-indi-ba', 'eps-indi-bb']);
  assert.equal(systemById(SCENE_OBJECTS, 'eps-indi-ba'), null);
  assert.deepEqual(systemById(SCENE_OBJECTS, 'vhs-1256-1257')!.memberIds, ['vhs-1256-1257-companion', 'vhs-1256-1257-b']);
  assert.deepEqual(systemById(SCENE_OBJECTS, 'roxs-42b')!.memberIds, ['roxs-42b-companion', 'roxs-42b-b']);
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
