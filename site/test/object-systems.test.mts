import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { SCENE_OBJECTS } from '../objects.mts';
import { SOLAR_SYSTEM_ID, allPlanetarySystems, planetarySystems, systemById } from '../object-systems.mts';

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

test("every system's overview lasts two doublings of distance before its orbits are gone, more than one wheel step", async () => {
  const { overviewScopeAtCamera } = await import('../overview-context.mts');
  const { SYSTEM_RANGES } = await import('../system-framing.mts');
  const { APPLICATION_WORLD_CONTEXT: plan } = await import('../world-context-plan.mts');
  for (const system of allPlanetarySystems(SCENE_OBJECTS)) {
    const at = (factor: number) => ({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [system.originM[0] + system.exitDistanceM * factor, system.originM[1], system.originM[2]] as const,
      orientationXyzw: [0, 0, 0, 1] as const } });
    assert.equal(overviewScopeAtCamera(at(3.99), 'system', plan, { originM: system.originM, orbitsWithinM: SYSTEM_RANGES.get(system.id) }), 'system', system.id);
  }
  assert.ok(systemById(SCENE_OBJECTS, 'sgr-a-star')!.exitDistanceM < 0.8 * 9.4607e15, 'Sgr A* opens at 0.8 ly, not the scaled 3.6 ly');
});
