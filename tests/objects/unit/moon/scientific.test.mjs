import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {basename} from 'node:path';
import test from 'node:test';
import {parsePdsImage} from '../../../../tools/objects/terrestrial-layers/pds-image.mts';
import {paintScienceSurface, colorForValue} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';

const sourceRoot=new URL('../../../../src/planets/moon/source/',import.meta.url);
const recipe=JSON.parse(await readFile(new URL('preparation/raster.json',sourceRoot),'utf8'));
const anchors=JSON.parse(await readFile(new URL('validation/scientific-source-anchors.json',sourceRoot),'utf8'));

for(const id of ['topography','rock-abundance']) test(`Moon ${id} matches independent original-DN anchors and source coverage`,async()=>{
  const lens=recipe.lenses.find(item=>item.id===id), policy=lens.scientific;
  const name=basename(lens.input,'.img'), expected=anchors.products[name];
  const bytes=await readFile(new URL(lens.input,sourceRoot));
  assert.equal(bytes.length,expected.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),expected.sha256);
  const label=await readFile(new URL(`science/${policy.labelPath}`,sourceRoot),'utf8');
  const map=parsePdsImage(bytes,label,policy);
  for(const key of ['sourcePixels','validPixels','missingPixels','rejectedRangePixels','zeroPixels'])
    assert.equal(map.report[key],expected[key],key);
  for(const key of ['minimum','maximum'])assert.ok(Math.abs(map.report[key]-expected[key])<1e-9,key);
  for(const anchor of expected.anchors){
    assert.equal(bytes.readInt16LE((anchor.line*policy.grid.width+anchor.sample)*2),anchor.raw);
    const value=map.sample(anchor.longitude,anchor.latitude);
    if(anchor.value===null)assert.equal(value,null);
    else assert.ok(Math.abs(value-anchor.value)<1e-9,`${anchor.longitude},${anchor.latitude}`);
  }
  const registration=anchors.crossLensRegistration;
  assert.equal(policy.outputLongitudeOrigin,registration.outputLongitudeOrigin);
  const painted=paintScienceSurface(map,policy,registration.outputWidth,registration.outputHeight);
  for(const anchor of expected.alignmentAnchors){
    assert.equal(bytes.readInt16LE((anchor.sourceLine*policy.grid.width+anchor.sourceSample)*2),anchor.raw);
    const index=anchor.outputLine*registration.outputWidth+anchor.outputSample;
    assert.equal(painted.missing[index],0,anchor.feature);
    const normalized=Math.max(0,Math.min(1,(anchor.value-policy.minimum)/(policy.maximum-policy.minimum)));
    const paletteValue=policy.minimum+Math.round(normalized*1023)/1023*(policy.maximum-policy.minimum);
    assert.deepEqual([...painted.rgb.subarray(index*3,index*3+3)],colorForValue(paletteValue,policy),anchor.feature);
  }
  assert.equal(map.sample(360,0),map.sample(0,0));
  assert.equal(map.sample(-90,0),map.sample(270,0));
  if(id==='topography'){
    assert.equal(map.sample(0,0),-718.5);
    assert.equal(policy.valueTransform.offset,0);
  } else {
    assert.equal(map.sample(0,0),.4);
    assert.equal(map.sample(0,60.001),null);
    assert.equal(map.sample(0,-60.001),null);
    assert.deepEqual(policy.validRange,[0,100]);
  }
});
