import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodeCalibratedCamera,controlledShapeCamera} from './shape-camera-mosaic.mjs';
import {parsePdsPlateShape} from './obj-shape.mjs';

test('calibrated VICAR skips binary telemetry and honors source byte order',()=>{
  for(const endian of ['RIEEE','IEEE']){
    const b=Buffer.alloc(512+8+16);b.write(`LBLSIZE=512 FORMAT='REAL' ORG='BSQ' NS=2 NL=2 NB=1 NBB=0 NLB=1 RECSIZE=8 REALFMT='${endian}'`);
    b.fill(255,512,520);
    [.01,.2,.3,.4].forEach((v,i)=>endian==='RIEEE'?b.writeFloatLE(v,520+4*i):b.writeFloatBE(v,520+4*i));
    const image=decodeCalibratedCamera(b);assert.equal(image.offset,520);assert.equal(image.width,2);
    assert.ok(Math.abs(image.data[0]-.01)<1e-8);assert.ok(Math.abs(image.data[3]-.4)<1e-7);
    assert.throws(()=>decodeCalibratedCamera(b.subarray(0,530)),/layout/);
  }
});

test('controlled perspective retains handedness, north azimuth and range scaling',()=>{
  const f={observerLatitude:0,observerWestLongitude:0,sunLatitude:0,sunWestLongitude:0,rangeKm:1000,
    northAzimuthDegrees:0,center:[512,400],pixelAngleMicroradians:6};
  const c=controlledShapeCamera(f);assert.deepEqual(c.project([0,0,0]),[512,400]);
  assert.ok(c.project([0,1000,0])[0]>512);assert.ok(c.project([0,0,1000])[1]<400);
  const rotated=controlledShapeCamera({...f,northAzimuthDegrees:90});
  assert.ok(rotated.project([0,0,1000])[0]>512);assert.ok(Math.abs(rotated.project([0,0,1000])[1]-400)<1e-8);
  const near=c.project([100000,1000,0])[0]-512,far=c.project([0,1000,0])[0]-512;
  assert.ok(Math.abs(near/far-10/9)<1e-12);
});

test('PDS4 zero-based plate topology supports external camera and shadow rays',()=>{
  const text='6 8\n2 0 0\n-2 0 0\n0 3 0\n0 -3 0\n0 0 4\n0 0 -4\n0 2 4\n2 1 4\n1 3 4\n3 0 4\n2 0 5\n1 2 5\n3 1 5\n0 3 5';
  const profile={metersPerUnit:1000,expectedVertices:6,expectedFaces:8,indexBase:0};
  const mesh=parsePdsPlateShape(text,profile);assert.equal(mesh.sample(0,0),2000);
  assert.equal(mesh.intersect([5000,0,0],[-1,0,0]).radius,3000);
  assert.equal(mesh.intersect([5000,0,0],[1,0,0]),null);
  assert.equal(mesh.intersect([5000,0,0],[-1,0,0],2500),null);
  assert.throws(()=>parsePdsPlateShape(text,{...profile,indexBase:1}),/absent/);
});
