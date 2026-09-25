import { fixtureRecord } from '../../contract/test-values.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import{readFile,mkdtemp,readdir,rm}from'node:fs/promises';
import{join}from'node:path';
import{tmpdir}from'node:os';
import{phaseLightDirection,rasterPhotometricDisc,parsePhotometricDiscRecipe,preparePhotometricDisc}from'./photometric-disc.mts';
import{limbLawFromRecords}from'../../photometry/limb.mts';
import{parsePhotometricModelRecord}from'../../photometry/model-record.mts';

const minnaert=(k: number)=>parsePhotometricModelRecord({schema:'cssearth-photometric-model@1',id:`fixture-k${String(k).replace('.','-')}`,instrument:'fixture',filter:'fixture',quantity:'radiance-factor',model:{family:'separable',disk:{family:'minnaert',coefficient:k,coefficientPerDegree:0}},fit:{phaseDegrees:[0,10],emissionDegrees:[0,80]}});

test('declared light azimuth keeps the phase and a unit direction',()=>{
 for(const z of[-1,-.5,0,.5,1]){const direction=phaseLightDirection(z,[.3,-.4,.5]);assert.equal(direction[2],z);assert.ok(Math.abs(Math.hypot(...direction)-1)<1e-12);}
});
test('published-law overlays preserve coverage, leave the flood-lit centre untouched and darken the night side',()=>{
 const config: Parameters<typeof rasterPhotometricDisc>[0]={
 schema:'cssearth-photometric-disc@1',namespace:'fixture',urlPrefix:'/fixture',sources:[],limb:{models:['photometry/a.json','photometry/b.json','photometry/c.json'],reference:'fixture.png'},presentationSize:16,pixelDensity:1,
 bank:{frames:3,framesPerRow:3,columns:3,gutter:1,maximumRetainedRows:1},rowOutput:'row-{row}.webp',shadowlessOutput:'shadowless.webp',encoding:{lossless:true,effort:0,alphaQuality:100},qualification:'synthetic analytic fixture',shapePrecisionDigits:6,
 shape:{equatorialRadius:7,polarRadius:6},frameSize:16,scenePitchDegrees:30,systemRotationXDegrees:5,rasterSurfaceRadius:6,presentationScale:1.002,contentScale:.992,referenceLightDirection:[.3,-.4,.866],
 law:limbLawFromRecords(['photometry/a.json','photometry/b.json','photometry/c.json'],[minnaert(.8),minnaert(.9),minnaert(1)]),reference:[160,150,140]};
 const flood=rasterPhotometricDisc(config,1,{shadowless:true}),day=rasterPhotometricDisc(config,1),night=rasterPhotometricDisc(config,-1),centre=(8*16+8)*4+3;
 assert.equal(flood.data[3],0);assert.equal(night.data[3],0);assert.ok(flood.data[centre]<=2);
 assert.equal(night.data[centre],255);assert.ok(day.data[centre]<night.data[centre]);assert.throws(()=>Reflect.apply(rasterPhotometricDisc, undefined, [config, 2]),/phase/);
});
test('invalid photometric recipes and altered source pins fail before writing',async()=>{
 const sourceDirectory=new URL('../../../src/objects/jupiter/source/',import.meta.url).pathname,config=parsePhotometricDiscRecipe(JSON.parse(await readFile(join(sourceDirectory,'preparation/materials.json'),'utf8')));
 for(const change of[
 (c: unknown)=>fixtureRecord(c).rowOutput='../escape-{row}.webp',
 (c: unknown)=>fixtureRecord(c,'shape').polarRadius=0,
 (c: unknown)=>fixtureRecord(c,'limb').models=['photometry/only-one.json'],
 (c: unknown)=>fixtureRecord(c,'bank').frames=1,
 (c: unknown)=>fixtureRecord(c).shapePrecisionDigits=99
]){const invalid=structuredClone(config);change(invalid);assert.throws(()=>parsePhotometricDiscRecipe(invalid));}
});
