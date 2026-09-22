import { required } from '../../contract/test-values.mts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodeCalibratedCamera,controlledShapeCamera,insetCoverage} from './shape-camera-mosaic.mts';
import {parsePdsPlateShape} from './obj-shape.mts';

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
  assert.ok(required(c.project([0,1000,0]))[0]>512);assert.ok(required(c.project([0,0,1000]))[1]<400);
  const rotated=controlledShapeCamera({...f,northAzimuthDegrees:90});
  assert.ok(required(rotated.project([0,0,1000]))[0]>512);assert.ok(Math.abs(required(rotated.project([0,0,1000]))[1]-400)<1e-8);
  const near=required(c.project([100000,1000,0]))[0]-512,far=required(c.project([0,1000,0]))[0]-512;
  assert.ok(Math.abs(near/far-10/9)<1e-12);
});

test('PDS4 zero-based plate topology supports external camera and shadow rays',()=>{
  const text='6 8\n2 0 0\n-2 0 0\n0 3 0\n0 -3 0\n0 0 4\n0 0 -4\n0 2 4\n2 1 4\n1 3 4\n3 0 4\n2 0 5\n1 2 5\n3 1 5\n0 3 5';
  const profile={metersPerUnit:1000,expectedVertices:6,expectedFaces:8,indexBase:0};
  const mesh=parsePdsPlateShape(text,profile);assert.equal(mesh.sample(0,0),2000);
  assert.equal(required(mesh.intersect([5000,0,0],[-1,0,0])).radius,3000);
  assert.equal(mesh.intersect([5000,0,0],[1,0,0]),null);
  assert.equal(mesh.intersect([5000,0,0],[-1,0,0],2500),null);
  assert.throws(()=>parsePdsPlateShape(text,{...profile,indexBase:1}),/absent/);
});

test('Voyager geometric images use signed HALF pixels and their FICOR I/F scale',()=>{
  for(const endian of ['LOW','HIGH']){
    const b=Buffer.alloc(516);b.write(`LBLSIZE=512 FORMAT='HALF' ORG='BSQ' NS=2 NL=1 NB=1 NBB=0 NLB=0 RECSIZE=4 INTFMT='${endian}' REALFMT='VAX' LABEL3='FOR (I/F)*10000., MULTIPLY DN VALUE BY 2.00000'`);
    [-30,500].forEach((v,i)=>endian==='LOW'?b.writeInt16LE(v,512+2*i):b.writeInt16BE(v,512+2*i));
    const im=decodeCalibratedCamera(b);assert.ok(Math.abs(im.data[0]+.006)<1e-8);assert.ok(Math.abs(im.data[1]-.1)<1e-8);
    const uncalibrated=Buffer.from(b);uncalibrated.write('X',uncalibrated.indexOf('FOR (I/F)'));
    assert.throws(()=>decodeCalibratedCamera(uncalibrated),/layout/);
  }
});

// Raw detector DN is opt-in: it must never be misreported as calibrated I/F.
test('raw BYTE camera skips telemetry and each row prefix without treating it as radiance',()=>{
  const b=Buffer.alloc(512+5+10,255);b.fill(0,0,512);
  b.write("LBLSIZE=512 FORMAT='BYTE' ORG='BSQ' NS=3 NL=2 NB=1 NBB=2 NLB=1 RECSIZE=5 ");
  b.set([222,223,0,51,102,224,225,153,204,255],517);
  const result=decodeCalibratedCamera(b,'vicar-byte-dn');
  assert.equal(result.encoding,'vicar-byte-dn');
  assert.equal(result.offset,517);
  assert.deepEqual(Array.from(result.data).map(v=>Math.round(v*255)),[0,51,102,153,204,255]);
  assert.throws(()=>decodeCalibratedCamera(b),/Unsupported/);
  assert.throws(()=>decodeCalibratedCamera(b.subarray(0,-1),'vicar-byte-dn'),/Unsupported/);
});

test('coverage uncertainty insets known gaps while retaining dark valid interior samples',()=>{
  const width=11,height=11,image={width,height,data:new Float32Array(width*height).fill(.1),missing:new Uint8Array(width*height)};
  image.missing[5*width+2]=1;image.data[5*width+7]=.00001;
  insetCoverage(image,2);
  assert.equal(image.missing[5*width+4],1); // Two pixels from an identified hole.
  assert.equal(image.missing[5*width+5],0); // Beyond the uncertainty band.
  assert.equal(image.missing[5*width+7],0); // Dim observed terrain is not a gap.
  assert.equal(image.data[5*width+7],Math.fround(.00001));
  assert.equal(image.missing[2*width+5],1); // Raster edge receives the same margin.
  assert.throws(()=>insetCoverage(image,-1),/inset/);
});
