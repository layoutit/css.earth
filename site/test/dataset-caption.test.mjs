import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { datasetCaption } from '../dataset-caption.mjs';

const read = async id => JSON.parse(await readFile(new URL(`../../src/planets/${id}/prepared/provenance.json`, import.meta.url), 'utf8'));
const lens = id => ({ id, label: id, title: `${id} instrument dataset`, description: 'Brightness records the measured surface response.' });

test('Mercury titles link the main mosaic, not coverage-completion images or tile templates', async () => {
  const document = await read('mercury');
  const before = structuredClone(document);
  const caption = datasetCaption(document, lens('enhanced'));
  assert.equal(caption.title, lens('enhanced').title);
  assert.equal(caption.href, document.sources.find(source => source.id === 'usgs-messenger-enhanced-global-z3').sourceUrl);
  assert.deepEqual(document, before);
});

test('direct source images take precedence over product pages, including WMS images', async () => {
  const earth = await read('earth');
  earth.sources.find(source => source.path === 'blue-marble-december.jpg').sourceUrl = 'https://example.org/product';
  assert.match(datasetCaption(earth, lens('normal')).href, /world\.200412\.3x21600x10800\.jpg$/u);
  const venus = await read('venus');
  assert.equal(new URL(datasetCaption(venus, lens('radar')).href).searchParams.get('FORMAT'), 'image/png');
});

test('a source-defined single-input mosaic does not inherit the parent mosaic link', async () => {
  const io = await read('io');
  assert.match(datasetCaption(io, lens('enhanced')).href, /FalseColor_1km\.tif$/u);
});

test('a multi-image mosaic does not pass off an arbitrary exposure as its source image', async () => {
  const sun = await read('sun');
  assert.equal(datasetCaption(sun, lens('photosphere')).href, undefined);
  assert.match(datasetCaption(sun, lens('chromosphere')).href, /AIA0304\/CR2311\.fits$/u);
});

test('missing, internal, and malformed source URLs leave a plain title', async () => {
  assert.deepEqual(datasetCaption(undefined, lens('normal')), { title: 'normal instrument dataset' });
  const mercury = await read('mercury');
  const source = mercury.sources.find(source => source.path === 'maps/mercury-bdr-global.png');
  source.origin = 'https://example.org/{tile}.png';
  source.sourceUrl = 'javascript:alert(1)';
  source.acquisitionOperation.url = '/local/image.png';
  assert.equal(datasetCaption(mercury, lens('normal')).href, undefined);
  source.kind = 'authored-document';
  assert.deepEqual(datasetCaption(mercury, lens('normal')), { title: 'normal instrument dataset' });
});
