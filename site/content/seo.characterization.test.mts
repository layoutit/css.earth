import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { objectSeo, applySeoHead } from './seo.mts';
const object = { id: 'moon', name: 'Moon', description: 'Earth’s moon.', route: '/moon/' };
test('share metadata chooses only declared captures or the supplied fallback', () => {
  assert.equal(objectSeo(object).image, 'https://css.earth/social/moon.jpg');
  assert.equal(objectSeo(object, { socialImages: new Set(['moon']) }).image, 'https://css.earth/social/moon.jpg');
  assert.equal(objectSeo(object, { socialImages: new Set() }).image, 'https://css.earth/social/earth.jpg');
  assert.equal(objectSeo(object, { socialImages: new Set(), defaultSocialImageId: 'sun' }).image, 'https://css.earth/social/sun.jpg');
});
test('a system page shares its host\'s image, under its own title and address', () => {
  const system = { id: 'mars-system', name: 'Mars System', description: 'Mars and its moons.', route: '/mars-system/', system: { host: 'mars' } };
  const seo = objectSeo(system, { socialImages: new Set(['mars']) });
  assert.equal(seo.image, 'https://css.earth/social/mars.jpg');
  assert.equal(seo.canonical, 'https://css.earth/mars-system/');
  assert.equal(objectSeo(system, { socialImages: new Set() }).image, 'https://css.earth/social/earth.jpg');
});
test('live head updates present metadata and keeps the loaded share image', () => {
  const { document } = parseHTML('<html><head><title>Old</title><link rel="canonical" href="/old"><meta name="description" content="Old"><meta property="og:title" content="Old"><meta property="og:image" content="loaded.jpg"></head><body></body></html>');
  const seo = objectSeo(object); applySeoHead(document, seo); applySeoHead(document, seo);
  assert.equal(document.title, 'Moon | cssEarth');
  assert.equal(document.querySelector('link')?.getAttribute('href'), 'https://css.earth/moon/');
  assert.equal(document.querySelector('meta[name="description"]')?.getAttribute('content'), 'Earth’s moon.');
  assert.equal(document.querySelector('meta[property="og:image"]')?.getAttribute('content'), 'loaded.jpg');
  assert.equal(document.querySelector('meta[name="twitter:title"]'), null);
});
