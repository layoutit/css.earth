import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publishedImageFrame } from './formats/published-image.mts';
import { createSurfaceObservation } from './surface.mts';
import { parseObjShape } from '../terrestrial-layers/obj-shape.mts';
import { validateSurfaceObservation } from './index.mts';
import { readFile } from 'node:fs/promises';
import { fixtureRecord } from '../../test-values.mts';

const mesh = parseObjShape('v -20 -20 1\nv 20 -20 1\nv 20 20 1\nv -20 20 1\nf 1 2 3\nf 1 3 4\n', { metersPerUnit: 1, expectedVertices: 4, expectedFaces: 2 });
const projection = { status: 'approximate', method: 'Synthetic plane with known pixel correspondence.', limitations: 'Fixture; no measured camera.',
  shapeSha256: 'a'.repeat(64), imageSha256: 'b'.repeat(64), imageSize: [32,32], crop: { left: 0, top: 0, width: 32, height: 32 },
  camera: { right: [1,0,0], up: [0,1,0], eye: [0,0,1], center: [16,16], pixelsPerMeter: 1 },
  mask: { polygon: [[1,1],[30,1],[30,30],[1,30]], insetPixels: 2 } };
const limits = { maximumSourceDistanceMeters: .1, maximumSeparationFootprints: 2, visibilityToleranceMeters: .01, maximumEmissionDegrees: 60 };
const rgb = new Uint8Array(32*32*3);
for (let y=0;y<32;y++) for (let x=0;x<32;x++) rgb.set([x*4,y*4,0],(y*32+x)*3);

test('published RGB keeps dark pixels, image axes and all four bounded contributors', () => {
  const frame = publishedImageFrame('plane',projection,rgb,mesh,limits);
  const sample = frame.sample([.5,-.5,1]);
  assert.equal(sample.reason,undefined);
  assert.deepEqual(sample.color,[66,66,0]);
  assert.equal(sample.gain,1);
  assert.equal(frame.sample([-13.5,0,1]).reason,'mask-or-geometry','One rejected contributor withholds the interpolated pixel');
  assert.ok(frame.sample([0,0,-5]).reason,'A detached point must not borrow foreground texels');
  assert.equal(frame.visible([0,0,1]),true);
  assert.equal(frame.visible([0,0,-1]),false,'The front plane occludes a rear point');
  assert.equal(frame.positionKm,null);
});

test('surface transfer retains encoded RGB, uses the grid off the source and reports approximate placement', () => {
  const frame = publishedImageFrame('plane',projection,rgb,mesh,limits);
  const surface = createSurfaceObservation({ frames:[frame], entries:[],
    radial:{ grid:mesh,faces:[{ vertices:[[0,0,1],[1,0,1],[0,1,1]],normal:[0,0,1],vertexNormals:[[0,0,1],[0,0,1],[0,0,1]] }] },
    config:{ geometry:{radius:1,radiusKm:.001,radialTerrain:{path:'plane.obj',simplification:{method:'source-meshoptimizer',maximumErrorMeters:.1}}},raster:{height:180} },
    policy:{format:'published-image-projection',maximumSourceDistanceMeters:.1,precheckDisplayPoint:true,selection:'single',samplesPerTriangle:8,
      display:{range:'authored',low:0,high:255,units:'RGB bytes',colorDisplay:{kind:'provider-rgb',interpolation:'encoded',interpretation:'Published display'}},photometry:{model:'retained-observation'},limits} });
  assert.deepEqual(surface.samplePoint([.5,-.5,1]).color,[66,66,0],'No second gamma curve or contrast stretch');
  assert.ok(surface.samplePoint([0,0,1.2]).reason);
  assert.equal(surface.report.camera.positionKm,null);
  assert.equal(surface.report.camera.kind,'approximate-orthographic');
  assert.deepEqual(surface.report.frames[0].registration,{status:'approximate',qualified:false,method:projection.method,limitations:projection.limitations});
});

test('an approximate recipe refuses a qualification claim, changed image frame, nonorthogonal camera and extra gain', async () => {
  const body: unknown=JSON.parse(await readFile(new URL('../../../src/planets/toutatis/source/preparation/terrestrial.json',import.meta.url),'utf8'));
  const recipe=fixtureRecord(body,'raster','surfaceObservations',0), geometry=fixtureRecord(body,'geometry','radialTerrain');
  validateSurfaceObservation(recipe,geometry);
  for (const alter of [
    (r: unknown) => { fixtureRecord(r,'frames',0,'projection').status='qualified'; },
    (r: unknown) => { fixtureRecord(r,'frames',0,'projection','crop').left=2000; },
    (r: unknown) => { fixtureRecord(r,'frames',0,'projection','camera').right=[1,1,1]; },
    (r: unknown) => { fixtureRecord(r).photometry={model:'retained-observation',maximumGain:2}; },
    (r: unknown) => { fixtureRecord(r,'transfer').maximumSourceDistanceMeters=51; },
  ]) { const changed=structuredClone(recipe);alter(changed);assert.throws(()=>validateSurfaceObservation(changed,geometry)); }
});
