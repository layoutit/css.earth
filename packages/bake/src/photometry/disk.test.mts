import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { diskGain, diskValue, assertDiskModel, NORMAL_GEOMETRY, type DiskModel, phaseGain, phaseValue, assertPhaseModel } from '@cssearth/bake/photometry';

/**
 * Frozen copies of the photometric arithmetic the routes used before tools/photometry
 * existed (osiris-geo.mts, shape-camera-mosaic.mts and photometric-observations.mts at
 *). The library must equal them exactly, so moving a route onto it
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
  // Triton's observed colors reference 30° incidence at nadir emission.
  const radians = Math.PI / 180, reference = { mu0: Math.cos(30 * radians), mu: Math.cos(0 * radians), phase: 0 };
  // Observed colors carry per-observation weights, so any weight must match.
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
  for (const model of [{ family: 'lommel-seeliger' }, { family: 'lunar-lambert', weight: 0.3 }, { family: 'minnaert', coefficient: 0.7, coefficientPerDegree: 0.002 }, { family: 'lommel-seeliger-lambert', lunarFraction: 0.871, lunarFractionPerDegree: -0.003, surfacePhase: 1.556, surfacePhasePerDegree: -0.014 }] as DiskModel[]) {
    const g = { mu0: 0.37, mu: 0.81, phase: 0.9 };
    assert.ok(Math.abs(diskGain(model, g, g) - 1) < 1e-14, model.family);
  }
  assert.throws(() => assertDiskModel({ family: 'lunar-lambert', weight: 1.2 }), /weight/);
  assert.throws(() => assertDiskModel({ family: 'minnaert', coefficient: Number.NaN, coefficientPerDegree: 0 }), /Minnaert/);
});

test('Lommel-Seeliger plus Lambert follows its printed lines in phase and sends no negative light', () => {
  // Dhingra et al. (2021) eq. 2 with the ridged-plains lines of its Table 2.
  const europa: DiskModel = { family: 'lommel-seeliger-lambert', lunarFraction: 0.871, lunarFractionPerDegree: -0.003, surfacePhase: 1.556, surfacePhasePerDegree: -0.014 };
  const degree = Math.PI / 180, near = (value: number, expected: number) => assert.ok(Math.abs(value - expected) < 1e-12, `${value} is not ${expected}`);
  // At 60 degrees the lines give A = 0.691 and f = 0.716.
  near(diskValue(europa, { mu0: 0.5, mu: 0.8, phase: 60 * degree }), 0.691 * 0.716 * 0.5 / 1.3 + 0.309 * 0.5);
  // The flood-lit disc, relative to its centre: (A f / 2 + (1 - A) mu) / (A f / 2 + 1 - A).
  near(diskGain(europa, { mu0: 1, mu: 1, phase: 0 }, { mu0: 0.1, mu: 0.1, phase: 0 }), (0.871 * 1.556 / 2 + 0.129 * 0.1) / (0.871 * 1.556 / 2 + 0.129));
  // A = 1 with f = 2 is Lommel-Seeliger and A = 0 is Lambert.
  near(diskValue({ ...europa, lunarFraction: 1, lunarFractionPerDegree: 0, surfacePhase: 2, surfacePhasePerDegree: 0 }, { mu0: 0.4, mu: 0.7, phase: 1 }), diskValue({ family: 'lommel-seeliger' }, { mu0: 0.4, mu: 0.7, phase: 1 }));
  near(diskValue({ ...europa, lunarFraction: 0, lunarFractionPerDegree: 0 }, { mu0: 0.4, mu: 0.7, phase: 1 }), 0.4);
  // The line for f crosses zero at 111.1 degrees; at 128 degrees only the Lambert term, 1 - A = 0.513, remains.
  near(diskValue(europa, { mu0: 0.3, mu: 0.2, phase: 128 * degree }), 0.513 * 0.3);
  assert.throws(() => assertDiskModel({ ...europa, lunarFractionPerDegree: -0.006 }), /lunar fraction/);
  assert.throws(() => assertDiskModel({ ...europa, surfacePhase: 0 }), /surface phase/);
  assert.throws(() => assertDiskModel({ ...europa, surfacePhasePerDegree: Number.NaN }), /finite/);
});

test('the Akimov disk function is flat at zero phase and follows its printed form elsewhere', () => {
  const akimov: DiskModel = { family: 'akimov' }, degree = Math.PI / 180, near = (value: number, expected: number) => assert.ok(Math.abs(value - expected) < 1e-12, `${value} is not ${expected}`);
  const at = (incidence: number, emission: number, phase: number) => diskValue(akimov, { mu0: Math.cos(incidence * degree), mu: Math.cos(emission * degree), phase: phase * degree });
  // Flood light: 1 at every emission, so no limb darkening.
  for (const emission of [0, 40, 70, 89]) assert.equal(at(emission, emission, 0), 1);
  // Filacchione et al. (2022) eq. 4 at 60 degrees phase. Sub-observer point: gamma = 0, so D = cos 30 cos(1.5 x 30).
  near(at(60, 0, 60), Math.cos(30 * degree) * Math.cos(45 * degree));
  // The mirror meridian, gamma = g/2 on the photometric equator: D = 1.
  near(at(30, 30, 60), 1);
  // The sub-solar point, gamma = g: D = cos 30 cos(1.5 x 30) / cos 60.
  near(at(0, 60, 60), Math.cos(30 * degree) * Math.cos(45 * degree) / Math.cos(60 * degree));
  // The terminator on the equator, gamma = g - 90: no light.
  assert.ok(at(90 - 1e-7, 30, 60) < 1e-6);
  assert.equal(assertDiskModel(akimov), akimov);
});

test('a quadratic phase curve follows its printed line and is held beyond its fitted phase', () => {
  // Rhea at 599 nm, Filacchione et al. (2022) Table 6.
  const rhea = { family: 'quadratic' as const, constant: 0.610461, perDegree: -0.00352956, perDegreeSquared: -1.00710e-06, heldBeyondDegrees: 120 };
  const degree = Math.PI / 180, line = (g: number) => 0.610461 - 0.00352956 * g - 1.00710e-06 * g * g;
  assert.equal(phaseValue(rhea, 0), 0.610461);
  assert.ok(Math.abs(phaseValue(rhea, 90 * degree) - line(90)) < 1e-12);
  assert.ok(Math.abs(phaseValue(rhea, 170 * degree) - line(120)) < 1e-12, 'held at 120 degrees');
  assert.throws(() => assertPhaseModel({ ...rhea, heldBeyondDegrees: 180 }), /positive/);
  assert.throws(() => assertPhaseModel({ ...rhea, constant: Number.NaN }), /finite/);
});
