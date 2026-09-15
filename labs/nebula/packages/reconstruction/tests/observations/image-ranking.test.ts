import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageFromRow } from '../../src/observations/archives.ts';
import { imageRank, rankImages } from '../../src/observations/image-ranking.ts';

const object = {id:'m42',messier:42,name:'Orion',aliases:[],type:'nebula',raDegrees:83.82,decDegrees:-5.39,majorArcmin:60,minorArcmin:60,sourceIds:[]};
const full = imageFromRow('irsa', {obs_id:'mosaic',calib_level:3,access_url:'https://archive.example/mosaic.fits',access_format:'image/fits',s_ra:83.82,s_dec:-5.39,s_fov:1.2,s_resolution:2,s_xel1:2048,s_xel2:2048}, 'https://archive.example/');
test('a detailed wide mosaic beats a sharper tiny crop and an unreported frame across archives', () => {
  const crop = {...full, id:'crop', provider:'eso' as const,fieldDegrees:.01,resolutionArcsec:.1,calibrationLevel:2};
  const missing = {...full,id:'unreported',provider:'mast' as const,fieldDegrees:null,resolutionArcsec:null,width:null,height:null};
  assert.deepEqual(rankImages([missing,crop,full],object,'best').map(i=>i.id),[full.id,'crop','unreported']);
  assert.equal(rankImages([full,crop],object,'resolution')[0]!.id,'crop');
  assert.equal(imageRank(crop,object).detail,360, 'A small crop cannot inherit the entire object’s detail.');
});
test('mask products and clearly disjoint fields cannot win with their size or sharpness', () => {
  const mask = {...full,id:'mask',accessUrl:'https://archive.example/mosaic-w1-unc-3.fits',resolutionArcsec:.01};
  const outside = {...full,id:'outside',raDegrees:100};
  assert.deepEqual(rankImages([mask,outside,full],object,'best').map(i=>i.id),[full.id,'outside','mask']);
});
test('field size and pixel sampling cap detail; missing metadata remains unreported', () => {
  assert.equal(imageRank({...full,width:32,height:32},object).detail,32/1.2);
  assert.equal(imageRank({...full,fieldDegrees:null},object).detail,null);
  assert.ok(imageRank(full,object,120).detail! < imageRank(full,object,3600).detail!);
});
