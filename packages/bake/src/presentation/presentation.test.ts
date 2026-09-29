import { expect, it } from 'vitest';
import { parsePresentationProfile } from './css-presentation.ts';

it('rejects surface texture levels: raster surfaces have one prepared density', () => {
  const profile = { schema: 'cssearth-css-presentation-profile@1', namespace: 'mercury', mode: 'row-bank-cutaway', textureLevels: { hysteresis: 0.2, texelsPerCssPixel: 2 } };
  expect(() => parsePresentationProfile(profile)).toThrow(/one prepared density/);
});
