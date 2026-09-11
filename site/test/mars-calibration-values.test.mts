import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseBrowserRegistration,parseNativeTraining,parseAtlasManifest} from './mars-calibration-values.mts';

test('browser registration checks geographic and pixel coordinates before capture',()=>{
 const capture={nativeCamera:{latitude:1,longitude:2,distance:3,tilt:0,azimuth:0},nativeDisc:{centerX:10,centerY:20,width:30,height:30},zoom:1,
   browserEndpoint:{controlPitch:4,controlYaw:5,screenRollDegrees:0}};
 const input={qualification:'fixture',viewport:{width:100,height:100},crop:{left:0,top:5,width:100,height:95},densities:[{density:1,captures:[capture]}]};
 assert.deepEqual(parseBrowserRegistration(input),input);
 for(const invalid of [undefined,NaN,'1']){
  const changed=structuredClone(input);Object.assign(changed.densities[0].captures[0].nativeCamera,{latitude:invalid});
  assert.throws(()=>parseBrowserRegistration(changed),/finite/);
 }
});
test('native trace bindings require a numeric frame count and retain additional evidence',()=>{
 const input={qualification:'fixture',scenarioQualifications:[{id:'drag',qualification:'valid',evidence:'retained'}],runs:[{repeat:1,
   scenarios:[{id:'drag',trace:{path:'trace.json',sha256:'0'.repeat(64),frameCount:30}}]}]};
 assert.deepEqual(parseNativeTraining(input),input);
 Reflect.deleteProperty(input.runs[0].scenarios[0].trace,'frameCount');
 assert.throws(()=>parseNativeTraining(input),/frameCount/);
});
test('atlas registration requires the encoded image binding before loading it',()=>{
 const input={sourceDecodedRgbaSha256:'source',atlases:[{id:'surface',path:'surface.png',width:256,height:128,
   encodedSha256:'encoded',decodedRgbaSha256:'decoded',sourceDecodedRgbaSha256:'source'}]};
 assert.deepEqual(parseAtlasManifest(input),input);
 Reflect.deleteProperty(input.atlases[0],'encodedSha256');
 assert.throws(()=>parseAtlasManifest(input),/encodedSha256/);
});
