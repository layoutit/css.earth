/** The candidate orbits read from a LOFTI results file must reproduce the measurement they were fitted to: every one of them
 * puts the companion at the measured separation and position angle at the fit's reference epoch. That is what LOFTI's scale and
 * rotate step enforces, so it checks this project's reading of its columns and of its sky frame, not the fit itself. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { candidateOrbitFrame, candidateOrbitalState, candidateRelativePositionAu, parseOrbitFamilyRecord, readLoftiOrbits,
  separationArcseconds, trueAnomalyAt } from './binary-orbit-family.mts';

const source = resolve(import.meta.dirname, '../../src/objects/hd-189733-companion/source');
const read = async (path: string) => readFile(resolve(source, path), 'utf8');

test('HD 189733 B\'s candidate orbits reproduce the measured separation and position angle', async () => {
  const record = parseOrbitFamilyRecord(JSON.parse(await read('orbits/orbit-family.json')));
  assert.deepEqual([record.primary, record.displayed], ['hd-189733', 24]);
  const orbits = readLoftiOrbits(await read(record.path), record.displayed);
  assert.equal(orbits.length, 24);
  for (const [index, elements] of orbits.entries()) {
    const position = candidateRelativePositionAu(elements, 2016);
    const separation = separationArcseconds(position, elements.distanceParsecs);
    const positionAngle = (Math.atan2(position[1], position[0]) * 180 / Math.PI + 360) % 360;
    // Gaia DR3: 11.4423 arcsec at position angle 244.348 degrees, at epoch 2016.0. LOFTI solves Kepler's equation to 0.001
    // radians, which moves a wide orbit's position by up to about 0.06 arcsec here; that is the tolerance, not the measurement's.
    assert.ok(Math.abs(separation - 11.4423) < 0.07, `orbit ${index + 1} separation ${separation}`);
    assert.ok(Math.abs(positionAngle - 244.348) < 0.02, `orbit ${index + 1} position angle ${positionAngle}`);
    // The line-of-sight offset is what the measurements leave open; the family must not agree on it.
    assert.ok(Math.abs(position[2]) < 20000, `orbit ${index + 1} depth ${position[2]} au`);
  }
  const depths = orbits.map(elements => candidateRelativePositionAu(elements, 2016)[2]);
  assert.ok(Math.max(...depths) - Math.min(...depths) > 100, 'the candidates disagree about the companion\'s depth');
  // Nearly every fitted orbit is seen close to edge-on, because B moves almost straight away from A on the sky; a few
  // eccentric ones are not. LOFTI measures the inclination from the plane of the sky over 0 to 180 degrees.
  const edgeOn = orbits.filter(elements => Math.abs(elements.inclinationDegrees - 90) < 30).length;
  assert.ok(edgeOn >= orbits.length - 3, `${edgeOn} of ${orbits.length} orbits within 30 degrees of edge-on`);
});

test('a candidate orbital state carries the orbit\'s own plane, periastron and position', async () => {
  const record = parseOrbitFamilyRecord(JSON.parse(await read('orbits/orbit-family.json')));
  const elements = readLoftiOrbits(await read(record.path), 2)[0]!;
  const axes = { north: [0, 0, 1] as const, east: [0, 1, 0] as const, towardObserver: [1, 0, 0] as const };
  const centerPositionM = [7, 8, 9] as const, metres = 149597870700;
  const state = candidateOrbitalState(elements, axes as never, 2016, centerPositionM as never, 'hd-189733');
  assert.equal(state.centerBodyId, 'hd-189733');
  assert.deepEqual([...state.centerPositionM], [...centerPositionM]);
  const relative = candidateRelativePositionAu(elements, 2016);
  // North, east and toward-observer map onto the frame's axes in that order.
  assert.ok([relative[2], relative[1], relative[0]].every((value, axis) =>
    Math.abs(state.positionM[axis]! - centerPositionM[axis]! - value * metres) < 1));
  const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, value, axis) => sum + value * b[axis]!, 0);
  assert.ok(Math.abs(dot(state.normal, state.perihelionDirection)) < 1e-12, 'the normal is perpendicular to the periastron direction');
  assert.ok(Math.abs(Math.hypot(...state.normal) - 1) < 1e-12 && Math.abs(Math.hypot(...state.perihelionDirection) - 1) < 1e-12);
  assert.ok(Math.abs(state.semiMajorAxisM / metres - elements.semiMajorAxisAu) < 1e-6);
  assert.equal(state.eccentricity, elements.eccentricity);
  // A circular orbit's true anomaly advances by a full turn over one period, and the frame's vectors stay a right-handed set.
  const circular = { periodYears: 100, periastronYear: 2000, eccentricity: 0 };
  assert.ok(Math.abs(trueAnomalyAt(circular, 2025) - Math.PI / 2) < 1e-9);
  const frame = candidateOrbitFrame({ inclinationDegrees: 0, argumentOfPeriastronDegrees: 0, longitudeOfNodeDegrees: 0 });
  const rounded = (vector: readonly number[]) => vector.map(value => Math.round(value) + 0);
  assert.deepEqual(rounded(frame.periastron), [1, 0, 0]);
  assert.deepEqual(rounded(frame.inPlane), [0, 1, 0]);
  assert.deepEqual(rounded(frame.normal), [0, 0, 1]);
});

test('an orbit family record and its results file fail closed', async () => {
  const record = JSON.parse(await read('orbits/orbit-family.json'));
  assert.throws(() => parseOrbitFamilyRecord({ ...record, schema: 'other' }), /cssearth-orbit-family@1/u);
  assert.throws(() => parseOrbitFamilyRecord({ ...record, format: 'text' }), /LOFTI results/u);
  assert.throws(() => parseOrbitFamilyRecord({ ...record, displayed: 1 }), /at least two orbits/u);
  const text = await read(record.path);
  assert.throws(() => readLoftiOrbits(text.split('\n').slice(1).join('\n'), 2), /LOFTI's own header/u);
  assert.throws(() => readLoftiOrbits(text, 100000), /fewer than the/u);
  assert.throws(() => readLoftiOrbits(`${text.split('\n')[0]}\n1 2 3\n1 2 3\n`, 2), /does not have 13 columns/u);
});
