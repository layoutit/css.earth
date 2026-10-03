import assert from 'node:assert/strict';
import test from 'node:test';
import { MEASURED_SPECTRUM_SCHEMA, parseMeasuredSpectrumDocument } from './measured-spectrum.js';

const row = { xLow: 0, xHigh: 4, y: 1, minus: .1, plus: .2 };
const document = { schema: MEASURED_SPECTRUM_SCHEMA, measurements: [row] };
test('measurement documents retain the mode-dependent missing-x policy and scaling', () => {
  assert.equal(MEASURED_SPECTRUM_SCHEMA, 'cssearth-measured-spectrum@1');
  assert.deepEqual(parseMeasuredSpectrumDocument(document, 'band', 100), [{ ...row, x: 2, y: 100, minus: 10, plus: 20 }]);
  assert.throws(() => parseMeasuredSpectrumDocument(document, 'points', 1), TypeError);
  assert.deepEqual(parseMeasuredSpectrumDocument({ ...document, measurements: [{ ...row, x: 1 }] }, 'band', 1), [{ ...row, x: 1 }]);
  assert.throws(() => parseMeasuredSpectrumDocument({ ...document, schema: 'other' }, 'band', 1), { message: 'Unknown measurement document schema.' });
  assert.throws(() => parseMeasuredSpectrumDocument({ ...document, measurements: [{ ...row, minus: NaN }] }, 'band', 1), TypeError);
  assert.throws(() => parseMeasuredSpectrumDocument({ ...document, measurements: {} }, 'band', 1), TypeError);
  // Clipping and negative-error checks remain with chart rendering's owner.
  assert.equal(parseMeasuredSpectrumDocument({ ...document, measurements: [{ ...row, minus: -1 }] }, 'band', 1)[0]!.minus, -1);
});
