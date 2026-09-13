import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { parseCitySource, parseWmtsRelease, parsePreparationRecipe, parsePlacesConfig, parsePlacesManifest,
  parseOverlayConfig, parseOverlayPin, parseOverlayData, parseRuntimePages, parseGeographicScene,
  parseBlockReference, parseWorldCoverSource, numericSource } from './source-records.mts';

const earth = new URL('../../../src/objects/earth/', import.meta.url);
async function json(path: string): Promise<unknown> { return JSON.parse(await readFile(new URL(path, earth), 'utf8')); }

test('geographic source contracts decode the accepted recipes and prepared metadata without dropping provenance', async () => {
  const source = await json('source/city/manifest.json');
  assert.deepEqual(parseCitySource(source), source);
  const release = await json('source/city/wmts-release.json');
  assert.deepEqual(parseWmtsRelease(release), release);
  const recipe = await json('source/preparation/paged-ellipsoid.json');
  assert.deepEqual(parsePreparationRecipe(recipe), recipe);
  assert.deepEqual(parsePlacesConfig(recipe), recipe);
  assert.deepEqual(parseOverlayConfig(recipe), recipe);
  const places = await json('source/places/manifest.json');
  assert.deepEqual(parsePlacesManifest(places), places);
  const pages = await json('prepared/pages.json');
  assert.deepEqual(parseRuntimePages(pages), pages);
  const scene = await json('prepared/scene.json');
  assert.deepEqual(parseGeographicScene(scene), scene);
});

test('noise source numeric strings retain their pinned representation', async () => {
  const rawPin = await json('source/noise/manifest.json');
  const pin = parseOverlayPin(rawPin);
  assert.deepEqual(pin, rawPin);
  const raw: unknown = JSON.parse(gunzipSync(await readFile(new URL('source/noise/' + pin.file, earth))).toString('utf8'));
  const decoded = parseOverlayData(raw);
  assert.deepEqual(decoded, raw);
  assert.equal(typeof decoded.features[0].properties.dba_low, 'string');
  assert.equal(numericSource('55'), '55');
  assert.equal(numericSource(55), 55);
  for (const value of ['', 'no reading', Infinity, null]) assert.throws(() => numericSource(value));
});

test('source readers reject malformed geometry, identity fields, and block ranges before exposing typed values', () => {
  assert.throws(() => parseGeographicScene({body:{bands:[{latitudeIndex:1,leaves:[{style:3,leafWidth:2}]}]}}));
  assert.throws(() => parseWorldCoverSource({tile:'N00E000',url:'https://source.example/tile',etag:'valid',sourceBytes:NaN}));
  assert.throws(() => parseBlockReference({url:'/page.pack',bytes:2,sha256:'hash',encoding:'gzip',offset:'0',decodedBytes:2,decodedSha256:'hash'}));
  assert.throws(() => parseOverlayData({crs:{properties:{name:'CRS84'}},features:[{geometry:{type:'Point',coordinates:[1,2]},properties:{periodo:'Diurno',color:'0 0 0',rango:'55',dba_low:'55'}}]}));
});
