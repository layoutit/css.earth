import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseWorldContextSource, prepareWorldContext } from './spatial-context.js';

const sourcePath = 'src/planets/sun/source/navigation/universe.json';

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
  assert.equal(source.camera.presentation.dolly.maximumDistanceOverOrbitExtent, 1);
  assert.throws(() => parseWorldContextSource({ ...raw, frame: { ...(raw.frame as Record<string, unknown>), metersPerUnit: 1 } }), /metres per unit/);
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
      [body.id]: { positionM: [7, 0, 0], normal: [0, 0, 1], perihelionDirection: [1, 0, 0], semiMajorAxisM: 10, eccentricity: .3, trueAnomalyRadians: 0 },
    });
  assert.deepEqual(result.bodies[0]!.positionM, result.bodies[0]!.orbit.verticesM[0]);
  assert.equal(result.bodies[0]!.orbit.verticesM.length, 16);
  assert.equal(result.bodies[0]!.orbit.trail.length, 16);
  assert.deepEqual(result.focus.positionM, [0, 0, 0]);
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
