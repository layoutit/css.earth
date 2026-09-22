import {parseCitySource,shape,array,number} from '../../../../tools/objects/geographic-pages/source-records.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { parseWorldCoverInventory, readWorldCoverCatalog, sourceTilesForBounds,
  worldCoverTileBounds, worldCoverSourceEntry } from "../../../../tools/objects/geographic-pages/worldcover-catalog.mts";
import { cityCoverageRoots, planCityCoverage } from '../../../../tools/objects/geographic-pages/operations/plan-coverage.mts';
import { citySourceWindow, CITY_SOURCE_WINDOW_MAX_PIXELS, validateWorldCoverRegionSources } from '../../../../tools/objects/geographic-pages/operations/worldcover-source.mts';
import { PREPARED_EARTH_SCENE } from './prepared-fixture.mts';
import { expectedGlobalCityFace, validateGlobalCityFaceReceipt } from '../../../../tools/objects/geographic-pages/operations/global-face-receipts.mts';

const inventoryPage=`<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>esa-worldcover-s2</Name><Prefix>rgbnir/2021/</Prefix><KeyCount>1</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated><Contents><Key>rgbnir/2021/N00/ESA_WorldCover_10m_2021_v200_N00E044_S2RGBNIR.tif</Key><LastModified>2022-12-10T13:22:13.000Z</LastModified><ETag>&quot;7eb1875cba23a838f73197efdb25b85f&quot;</ETag><Size>1992255</Size><StorageClass>STANDARD</StorageClass></Contents></ListBucketResult>`;

test("publisher inventory parsing fails closed on malformed, duplicate and incomplete XML",()=>{
  const {entries,next}=parseWorldCoverInventory(inventoryPage);
  assert.equal(entries.length,1);assert.equal(next,null);
  assert.equal(entries[0].etag,"7eb1875cba23a838f73197efdb25b85f");
  assert.match(worldCoverSourceEntry(entries[0]).url,/rgbnir\/2021\/N00\//);
  for(const broken of [inventoryPage.replace('</Size>','</Other>'),
    inventoryPage.replace('<KeyCount>1</KeyCount>','<KeyCount>2</KeyCount>'),
    inventoryPage.replace('<IsTruncated>false</IsTruncated>','<IsTruncated>true</IsTruncated>'),
    inventoryPage.replace('</Size>','</Size><Size>1</Size>'),
    inventoryPage.replace('rgbnir/2021/N00/','map/2021/N00/'),
    inventoryPage.replace('&quot;','&external;')]) assert.throws(()=>parseWorldCoverInventory(broken));
});

test("the pinned global object inventory binds every published proof source",async()=>{
  const {pin,entries}=await readWorldCoverCatalog({directory:new URL("../../../../src/objects/earth/source/city/",import.meta.url)});
  assert.equal(entries.size,pin.tileCount);
  const bounds=[...entries.values()].map(entry=>worldCoverTileBounds(entry.tile));
  assert.deepEqual([Math.min(...bounds.map(b=>b.south)),Math.max(...bounds.map(b=>b.north))],shape({latitudeExtent:array(number)})(pin).latitudeExtent);
  const source=parseCitySource(JSON.parse(await readFile(new URL('../../../../src/objects/earth/source/city/manifest.json',import.meta.url),'utf8')));
  for(const region of source.regions)for(const entry of region.sources??[region]) {
    const listed=worldCoverSourceEntry(required(entries.get(required(entry.tile))));
    assert.equal(listed.etag,entry.etag);assert.equal(listed.sourceBytes,entry.sourceBytes);assert.equal(listed.url,entry.url);
  }
});

test("source lookup wraps the antimeridian and distinguishes absent tiles from imagery",async()=>{
  const {entries}=await readWorldCoverCatalog({directory:new URL("../../../../src/objects/earth/source/city/",import.meta.url)});
  const crossing=sourceTilesForBounds({west:179.5,east:180.5,south:-17,north:-16},entries);
  assert.deepEqual(crossing.available.map(e=>e.tile),['S17E179','S17W180']);
  assert.deepEqual(crossing.unavailable,[]);
  assert.deepEqual(sourceTilesForBounds({west:10,east:11,south:84,north:85},entries).unavailable,['N84E010']);
  assert.deepEqual(sourceTilesForBounds({west:10,east:11,south:-80,north:-79},entries).unavailable,['S80E010']);
  const all=sourceTilesForBounds({west:.5,east:360.5,south:-90,north:90},entries);
  assert.equal(all.available.length,entries.size);
  assert.equal(all.available.length+all.unavailable.length,360*180);
  assert.throws(()=>sourceTilesForBounds({west:0,east:1,south:-91,north:0},entries));
});

test('global source-window planning uses the accepted faces and reproduces all pinned regions',async()=>{
  const {entries}=await readWorldCoverCatalog({directory:new URL("../../../../src/objects/earth/source/city/",import.meta.url)});
  const source=parseCitySource(JSON.parse(await readFile(new URL('../../../../src/objects/earth/source/city/manifest.json',import.meta.url),'utf8')));
  assert.equal(cityCoverageRoots().length,PREPARED_EARTH_SCENE.body.bands.reduce((sum,band)=>sum+band.leaves.length,0));
  for(const region of source.regions) {
    const jobs=[...planCityCoverage(PREPARED_EARTH_SCENE,entries,[region.root])];
    assert.equal(jobs.length,1);
    const job=jobs[0];
    assert.deepEqual(job.root,region.root);
    assert.deepEqual(job.sources.map(s=>s.tile).sort(),(region.sources??[region]).map(s=>s.tile).sort());
    assert.deepEqual(job.unavailableTiles,[]);
    assert.equal(job.blocked,null);
    assert.deepEqual(job.window,citySourceWindow(job.bounds));
    assert.ok(job.window.pixels<=CITY_SOURCE_WINDOW_MAX_PIXELS);
  }
  assert.deepEqual([...planCityCoverage(PREPARED_EARTH_SCENE,new Map())],[]);
});

test('absent source tiles require exact publisher evidence and cannot hide missing or failed sources',async()=>{
  const {entries}=await readWorldCoverCatalog({directory:new URL("../../../../src/objects/earth/source/city/",import.meta.url)});
  const bounds={west:44.99,east:45.01,south:.25,north:.26};
  const coverage=sourceTilesForBounds(bounds,entries);
  const region={id:'catalog-gap',sources:coverage.available,unavailableTiles:coverage.unavailable};
  assert.ok(region.sources.length>0&&region.unavailableTiles.length>0);
  const checked=validateWorldCoverRegionSources(region,bounds,entries);
  assert.equal(checked.absentSourcePixels,120*120);
  assert.equal(citySourceWindow(bounds).pixels,2*checked.absentSourcePixels);
  assert.throws(()=>validateWorldCoverRegionSources({...region,unavailableTiles:[]},bounds,entries));
  assert.throws(()=>validateWorldCoverRegionSources({...region,sources:[]},bounds,entries));
  assert.throws(()=>validateWorldCoverRegionSources({...region,unavailableTiles:[...region.unavailableTiles,region.sources[0].tile]},bounds,entries));
  assert.throws(()=>validateWorldCoverRegionSources({...region,sources:[{...region.sources[0],etag:'0'.repeat(32)}]},bounds,entries));
  assert.throws(()=>validateWorldCoverRegionSources({...region,sources:[...region.sources,...region.sources]},bounds,entries));
  const crossing={west:179.99,east:180.01,south:-16.7,north:-16.69};
  const pair=sourceTilesForBounds(crossing,entries);
  assert.equal(validateWorldCoverRegionSources({id:'antimeridian',sources:pair.available},crossing,entries).absentSourcePixels,0);
});

test('global face receipts bind resumable R2 publication to the pinned catalog',()=>{
  const source={dataset:'example-dataset',delivery:{accountId:'fixture-account',bucket:'cssearth-assets',
    assetOrigin:'https://earth-assets.lowpoly.cc',keyPrefix:'scenes/earth'}};
  const expected=expectedGlobalCityFace({level:0,x:3,y:4},[{root:{level:5,x:96,y:128},
    lastLevel:7,window:{pixels:100},sources:[{tile:'N00E000'}]}]);
  assert.deepEqual({jobs:expected.jobs,finePages:expected.finePages,pages:expected.pages},
    {jobs:1,finePages:21,pages:26});
  const hash='a'.repeat(64);
  const receipt={schema:'cssearth-earth-city-global-face@1',dataset:source.dataset,
    catalogSha256:'b'.repeat(64),face:expected.face,jobs:expected.jobs,
    finePages:expected.finePages,pages:expected.pages,sourceObjects:expected.sourceObjects,
    maximumWindowPixels:expected.maximumWindowPixels,
    qualification:'One verified global-build face; not global runtime coverage.',
    heads:[{key:expected.face.key,directory:{url:`${source.delivery.assetOrigin}/scenes/earth/city-index-${source.dataset}-${expected.face.key}-${hash.slice(0,16)}.json`,bytes:50,sha256:hash}}],
    indexes:6,compressedBytes:100,provenance:[{id:'proof'}],
    publish:{mode:'publish-and-verify',bucket:source.delivery.bucket,origin:source.delivery.assetOrigin,
      objects:32,bytes:150,webp:{objects:26,bytes:100},json:{objects:6,bytes:50}}};
  assert.equal(validateGlobalCityFaceReceipt(receipt,expected,source,'b'.repeat(64)),receipt);
  assert.throws(()=>validateGlobalCityFaceReceipt({...receipt,pages:25},expected,source,'b'.repeat(64)));
  assert.throws(()=>validateGlobalCityFaceReceipt({...receipt,heads:[{...receipt.heads[0],
    directory:{...receipt.heads[0].directory,url:receipt.heads[0].directory.url.replace(
      'earth-assets.lowpoly.cc','css.earth')}}]},expected,source,'b'.repeat(64)));
});
