import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { SCENE_OBJECTS } from '../objects.mts';
import { WORLD_OBJECTS } from '../world-objects.mts';
import { SOLAR_SYSTEM_ID, allPlanetarySystems, planetarySystems, systemById, systemOfObject } from '../object-systems.mts';
import { planetarySystemMembers } from '../planetary-system-members.mts';
import { PREPARED_WORLD_PRESENTATION } from '../prepared-world-presentation.mts';
import { SYSTEM_FRAMING_RADII, systemFramingRadii } from '../system-framing.mts';
import { APPLICATION_WORLD_CONTEXT } from '../world-context-plan.mts';

test('planetary systems follow prepared orbit chains to their stars', () => {
  const systems = allPlanetarySystems(SCENE_OBJECTS);
  // Every archive batch adds systems (exoplanet batch 1, 2026-09-29), so the list is held to its rules, not pinned: the Solar
  // System first, each system named and routed after its star, each once, and the hand-built systems all present.
  assert.deepEqual([systems[0]!.id, systems[0]!.name, systems[0]!.route], [SOLAR_SYSTEM_ID, 'Solar System', '/sun/']);
  assert.equal(new Set(systems.map(system => system.id)).size, systems.length);
  for (const system of systems.slice(1)) {
    const star = SCENE_OBJECTS.find(object => object.id === system.id);
    assert.ok(star, `${system.id} is a registered star`);
    assert.deepEqual([system.name, system.route], [star.systemName, `/${system.id}/`]);
  }
  for (const id of ['wasp-43', 'hd-189733', 'hd-209458', 'k2-18', 'kepler-186', 'kepler-452', 'trappist-1', 'wasp-39', 'beta-pictoris', 'hr-8799', 'sgr-a-star', 'hd-110067', 'hd-29391', 'kepler-16-a', 'wd-1856-534', 'kelt-9', 'vhs-1256-1257', 'gq-lup', 'dh-tau', 'roxs-42b', 'wasp-76', 'pds-70', 'wasp-18', 'wasp-121', 'luhman-16', 'hip-65426', 'af-lep', 'ab-pic', 'yses-1', 'hd-206893', 'hd-95086', 'gj-504', 'hd-135344-a', 'eps-indi-a', 'hd-219134', 'hip-56998', 'hd-136352', 'gj-143', 'hd-39091', 'toi-2194', 'toi-5789', 'hd-97658', 'hd-63433', 'toi-2134', 'hd-207496', 'toi-836', 'hd-207897', 'hd-73583', 'hr-858', 'toi-431', 'hd-88986', 'hd-60779', 'kepler-444']) assert.ok(systems.some(system => system.id === id), `${id} keeps its system`);
  // A page builds its systems from the world summary alone; they match the registry's. The summary is regenerated on each
  // machine, so positions of order 1e18 m agree to 12 significant digits, not to the last bit.
  const rounded = (value: unknown): unknown => typeof value === 'number' ? Number(value.toPrecision(12))
    : Array.isArray(value) ? value.map(rounded) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rounded(item)])) : value;
  assert.deepEqual(rounded(allPlanetarySystems(WORLD_OBJECTS)), rounded(systems));
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

test('a page that holds only the summary has the systems whose members it holds, and each other one once its holder is read', async () => {
  const { readFile } = await import('node:fs/promises');
  const { extendWorldContext, parsePreparedWorldContextSummary, parsePreparedWorldSystem } = await import('@cssearth/objects');
  const { worldObjects } = await import('../world-objects.mts');
  const prepared = new URL('../../src/objects/sun/prepared/', import.meta.url);
  const summary = parsePreparedWorldContextSummary(JSON.parse(await readFile(new URL('world-context-summary.json', prepared), 'utf8')));
  // TRAPPIST-1 is a body of the summary; its planets are in its holder's file.
  const before = planetarySystems(worldObjects(summary), summary, systemFramingRadii(summary));
  assert.ok(before.some(system => system.id === SOLAR_SYSTEM_ID));
  assert.equal(before.some(system => system.id === 'trappist-1'), false, 'no system until its planets are held');
  const extended = extendWorldContext(summary, [parsePreparedWorldSystem(JSON.parse(await readFile(new URL('../../trappist-1-system/prepared/members.json', prepared), 'utf8')), summary, 'trappist-1-system')]);
  const after = planetarySystems(worldObjects(extended), extended, systemFramingRadii(extended));
  // Read whole, it is the system the build sees.
  assert.deepEqual(after.find(system => system.id === 'trappist-1'), systemById(WORLD_OBJECTS, 'trappist-1'));
});

test('the system helpers read the orbit graph of the plan', () => {
  for (const objects of [SCENE_OBJECTS, WORLD_OBJECTS]) {
    const derived = planetarySystems(objects, APPLICATION_WORLD_CONTEXT, SYSTEM_FRAMING_RADII, planetarySystemMembers(APPLICATION_WORLD_CONTEXT));
    assert.deepEqual(allPlanetarySystems(objects), derived);
    for (const { id } of objects) {
      assert.deepEqual(systemOfObject(objects, id), derived.find(system => system.id === id || system.memberIds.includes(id)) ?? null, id);
      assert.deepEqual(systemById(objects, id), derived.find(system => system.id === id) ?? null, id);
    }
  }
});

test('a plan reads its systems from its own orbit graph', () => {
  const plan = { ...APPLICATION_WORLD_CONTEXT, bodies: APPLICATION_WORLD_CONTEXT.bodies.filter(body => body.id !== 'wasp-43b') };
  assert.deepEqual(planetarySystems(SCENE_OBJECTS, plan, SYSTEM_FRAMING_RADII).find(system => system.id === 'wasp-43')?.memberIds, []);
  // The Sun made to orbit the Earth closes every Solar System chain into a loop.
  const cyclic = { ...APPLICATION_WORLD_CONTEXT, orbitCenters: { ...APPLICATION_WORLD_CONTEXT.orbitCenters, sun: { positionM: [0, 0, 0] as const, centerBodyId: 'earth' } } };
  assert.throws(() => planetarySystemMembers(cyclic), /has a cyclic orbit chain/);
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

test("a system's card lists its star, its planets and its featured bodies", async () => {
  const { listedInSystemCard } = await import('../object-systems.mts');
  const body = (id: string, classification: string, featured: boolean) => ({ id, classification, discovery: { featured } });
  assert.deepEqual([body('sun', 'star', false), body('neptune', 'planet', false), body('trappist-1b', 'exoplanet', false), body('ceres', 'dwarf-planet', true),
    body('asteroid-1998-wt24', 'asteroid', false), body('hyperion', 'satellite', false)].filter(object => listedInSystemCard(object, 'sun')).map(object => object.id),
  ['sun', 'neptune', 'trappist-1b', 'ceres']);
});
