import assert from 'node:assert/strict';
import {test} from 'node:test';
import profile from '../../../src/planets/mars/source/preparation/ellipsoid.json' with {type:'json'};
import {createEllipsoidGeometry} from './ellipsoid-geometry.mts';
import {preparePolarAtlas} from './polar-stabilization.mts';
import {prepareEllipsoidMaterialPlaneTransform} from './material-plane.mts';

test('ellipsoid axes and latitude bands agree with independently calculated coordinates', () => {
  const geometry=createEllipsoidGeometry(profile);
  assert.deepEqual(geometry.point(0,0),[230,0,0]);
  assert.ok(Math.abs(geometry.point(Math.PI/2,0)[2]-230*3376.2/3396.19)<1e-12);
  assert.deepEqual(geometry.rasterBands(1024)[0],{y:960,height:48});
  assert.equal(geometry.silhouetteVertices().length,17*32+2);
  const sphere=createEllipsoidGeometry({...profile,equatorialRadius:100,equatorialRadiusKm:1,polarRadiusKm:1});
  assert.equal(sphere.polarRadius,100);
});

test('authored polar stabilization retains source edges and transparent outside corners', () => {
  const data=Buffer.alloc(32*16*3);
  for(let i=0;i<32*16;i++)data.set([120,80,40],i*3);
  const atlas=preparePolarAtlas({data,info:{width:32,height:16,channels:3}},16,profile.polar);
  assert.deepEqual([atlas.width,atlas.height],[32,16]);
  assert.equal(atlas.data[3],0);
  assert.deepEqual([...atlas.data.subarray((8*32+8)*4,(8*32+8)*4+4)],[120,80,40,255]);
  assert.equal(atlas.stabilization.boundaryAngularSmoothingDegrees,12);
});

test('counter-rotated plane maps differently sized shapes using authored physical axes', () => {
  const geometry=createEllipsoidGeometry(profile);
  const options={pitchDegrees:40,yawDegrees:0,outputSize:512,contentRadius:238,physicalRadius:230,
    equatorialRadius:230,polarRadius:geometry.polarRadius,axialTiltDegrees:25.19,bodyRotationDegrees:145,depthBias:1.3};
  const transform=prepareEllipsoidMaterialPlaneTransform(options);
  assert.match(transform,/^matrix3d\(/);
  assert.equal(transform.slice(9,-1).split(',').length,16);
  assert.notEqual(prepareEllipsoidMaterialPlaneTransform({...options,polarRadius:200}),transform);
  assert.throws(()=>prepareEllipsoidMaterialPlaneTransform({...options,axialTiltDegrees:NaN}),/invalid/);
});
