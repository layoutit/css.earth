import assert from 'node:assert/strict';
import test from 'node:test';
import { collectRuntimeAssetUrls, stylesheetTexts } from './runtime-assets.ts';

test('a body ships the images its stylesheet lenses reference, not only its prepared data', async () => {
  // Europa's composition lenses exist only in europa-surfaces.css. Three bakes dropped them from the inventory and the
  // deploy then stopped: No published asset hash for /scenes/europa/europa-ice-signature@2x.webp.
  const urls = collectRuntimeAssetUrls('europa', ...await stylesheetTexts());
  for (const lens of ['coarse-ice', 'fine-ice', 'ice-signature']) {
    assert.ok(urls.includes(`/scenes/europa/europa-${lens}@2x.webp`), lens);
    assert.ok(urls.includes(`/scenes/europa/europa-poles-${lens}@2x.webp`), `${lens} poles`);
  }
  assert.ok(urls.every(url => url.startsWith('/scenes/europa/')));
});
