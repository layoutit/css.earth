import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePreparedCssVolume } from './css-volume-validation.js';
import type { PreparedCssVolume } from './css-volume-types.js';

const valid = (): PreparedCssVolume => ({
  schema: 'cssearth-css-volume@1', id: 'milky-way',
  frame: { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [0, 0, 0],
    localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1,
    boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
  anchors: [],
  stacks: [{ axis: 'x', leaves: [{ id: 'x-0', centerUnits: [0, 0, 0], texturePath: 'slices/x/00.png', widthPx: 2, heightPx: 2,
    style: { width: '2px', height: '2px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } }] },
    { axis: 'y', leaves: [{ id: 'y-0', centerUnits: [0, 0, 0], texturePath: 'slices/y/00.png', widthPx: 2, heightPx: 2,
      style: { width: '2px', height: '2px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } }] },
    { axis: 'z', leaves: [{ id: 'z-0', centerUnits: [0, 0, 0], texturePath: 'slices/z/00.png', widthPx: 2, heightPx: 2,
      style: { width: '2px', height: '2px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } }] }],
  resources: ['x', 'y', 'z'].map(axis => ({ path: `slices/${axis}/00.png`, bytes: 2, width: 2, height: 2 })),
  provenance: {}, approximation: {},
});

test('accepts the direct prepared CSS volume payload and all three stacks', () => {
  assert.equal(validatePreparedCssVolume(valid()).stacks.length, 3);
});

test('directional faces hide their backs and cannot reuse a double-sided topology', async () => {
  const value = valid();
  Object.assign(value.stacks[0]!.leaves[0]!.style, { backfaceVisibility: 'hidden' });
  assert.equal(validatePreparedCssVolume(value).stacks[0]!.leaves[0]!.style.backfaceVisibility, 'hidden');
  const { samePreparedVolumeTopology } = await import('./prepared-volume-topology.js');
  assert.equal(samePreparedVolumeTopology(value, valid()), false);
  Object.assign(value.stacks[0]!.leaves[0]!.style, { backfaceVisibility: 'visible' });
  assert.throws(() => validatePreparedCssVolume(value), /hide its backface/);
});

test('rejects a runtime URL in authored leaf style', () => {
  const value = valid();
  Object.assign(value.stacks[0]!.leaves[0]!, { style: { ...value.stacks[0]!.leaves[0]!.style, transform: 'url(/runtime.png)' } });
  assert.throws(() => validatePreparedCssVolume(value), /URL-free/);
});

test('rotated bank normals must remain an orthonormal basis', () => {
  const value = valid();
  const normals = [[0, 1, 0], [-1, 0, 0], [0, 0, 1]];
  value.stacks.forEach((stack, i) => Object.assign(stack, { normalUnits: normals[i] }));
  assert.deepEqual(validatePreparedCssVolume(value).stacks[0]!.normalUnits, [0, 1, 0]);
  Object.assign(value.stacks[1]!, { normalUnits: [0, 1, 0] }); assert.throws(() => validatePreparedCssVolume(value), /orthogonal/);
  Object.assign(value.stacks[1]!, { normalUnits: [0, 2, 0] }); assert.throws(() => validatePreparedCssVolume(value), /unit vector/);
});

test('keeps a merged-copies declaration of exactly three, and refuses any other count', () => {
  assert.equal(validatePreparedCssVolume({ ...valid(), mergedOpticalCopies: 3 }).mergedOpticalCopies, 3);
  assert.equal(validatePreparedCssVolume(valid()).mergedOpticalCopies, undefined);
  for (const count of [1, 2, 4, '3', null]) assert.throws(() => validatePreparedCssVolume({ ...valid(), mergedOpticalCopies: count }), /exactly three optical copies/);
});

test('merged and unmerged copies of the same geometry are different topology', async () => {
  const { samePreparedVolumeTopology } = await import('./prepared-volume-topology.js');
  assert.equal(samePreparedVolumeTopology(valid(), valid()), true);
  assert.equal(samePreparedVolumeTopology(valid(), { ...valid(), mergedOpticalCopies: 3 }), false);
  assert.equal(samePreparedVolumeTopology({ ...valid(), mergedOpticalCopies: 3 }, { ...valid(), mergedOpticalCopies: 3 }), true);
});

test('fixed images preserve their explicit single-stack mode and reject ambiguous image policies', async () => {
  const source = valid(), fixed = { ...source, fixedImages: true as const,
    stacks: source.stacks.map(stack => stack.axis === 'z' ? stack : { ...stack, leaves: [] }) };
  const parsed = validatePreparedCssVolume(JSON.parse(JSON.stringify(fixed)));
  assert.equal(parsed.fixedImages, true);
  assert.equal(validatePreparedCssVolume(valid()).fixedImages, undefined);
  for (const invalid of [false, null, 1, 'true']) assert.throws(() => validatePreparedCssVolume({ ...fixed, fixedImages: invalid }), /must be true/);
  for (const incompatible of [{ mergedOpticalCopies: 3 }, { impostors: {} }, { farPlanes: {} }])
    assert.throws(() => validatePreparedCssVolume({ ...fixed, ...incompatible }), /exactly one populated stack/);
  assert.throws(() => validatePreparedCssVolume({ ...source, fixedImages: true }), /exactly one populated stack/);
  assert.throws(() => validatePreparedCssVolume({ ...fixed, stacks: fixed.stacks.map(stack => ({ ...stack, leaves: [] })) }), /exactly one populated stack/);
  const { samePreparedVolumeTopology } = await import('./prepared-volume-topology.js');
  const { fixedImages: _, ...optical } = fixed;
  assert.equal(samePreparedVolumeTopology(fixed, optical), false);
  assert.equal(samePreparedVolumeTopology(fixed, parsed), true);
});

const withFarPlanes = (): PreparedCssVolume => {
  const volume = valid();
  return { ...volume, resources: [...volume.resources, ...['side.png', 'side-high.png'].map(path => ({ path, bytes: 2, width: 32, height: 2 }))],
    farPlanes: { gainBlend: [{ axis: 'z', samples: [[1, .001], [3, .8]] }], radiusUnits: 1, belowDiameterPixels: 300,
      stacks: volume.stacks.filter(stack => stack.axis === 'z').map(stack => ({ ...stack,
        leaves: [0, 1].flatMap(level => stack.leaves.map(leaf => ({ ...leaf, id: `far-z-${level}` }))) })),
      side: { views: 16, highTexturePath: 'side-high.png', coefficients: Array.from({ length: 16 }, () => [[0, 1, 0], [90, 1, 0]]),
        leaf: { id: 'side', centerUnits: [0, 0, 0], texturePath: 'side.png', widthPx: 2, heightPx: 2,
          style: { width: '2px', height: '2px', backgroundSize: '2px 2px', backgroundPosition: '0px 0px',
            transform: 'matrix3d(1,0,0,0,0,0,-1,0,0,1,0,0,-1,0,1,1)' } } } } };
};

test('far planes validate their thresholds, a fixed top pair and a declared 16-view cylindrical side atlas and uncropped styles', () => {
  assert.equal(validatePreparedCssVolume(withFarPlanes()).farPlanes!.stacks.length, 1);
  const mutations = [
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!.gainBlend[0]!, { samples: [[1, .001], [1, .8]] }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!.gainBlend[0]!, { samples: [[1, .001], [3, 1]] }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!.gainBlend[0]!, { samples: [[1, .001], [3, NaN]] }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!.gainBlend[0]!, { samples: [[1.1, .001], [3, .8]] }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!.gainBlend[0]!, { axis: 'x' }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!.stacks[0]!.leaves[1]!.style, { width: '3px' }),
    (volume: PreparedCssVolume) => Reflect.deleteProperty(volume.farPlanes!, 'gainBlend'),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!, { gainBlend: [] }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!, { belowDiameterPixels: 0 }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!, { radiusUnits: Infinity }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!, { extra: 1 }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!, { stacks: volume.farPlanes!.stacks.slice(1) }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!.stacks[0]!, { axis: 'x' }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!.stacks[0]!, { leaves: [] }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!.stacks[0]!.leaves[0]!, { centerUnits: [0, 0, 1] }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!.stacks[0]!.leaves[0]!, { texturePath: 'missing.png' }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!.stacks[0]!.leaves[0]!.style, { backgroundPosition: '1px 0px' }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!.stacks[0]!.leaves[0]!.style, { transform: 'matrix3d(1,0,0,0,0,0,1,0,0,1,0,0,0,50,0,1)' }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!.stacks[0]!.leaves[0]!.style, { transform: 'matrix3d(0,1,0,0,0,0,1,0,1,0,0,0,0,0,0,1)' }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!.side, { views: 15 }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!.side, { highTexturePath: 'missing.png' }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!.side, { coefficients: [[[0, 1, 0], [90, 1, 0]]] }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!.side.coefficients[0]!, { 0: [0, NaN, 0] }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!.side.coefficients[0]!, { 1: [0, 1, 0] }),
    (volume: PreparedCssVolume) => Object.assign(volume.farPlanes!.side.leaf.style, { transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)' }),
  ];
  for (const mutate of mutations) { const volume = structuredClone(withFarPlanes()); mutate(volume); assert.throws(() => validatePreparedCssVolume(volume)); }
});

test('far plane topology retains geometry and thresholds but permits a replacement material', async () => {
  const { samePreparedVolumeTopology } = await import('./prepared-volume-topology.js');
  assert.equal(samePreparedVolumeTopology(withFarPlanes(), valid()), false);
  assert.equal(samePreparedVolumeTopology(withFarPlanes(), withFarPlanes()), true);
  const changed = withFarPlanes(); Object.assign(changed.farPlanes!, { belowDiameterPixels: 301 });
  assert.equal(samePreparedVolumeTopology(withFarPlanes(), changed), false);
  const geometry = structuredClone(withFarPlanes()); for (const leaf of geometry.farPlanes!.stacks[0]!.leaves) Object.assign(leaf.style, { width: '3px', backgroundSize: '3px 2px' });
  assert.equal(samePreparedVolumeTopology(withFarPlanes(), geometry), false);
  const material = structuredClone(withFarPlanes());
  Object.assign(material.farPlanes!.stacks[0]!.leaves[0]!, { texturePath: 'slices/y/00.png' });
  assert.equal(samePreparedVolumeTopology(withFarPlanes(), material), true);
  const reordered = withFarPlanes(), leaf = reordered.farPlanes!.side.leaf;
  Object.assign(reordered.farPlanes!.side, { leaf: { style: leaf.style, widthPx: leaf.widthPx, heightPx: leaf.heightPx,
    texturePath: 'side-high.png', centerUnits: leaf.centerUnits, id: leaf.id } });
  assert.equal(samePreparedVolumeTopology(withFarPlanes(), reordered), true, 'material JSON key order is not geometry');
});
