import test from 'node:test';
import assert from 'node:assert/strict';
import { readEmissionWindow, type EmissionWindow } from './emission-window.js';

const window: EmissionWindow = { sourceId: 'optical', polygonArcsec: [[-5, -4], [-2, -1], [-5, 2], [-8, -1]],
  featherArcsec: .5, interpretation: 'Authored display footprint, not a physical edge.' };
test('external window decoder rejects nonfinite, concave, crossing, degenerate and unknown data', () => {
  for (const invalid of [null, {}, { ...window, sourceId: '' }, { ...window, interpretation: '' }, { ...window, featherArcsec: -1 },
    { ...window, featherArcsec: Infinity }, { ...window, featherArcsec: '1' }, { ...window, extra: true },
    { ...window, polygonArcsec: [[0, 0], [1, 0], [1, 1]] },
    { ...window, polygonArcsec: [[0, 0], [1, 1], [0, 1], [1, 0]] },
    { ...window, polygonArcsec: [[0, 0], [2, 0], [.5, .5], [0, 2]] },
    { ...window, polygonArcsec: [[0, 0], [1, 0], [2, 0], [0, 1]] },
    { ...window, polygonArcsec: [[0, 0], [1, 0], [1, Infinity], [0, 1]] },
    { ...window, polygonArcsec: [[-1e308, 0], [1e308, 0], [1e308, 1], [-1e308, 1]] },
    { ...window, polygonArcsec: [[-1e308, 0], [0, -1e308], [1e308, 0], [0, 1e308]] }])
    assert.throws(() => readEmissionWindow(invalid), /[Ee]mission window/);
});
