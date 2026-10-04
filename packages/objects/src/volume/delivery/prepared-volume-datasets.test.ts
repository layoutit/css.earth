import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PreparedCssVolume } from './css-volume-types.js';
import { validatePreparedCssVolume } from './css-volume-validation.js';
import type { VolumeVector } from '../../density-volume.js';
import { validatePreparedCataloguePoints, type PreparedCataloguePoints } from '../catalogue/prepared-catalogue-points.js';
import { validatePreparedVolumeDatasets, type PreparedVolumeDatasets } from './prepared-volume-datasets.js';

const frame = { referenceFrame: 'fixture', epochJdTt: 123, originM: [0, 0, 0] as const,
  localToReferenceXyzw: [0, 0, 0, 1] as const, metersPerUnit: 1,
  boundsUnits: { min: [-1, -1, -1] as const, max: [1, 1, 1] as const } };
const points = (): PreparedCataloguePoints => ({ frame, points: [
  { id: 'catalogue:a', positionUnits: [-1, 1, 0], sizePx: 2, colorCss: '#ffeecc', opacity: .7 },
  { id: 'catalogue:behind', positionUnits: [0, 0, 20], sizePx: 2, colorCss: '#ffffff', opacity: 1 },
  { id: 'catalogue:removed', positionUnits: [0, 0, 0], sizePx: 2, colorCss: '#ffffff', opacity: 0 },
] });
const volume = (id: string, atlasOffset = 0, geometryOffset = 0): PreparedCssVolume => ({ schema: 'cssearth-css-volume@1', id, frame, anchors: [],
  stacks: (['x', 'y', 'z'] as const).map(axis => ({ axis, leaves: [{ id: `${axis}-0`, centerUnits: [0, 0, 0],
    texturePath: `${id}/${axis}.webp`, widthPx: 1, heightPx: 1,
    style: { width: '1px', height: '1px', transform: `matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,${axis === 'x' ? geometryOffset : 0},0,0,1)`,
      backgroundSize: '3px 1px', backgroundPosition: `${atlasOffset}px 0px` } }] })),
  resources: ['x', 'y', 'z'].map(axis => ({ path: `${id}/${axis}.webp`, bytes: 1, width: 1, height: 1 })),
  provenance: {}, approximation: {},
});
const payload = (): PreparedVolumeDatasets => ({ schema: 'cssearth-volume-datasets@1', id: 'fixture', defaultDataset: 'first', framingRadiusUnits: 1,
  datasets: ['first', 'second', 'third'].map((id, index) => ({ id, label: id, title: `${id} dataset`, description: 'Prepared observation',
    sourceUrl: 'https://example.org/source', volume: volume(id, -index), brightness: { overall: .8, x: .2, y: .5, z: .9 }, stars: points() })),
});
test('malformed point payloads and dataset-specific catalogue geometry are rejected before mounting', () => {
  const p = points();
  for (const altered of [{ ...p, points: [p.points[0], p.points[0]] },
    { ...p, points: [{ ...p.points[0], sizePx: NaN }] }, { ...p, points: [{ ...p.points[0], opacity: 1.1 }] },
    { ...p, points: [{ ...p.points[0], colorCss: 'url(unsafe)' }] }]) assert.throws(() => validatePreparedCataloguePoints(altered));
  const data = payload(), second = data.datasets[1];
  const moved = { ...second.stars, points: second.stars.points.map(point => ({ ...point, positionUnits: [1, 2, 3] as VolumeVector })) };
  assert.throws(() => validatePreparedVolumeDatasets({ ...data, datasets: [data.datasets[0], { ...second, stars: moved }] }), /same catalogue geometry/);
  assert.throws(() => validatePreparedVolumeDatasets({ ...data, defaultDataset: 'absent' }), /default/);
  assert.throws(() => validatePreparedVolumeDatasets({ ...data, datasets: [data.datasets[0], data.datasets[0]] }), /content/);
  assert.throws(() => validatePreparedVolumeDatasets({ ...data, pointVisibility: { hiddenBelowRadiusPixels: 24, fullAboveRadiusPixels: 2 } }), /thresholds/);
  assert.throws(() => validatePreparedVolumeDatasets({ ...data, datasets: [{ ...data.datasets[0], brightness: { overall: 2, x: 1, y: 1, z: 1 } }] }), /brightness/);
});


test('nearby volume visibility is explicit and rejects unknown policies', () => {
  assert.equal(validatePreparedVolumeDatasets({ ...payload(), contextVisibility: 'independent' }).contextVisibility, 'independent');
  assert.equal(validatePreparedVolumeDatasets(payload()).contextVisibility, 'galactic');
  assert.throws(() => validatePreparedVolumeDatasets({ ...payload(), contextVisibility: 'maybe' }));
});

test('a validated bank, volume or catalogue handed back is answered as it is, and a copy of it is read again', () => {
  const bank = validatePreparedVolumeDatasets(payload()), first = bank.datasets[0]!;
  assert.equal(validatePreparedVolumeDatasets(bank), bank);
  assert.equal(validatePreparedCssVolume(first.volume), first.volume);
  assert.equal(validatePreparedCataloguePoints(first.stars), first.stars);
  assert.ok(Object.isFrozen(first.volume));
  // A copy is another object: it is read, and refused when it is wrong.
  assert.notEqual(validatePreparedCssVolume({ ...first.volume }), first.volume);
  assert.throws(() => validatePreparedCssVolume({ ...first.volume, id: 'Not An Id' }), /identity/);
  assert.throws(() => validatePreparedCataloguePoints({ ...first.stars, points: [{ ...first.stars.points[0]!, opacity: 2 }] }));
  assert.throws(() => validatePreparedVolumeDatasets({ ...bank, defaultDataset: 'absent' }), /default/);
});
