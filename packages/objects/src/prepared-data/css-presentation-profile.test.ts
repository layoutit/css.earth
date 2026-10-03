import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePresentationProfile } from './css-presentation-profile.js';

describe('presentation profile', () => {
  it('rejects surface texture levels: raster surfaces have one prepared density', () => {
    const profile = { schema: 'cssearth-css-presentation-profile@2', namespace: 'mercury', mode: 'row-bank-cutaway', textureLevels: { hysteresis: 0.2, texelsPerCssPixel: 2 } };
    assert.throws(() => parsePresentationProfile(profile), /one prepared density/);
  });
});
