import assert from 'node:assert/strict';
import test from 'node:test';
import { sphereDictionary,decodeSphereDictionary } from './sphere-bank-codec.mts';
import { sphereDirection } from './sphere-bank.mts';
import { requireRecord, requireFiniteNumber } from '@cssearth/core';

test('sphere dictionary shares prepared geometry and decodes it exactly',()=>{
  const dictionary=sphereDictionary(),geometry={nodes:[{style:'transform:scale(2)',parent:-1}],boxes:[1,2,3]};
  const first=dictionary.add({id:'first',geometry}),second=dictionary.add({id:'second',geometry});
  assert.deepEqual(decodeSphereDictionary(dictionary.entries)(first),{id:'first',geometry});
  assert.deepEqual(decodeSphereDictionary(dictionary.entries)(second),{id:'second',geometry});
  assert.equal(dictionary.add(geometry),dictionary.add(geometry));
  assert.throws(()=>decodeSphereDictionary([{array:[0]}]),/reference/u);
  assert.throws(()=>sphereDirection([0,0,0]),/unit/u);assert.throws(()=>sphereDirection([1,0,NaN]));
});

test('pack-time bank retains the exact source sphere geometry, camera, styles and physical frame',async()=>{
  const {requireWorkspace}=await import('@cssearth/telescope-core/node');
  const {resolve}=await import('node:path');
  const {inspectMeasurementSphere}=await import('./sphere-inputs.mts');
  const root=requireWorkspace();
  for(const id of ['mercury','eris']) {
    const source=await inspectMeasurementSphere(root,id),packed=await inspectMeasurementSphere(resolve(root,'packages/telescope-cli/data/spheres'),id);
    assert.deepEqual(packed.original.tree.nodes,source.original.tree.nodes);
    assert.deepEqual(packed.original.viewBindings,source.original.viewBindings);
    assert.deepEqual(packed.original.camera,source.original.camera);
    assert.deepEqual(packed.styles,source.styles);
    const {parsePreparedWorldCameraFrame}=await import('@cssearth/objects');
    assert.deepEqual(packed.worldFrame,parsePreparedWorldCameraFrame(source.worldFrame));
    assert.equal(packed.inputs.length,1);assert.match(packed.inputs[0].identity,/sphere-bank\.json\.gz$/u);
    assert.equal(packed.recipe.surfaces.length,1);
  }
});

test('oracle validates a fresh bank-backed fixture sphere and rejects scene and pin mutations',async()=>{
  const {requireWorkspace}=await import('@cssearth/telescope-core/node');
  const {resolve}=await import('node:path');const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');
  const {writeHtmlFixtures}=await import('../delivery/html-fixture.mts');
  const {measurementSphere,sphereHtml}=await import('@cssearth/telescope/sphere/lane');
  const {loadSolarGeometry}=await import('@cssearth/bake/objects/scene');
  const {assertSphereScene}=await import('./sphere-oracle.mts');
  const {parseHTML}=await import('linkedom');
  const root=requireWorkspace(),directory=await mkdtemp(resolve(tmpdir(),'bank-oracle-'));
  try{
    await writeHtmlFixtures(directory);
    const prepared=await measurementSphere(resolve(root,'packages/telescope-cli/data/spheres'),'mercury',resolve(directory,'sphere/texture.png'),resolve(directory,'bake'),
      {longitudeDegrees:0,latitudeDegrees:0,zoom:1.1},await loadSolarGeometry(root));
    const html=sphereHtml(prepared,{renderer:prepared.owner},'Fixture sphere','Fixture');
    const result=await assertSphereScene(html,prepared.inputs);
    assert.ok(result.sceneParity.bankBytes!>0);assert.equal(result.sceneParity.physicalFrameValidated,true);
    const {document}=parseHTML(html),template=document.querySelector<HTMLTemplateElement>('template#prepared')!;
    const data=requireRecord(JSON.parse([...template.content.childNodes].map(node=>node.textContent??'').join('')));
    const camera=requireRecord(requireRecord(data.definition).camera);
    camera.defaultControlPitchDegrees=requireFiniteNumber(camera.defaultControlPitchDegrees)+1;
    template.innerHTML=JSON.stringify(data).replaceAll('&','&amp;').replaceAll('<','&lt;');
    await assert.rejects(assertSphereScene(document.toString(),prepared.inputs),/camera changed/u);
    await assert.rejects(assertSphereScene(html,prepared.inputs.map(pin=>pin.role==='prepared sphere bank'?{...pin,bytes:pin.bytes+1}:pin)));
    await assert.rejects(assertSphereScene(html,prepared.inputs.filter(pin=>pin.role!=='prepared sphere bank')),/pin its bank/u);
  }finally{await rm(directory,{recursive:true,force:true});}
});
