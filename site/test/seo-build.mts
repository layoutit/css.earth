import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseHTML } from 'linkedom';
import sharp from 'sharp';
import { SCENE_OBJECTS } from '../objects.mts';
import { objectSeo, SITE_ORIGIN } from '../seo.mts';
import { availableSocialImages, DEFAULT_SOCIAL_IMAGE_ID } from '../social-images.mts';

const dist = resolve(process.argv[2] ?? 'dist');
const file = (route: string) => resolve(dist, route);
const html = async (route: string) => readFile(file(route), 'utf8');
const socialImages = availableSocialImages();

function metadata(page: string) {
  const end = page.indexOf('</head>');
  assert.ok(end > 0, 'Built page has no head');
  return parseHTML(page.slice(0, end + '</head>'.length)).document;
}

function meta(document: Document, name: string) {
  const element = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
  assert.ok(element, `Missing ${name} metadata`);
  return element.getAttribute('content');
}

const home = metadata(await html('index.html'));
assert.equal(home.querySelector('link[rel="canonical"]')?.getAttribute('href'), new URL('/earth/', SITE_ORIGIN).href);

const sitemap = await html('sitemap.xml');
const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(match => match[1]);
assert.deepEqual(listed, SCENE_OBJECTS.map(object => objectSeo(object).canonical));
assert.equal(await html('robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`);

const referencedImages = new Set<string>();
for (const object of SCENE_OBJECTS) {
  const page = await html(`${object.id}/index.html`);
  const head = metadata(page);
  const expected = objectSeo(object, { socialImages, defaultSocialImageId: DEFAULT_SOCIAL_IMAGE_ID });
  assert.equal(head.documentElement.getAttribute('lang'), 'en', object.id);
  assert.equal(head.querySelector('title')?.textContent, expected.title, object.id);
  assert.equal(meta(head, 'description'), expected.description, object.id);
  assert.equal(head.querySelector('link[rel="canonical"]')?.getAttribute('href'), expected.canonical, object.id);
  assert.equal(meta(head, 'og:url'), expected.canonical, object.id);
  assert.equal(meta(head, 'og:title'), expected.title, object.id);
  assert.equal(meta(head, 'og:description'), expected.description, object.id);
  assert.equal(meta(head, 'og:image'), expected.image, object.id);
  assert.equal(meta(head, 'og:image:alt'), expected.imageAlt, object.id);
  assert.equal(meta(head, 'twitter:image'), expected.image, object.id);
  assert.equal(meta(head, 'twitter:image:alt'), expected.imageAlt, object.id);
  assert.doesNotMatch(head.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '', /noindex/iu, object.id);
  referencedImages.add(new URL(expected.image).pathname);
}

for (const image of referencedImages) {
  const bytes = await readFile(file(image.slice(1)));
  const info = await sharp(bytes).metadata();
  assert.deepEqual([info.format, info.width, info.height], ['jpeg', 1200, 630], image);
}

const preview = metadata(await html('previews/overview-spectrum/index.html'));
assert.match(meta(preview, 'robots') ?? '', /\bnoindex\b/iu);
console.log(`SEO passed: ${SCENE_OBJECTS.length} object pages, sitemap, robots, and ${referencedImages.size} social images.`);
