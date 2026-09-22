import { required } from '../../contract/test-values.mts';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {createIndexedShape} from '../terrestrial-layers/obj-shape.mts';
import {deriveVegaCamera} from './encounter-camera.mts';
import {prepareEncounters,decodeVegaImage,createVegaSampler,fitDisplayGain,selectVegaCandidate} from './prepare-encounters.mts';

const source=resolve('src/objects/comet-1p/source');

test('Vega cameras recover the published longitude anchor and independent header geometry',async()=>{
  const first=await deriveVegaCamera(source,'1986-03-09T07:19:58Z');
  const second=await deriveVegaCamera(source,'1986-03-09T07:21:38Z');
  assert.ok(Math.abs(first.eastLongitudeDegrees-270)<1e-9);
  assert.ok(first.latitudeDegrees<0 && second.latitudeDegrees>0,'The two frames view different latitudes.');
  // Independent values transcribed from the original TVS headers, not the fit JSON.
  for(const [camera,range,phase,sun] of [[first,8032,28.7,113.3],[second,11040,23.5,234.7]] as const) {
    assert.ok(Math.abs(camera.rangeKm/range-1)<.01);
    assert.ok(Math.abs(camera.phaseDegrees-phase)<.5);
    assert.ok(Math.abs(camera.sunCounterclockwiseFromUpDegrees-sun)<1.5);
    assert.ok(Math.abs(Math.hypot(...camera.bodyEye)-1)<1e-12);
    assert.ok(Math.abs(camera.bodyRight.reduce((s: number,n: number,i: number)=>s+n*camera.bodyUp[i],0))<1e-12);
  }
  await assert.rejects(deriveVegaCamera(source,'1986-03-09T09:00:00Z'),/qualified close encounter/);
});

test('KFKI detector decoding rejects changed samples, headers and truncated padding',async()=>{
  const bytes=await readFile(resolve(source,'vega/t11190.img'));
  const header=await readFile(resolve(source,'vega/t11190.hdr'));
  const image=decodeVegaImage(bytes,header);
  assert.equal(image.data.length,262144);
  assert.equal(image.data.reduce((sum,n)=>sum+n,0),5208251);
  assert.equal(image.cards.FILTER,'NIR');
  const changed=Buffer.from(bytes);changed[700]++;
  assert.throws(()=>decodeVegaImage(changed,header),/checksum mismatch/);
  assert.throws(()=>decodeVegaImage(bytes,Buffer.from(header.toString().replace('5208251','5208252'))),/checksum mismatch/);
  assert.throws(()=>decodeVegaImage(bytes.subarray(0,262144),header));
});

test('Source visibility and all interpolation corners guard coverage without using brightness',()=>{
  const positions=[[-20000,-20000,0],[20000,-20000,0],[0,20000,0],[-20000,-20000,1000],[20000,-20000,1000],[0,20000,1000]];
  const mesh=createIndexedShape(positions,[[0,1,2],[3,4,5]],{metersPerUnit:1,expectedVertices:6,expectedFaces:2});
  const observation={id:'synthetic',utc:'1986-03-09T07:19:58Z',bodyRight:[1,0,0],bodyUp:[0,1,0],bodyEye:[0,0,1],bodySun:[0,0,1],kmPerPixel:[1,2],scaleMultiplier:1,center:[10,10],footprintPolygon:[[4,4],[16,4],[16,16],[4,16]]};
  const mask={physicalInsetKm:1.1,maximumEmissionDegrees:75,maximumIncidenceDegrees:80};
  const image={data:Buffer.alloc(20*20),width:20,height:20};
  const black=createVegaSampler(mesh,observation,mask,image),white=createVegaSampler(mesh,observation,mask,{...image,data:Buffer.alloc(400,255)});
  assert.equal(required(black([0,0,1000],1)).dn,0);
  assert.equal(required(white([0,0,1000],1)).dn,255);
  assert.deepEqual(required(black([0,0,1000],1)).pixel,required(white([0,0,1000],1)).pixel);
  assert.equal(black([0,0,0],0),null,'A front-facing sample hidden by another source triangle must be rejected.');
  assert.equal(black([-4500,0,1000],1),null,'The sample centre alone cannot qualify a border interpolation.');
  assert.ok(black([-4000,0,1000],1));
  const night=createVegaSampler(mesh,{...observation,bodySun:[0,0,-1]},mask,image);
  assert.equal(night([0,0,1000],1),null);
});

test('Display matching withholds sparse, excessive and inconsistent fits',()=>{
  assert.equal(fitDisplayGain(Array(6).fill(Math.log(2))).accepted,false);
  assert.equal(fitDisplayGain(Array(100).fill(Math.log(3.1))).accepted,false);
  assert.equal(fitDisplayGain(Array.from({length:100},(_,i)=>Math.log(i%2?5:2))).accepted,false);
  const fit=fitDisplayGain(Array.from({length:100},(_,i)=>Math.log(2)+(i%2?.02:0)));
  assert.equal(fit.accepted,true);assert.equal(fit.trainingBlocks,50);assert.equal(fit.heldOutBlocks,50);
  assert.ok(Math.abs(fit.gain-2)<1e-12);
});

test('Observation selection favors resolution and keeps deterministic ties independent of brightness',()=>{
  const coarse={dn:250,pixel:[2,2],emission:.5,resolutionKm:.5};
  const fine={dn:0,pixel:[2,2],emission:1,resolutionKm:.2};
  assert.equal(required(selectVegaCandidate([coarse,fine])).index,1);
  assert.equal(required(selectVegaCandidate([fine,{...fine,dn:255}])).index,0);
  assert.equal(selectVegaCandidate([null,null]),null);
});

test('The reproducible mosaic adds measured area while preserving every Giotto map texel',async()=>{
  const result=await prepareEncounters(source);
  assert.deepEqual(result.png,await readFile(resolve(source,'material/encounters.png')));
  assert.deepEqual(result.attribution,await readFile(resolve(source,'reference/encounter-attribution.bin')));
  assert.deepEqual(result.report,JSON.parse(await readFile(resolve(source,'reference/encounter-projection-report.json'),'utf8')));
  const before=await sharp(resolve(source,'material/giotto.png')).removeAlpha().raw().toBuffer();
  const after=await sharp(result.png).removeAlpha().raw().toBuffer();
  const oldValidity=await readFile(resolve(source,'reference/giotto-validity.bin'));
  const counts=[0,0,0,0];
  for(let i=0;i<result.attribution.length;i++) {
    const id=result.attribution[i];assert.ok(id<4);counts[id]++;
    const black=after.subarray(i*3,i*3+3).every(n=>n===0);
    assert.equal(black,id===0);
    if(oldValidity[i]) {assert.equal(id,1);assert.deepEqual(after.subarray(i*3,i*3+3),before.subarray(i*3,i*3+3));}
  }
  assert.deepEqual(counts,result.report.map.attributionCounts);
  assert.equal(counts[1],4842);
  assert.ok(counts[2]>10000 && counts[3]>5000);
  assert.equal(result.report.coverage.sourceAreaSquareKm,307.7859609260954);
  assert.ok(result.report.coverage.beforePercent>4 && result.report.coverage.beforePercent<5);
  assert.ok(result.report.coverage.afterPercent>27 && result.report.coverage.afterPercent<29);
  assert.equal(result.report.clippedPixels,0);
  for(const observation of result.report.observations.slice(1)) {
    assert.ok('outline' in observation);
    assert.ok(observation.outline.rmsKm<.5 && observation.outline.maximumKm<1);
    assert.ok(observation.outline.heldOutCount>=9);
  }
  assert.equal(result.report.overlap[1].displayFit.accepted,false,'Sparse Giotto overlap cannot set Vega brightness.');
  assert.equal(result.report.overlap[2].displayFit.accepted,true);
});
