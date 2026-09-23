import { requireArray } from '../../tools/sources/source-values.mts';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { M_PER_AU } from '@cssearth/astronomy';
import { parseWorldContextSource, prepareWorldContext } from './spatial-context.js';
import type { OrbitalState } from './spatial-context.js';

const sourcePath = 'src/objects/sun/source/navigation/universe.json';
// Unit cases supply their own body inventory; the application resolves catalogue membership.
async function readSource() {
  return { ...JSON.parse(await readFile(sourcePath, 'utf8')), bodies: [{id: 'test-body', name: 'Test body', color: '#aaaaaa'}] };
}

test('catalogue selection must be resolved before preparing a physical context', async () => {
  const source = parseWorldContextSource(JSON.parse(await readFile(sourcePath, 'utf8')));
  assert.equal(source.bodySelection, 'catalog');
  assert.throws(() => prepareWorldContext(source, {}, {}), /Resolve catalogue membership/);
});

test('approximate placement survives preparation without changing the orbit geometry', async () => {
  const raw = await readSource();
  const body = { ...raw.bodies[0], placement: 'approximate' };
  const source = parseWorldContextSource({ ...raw, bodies: [body] });
  const facts = { [body.id]: { radiusM: 1 } };
  const states = { [body.id]: { positionM: [7, 0, 0], centerBodyId: source.focus.id,
    centerPositionM: source.frame.originM, normal: [0, 0, 1], perihelionDirection: [1, 0, 0],
    semiMajorAxisM: 10, eccentricity: .3, trueAnomalyRadians: 0 } } as Record<string, OrbitalState>;
  const prepared = prepareWorldContext(source, facts, states);
  const original = prepareWorldContext({ ...source, bodies: [{ id: body.id, name: body.name, color: body.color }] }, facts, states);
  assert.equal(prepared.bodies[0]!.placement, 'approximate');
  assert.deepEqual(prepared.bodies[0]!.orbit!, original.bodies[0]!.orbit!);
  assert.throws(() => parseWorldContextSource({ ...raw, bodies: [{ ...body, placement: 'exact-ish' }] }), /placement/);
});

test('prepared volume opacity preserves authored grading and validates bounded levels and ordered distances', async () => {
  const raw = await readSource();
  const source = parseWorldContextSource(raw), profile = source.volume.opacityProfile!;
  assert.deepEqual(profile, raw.volume.opacityProfile);
  assert.equal(profile.nearOpacity, 0); assert.equal(profile.fullOpacity, 1);
  assert(profile.fadeStartDistanceM > source.system.hiddenDistanceM, 'NASA stays opaque throughout the prepared Solar System');
  const brightness = source.volume.brightnessProfile!;
  assert.deepEqual(brightness, raw.volume.brightnessProfile);
  assert(profile.fadeStartDistanceM < brightness.fadeStartDistanceM && profile.fullDistanceM > brightness.fadeStartDistanceM,
    'NASA remains present while the faint incoming volume starts brightening');
  assert(profile.fullDistanceM < brightness.fullDistanceM, 'the panorama retires before the exterior galaxy reaches full brightness');
  const prepared = prepareWorldContext({ ...source, bodies: [] }, {}, {});
  assert.deepEqual(prepared.volume.opacityProfile, profile);
  assert.deepEqual(prepared.volume.brightnessProfile, brightness);
  const { opacityProfile: _profile, brightnessProfile: _brightness, ...legacyVolume } = raw.volume;
  assert.equal(parseWorldContextSource({ ...raw, volume: legacyVolume }).volume.opacityProfile, undefined);
  assert.equal(parseWorldContextSource({ ...raw, volume: legacyVolume }).volume.brightnessProfile, undefined);
  for (const invalid of [{ ...profile, model: 'linear' }, { ...profile, nearOpacity: -.01 }, { ...profile, fullOpacity: 1.01 },
    { ...profile, fullOpacity: NaN }, { ...profile, nearOpacity: undefined }, { ...profile, fadeStartDistanceM: 0 },
    { ...profile, fullDistanceM: profile.fadeStartDistanceM }, { ...profile, runtimeExposure: true }]) {
    for (const key of ['opacityProfile', 'brightnessProfile']) assert.throws(() => parseWorldContextSource({ ...raw, volume: { ...raw.volume, [key]: invalid } }), /opacity/i);
  }
});

test('stellar handoff survives preparation and rejects missing or out-of-order ranges', async () => {
  const raw = await readSource() as Record<string, unknown>;
  const expected = { objectId:'stellar-neighbourhood',fadeStartDistanceM:100 * M_PER_AU,fullDistanceM:200 * M_PER_AU };
  const source = parseWorldContextSource(raw);
  const prepared = prepareWorldContext({...source,bodies:[]},{},{}) as unknown as Record<string,unknown>;
  assert.deepEqual(prepared.stars,expected,'prepared world must retain the authored stellar handoff');
  assert.throws(()=>parseWorldContextSource({...raw,stars:undefined}),/stars/i);
  assert.throws(()=>parseWorldContextSource({...raw,stars:{...expected,fullDistanceM:expected.fadeStartDistanceM}}),/stars/i);
  assert.throws(()=>parseWorldContextSource({...raw,stars:{...expected,fullDistanceM:source.volume.fadeStartDistanceM+1e20}}),/stars/i);
});

test('Sun context source derives its physical scale from the prepared visible radius', async () => {
  const raw = await readSource() as Record<string, unknown>;
  const source = parseWorldContextSource(raw);
  assert.equal(source.frame.bodyRadiusM / source.frame.metersPerUnit, 310);
  assert.equal(source.system.fadeOutStartDistanceM, 1e14);
  assert.equal(source.system.hiddenDistanceM, 9460730472580800);
  assert(source.stars.fullDistanceM < source.system.hiddenDistanceM,
    'nearby stars finish appearing before the Solar System context retires at one light-year');
  assert.equal(source.camera.framingReferenceZoom, 1);
  assert.deepEqual(source.focus.pointSource,{absoluteMagnitude:4.832125665882298,color:'#fff5e0',
    proximityEnhancement:{fullDistanceM:1e12,fadeOutDistanceM:9460730472580800,radiusMultiplier:2.4,brightnessMultiplier:1.5}});
  const prepared = prepareWorldContext({ ...source, bodies: [] }, {}, {});
  assert.deepEqual(prepared.focus.pointSource,source.focus.pointSource,'prepared focus must preserve authored far-point photometry');
  assert.equal(source.camera.presentation.dolly.maximumDistanceOverOrbitExtent, 1);
  assert.throws(() => parseWorldContextSource({ ...raw, frame: { ...(raw.frame as Record<string, unknown>), metersPerUnit: 1 } }), /metres per unit/);
  assert.throws(() => parseWorldContextSource({ ...raw, focus: { ...(raw.focus as Record<string, unknown>), pointSource: { absoluteMagnitude: Number.NaN, color: '#fff5e0' } } }), /point/i);
  assert.throws(() => parseWorldContextSource({ ...raw, focus: { ...(raw.focus as Record<string, unknown>), pointSource: { absoluteMagnitude: 4.83, color: 'yellow' } } }), /color/i);
  assert.throws(() => parseWorldContextSource({ ...raw, focus: { ...(raw.focus as Record<string, unknown>), pointSource: { ...(raw.focus as { pointSource: Record<string, unknown> }).pointSource,
    proximityEnhancement: { fullDistanceM: 1e14, fadeOutDistanceM: 1e12, radiusMultiplier: .9, brightnessMultiplier: 1.5 } } } }), /proximity/i);
  assert.throws(() => parseWorldContextSource({ ...raw, focus: requireArray(raw.bodies)[0] }), /exclude the focus/);
  const camera = raw.camera as Record<string, unknown>;
  const presentation = camera.presentation as Record<string, unknown>;
  assert.throws(() => parseWorldContextSource({ ...raw, camera: { ...camera, presentation: { ...presentation, dolly: { ...(presentation.dolly as Record<string, unknown>), wheelStepPerDelta: 0 } } } }), /wheel step/);
});

test('prepared ellipses start at their same-epoch ephemeris position', async () => {
  const source = parseWorldContextSource(await readSource() as unknown);
  const body = source.bodies[0]!;
  const result = prepareWorldContext({ ...source, bodies: [body], orbit: { ...source.orbit!, segments: 16 } },
    { [body.id]: { radiusM: 1 } }, {
      [body.id]: { positionM: [7, 0, 0], centerBodyId: source.focus.id, centerPositionM: source.frame.originM, normal: [0, 0, 1], perihelionDirection: [1, 0, 0], semiMajorAxisM: 10, eccentricity: .3, trueAnomalyRadians: 0 },
    });
  assert.deepEqual(result.bodies[0]!.positionM, result.bodies[0]!.orbit!.verticesM[0]);
  assert.equal(result.bodies[0]!.orbit!.verticesM.length, 16);
  assert.equal(result.bodies[0]!.orbit!.trail.length, 16);
  assert.deepEqual(result.focus.positionM, [0, 0, 0]);
});

test('a hyperbolic world trajectory retains its epoch marker on a finite open conic', async () => {
  const source = parseWorldContextSource(await readSource());
  const body = { id: 'interstellar-visitor', name: 'Interstellar visitor', color: '#aaaaaa' };
  const eccentricity = 1.5, trueAnomalyRadians = Math.PI / 3;
  const distance = M_PER_AU * (eccentricity ** 2 - 1) / (1 + eccentricity * Math.cos(trueAnomalyRadians));
  const state: OrbitalState = { positionM: [distance * Math.cos(trueAnomalyRadians), distance * Math.sin(trueAnomalyRadians), 0],
    centerBodyId: source.focus.id, centerPositionM: source.frame.originM, normal: [0, 0, 1], perihelionDirection: [1, 0, 0],
    semiMajorAxisM: -M_PER_AU, eccentricity, trueAnomalyRadians };
  const prepared = prepareWorldContext({ ...source, bodies: [body], orbit: { ...source.orbit!, segments: 16 } },
    { [body.id]: { radiusM: 100, orbitStyle: 'closed' } }, { [body.id]: state });
  const orbit = prepared.bodies[0]!.orbit!;
  assert.equal(orbit.closed, false, 'a bound-orbit styling preference cannot close a hyperbola');
  assert.equal(orbit.displayExtentAu, 600, 'the radius cap is a display window, not an apoapsis');
  assert.equal(orbit.trailModel, 'finite-open-trajectory-constant-weight');
  assert(orbit.bodyVertexIndex! > 0 && orbit.bodyVertexIndex! < orbit.verticesM.length - 1);
  assert.deepEqual(orbit.verticesM[orbit.bodyVertexIndex!], state.positionM);
  assert.equal(orbit.trail.length, orbit.verticesM.length - 1);
  assert(orbit.trail.every(weight => weight === 1));
  assert.deepEqual(orbit.activeChords, Array.from({ length: orbit.verticesM.length - 1 }, (_, index) => index));
  assert.deepEqual([...orbit!.extentChords].sort((a, b) => a - b), orbit.activeChords);
  assert(orbit.verticesM[0]![1] < 0 && orbit.verticesM.at(-1)![1] > 0, 'both unbound branches remain in chronological order');
  for (const vertex of orbit.verticesM) {
    const radius = Math.hypot(...vertex);
    // The independent polar equation r(1 + e cos(nu)) = a(1-e²).
    assert(Math.abs(radius + eccentricity * vertex[0] - M_PER_AU * (eccentricity ** 2 - 1)) < M_PER_AU * 1e-10);
    assert.equal(vertex[2], 0);
    assert(radius <= 600 * M_PER_AU * (1 + 8 * Number.EPSILON));
    assert(Math.hypot(...vertex.map((value, axis) => value - orbit.bounds.centerM[axis]!)) <= orbit.bounds.radiusM);
  }
  for (const endpoint of [orbit.verticesM[0]!, orbit.verticesM.at(-1)!]) {
    assert(Math.abs(Math.hypot(...endpoint) / M_PER_AU - 600) < 1e-10);
  }
  assert(!('period' in orbit) && !('chordBehindTurns' in orbit), 'an unbound passage has no period or share-of-a-turn trail');
});

test('world context rejects inconsistent conic signs and parabolic or unreachable states', async () => {
  const source = parseWorldContextSource(await readSource());
  const body = source.bodies[0]!;
  const state: OrbitalState = { positionM: [M_PER_AU / 2, 0, 0], centerBodyId: source.focus.id, centerPositionM: source.frame.originM,
    normal: [0, 0, 1], perihelionDirection: [1, 0, 0], semiMajorAxisM: -M_PER_AU, eccentricity: 1.5, trueAnomalyRadians: 0 };
  for (const invalid of [{ semiMajorAxisM: M_PER_AU }, { semiMajorAxisM: 0 }, { semiMajorAxisM: Infinity },
    { eccentricity: .5 }, { eccentricity: 1 }, { eccentricity: NaN }, { eccentricity: Infinity }, { trueAnomalyRadians: Math.PI }]) {
    assert.throws(() => prepareWorldContext({ ...source, bodies: [body] }, { [body.id]: { radiusM: 100 } },
      { [body.id]: { ...state, ...invalid } }), /orbit|finite/);
  }
});

test('satellite ellipses are translated to their parent with exact prepared centres', async () => {
  const source = parseWorldContextSource(await readSource() as unknown);
  const bodies = [{ id: 'parent', name: 'Parent', color: '#888888' }, { id: 'satellite', name: 'Satellite', color: '#999999' }];
  const states: Record<string, OrbitalState> = {
    parent: { positionM: [1000, 0, 0], centerBodyId: source.focus.id, centerPositionM: [0, 0, 0],
      normal: [0, 0, 1], perihelionDirection: [1, 0, 0], semiMajorAxisM: 1000, eccentricity: 0, trueAnomalyRadians: 0 },
    satellite: { positionM: [1007, 0, 0], centerBodyId: 'parent', centerPositionM: [1000, 0, 0],
      normal: [0, 0, 1], perihelionDirection: [1, 0, 0], semiMajorAxisM: 10, eccentricity: .3, trueAnomalyRadians: 0 },
  };
  const config = { ...source, bodies, orbit: { ...source.orbit!, segments: 16 } };
  const facts = { parent: { radiusM: 2 }, satellite: { radiusM: 1 } };
  const orbit = prepareWorldContext(config, facts, states).bodies[1]!.orbit!;
  const policy = { minimumRadiusShare: .2, elevationsDegrees: [30, 45, 60], azimuthStepDegrees: 15 };
  const view = prepareWorldContext(config, facts, states, {}, policy).bodies[0]!.systemView!;
  assert.deepEqual(view.memberIds, ['satellite']);
  assert.deepEqual(view.memberRadiiM, [1]);
  assert.equal(view.candidates.length, 72);
  // Include the far side omitted by the trail, with room for the moon itself.
  assert.equal(view.candidates[0]!.minimumM[0], -14);
  assert.equal(view.candidates[0]!.maximumM[0], 8);
  for (const candidate of view.candidates) {
    const rotation = candidate.cameraToReference;
    const elevation = Math.asin(rotation[8]!) * 180 / Math.PI;
    assert.ok(elevation >= 30 - 1e-10 && elevation <= 60 + 1e-10, 'every candidate is oblique');
    const project = (point: readonly number[]) => [0, 1, 2].map(axis =>
      point.reduce((sum, value, row) => sum + (value - states.parent!.positionM[row]!) * rotation[3 * row + axis]!, 0));
    assert.deepEqual(candidate.memberPositionsM[0], project(states.satellite!.positionM));
    for (const vertex of orbit.verticesM) for (const [axis, value] of project(vertex).entries()) {
      assert.ok(value - 1 >= candidate.minimumM[axis]! - 1e-10 && value + 1 <= candidate.maximumM[axis]! + 1e-10);
    }
  }
  const retrograde = prepareWorldContext(config, facts, { ...states,
    satellite: { ...states.satellite!, normal: [0, 0, -1] } }, {}, policy).bodies[0]!.systemView!;
  assert.ok(retrograde.candidates.every(candidate => candidate.cameraToReference[8]! < 0), 'retrograde orbital north is respected');
  const renamed = prepareWorldContext({ ...config, bodies: bodies.map(body => ({ ...body, id: `${body.id}-renamed` })) },
    { 'parent-renamed': facts.parent, 'satellite-renamed': facts.satellite },
    { 'parent-renamed': states.parent!, 'satellite-renamed': { ...states.satellite!, centerBodyId: 'parent-renamed' } }, {}, policy);
  assert.deepEqual(renamed.bodies[0]!.systemView!.candidates, view.candidates, 'body names have no influence on framing');
  const reordered = prepareWorldContext({ ...config, bodies: [...bodies].reverse() }, facts, states, {}, policy);
  assert.deepEqual(reordered.bodies.find(body => body.id === 'parent')!.systemView, view, 'registry order has no influence on framing');
  assert.throws(() => prepareWorldContext(config, facts, states, {}, { ...policy, elevationsDegrees: [90] }), /oblique/);
  assert.deepEqual(orbit.centerPositionM, states.parent!.positionM);
  assert.equal(orbit.centerBodyId, 'parent');
  assert.deepEqual(orbit.verticesM[0], [1007, 0, 0]);
  assert(orbit.bounds.radiusM > 0);
  assert.deepEqual(orbit.activeChords, orbit.trail.flatMap((weight, index) => weight > 0 ? [index] : []));
  assert.deepEqual([...orbit!.extentChords].sort((a, b) => a - b), orbit.activeChords);
  assert(Object.isFrozen(orbit.extentChords));
  for (const index of orbit.activeChords) for (const vertex of [orbit.verticesM[index]!, orbit.verticesM[(index + 1) % orbit.verticesM.length]!]) {
    assert(Math.hypot(...vertex.map((value, axis) => value - orbit.bounds.centerM[axis]!)) <= orbit.bounds.radiusM,
      'prepared bound includes every active endpoint and therefore its convex chords');
  }
  assert(Math.abs(orbit.verticesM[8]![0] - 987) < 1e-10, 'apocentre must remain around the parent, not the global origin');
  for (const [x, y, z] of orbit.verticesM) {
    assert(Math.abs(((x - 997) / 10) ** 2 + (y / Math.sqrt(91)) ** 2 - 1) < 1e-12);
    assert.equal(z, 0);
  }
  assert.throws(() => prepareWorldContext(config, facts, { ...states,
    satellite: { ...states.satellite!, centerPositionM: [0, 0, 0] } }), /parent/);
  assert.throws(() => prepareWorldContext(config, facts, { ...states,
    parent: { ...states.parent!, centerBodyId: 'satellite', centerPositionM: states.satellite!.positionM } }), /hierarchy/);

  // A coordinate-only primary carries no body facts and emits no marker.
  const visible = { ...config, bodies: [bodies[1]!] };
  const visibleStates = { satellite: states.satellite! };
  const centers = { parent: { positionM: states.parent!.positionM, centerBodyId: source.focus.id } };
  const hiddenParent = prepareWorldContext(visible, { satellite: facts.satellite }, visibleStates, centers);
  assert.deepEqual(hiddenParent.bodies.map(body => body.id), ['satellite']);
  assert.deepEqual(hiddenParent.bodies[0]!.orbit!, orbit);
  assert.deepEqual(hiddenParent.orbitCenters, centers);
  assert.throws(() => prepareWorldContext(visible, facts, visibleStates), /parent/);
  assert.throws(() => prepareWorldContext(visible, facts, visibleStates,
    { parent: { ...centers.parent, positionM: [1001, 0, 0] } }), /parent/);
  assert.throws(() => prepareWorldContext(visible, facts, visibleStates,
    { parent: { ...centers.parent, centerBodyId: 'satellite' } }), /hierarchy/);
  assert.throws(() => prepareWorldContext(visible, facts, visibleStates,
    { parent: { ...centers.parent, centerBodyId: 'missing' } }), /hierarchy/);
  assert.throws(() => prepareWorldContext(config, facts, states, centers), /duplicates/);
  assert.throws(() => prepareWorldContext(visible, facts, visibleStates,
    { parent: { ...centers.parent, positionM: [NaN, 0, 0] } }), /finite/);
  assert.throws(() => prepareWorldContext(visible, facts, visibleStates,
    { ...centers, unused: { positionM: [0, 0, 0], centerBodyId: 'unused' } }), /hierarchy/);
});

test('classification views share the root candidate angles and enclose their members\' positions', async () => {
  const source = parseWorldContextSource(await readSource() as unknown);
  const bodies = [{ id: 'parent', name: 'Parent', color: '#888888' }, { id: 'satellite', name: 'Satellite', color: '#999999' }];
  const states: Record<string, OrbitalState> = {
    parent: { positionM: [1000, 0, 0], centerBodyId: source.focus.id, centerPositionM: [0, 0, 0],
      normal: [0, 0, 1], perihelionDirection: [1, 0, 0], semiMajorAxisM: 1000, eccentricity: 0, trueAnomalyRadians: 0 },
    satellite: { positionM: [1007, 0, 0], centerBodyId: 'parent', centerPositionM: [1000, 0, 0],
      normal: [0, 0, 1], perihelionDirection: [1, 0, 0], semiMajorAxisM: 10, eccentricity: .3, trueAnomalyRadians: 0 },
  };
  const config = { ...source, bodies, orbit: { ...source.orbit!, segments: 16 } };
  const facts = { parent: { radiusM: 2, classification: 'planet' }, satellite: { radiusM: 1, classification: 'satellite' } };
  const policy = { minimumRadiusShare: .2, elevationsDegrees: [30, 45, 60], azimuthStepDegrees: 15 };
  const context = prepareWorldContext(config, facts, states, {}, policy);
  assert.deepEqual(Object.keys(context.classificationViews ?? {}), ['planet', 'satellite']);
  const view = context.classificationViews!.satellite!;
  assert.deepEqual(view.memberIds, ['satellite']);
  assert.deepEqual(view.memberRadiiM, [1]);
  assert.equal(view.candidates.length, 72);
  for (const [index, candidate] of view.candidates.entries()) {
    assert.deepEqual(candidate.cameraToReference, context.focus.systemView!.candidates[index]!.cameraToReference,
      'every classification uses the root system\'s camera angles');
    for (const [axis, value] of candidate.memberPositionsM[0]!.entries()) {
      assert.ok(value - 1 >= candidate.minimumM[axis]! - 1e-10 && value + 1 <= candidate.maximumM[axis]! + 1e-10,
        'the view encloses the member\'s current position and radius');
    }
  }
  assert.equal(prepareWorldContext(config, facts, states).classificationViews, undefined, 'views need a framing policy');
});

test('extent traversal covers each active chord once for sparse trails and uneven bank sizes', async () => {
  const source = parseWorldContextSource(await readSource());
  const body = source.bodies[0]!;
  const state: OrbitalState = { positionM: [7, 0, 0], centerBodyId: source.focus.id, centerPositionM: source.frame.originM,
    normal: [0, 0, 1], perihelionDirection: [1, 0, 0], semiMajorAxisM: 10, eccentricity: .3, trueAnomalyRadians: 0 };
  for (const segments of [8, 9, 16, 127, 128]) for (const orbitStyle of ['closed', 'trail'] as const) {
    const context = prepareWorldContext({ ...source, bodies: [body], orbit: { ...source.orbit!, segments } },
      { [body.id]: { radiusM: 1, orbitStyle } }, { [body.id]: state });
    const orbit = context.bodies[0]!.orbit!;
    assert.deepEqual([...orbit!.extentChords].sort((a, b) => a - b), orbit.activeChords);
    assert.equal(new Set(orbit.extentChords).size, orbit.activeChords.length);
    assert(orbit.extentChords.every(index => orbit.trail[index]! > 0));
    assert(Object.isFrozen(orbit.extentChords));
    assert(Math.abs(orbit.extentChords[0]! - orbit.extentChords[1]!) >= Math.floor(orbit.activeChords.length / 2),
      'initial probes span the trail so a saturated fade need not walk consecutive chords');
  }
});

test('prepared sky registration preserves the legacy default sky and rejects a missing baseline', async () => {
  const raw = await readSource() as Record<string, unknown>;
  const source = parseWorldContextSource(raw);
  const result = prepareWorldContext({ ...source, bodies: [] }, {}, {}) as unknown as Record<string, unknown>;
  const sky = result.sky as { sceneRegistration: string };
  assert(sky, 'world context must prepare a scene-locked sky registration');
  const matrix = sky.sceneRegistration.slice(9, -1).split(',').map(Number);
  const apply = (v: readonly number[]) => [0, 1, 2].map(row => matrix[row]! * v[0]! + matrix[row + 4]! * v[1]! + matrix[row + 8]! * v[2]!);
  function rotate(v: readonly number[], axis: number, degrees: number) {
    const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), [x, y, z] = v as [number, number, number];
    return axis === 0 ? [x, c*y-s*z, s*y+c*z] : axis === 1 ? [c*x+s*z, y, -s*x+c*z] : [c*x-s*y, s*x+c*y, z];
  }
  for (const direction of [[1,0,0], [0,1,0], [0,0,1]]) {
    // Existing Sun default: scene Rx(40) Ry(-105); sky Ry(105) Rx(20) Rz(66).
    const actual = rotate(rotate(apply(direction), 1, -105), 0, 40);
    const expected = rotate(rotate(rotate(direction, 2, 66), 0, 20), 1, 105);
    assert(Math.hypot(...actual.map((value, index) => value - expected[index]!)) < 2e-12);
  }
  assert.throws(() => parseWorldContextSource({ ...raw, sky: undefined }), /sky/i);
});

test('a centred caption survives preparation and any other placement is refused', async () => {
  const raw = await readSource();
  const body = { ...raw.bodies[0], labelPlacement: 'centre' };
  const source = parseWorldContextSource({ ...raw, bodies: [body] });
  const states = { [body.id]: { positionM: [7, 0, 0], centerBodyId: source.focus.id,
    centerPositionM: source.frame.originM, normal: [0, 0, 1], perihelionDirection: [1, 0, 0],
    semiMajorAxisM: 10, eccentricity: .3, trueAnomalyRadians: 0 } } as Record<string, OrbitalState>;
  assert.equal(prepareWorldContext(source, { [body.id]: { radiusM: 1 } }, states).bodies[0]!.labelPlacement, 'centre');
  assert.throws(() => parseWorldContextSource({ ...raw, bodies: [{ ...body, labelPlacement: 'below' }] }), /label placement is below, not centre/);
});
