import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { ellipsoidParameterMesh, subdividedOctahedron } from './ellipsoid-parameters.mts';
import { contactEllipsoidMesh } from './contact-ellipsoids.mts';

test('ellipsoid scaling preserves axis ratios and the explicit volume convention', () => {
  const model={schema:'cssearth-ellipsoid-parameters@1',scaleConvention:'thermal-radius-as-volume-equivalent',axisRatioAB:2,axisRatioBC:3,thermalRadiusKm:6,subdivisions:3};
  const mesh=ellipsoidParameterMesh(model),[a,b,c]=mesh.axesMeters;
  assert.ok(Math.abs(a/b-2)<1e-12);assert.ok(Math.abs(b/c-3)<1e-12);
  assert.ok(Math.abs(Math.cbrt(a*b*c)-6000)<1e-9);
  for(const p of mesh.positions)assert.ok(Math.abs(p.reduce((s,n,i)=>s+(n/mesh.axesMeters[i])**2,0)-1)<1e-12);
  const edges=new Map();
  for(const f of mesh.indices)for(let i=0;i<3;i++){const a=f[i],b=f[(i+1)%3],key=[a,b].sort((a,b)=>a-b).join(',');edges.set(key,(edges.get(key)??0)+(a<b?1:-1));}
  assert.ok([...edges.values()].every(n=>n===0));
  assert.equal(mesh.positions.length-edges.size+mesh.indices.length,2);
});

test('unsupported scales, invalid axes and unbounded subdivisions are rejected', () => {
  const model={schema:'cssearth-ellipsoid-parameters@1',scaleConvention:'thermal-radius-as-volume-equivalent',axisRatioAB:2,axisRatioBC:3,thermalRadiusKm:6,subdivisions:3};
  for(const patch of [{scaleConvention:'measured-volume'},{axisRatioAB:0},{axisRatioBC:NaN},{thermalRadiusKm:-1},{subdivisions:6}])assert.throws(()=>ellipsoidParameterMesh({...model,...patch}));
  assert.throws(()=>subdividedOctahedron(1.5));
});

test('the common tessellation preserves the established contact-body topology', () => {
  const m=contactEllipsoidMesh({schema:'cssearth-contact-ellipsoids@1',origin:'equal-density-volume-centroid',lobes:[{semiaxesKm:[2.8,2.8,2.8]},{semiaxesKm:[1.2,1.2,1.2]}],fluxScale:.9,subdivisions:4});
  assert.equal(m.positions.length,2052);assert.equal(m.indices.length,4096);
  assert.ok(Math.abs(m.centersMeters[1]-m.centersMeters[0]-4000*Math.sqrt(.9))<1e-9);
});

test('published semiaxes retain absolute lengths without a thermal-radius rescale', () => {
  const model={schema:'cssearth-ellipsoid-parameters@1',scaleConvention:'published-semiaxes',semiaxesKm:[1.95,1.35,1.30],subdivisions:4};
  const mesh=ellipsoidParameterMesh(model);
  assert.deepEqual(mesh.axesMeters,[1950,1350,1300]);
  for(let axis=0;axis<3;axis++){
    assert.equal(Math.max(...mesh.positions.map(p=>p[axis])),mesh.axesMeters[axis]);
    assert.equal(Math.min(...mesh.positions.map(p=>p[axis])),-mesh.axesMeters[axis]);
  }
  for(const patch of [{semiaxesKm:[1,2,3]},{semiaxesKm:[1,1,0]},{semiaxesKm:[1,1]},{semiaxesKm:[Infinity,1,1]},{thermalRadiusKm:4},{axisRatioAB:2}])assert.throws(()=>ellipsoidParameterMesh({...model,...patch}));
  assert.throws(()=>ellipsoidParameterMesh({schema:model.schema,scaleConvention:'thermal-radius-as-volume-equivalent',axisRatioAB:1,axisRatioBC:1,thermalRadiusKm:1,semiaxesKm:[1,1,1],subdivisions:4}));
});

test('an effective radius scales the axis ratios as a volume-equivalent sphere, like the thermal convention', () => {
  const thermal = ellipsoidParameterMesh({ schema: 'cssearth-ellipsoid-parameters@1', scaleConvention: 'thermal-radius-as-volume-equivalent', axisRatioAB: 1.2, axisRatioBC: 1.1, thermalRadiusKm: 2, subdivisions: 2 });
  const effective = ellipsoidParameterMesh({ schema: 'cssearth-ellipsoid-parameters@1', scaleConvention: 'effective-radius-as-volume-equivalent', axisRatioAB: 1.2, axisRatioBC: 1.1, effectiveRadiusKm: 2, subdivisions: 2 });
  assert.deepEqual(effective.axesMeters, thermal.axesMeters);
  const sphere = ellipsoidParameterMesh({ schema: 'cssearth-ellipsoid-parameters@1', scaleConvention: 'effective-radius-as-volume-equivalent', axisRatioAB: 1, axisRatioBC: 1, effectiveRadiusKm: 0.6, subdivisions: 4 });
  assert.deepEqual(sphere.axesMeters, [600, 600, 600]);
  assert.equal(sphere.positions.length, 1026); assert.equal(sphere.indices.length, 2048);
  assert.throws(() => ellipsoidParameterMesh({ schema: 'cssearth-ellipsoid-parameters@1', scaleConvention: 'effective-radius-as-volume-equivalent', axisRatioAB: 1, axisRatioBC: 1, effectiveRadiusKm: 0, subdivisions: 4 }));
});
