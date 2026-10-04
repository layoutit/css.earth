import assert from 'node:assert/strict';
import test from 'node:test';
import { PUBLISHED_LIMB_DARKENING_SCHEMA, readPublishedLimbDarkening, readPublishedPowerLaw, checkLimbLaw } from './published-limb-darkening.js';

const coefficient = { value: 0.3, uncertainty: 0.05, cell: 'table 1' };
const quadratic = { schema: PUBLISHED_LIMB_DARKENING_SCHEMA, source: 'paper', band: 'V', u1: coefficient, u2: coefficient };
const power = { schema: PUBLISHED_LIMB_DARKENING_SCHEMA, source: 'paper', band: 'V', law: 'power', alpha: coefficient };
test('published quadratic and power coefficients retain values, bounds and basis', () => {
  assert.equal(PUBLISHED_LIMB_DARKENING_SCHEMA, 'cssearth-published-limb-darkening@1');
  assert.deepEqual(readPublishedLimbDarkening(quadratic), { law: 'quadratic', u1: 0.3, u2: 0.3, u1Bounds: [0.25, 0.35], u2Bounds: [0.25, 0.35] });
  assert.deepEqual(readPublishedPowerLaw(power), { law: 'power', alpha: 0.3, alphaBounds: [0.25, 0.35], basis: 'fit' });
  assert.deepEqual(readPublishedPowerLaw({ ...power, alpha: { value: 0.2, fixed: 'model' } }), { law: 'power', alpha: 0.2, alphaBounds: [0.2, 0.2], basis: 'model-prior' });
  assert.equal(readPublishedLimbDarkening({ ...quadratic, basis: 'model-prior' }).basis, 'model-prior');
});
test('published readers preserve their distinct schema diagnostics and physical checks', () => {
  assert.throws(() => readPublishedLimbDarkening({ ...quadratic, schema: 'other' }), { message: 'Published limb darkening must use cssearth-published-limb-darkening@1.' });
  assert.throws(() => readPublishedPowerLaw({ ...power, law: 'quadratic' }), { message: 'A published power law is a cssearth-published-limb-darkening@1 record with law "power".' });
  assert.throws(() => readPublishedLimbDarkening({ ...quadratic, basis: 'other' }), { message: 'Published limb-darkening basis must be transit-fit or model-prior.' });
  assert.throws(() => readPublishedLimbDarkening({ ...quadratic, u1: { ...coefficient, value: 2 } }), /must keep the limb/);
  assert.throws(() => readPublishedPowerLaw({ ...power, alpha: { ...coefficient, value: -1 } }), /must keep the limb/);
  // Historical fixed-power admission does not run the fitted-power physical check.
  assert.equal(readPublishedPowerLaw({ ...power, alpha: { value: -1, fixed: 'model' } }).alpha, -1);
  assert.throws(() => readPublishedLimbDarkening({ ...quadratic, u1: { value: 0.3, uncertainty: 0.05 } }), TypeError);
  assert.throws(() => checkLimbLaw({ u1: 2, u2: 0 }), /must keep the limb/);
  assert.doesNotThrow(() => checkLimbLaw({ u1: 2, u2: 0 }, { darkEdge: true }));
});
