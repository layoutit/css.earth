import { sourceTest } from '../../source-test.mts';
const test = sourceTest('donaldjohanson');
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeLlorri,bindSipCamera,sipPixel} from '../../../../tools/objects/terrestrial-layers/llorri-geo.mts';
import {readFitsPrimary} from '../../../../tools/objects/observation/fits.mts';
const root='src/objects/donaldjohanson/source/';
const camera=JSON.parse((await readFile(root+'observations/llorri-camera.json')).toString('utf8'));
const bytes=await readFile(root+'observations/lor_0798443290_04598_00035_1x1_sci_03.fit');
test('Lucy TAN-SIP agrees with disjoint Astropy coordinates and the published withheld landmark',()=>{
  const f=bindSipCamera(camera);
  for(const a of camera.checks.astropyProjectionAnchors){
    const p=f.projectPoint(a.pointKm);assert.ok(Math.hypot(p[0]-a.pixel[0],p[1]-a.pixel[1])<1e-7);
    const ideal=sipPixel(camera,p[0],p[1],false),roundtrip=sipPixel(camera,ideal[0],ideal[1],true);
    assert.ok(Math.hypot(roundtrip[0]-p[0],roundtrip[1]-p[1])<1e-7);
  }
  const a=camera.checks.anchors.find((a: { role: string; })=>a.role==='holdout'),p=f.projectPoint(a.pointKm);
  assert.equal(a.name,'Narmada');assert.ok(Math.hypot(p[0]-a.pixel[0],p[1]-a.pixel[1])<2);
});
test('Lucy preserves calibrated darkness and rejects every nonzero paired quality bit',()=>{
  const frame=decodeLlorri(bytes,camera),i=124*1024+588;
  assert.ok(Math.abs(frame.planes.IMAGE[i]-37963.3903503418)<.002);assert.equal(frame.acceptPixel(i),true);
  const image=readFitsPrimary(bytes),sigma=readFitsPrimary(bytes.subarray(image.nextOffset));
  const qstart=image.nextOffset+sigma.nextOffset,quality=readFitsPrimary(bytes.subarray(qstart));
  // Derive each HDU data start from its padded extent, independently of decoding.
  const dataStart=image.nextOffset-1024*1024*4-((2880-(1024*1024*4)%2880)%2880);
  const qdata=qstart+quality.nextOffset-1024*1024*2-((2880-(1024*1024*2)%2880)%2880);
  for(const flag of [1,2,4,8,16,32]){
    const b=Buffer.from(bytes);b.writeInt16BE(flag-32768,qdata+i*2);
    assert.equal(decodeLlorri(b,{...camera,imageSha256:createHash('sha256').update(b).digest('hex')}).acceptPixel(i),false);
  }
  const dark=Buffer.from(bytes);dark.writeFloatBE(0,dataStart+i*4);
  const f=decodeLlorri(dark,{...camera,imageSha256:createHash('sha256').update(dark).digest('hex')});
  assert.equal(f.acceptPixel(i),true);assert.equal(f.planes.IMAGE[i],0);
  assert.throws(()=>decodeLlorri(dark,camera),/bound/);
});
