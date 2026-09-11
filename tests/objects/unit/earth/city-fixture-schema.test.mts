import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareCityPageGeometry } from '../../../../tools/objects/geographic-pages/page-geometry.mts';
import { PREPARED_EARTH_SCENE } from './prepared-fixture.mts';
import { parseCityRaster, parseCityFixtureManifest, parseCityFixtureDirectory } from './city-fixture-schema.mts';

const page={...prepareCityPageGeometry({level:0,x:1,y:8},PREPARED_EARTH_SCENE),
  children:[],url:'https://example.test/city.webp',bytes:123,sha256:'a'.repeat(64),maximumCssSpan:1024};
test('city fixture decodes prepared raster geometry and preserves plan metadata', () => {
  assert.deepEqual(parseCityRaster(page),page);
  const manifest={dataset:'fixture',pages:[page],proofRoots:[page.key],poolSize:12};
  assert.deepEqual(parseCityFixtureManifest(manifest),manifest);
  const directory={schema:'cssearth-city-index@1',dataset:'fixture',key:page.key,nodes:[page],external:[]};
  assert.deepEqual(parseCityFixtureDirectory(directory),directory);
});
test('city fixture rejects malformed source coordinates and raster identities', () => {
  assert.throws(()=>parseCityRaster({...page,normal:[0,1]}),/three coordinates/);
  assert.throws(()=>parseCityRaster({...page,normal:[0,1,0,1]}),/three coordinates/);
  assert.throws(()=>parseCityRaster({...page,corners:[[0,NaN,0]]}),/finite/);
  assert.throws(()=>parseCityRaster({...page,url:123}),/string/);
  assert.throws(()=>parseCityFixtureManifest({pages:[page],proofRoots:[{level:0,x:1,y:8}]}),/string/);
});
