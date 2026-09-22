import { fixtureRecord } from '../../contract/test-values.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import{readFile,mkdtemp,readdir,rm}from'node:fs/promises';
import{join}from'node:path';
import{tmpdir}from'node:os';
import{encodeAttenuatedSrgb,phaseLightDirection,rasterPhotometricDisc,parsePhotometricDiscRecipe,preparePhotometricDisc}from'./photometric-disc.mts';

test('linear-light attenuation retains exact endpoints and declared light azimuth',()=>{
 for(const channel of[0,16,160,255]){assert.equal(encodeAttenuatedSrgb(channel,1),channel);assert.equal(encodeAttenuatedSrgb(channel,0),0);}
 for(const z of[-1,-.5,0,.5,1]){const direction=phaseLightDirection(z,[.3,-.4,.5]);assert.equal(direction[2],z);assert.ok(Math.abs(Math.hypot(...direction)-1)<1e-12);}
});
test('hypothetical Minnaert overlays preserve coverage and do not replace source colour',()=>{
 const config: Parameters<typeof rasterPhotometricDisc>[0]={
 schema:'cssearth-photometric-disc@1',namespace:'fixture',urlPrefix:'/fixture',sources:[],minnaertSource:'fixture',minnaertSourceChannels:['r','g','b'],presentationSize:16,pixelDensity:1,
 bank:{frames:3,framesPerRow:3,columns:3,gutter:1,maximumRetainedRows:1},rowOutput:'row-{row}.webp',shadowlessOutput:'shadowless.webp',encoding:{lossless:true,effort:0,alphaQuality:100},qualification:'synthetic analytic fixture',shapePrecisionDigits:6,
 shape:{equatorialRadius:7,polarRadius:6},frameSize:16,scenePitchDegrees:30,systemRotationXDegrees:5,rasterSurfaceRadius:6,presentationScale:1.002,contentScale:.992,referenceLightDirection:[.3,-.4,.866],referenceChannel:160,ambientIntensity:.05,terminatorSmoothstep:[0,.1],minnaertChannels:[.8,.9,1]};
 const day=rasterPhotometricDisc(config,1),night=rasterPhotometricDisc(config,-1);assert.equal(day.data[3],0);assert.equal(night.data[3],0);
 assert.ok(night.data[(8*16+8)*4+3]>day.data[(8*16+8)*4+3]);assert.throws(()=>Reflect.apply(rasterPhotometricDisc, undefined, [config, 2]),/phase/);
});
test('invalid photometric recipes and altered source pins fail before writing',async()=>{
 const sourceDirectory=new URL('../../../src/objects/jupiter/source/',import.meta.url).pathname,config=parsePhotometricDiscRecipe(JSON.parse(await readFile(join(sourceDirectory,'preparation/materials.json'),'utf8')));
 for(const change of[
 (c: unknown)=>fixtureRecord(c).rowOutput='../escape-{row}.webp',
 (c: unknown)=>fixtureRecord(c,'shape').polarRadius=0,
 (c: unknown)=>fixtureRecord(c).terminatorSmoothstep=[1,0],
 (c: unknown)=>fixtureRecord(c,'bank').frames=1,
 (c: unknown)=>fixtureRecord(c).shapePrecisionDigits=99
]){const invalid=structuredClone(config);change(invalid);assert.throws(()=>parsePhotometricDiscRecipe(invalid));}
});
