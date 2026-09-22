import { required } from '../../contract/test-values.mts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseObjShape } from './obj-shape.mts';
import { parseObjTextureCoordinates, createObjUvFitsSampler, validateObjUvFits } from './obj-uv-fits.mts';

// Independent two-layer geometry: a center ray can see multiple surfaces,
// whereas a local surface point still identifies its own released UV island.
const obj = 'v -1 -1 1\nv 1 -1 1\nv -1 1 1\nv -1 -1 2\nv 1 -1 2\nv -1 1 2\n'+
  'vt 0.25 0.25\nvt 0.75 0.25\nvt 0.25 0.75\n'+
  'vt 0.75 0.75\nvt 0.75 0.75\nvt 0.75 0.75\n'+
  'f 1/1 2/2 3/3\nf 4/4 5/5 6/6\n';
const mesh = parseObjShape(obj, { metersPerUnit: 1, expectedVertices: 6, expectedFaces: 2 });
const mapping = parseObjTextureCoordinates(obj, mesh);
const fits = { bitpix: -32, width: 2, height: 2, values: [10,20,30,40], scale: 1, zero: 0 };
const lens = { grid: { bitpix: -32, width: 2, height: 2, flipV: false }, sampling: 'bilinear', surfaceSampling: { method: 'closest-source-point', maximumDistanceMeters: .1 } };

test('source UV barycentrics preserve island identity and declared image orientation', () => {
  const sample = createObjUvFitsSampler(mesh, mapping, fits, lens);
  assert.equal(required(sample.samplePoint([-1,-1,1])).value, 10);
  assert.equal(required(sample.samplePoint([0,-1,1])).value, 15);
  assert.equal(required(sample.samplePoint([-1,0,1])).value, 20);
  assert.equal(required(sample.samplePoint([-1,-1,2])).value, 40);
  assert.equal(sample.samplePoint([-1,-1,1.5]), null);
  assert.equal(required(createObjUvFitsSampler(mesh, mapping, fits, { ...lens, grid: {...lens.grid, flipV:true} }).samplePoint([-1,-1,1])).value, 30);
  assert.equal(sample.sample(225, 80), null, 'a radial preview must withhold ambiguous layers');
});

test('source UV mapping rejects mismatched connectivity and incomplete texel support', () => {
  assert.throws(() => parseObjTextureCoordinates(obj.replace('f 1/1 2/2 3/3','f 2/1 1/2 3/3'), mesh), /differs/);
  assert.throws(() => parseObjTextureCoordinates(obj.replace('3/3', '3/99'), mesh), /Incomplete/);
  const sample = createObjUvFitsSampler(mesh, mapping, { ...fits, values:[10,NaN,30,40] }, lens);
  assert.equal(sample.samplePoint([0,-1,1]), null, 'missing interpolation support is not filled');
  assert.equal(createObjUvFitsSampler(mesh,mapping,fits,{...lens,grid:{...lens.grid,noData:20}}).samplePoint([0,-1,1]), null);
  assert.throws(() => createObjUvFitsSampler(mesh,mapping,{...fits,scale:2},lens), /encoding/);
});

test('nearest sampling preserves a supported texel while bilinear requires every neighbour', () => {
  const incomplete = { ...fits, values:[10,NaN,30,40] };
  const nearest = createObjUvFitsSampler(mesh,mapping,incomplete,{...lens,sampling:'nearest'});
  assert.equal(required(nearest.samplePoint([-.2,-1,1])).value,10);
  assert.equal(nearest.samplePoint([.2,-1,1]),null);
  assert.equal(createObjUvFitsSampler(mesh,mapping,incomplete,lens).samplePoint([-.2,-1,1]),null);
  const flipped = createObjUvFitsSampler(mesh,mapping,fits,{...lens,sampling:'nearest',grid:{...lens.grid,flipV:true}});
  assert.equal(required(flipped.samplePoint([.2,-1,1])).value,40);
});

test('UV recipe binds one original mesh and a finite simplification error bound', () => {
  const recipe = { ...lens, meshPath:'shape/model.obj', labelPath:'science/map.lblx' };
  const terrain = { path:'shape/model.obj', format:'wavefront-obj', simplification:{ method:'source-meshoptimizer', maximumErrorMeters:.1 } };
  assert.doesNotThrow(() => validateObjUvFits(recipe, terrain));
  assert.throws(() => validateObjUvFits({...recipe,meshPath:'another.obj'},terrain));
  assert.throws(() => validateObjUvFits({...recipe,surfaceSampling:{...lens.surfaceSampling,maximumDistanceMeters:Infinity}},terrain));
  assert.throws(() => validateObjUvFits({...recipe,grid:{...lens.grid,flipV:undefined}},terrain));
});
