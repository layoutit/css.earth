import {requireObjectRuntimeDefinition} from '../../tools/contract/object-runtime-contract.mts';
import {shape,array,text,number,optional} from '../../tools/objects/terrestrial-layers/source-records.mts';
import {required} from '../../tools/contract/test-values.mts';
import { sourceTest } from './source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseAuthoredObjectDescriptor} from '@cssearth/objects';
import {assertLayeredGiantFrameBank} from '../../tools/objects/giant-layers/object.mts';

const readJson=async (path: string|URL)=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const input=async (id: string)=>{
  const root=`../../src/objects/${id}/`;
  return {descriptor:parseAuthoredObjectDescriptor(await readJson(`${root}object.json`)),
    material:await readJson(`${root}source/preparation/materials.json`),
    // Row resource pools are optional since the focused heliocentric views (#123); the tool checks them only when declared.
    presentation:shape({resources:optional(shape({rowPool:text,pools:array(shape({id:text,options:shape({capacity:optional(number)})}))}))})(await readJson(`${root}source/preparation/presentation.json`)),
    runtime:requireObjectRuntimeDefinition(await readJson(`${root}prepared/runtime.json`))};
};

test('authored frame banks describe the accepted source and runtime residency',async()=>{
  for(const id of ['jupiter','uranus','neptune']){
    const {descriptor,material,presentation,runtime}=await input(id);
    assertLayeredGiantFrameBank(descriptor,material,presentation);
    const declared=required(descriptor.recipe.frameBanks)[0];
    const track=required(runtime.materials.find((track: { id: string; })=>track.id===required(required(descriptor.recipe.materials).find(material=>material.frameBank===declared.id)).id));
    const resources=track.banks.flatMap(bank=>required(bank.frames).map(frame=>frame.resource));
    const pools=new Set(runtime.assets.entries.filter(entry=>resources.includes(entry.key)).map(entry=>entry.pool));
    assert.equal(pools.size,1,`${id}: frame rows share the declared residency pool`);
    assert.equal(required(runtime.assets.pools.find(pool=>pools.has(pool.id))).capacity,declared.residentRows,id);
  }
});

test('frame, row and residency drift fail capability composition before preparation',async()=>{
  const {descriptor,material,presentation}=await input('uranus');
  for(const [field,value] of [['frames',255],['rows',15],['residentRows',3]] as const){
    const changed={...descriptor,recipe:{...descriptor.recipe,frameBanks:required(descriptor.recipe.frameBanks).map((bank,i)=>i===0?{...bank,[field]:value}:bank)}};
    assert.throws(()=>assertLayeredGiantFrameBank(changed,material,presentation),/Authored frame bank/);
  }
  // A declared row pool must still match the resident rows; Uranus declares none today, so exercise the check with one.
  const changed={...presentation,resources:{rowPool:'rows',pools:[{id:'rows',options:{capacity:3}}]}};
  assert.throws(()=>assertLayeredGiantFrameBank(descriptor,material,changed),/row resource pool/);
});
