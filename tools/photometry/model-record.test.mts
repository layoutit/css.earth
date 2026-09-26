import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { parsePhotometricModelRecord, parsePhotometryReference, PHOTOMETRIC_MODEL_SCHEMA, createNormalization } from '@cssearth/bake/photometry';

const hapkeRecord = {
  schema: PHOTOMETRIC_MODEL_SCHEMA, id: 'example-hapke', instrument: 'Example camera', filter: 'clear', quantity: 'radiance-factor',
  model: { family: 'hapke', singleScatteringAlbedo: 0.04, hFunction: 'hapke-1981', phaseFunction: { form: 'henyey-greenstein', asymmetry: -0.37 },
    shadowHiding: { amplitude: 2.5, width: 0.079 }, roughnessDegrees: 15 },
  fit: { phaseDegrees: [1.3, 54] },
};

test('a published Hapke record parses with roughness in radians and its fitted ranges kept', () => {
  const record = parsePhotometricModelRecord(hapkeRecord);
  assert.equal(record.model.family, 'hapke');
  if (record.model.family !== 'hapke') return;
  assert.ok(Math.abs((record.model.roughness ?? 0) - 15 * Math.PI / 180) < 1e-15);
  assert.deepEqual(record.fit.phaseDegrees, [1.3, 54]);
});

test('records refuse unknown keys, impossible parameters and malformed ranges', () => {
  const bad = (change: (r: Record<string, unknown>) => void, pattern: RegExp) => {
    const copy = structuredClone(hapkeRecord) as unknown as Record<string, unknown>; change(copy);
    assert.throws(() => parsePhotometricModelRecord(copy), pattern);
  };
  bad(r => { r.note = 'x'; }, /unknown keys: note/);
  bad(r => { (r.model as Record<string, unknown>).singleScatteringAlbedo = 1.2; }, /single-scattering albedo/);
  bad(r => { (r.model as Record<string, unknown>).hFunction = 'hapke-1999'; }, /H-function approximation/);
  bad(r => { (r.model as Record<string, unknown>).phaseFunction = { form: 'henyey-greenstein', asymmetry: -0.37, b: 1 }; }, /unknown keys: b/);
  bad(r => { r.fit = { phaseDegrees: [54, 1.3] }; }, /increasing/);
  bad(r => { r.schema = 'other'; }, /Expected cssearth-photometric-model@1/);
  assert.throws(() => parsePhotometricModelRecord({ ...hapkeRecord, model: { family: 'separable', disk: { family: 'lunar-lambert', weight: 2 } } }), /weight/);
});

test('a recipe block names its record, keeps the reference inside the fitted phase, and reports phase extrapolation', () => {
  const record = parsePhotometricModelRecord({ ...hapkeRecord, model: { ...hapkeRecord.model, roughnessDegrees: undefined } });
  const block = { model: 'photometry/example-hapke.json', referenceDegrees: { incidence: 30, emission: 0, phase: 30 },
    limits: { maximumIncidenceDegrees: 80, maximumEmissionDegrees: 80, phaseDegrees: [1, 70], minimumGain: 0.2, maximumGain: 5 } };
  const normalization = parsePhotometryReference(block, record);
  assert.equal(normalization.extrapolatesPhase, true, '70° exceeds the fitted 54°');
  assert.ok(Math.abs((createNormalization(normalization)(normalization.reference) ?? NaN) - 1) < 1e-14);
  assert.throws(() => parsePhotometryReference({ ...block, referenceDegrees: { incidence: 60, emission: 0, phase: 60 } }, record), /outside the fitted 1.3–54°/);
  assert.throws(() => parsePhotometryReference({ ...block, model: 'photometry/other.json' }, record), /photometry\/example-hapke.json/);
});
