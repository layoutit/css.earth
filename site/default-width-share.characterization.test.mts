import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultWidthShare } from './default-width-share.mts';
test('width shares require cqw optics and two positive combined shares', () => {
  const fit = { portraitBaseWidthShare: .4, landscapeWidthShareGain: .2, maximumHeightShare: .8 };
  const camera = { projection: { cssPerspective: '50cqw' }, responsiveFit: fit };
  assert.deepEqual(defaultWidthShare(camera), { diameterOverWidth: .6000000000000001, diameterOverFocal: 1.2000000000000002, maximumDiameterOverHeight: .8 });
  for (const maximumHeightShare of [undefined, 0, -1]) assert.equal(defaultWidthShare({ ...camera, responsiveFit: { ...fit, maximumHeightShare } })?.maximumDiameterOverHeight, null);
  for (const cssPerspective of ['50px', '0cqw', 'bad', '50cqw ']) assert.equal(defaultWidthShare({ ...camera, projection: { cssPerspective } }), null);
  for (const input of [{}, { projection: null, responsiveFit: null }, { ...camera, responsiveFit: { portraitBaseWidthShare: .4 } }, { ...camera, responsiveFit: { portraitBaseWidthShare: -.4, landscapeWidthShareGain: .2 } }]) assert.equal(defaultWidthShare(input), null);
});
