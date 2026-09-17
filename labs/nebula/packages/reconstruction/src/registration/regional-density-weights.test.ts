import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRegionalWeights, fitRegionalWeights, regionalBasis } from './regional-density-weights.ts';
import { evaluateForwardHistogram, evaluateForwardModel, projectForwardModel, type ForwardConfig, type ForwardParameters, type WeightedPoint } from './forward-density-fit.ts';
const parameters: ForwardParameters = { rotationXDeg: 0, rotationYDeg: 0, rotationZDeg: 0, xyScale: 1, yScale: 1, zScale: 1, offsetX: 0, offsetY: 0, offsetZ: 0 };
const config: ForwardConfig = { distance: 10, referenceDistance: 10, x: { min: -3, max: 3, bins: 8 }, y: { min: -3, max: 3, bins: 8 }, magnitude: { min: -.5, max: .5, bins: 12 }, sigmaMag: .06, xyKernel: [1,2,1], contaminationFraction: .02 };
const points: WeightedPoint[] = Array.from({ length: 32 }, (_, i) => ({ x: (i % 4 - 1.5) * .6, y: (Math.floor(i / 4) % 4 - 1.5) * .6, z: Math.floor(i / 16) - .5, weight: 1 + i / 100 }));
const footprint = new Float64Array(64).fill(1), split = Uint8Array.from({ length: 64 }, (_, i) => Math.floor(i / 8) < 4 ? 1 : 2);
const options = { spatialScale: .8, bounds: [.5,2] as const, regularization: .01, maxSweeps: 3, refinements: 3 };
test('smooth basis is an additive partition and cached projections reproduce weighted projection', () => {
  for (const p of points) assert.ok(Math.abs(regionalBasis(p,.8).reduce((a,b)=>a+b,0)-1)<1e-14);
  const coefficients = [.6,1.8,.7,1.5,.8,1.9,.9,1.4];
  const saved = structuredClone(points), weighted = applyRegionalWeights(points,coefficients,.8);
  const direct = projectForwardModel(weighted,parameters,config), summed = new Float64Array(direct.length);
  for (let region=0;region<8;region++) {
    const component = points.map(p=>({...p,weight:p.weight*regionalBasis(p,.8)[region]!}));
    const projected = projectForwardModel(component,parameters,config);
    for(let i=0;i<summed.length;i++) summed[i]!+=coefficients[region]!*projected[i]!;
  }
  assert.ok(direct.every((v,i)=>Math.abs(v-summed[i]!)<1e-12));
  assert.deepEqual(points,saved); assert.ok(weighted.every((p,i)=>p.x===points[i]!.x&&p.y===points[i]!.y&&p.z===points[i]!.z));
  const counts = direct.map(v=>100*v+.01);
  const fromHistogram=evaluateForwardHistogram({counts,footprint,split},config,direct,parameters);
  const fromParticles=evaluateForwardModel(weighted,{counts,footprint,split},config,parameters);
  assert.deepEqual(fromHistogram,fromParticles);
});
test('bounded weights fit training only, with geometry frozen and explicit prior', () => {
  const truth=applyRegionalWeights(points,[.6,1.8,.6,1.8,.6,1.8,.6,1.8],.8);
  const reverse=applyRegionalWeights(points,[1.8,.6,1.8,.6,1.8,.6,1.8,.6],.8);
  const target=projectForwardModel(truth,parameters,config), conflict=projectForwardModel(reverse,parameters,config);
  const counts=target.map(v=>100*v+.001);
  const changed=counts.map((v,i)=>split[Math.floor(i/12)]===2?conflict[i]!*3000+.001:v);
  const a=fitRegionalWeights(points,parameters,{counts,footprint,split},config,options);
  const b=fitRegionalWeights(points,parameters,{counts:changed,footprint,split},config,options);
  assert.deepEqual(a.coefficients,b.coefficients); assert.equal(a.amplitude,b.amplitude); assert.equal(a.objective,b.objective);
  assert.notEqual(a.validation.deviance,b.validation.deviance); assert.deepEqual(a.parameters,parameters);
  assert.ok(a.coefficients.every(v=>v>=.5&&v<=2)); assert.ok(a.train.deviance<a.baseline.train.deviance);
  assert.equal(a.regularizationPenalty,a.train.observedCount*.01*a.coefficients.reduce((s,v)=>s+Math.log(v)**2,0));
  assert.deepEqual(a.weightedPoints,applyRegionalWeights(points,a.coefficients,.8));
});
test('unsupported octants retain unit weights; invalid options and histograms fail',()=>{
  const concentrated=[{x:.5,y:.5,z:.5,weight:1}];
  const counts=projectForwardModel(concentrated,parameters,config).map(v=>100*v+.01);
  const result=fitRegionalWeights(concentrated,parameters,{counts,footprint,split},config,{...options,spatialScale:1e-4});
  assert.deepEqual(result.coefficients.slice(0,7),[1,1,1,1,1,1,1]);
  assert.throws(()=>applyRegionalWeights(points,[1],1)); assert.throws(()=>applyRegionalWeights(points,new Array(8).fill(1),0));
  assert.throws(()=>fitRegionalWeights(points,parameters,{counts,footprint,split},config,{...options,regularization:-1}));
  assert.throws(()=>evaluateForwardHistogram({counts,footprint,split},config,new Float64Array(2),parameters));
});
