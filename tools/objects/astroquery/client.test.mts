import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAstroqueryAnswer } from './client.mts';

test('the boundary rejects a response from another operation', async () => {
  assert.throws(() => parseAstroqueryAnswer({ schema: 'cssearth-astroquery-answer@1', astroquery: '0.4.11', operation: 'alma-tap', rows: [] },
    { operation: 'mast-service', service: 'Mast.Caom.Cone', parameters: {} }), /wrong contract/u);
});

test('the boundary validates rows before returning them', async () => {
  assert.throws(() => parseAstroqueryAnswer({ schema: 'cssearth-astroquery-answer@1', astroquery: '0.4.11', operation: 'mast-service', rows: [null] },
    { operation: 'mast-service', service: 'Mast.Caom.Cone', parameters: {} }), /Astroquery row 0/u);
});
