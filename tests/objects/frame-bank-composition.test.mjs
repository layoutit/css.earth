import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseAuthoredObjectDescriptor} from '@cssearth/objects';
import {assertLayeredGiantFrameBank} from '../../tools/objects/giant-layers/object.mts';

const readJson=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const input=async id=>{
  const root=`../../src/planets/${id}/`;
  return {descriptor:parseAuthoredObjectDescriptor(await readJson(`${root}object.json`)),
    material:await readJson(`${root}source/preparation/materials.json`),
    presentation:await readJson(`${root}source/preparation/presentation.json`),
    runtime:await readJson(`${root}prepared/runtime.json`)};
};

test('authored frame banks describe the accepted source and runtime residency',async()=>{
  for(const id of ['jupiter','uranus','neptune']){
    const {descriptor,material,presentation,runtime}=await input(id);
    assertLayeredGiantFrameBank(descriptor,material,presentation);
    const declared=descriptor.recipe.frameBanks[0];
    const track=runtime.materials.find(track=>track.id===descriptor.recipe.materials.find(material=>material.frameBank===declared.id).id);
    const resources=track.banks.flatMap(bank=>bank.frames.map(frame=>frame.resource));
    const pools=new Set(runtime.assets.entries.filter(entry=>resources.includes(entry.key)).map(entry=>entry.pool));
    assert.equal(pools.size,1,`${id}: frame rows share the declared residency pool`);
    assert.equal(runtime.assets.pools.find(pool=>pools.has(pool.id)).capacity,declared.residentRows,id);
  }
});

test('frame, row and residency drift fail capability composition before preparation',async()=>{
  const {descriptor,material,presentation}=await input('uranus');
  for(const [field,value] of [['frames',255],['rows',15],['residentRows',3]]){
    const changed=structuredClone(descriptor);changed.recipe.frameBanks[0][field]=value;
    assert.throws(()=>assertLayeredGiantFrameBank(changed,material,presentation),/Authored frame bank/);
  }
  const changed=structuredClone(presentation);
  changed.resources.pools.find(pool=>pool.id===changed.resources.rowPool).options.capacity=3;
  assert.throws(()=>assertLayeredGiantFrameBank(descriptor,material,changed),/row resource pool/);
});
