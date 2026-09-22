import { required, fixtureRecord } from '../../contract/test-values.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { prepareGiottoProjection, createGiottoSampler, polygonInteriorDistance } from './prepare-giotto.mts';
import { parsePdsRadiusTable } from '../terrestrial-layers/obj-shape.mts';

const source = resolve('src/objects/comet-1p/source');

test('Giotto preparation reproduces the reviewed image and lossless footprint', async () => {
  const result = await prepareGiottoProjection(source);
  assert.deepEqual(result.png, await readFile(resolve(source, 'material/giotto.png')));
  assert.deepEqual(result.validity, await readFile(resolve(source, 'reference/giotto-validity.bin')));
  const { data } = await sharp(result.png).raw().toBuffer({ resolveWithObject:true });
  for (let i = 0; i < result.validity.length; i++) {
    const isGap = data[i*3] === 0 && data[i*3+1] === 0 && data[i*3+2] === 0;
    assert.equal(isGap, result.validity[i] === 0);
  }
  assert.ok(result.report.coverage.sampledSurfacePercent > 4 && result.report.coverage.sampledSurfacePercent < 5);
  assert.equal(fixtureRecord(result.report.camera).cameraPoseWasFittedToOutline, false);
  assert.equal(fixtureRecord(result.report.camera).modelWasDeformed, false);
});

test('Source darkness does not remove an otherwise visible photographic sample', async () => {
  const registration = JSON.parse(await readFile(resolve(source, 'reference/giotto-registration.json'), 'utf8'));
  const mesh = parsePdsRadiusTable(await readFile(resolve(source, 'shape/1682q1halley.tab'), 'utf8'), {
    stepDegrees:5, longitudeDirection:'east-positive', metersPerUnit:1000, expectedVertices:2522, expectedFaces:5040,
  });
  const image = { width:1024,height:1280,data:Buffer.alloc(1024*1280*3) };
  const black = createGiottoSampler(mesh, registration, image);
  const white = createGiottoSampler(mesh, registration, { ...image,data:Buffer.alloc(image.data.length,255) });
  let observed = 0, missing = 0;
  for (let id = 0; id < mesh.indices.length; id++) {
    const vertices = mesh.indices[id].map(i => mesh.positions[i]);
    const point = [0,1,2].map(k => vertices.reduce((sum,v) => sum+v[k]/3,0));
    const a = black(point,id), b = white(point,id);
    assert.equal(Boolean(a), Boolean(b));
    if (a) { observed++; assert.deepEqual(a.color,[1,1,1]); assert.deepEqual(required(b).color,[255,255,255]); }
    else missing++;
  }
  assert.ok(observed > 0 && missing > observed);
});

test('The coverage inset respects a concave notch and both sides of its boundary', () => {
  const polygon = [[0,0],[10,0],[10,10],[6,10],[6,4],[4,4],[4,10],[0,10]];
  assert.equal(polygonInteriorDistance([5,7],polygon),-1);
  assert.equal(polygonInteriorDistance([2,7],polygon),2);
  assert.equal(Math.abs(polygonInteriorDistance([4,7],polygon)),0);
});
