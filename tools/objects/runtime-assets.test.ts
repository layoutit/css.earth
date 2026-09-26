import assert from 'node:assert/strict';
import test from 'node:test';
import { collectRuntimeAssetUrls, stylesheetTexts } from './runtime-assets.ts';

test('a body ships the images its stylesheet references, not only its prepared data', async () => {
  // A stylesheet image is a runtime asset: bakes that inventoried only prepared data dropped Europa's composition images,
  // and the deploy stopped (No published asset hash). Those lenses are now withheld and their rules are gone; Saturn's
  // stylesheet still draws scene images.
  const urls = collectRuntimeAssetUrls('saturn', ...await stylesheetTexts());
  assert.ok(urls.length > 0);
  assert.ok(urls.every(url => url.startsWith('/scenes/saturn/')));
  assert.equal(collectRuntimeAssetUrls('europa', ...await stylesheetTexts()).some(url => /ice-signature|fine-ice|coarse-ice/u.test(url)), false);
});
