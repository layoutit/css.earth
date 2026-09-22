import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { createNormalization, radianceFactor, possibleGeometry, type PhotometricNormalization } from './normalization.mts';

const rad = Math.PI / 180;
const wide = { maximumIncidence: 89 * rad, maximumEmission: 89 * rad, minimumPhase: 0, maximumPhase: 179 * rad, minimumGain: 1e-9, maximumGain: Number.POSITIVE_INFINITY };

test('a separable Lommel-Seeliger normalization to normal geometry is the historical disk gain and honours its limits', () => {
  const gain = createNormalization({ model: { family: 'separable', disk: { family: 'lommel-seeliger' } }, reference: { incidence: 0, emission: 0, phase: 0 },
    limits: { maximumIncidence: 80 * rad, maximumEmission: 80 * rad, minimumPhase: 0, maximumPhase: 179 * rad, minimumGain: 1e-9, maximumGain: 3 } });
  for (const [i, e] of [[10, 20], [45, 5], [70, 60]]) {
    const mu0 = Math.cos(i * rad), mu = Math.cos(e * rad);
    assert.equal(gain({ incidence: i * rad, emission: e * rad, phase: 0.4 }), (mu0 + mu) / (2 * mu0));
  }
  assert.equal(gain({ incidence: 81 * rad, emission: 10 * rad, phase: 0.4 }), null, 'beyond maximum incidence');
  assert.equal(gain({ incidence: 79.9 * rad, emission: 0, phase: 0.4 }), null, 'gain above 3 near the terminator');
  assert.equal(gain({ incidence: Number.NaN, emission: 0, phase: 0 }), null);
});

test('a Hapke normalization is the identity at its reference and carries brightness across phase in the right direction', () => {
  const model = { family: 'hapke', singleScatteringAlbedo: 0.04, hFunction: 'hapke-2002', phaseFunction: { form: 'henyey-greenstein', asymmetry: -0.37 },
    shadowHiding: { amplitude: 2.5, width: 0.079 } } as const;
  const reference = { incidence: 30 * rad, emission: 0, phase: 30 * rad };
  const normalization: PhotometricNormalization = { model, reference, limits: wide };
  const gain = createNormalization(normalization);
  assert.ok(Math.abs((gain(reference) ?? NaN) - 1) < 1e-14, 'identity at the reference geometry');
  // A dark backscattering surface is brighter near opposition: low-phase frames are carried down, high-phase frames up.
  const low = gain({ incidence: 5 * rad, emission: 3 * rad, phase: 8 * rad }), high = gain({ incidence: 60 * rad, emission: 20 * rad, phase: 75 * rad });
  assert.ok(low !== null && low < 1, `low phase gain ${low}`);
  assert.ok(high !== null && high > 1, `high phase gain ${high}`);
  // Multiplying an observed radiance factor by the gain reproduces the reference radiance factor.
  const observed = { incidence: 40 * rad, emission: 25 * rad, phase: 50 * rad };
  assert.ok(Math.abs(radianceFactor(model, observed) * (gain(observed) ?? NaN) - radianceFactor(model, reference)) < 1e-15);
  assert.throws(() => createNormalization({ model, reference: { incidence: 89.5 * rad, emission: 0, phase: 89.5 * rad }, limits: wide }), /outside the normalization limits/);
  assert.throws(() => createNormalization({ model, reference: { incidence: 10 * rad, emission: 10 * rad, phase: 40 * rad }, limits: wide }), /not a possible scattering geometry/);
  assert.equal(createNormalization({ ...normalization, limits: { ...wide, maximumPhase: 60 * rad } })({ incidence: 60 * rad, emission: 20 * rad, phase: 75 * rad }), null, 'beyond the phase range');
  assert.ok(possibleGeometry(reference) && !possibleGeometry({ incidence: 0, emission: 0, phase: 0.1 }));
});

test('gain bounds withhold rather than clamp', () => {
  const gain = createNormalization({ model: { family: 'separable', disk: { family: 'lunar-lambert', weight: 0.5 } }, reference: { incidence: 0, emission: 0, phase: 0 },
    limits: { maximumIncidence: 89 * rad, maximumEmission: 89 * rad, minimumPhase: 0, maximumPhase: 179 * rad, minimumGain: 0.9, maximumGain: 1.1 } });
  assert.equal(gain({ incidence: 0, emission: 0, phase: 0 }), 1);
  assert.equal(gain({ incidence: 70 * rad, emission: 0, phase: 70 * rad }), null, 'gain above the bound is withheld');
});
