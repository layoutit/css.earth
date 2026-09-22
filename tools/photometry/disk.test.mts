import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { diskGain, diskValue, assertDiskModel, NORMAL_GEOMETRY, type DiskModel } from './disk.mts';
import { phaseGain } from './phase.mts';

/**
 * Frozen copies of the photometric arithmetic the routes used before tools/photometry
 * existed (osiris-geo.mts, shape-camera-mosaic.mts and photometric-observations.mts at
 * main 5ca8c99d4). The library must equal them exactly, so moving a route onto it
 * cannot change a prepared byte.
 */
const legacy = {
  lommelSeeliger: (incidence: number, emission: number) => { const mu0 = Math.cos(incidence), mu = Math.cos(emission); return (mu0 + mu) / (2 * mu0); },
  minnaert: (incidence: number, emission: number, phase: number, coefficient: number, perDegree: number) => {
    const k = coefficient + perDegree * phase * 180 / Math.PI;
    return 1 / (Math.cos(incidence) ** k * Math.cos(emission) ** (k - 1));
  },
  shapeCamera: (mu0: number, mu: number, weight: number) => 1 / (2 * weight * mu0 / (mu0 + mu) + (1 - weight) * mu0),
  observedColor: (mu0: number, mu: number, weight: number, referenceIncidenceDegrees: number, referenceEmissionDegrees: number) => {
    const disk = (incidence: number, emission: number) => (1 - weight) * incidence + 2 * weight * incidence / (incidence + emission);
    const radians = Math.PI / 180;
    return disk(Math.cos(referenceIncidenceDegrees * radians), Math.cos(referenceEmissionDegrees * radians)) / disk(mu0, mu);
  },
  hgShadowHiding: (phase: number, reference: number, g: number, amplitude: number, width: number) => {
    const scattering = (angle: number) => (1 + amplitude / (1 + Math.tan(angle / 2) / width)) * (1 - g * g) / (1 + 2 * g * Math.cos(angle) + g * g) ** 1.5;
    return scattering(reference) / scattering(phase);
  },
};
const normal = NORMAL_GEOMETRY;
const angles = Array.from({ length: 90 }, (_, i) => i * Math.PI / 180 + 1e-7 * i);
const cosines = Array.from({ length: 101 }, (_, i) => Math.max(1e-3, i / 100));

test('Lommel-Seeliger and Minnaert gains equal the observation seam arithmetic bit for bit', () => {
  const ls: DiskModel = { family: 'lommel-seeliger' };
  const lutetia: DiskModel = { family: 'minnaert', coefficient: 0.5505, coefficientPerDegree: 0.005 };
  let compared = 0;
  for (const incidence of angles) for (const emission of angles) {
    const mu0 = Math.cos(incidence), mu = Math.cos(emission);
    assert.equal(diskGain(ls, { mu0, mu, phase: 0 }, normal), legacy.lommelSeeliger(incidence, emission));
    for (const phase of [0, 0.3, 0.66, 1.2]) assert.equal(diskGain(lutetia, { mu0, mu, phase }, normal), legacy.minnaert(incidence, emission, phase, 0.5505, 0.005));
    compared += 5;
  }
  assert.ok(compared > 40000);
});

test('ISIS Lunar-Lambert gains equal the camera mosaic and observed-color arithmetic for every weight in use', () => {
  let compared = 0;
  for (const weight of [0.5, 1]) for (const mu0 of cosines) for (const mu of cosines) {
    assert.equal(diskGain({ family: 'lunar-lambert', weight }, { mu0, mu, phase: 0 }, normal), legacy.shapeCamera(mu0, mu, weight), `weight ${weight} at ${mu0}, ${mu}`);
    compared++;
  }
  // Triton's observed colours reference 30° incidence at nadir emission.
  const radians = Math.PI / 180, reference = { mu0: Math.cos(30 * radians), mu: Math.cos(0 * radians), phase: 0 };
  // Observed colours carry per-observation weights, so any weight must match.
  for (const weight of [0.5, 0.123, 0.77]) for (const mu0 of cosines) for (const mu of cosines) {
    assert.equal(diskGain({ family: 'lunar-lambert', weight }, { mu0, mu, phase: 0 }, reference), legacy.observedColor(mu0, mu, weight, 30, 0));
    compared++;
  }
  assert.ok(compared > 30000);
});

test('the historical Henyey-Greenstein shadow-hiding phase ratio is reproduced exactly', () => {
  const model = { family: 'hg-shadow-hiding' as const, asymmetry: -0.37, amplitude: 2.5, width: 0.079 };
  for (const phase of angles) assert.equal(phaseGain(model, phase, 50 * Math.PI / 180), legacy.hgShadowHiding(phase, 50 * Math.PI / 180, -0.37, 2.5, 0.079));
});

test('disk functions have their defining limits and refuse invalid parameters', () => {
  const at = (model: DiskModel, mu0: number, mu: number) => diskValue(model, { mu0, mu, phase: 0 });
  assert.equal(at({ family: 'lambert' }, 0.25, 0.9), 0.25);
  assert.equal(at({ family: 'lommel-seeliger' }, 1, 1), 1);
  assert.ok(Math.abs(at({ family: 'lunar-lambert', weight: 0 }, 0.4, 0.7) - at({ family: 'lambert' }, 0.4, 0.7)) < 1e-15);
  assert.ok(Math.abs(at({ family: 'lunar-lambert', weight: 1 }, 0.4, 0.7) - at({ family: 'lommel-seeliger' }, 0.4, 0.7)) < 1e-15);
  assert.ok(Math.abs(at({ family: 'minnaert', coefficient: 1, coefficientPerDegree: 0 }, 0.4, 0.7) - 0.4) < 1e-15, 'k = 1 is Lambert');
  // Normalizing to the observed geometry itself is the identity.
  for (const model of [{ family: 'lommel-seeliger' }, { family: 'lunar-lambert', weight: 0.3 }, { family: 'minnaert', coefficient: 0.7, coefficientPerDegree: 0.002 }] as DiskModel[]) {
    const g = { mu0: 0.37, mu: 0.81, phase: 0.9 };
    assert.ok(Math.abs(diskGain(model, g, g) - 1) < 1e-14, model.family);
  }
  assert.throws(() => assertDiskModel({ family: 'lunar-lambert', weight: 1.2 }), /weight/);
  assert.throws(() => assertDiskModel({ family: 'minnaert', coefficient: Number.NaN, coefficientPerDegree: 0 }), /Minnaert/);
});
