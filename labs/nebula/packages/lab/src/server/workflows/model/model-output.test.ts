import assert from 'node:assert/strict';
import test from 'node:test';
import { ellipsePoints, LAB_MODEL_SCHEMA, readLabModel } from './model-output.ts';
import { fitSlit, slitRms } from './kinematic-model.ts';
import { shellVelocities } from '@cssearth/nebula-reconstruction/methods/kinematics/forward-model';
import { labRunArguments } from '../../routes/lab-object.ts';
import type { LabObject } from '../lab-objects.ts';

const model = () => ({ schema: LAB_MODEL_SCHEMA, id: 'm2-9-volume', method: 'symmetry', createdAt: '2026-10-09T00:00:00Z',
  image: { path: 'src/objects/m2-9-volume/.local/lab/model/image.png', width: 788, height: 438, label: 'B. Balick' },
  outlines: [{ id: 'envelope-0', label: 'Envelope', kind: 'envelope', closed: true, points: [[1, 2], [3, 4], [5, 1]] }], points: [],
  surfaces: [{ kind: 'surface', label: 'Envelope', values: { tiltDeg: 89, receding: '+z' } }], metrics: { arcsecPerCell: .403, projectionError: null },
  files: ['src/objects/m2-9-volume/.local/lab/model/surface.stl'], notes: ['Axis assumed in the sky plane.'] });

test('a model result reads whole and refuses an unknown method, a one-point outline or a non-number metric', () => {
  assert.equal(readLabModel(model()).outlines[0]!.points.length, 3);
  assert.throws(() => readLabModel({ ...model(), method: 'volume' }), /method is one of/);
  assert.throws(() => readLabModel({ ...model(), outlines: [{ ...model().outlines[0]!, points: [[1, 2]] }] }), /two or more points/);
  assert.throws(() => readLabModel({ ...model(), metrics: { rms: [1] } }), /metrics/);
  const ring = ellipsePoints(10, 10, 4, 2, 90, 4);
  assert.ok(ring.every(([x, y], index) => Math.abs(x - [10, 8, 10, 12][index]!) < 1e-9 && Math.abs(y - [14, 10, 6, 10][index]!) < 1e-9));
});

test('the slit fit finds the ellipsoid its points were drawn from', () => {
  const truth = { radiusArcsec: 120, inclinationDegrees: 30, depthRatio: 1.5, expansionKmS: 20 };
  const points = [-90, -60, -30, 0, 30, 60, 90].flatMap(offsetArcsec => shellVelocities(offsetArcsec, truth)!.map(relativeKmS => ({ offsetArcsec, relativeKmS })));
  assert.equal(slitRms(points, truth), 0);
  const fit = fitSlit(points, truth.radiusArcsec);
  assert.ok(fit.rms < 1e-9, `rms ${fit.rms}`);
  assert.equal(slitRms(points, fit.parameters), fit.rms);
  assert.ok(slitRms(points, { ...truth, expansionKmS: 25 })! > 1);
  // A point beyond every ellipsoid's outline along the slit refuses the grid.
  assert.throws(() => fitSlit([{ offsetArcsec: 200, relativeKmS: 0 }], truth.radiusArcsec), /No ellipsoid/);
});

test('a button runs only research, model with a known method, or stars, on a configured object', () => {
  const objects = [{ id: 'helix-layers' }] as LabObject[];
  assert.deepEqual(labRunArguments({ command: 'research', object: 'helix-layers' }, objects), ['research', 'helix-layers']);
  assert.deepEqual(labRunArguments({ command: 'model', object: 'helix-layers', method: 'kinematic' }, objects), ['model', 'helix-layers', '--method', 'kinematic']);
  assert.throws(() => labRunArguments({ command: 'bake', object: 'helix-layers' }, objects), /research, model or stars/);
  assert.throws(() => labRunArguments({ command: 'model', object: 'helix-layers', method: 'volume' }, objects), /model needs/);
  assert.throws(() => labRunArguments({ command: 'stars', object: 'm1-volume' }, objects), /configured lab object/);
  assert.throws(() => labRunArguments({ command: 'stars', object: 'helix-layers', method: 'symmetry' }, objects), /Only model/);
});
