import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseWorldContextSource, prepareWorldContext } from './spatial-context.js';
import type { OrbitalState } from './spatial-context.js';

const sourcePath = 'src/planets/sun/source/navigation/universe.json';

test('prepared volume opacity preserves authored grading and validates bounded levels and ordered distances', async () => {
  const raw = JSON.parse(await readFile(sourcePath, 'utf8'));
  const source = parseWorldContextSource(raw), profile = source.volume.opacityProfile!;
  assert.deepEqual(profile, raw.volume.opacityProfile);
  assert.equal(profile.nearOpacity, 0); assert.equal(profile.fullOpacity, 1);
  assert(profile.fadeStartDistanceM > source.system.hiddenDistanceM, 'NASA stays opaque throughout the prepared Solar System');
  const brightness = source.volume.brightnessProfile!;
  assert.deepEqual(brightness, raw.volume.brightnessProfile);
  assert(profile.fullDistanceM < brightness.fadeStartDistanceM, 'the physical volume owns the view before exterior brightening');
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
  const raw = JSON.parse(await readFile(sourcePath, 'utf8')) as Record<string, unknown>;
  const expected = { objectId:'stellar-neighbourhood',fadeStartDistanceM:1.495978707e13,fullDistanceM:3.085677581491367e15 };
  const source = parseWorldContextSource(raw);
  const prepared = prepareWorldContext({...source,bodies:[]},{},{}) as unknown as Record<string,unknown>;
  assert.deepEqual(prepared.stars,expected,'prepared world must retain the authored stellar handoff');
  assert.throws(()=>parseWorldContextSource({...raw,stars:undefined}),/stars/i);
  assert.throws(()=>parseWorldContextSource({...raw,stars:{...expected,fullDistanceM:expected.fadeStartDistanceM}}),/stars/i);
  assert.throws(()=>parseWorldContextSource({...raw,stars:{...expected,fullDistanceM:source.volume.fadeStartDistanceM+1e20}}),/stars/i);
});

test('Sun context source derives its physical scale from the prepared visible radius', async () => {
  const raw = JSON.parse(await readFile(sourcePath, 'utf8')) as Record<string, unknown>;
  const source = parseWorldContextSource(raw);
  assert.equal(source.frame.bodyRadiusM / source.frame.metersPerUnit, 310);
  assert.equal(source.system.fadeOutStartDistanceM, 1e14);
  assert.equal(source.system.hiddenDistanceM, 1e15);
  assert(source.system.hiddenDistanceM < source.stars.fullDistanceM);
  assert.equal(source.camera.framingReferenceZoom, 1);
  assert.deepEqual(source.focus.pointSource,{absoluteMagnitude:4.832125665882298,color:'#fff5e0',
    proximityEnhancement:{fullDistanceM:1e12,fadeOutDistanceM:1e14,radiusMultiplier:1.6,brightnessMultiplier:1.5}});
  const prepared = prepareWorldContext({ ...source, bodies: [] }, {}, {});
  assert.deepEqual(prepared.focus.pointSource,source.focus.pointSource,'prepared focus must preserve authored far-point photometry');
  assert.equal(source.camera.presentation.dolly.maximumDistanceOverOrbitExtent, 1);
  assert.throws(() => parseWorldContextSource({ ...raw, frame: { ...(raw.frame as Record<string, unknown>), metersPerUnit: 1 } }), /metres per unit/);
  assert.throws(() => parseWorldContextSource({ ...raw, focus: { ...(raw.focus as Record<string, unknown>), pointSource: { absoluteMagnitude: Number.NaN, color: '#fff5e0' } } }), /point/i);
  assert.throws(() => parseWorldContextSource({ ...raw, focus: { ...(raw.focus as Record<string, unknown>), pointSource: { absoluteMagnitude: 4.83, color: 'yellow' } } }), /color/i);
  assert.throws(() => parseWorldContextSource({ ...raw, focus: { ...(raw.focus as Record<string, unknown>), pointSource: { ...(raw.focus as { pointSource: Record<string, unknown> }).pointSource,
    proximityEnhancement: { fullDistanceM: 1e14, fadeOutDistanceM: 1e12, radiusMultiplier: .9, brightnessMultiplier: 1.5 } } } }), /proximity/i);
  assert.throws(() => parseWorldContextSource({ ...raw, focus: raw.bodies![0] }), /exclude the focus/);
  const camera = raw.camera as Record<string, unknown>;
  const presentation = camera.presentation as Record<string, unknown>;
  assert.throws(() => parseWorldContextSource({ ...raw, camera: { ...camera, presentation: { ...presentation, dolly: { ...(presentation.dolly as Record<string, unknown>), wheelStepPerDelta: 0 } } } }), /wheel step/);
});

test('prepared ellipses start at their same-epoch ephemeris position', async () => {
  const source = parseWorldContextSource(JSON.parse(await readFile(sourcePath, 'utf8')) as unknown);
  const body = source.bodies[0]!;
  const result = prepareWorldContext({ ...source, bodies: [body], orbit: { ...source.orbit, segments: 16 } },
    { [body.id]: { radiusM: 1 } }, {
      [body.id]: { positionM: [7, 0, 0], centerBodyId: source.focus.id, centerPositionM: source.frame.originM, normal: [0, 0, 1], perihelionDirection: [1, 0, 0], semiMajorAxisM: 10, eccentricity: .3, trueAnomalyRadians: 0 },
    });
  assert.deepEqual(result.bodies[0]!.positionM, result.bodies[0]!.orbit.verticesM[0]);
  assert.equal(result.bodies[0]!.orbit.verticesM.length, 16);
  assert.equal(result.bodies[0]!.orbit.trail.length, 16);
  assert.deepEqual(result.focus.positionM, [0, 0, 0]);
});

test('satellite ellipses are translated to their parent with exact prepared centres', async () => {
  const source = parseWorldContextSource(JSON.parse(await readFile(sourcePath, 'utf8')) as unknown);
  const bodies = [{ id: 'parent', name: 'Parent', color: '#888888' }, { id: 'satellite', name: 'Satellite', color: '#999999' }];
  const states: Record<string, OrbitalState> = {
    parent: { positionM: [1000, 0, 0], centerBodyId: source.focus.id, centerPositionM: [0, 0, 0],
      normal: [0, 0, 1], perihelionDirection: [1, 0, 0], semiMajorAxisM: 1000, eccentricity: 0, trueAnomalyRadians: 0 },
    satellite: { positionM: [1007, 0, 0], centerBodyId: 'parent', centerPositionM: [1000, 0, 0],
      normal: [0, 0, 1], perihelionDirection: [1, 0, 0], semiMajorAxisM: 10, eccentricity: .3, trueAnomalyRadians: 0 },
  };
  const config = { ...source, bodies, orbit: { ...source.orbit, segments: 16 } };
  const facts = { parent: { radiusM: 2 }, satellite: { radiusM: 1 } };
  const orbit = prepareWorldContext(config, facts, states).bodies[1]!.orbit;
  assert.deepEqual(orbit.centerPositionM, states.parent!.positionM);
  assert.equal(orbit.centerBodyId, 'parent');
  assert.deepEqual(orbit.verticesM[0], [1007, 0, 0]);
  assert(Math.abs(orbit.verticesM[8]![0] - 987) < 1e-10, 'apocentre must remain around the parent, not the global origin');
  for (const [x, y, z] of orbit.verticesM) {
    assert(Math.abs(((x - 997) / 10) ** 2 + (y / Math.sqrt(91)) ** 2 - 1) < 1e-12);
    assert.equal(z, 0);
  }
  assert.throws(() => prepareWorldContext(config, facts, { ...states,
    satellite: { ...states.satellite!, centerPositionM: [0, 0, 0] } }), /parent/);
  assert.throws(() => prepareWorldContext(config, facts, { ...states,
    parent: { ...states.parent!, centerBodyId: 'satellite', centerPositionM: states.satellite!.positionM } }), /hierarchy/);
});

test('prepared sky registration preserves the legacy default sky and rejects a missing baseline', async () => {
  const raw = JSON.parse(await readFile(sourcePath, 'utf8')) as Record<string, unknown>;
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
