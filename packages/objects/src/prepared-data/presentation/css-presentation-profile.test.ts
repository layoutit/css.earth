import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePresentationProfile } from './css-presentation-profile.js';

describe('presentation profile', () => {
  it('rejects surface texture levels: raster surfaces have one prepared density', () => {
    const profile = { schema: 'cssearth-css-presentation-profile@2', namespace: 'mercury', mode: 'row-bank-cutaway', textureLevels: { hysteresis: 0.2, texelsPerCssPixel: 2 } };
    assert.throws(() => parsePresentationProfile(profile), /one prepared density/);
  });
  it('reads a light curve with the step group of its stills, and refuses anything else beside the model', () => {
    const star = (lightCurve: unknown) => ({ schema: 'cssearth-css-presentation-profile@2', namespace: 'ry-cma', mode: 'emissive', lightCurve });
    const model = 'photometry/gaia-dr3-vari-cepheid.csv';
    assert.deepEqual(parsePresentationProfile(star({ model })).lightCurve, { model });
    assert.deepEqual(parsePresentationProfile(star({ model, stills: 'pulsation' })).lightCurve, { model, stills: 'pulsation' });
    assert.throws(() => parsePresentationProfile(star({ model, stills: 3 })), /step group as "stills"/);
    assert.throws(() => parsePresentationProfile(star({ model, rate: 2 })), /lightCurve needs/);
    assert.throws(() => parsePresentationProfile({ ...star({ model, stills: 'pulsation' }), mode: 'composite' }), /emissive presentation/);
  });
});
