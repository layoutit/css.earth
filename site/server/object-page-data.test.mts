import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import {mkdtemp,mkdir,readFile,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {loadObjectPageData,readPreparedObjectBytes} from './object-page-data.mts';
import {objectPageStyles,SHELL_STYLE_FILE,SHELL_STYLE_ID} from '../contracts/object-page-contract.mts';

test('page data and the object transport are read from the restored runtime, with no copy on disk',async t=>{
 const root=await mkdtemp(resolve(tmpdir(),'cssearth-page-data-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const directory=resolve(root,'src/objects/body');await mkdir(resolve(directory,'prepared'),{recursive:true});
 const data={schema:'cssearth-object-runtime@5',camera:{},assets:{entries:[{key:'surface',url:'/scenes/body/surface.webp',pool:'body'}],pools:[{id:'body',capacity:1,concurrency:1,retention:'mount',reuse:false}],startup:['surface']},
  tree:{nodes:[{tag:'u'}]},id:'body',controls:{datasets:{defaultDataset:'shape',controls:[{id:'shape',label:'Shape'}]},settings:{controls:[{kind:'toggle',name:'shadows',label:'Shadows',checked:false}]}}};
 const descriptor={schema:'cssearth-object@2',id:'body',type:'layered-body',properties:{page:{metadata:{url:'prepared/page.json'}}},prepared:{format:'cssearth-css-object@5',url:'prepared/object.json'}};
 await writeFile(resolve(directory,'object.json'),JSON.stringify(descriptor));
 await writeFile(resolve(directory,'prepared/runtime.json'),JSON.stringify(data)+'\n');
 await writeFile(resolve(directory,'prepared/controls.json'),JSON.stringify(data.controls));
 assert.deepEqual(await loadObjectPageData('body',root),{descriptor,assets:data.assets,controls:data.controls,motion:{spin:false,lightCurve:false}});
 // What the runtime's motion plays tells the shell which switches the page gets: a transform track is a spin, an opacity track a light curve.
 const spin={target:1,id:'body-spin',keyframes:[{offset:0,transform:'rotateZ(0deg)'},{offset:1,transform:'rotateZ(360deg)'}],duration:1000,timings:[]};
 const light={target:1,id:'body-light-curve',keyframes:[{offset:0,opacity:'1'},{offset:1,opacity:'0.5'}],duration:1000,timings:[]};
 for(const [motion,kinds] of [[[spin],{spin:true,lightCurve:false}],[[light],{spin:false,lightCurve:true}],[[spin,light],{spin:true,lightCurve:true}],[[],{spin:false,lightCurve:false}]] as const){
  await writeFile(resolve(directory,'prepared/runtime.json'),JSON.stringify({...data,motion})+'\n');
  assert.deepEqual((await loadObjectPageData('body',root)).motion,kinds);
 }
 await writeFile(resolve(directory,'prepared/runtime.json'),JSON.stringify({...data,motion:[{...spin,keyframes:[]}]}));
 await assert.rejects(loadObjectPageData('body',root),/no keyframes/);
 await writeFile(resolve(directory,'prepared/runtime.json'),JSON.stringify(data)+'\n');
 // The transport is the runtime in its envelope, byte for byte what JSON.stringify of the envelope gives.
 const {bytes}=await readPreparedObjectBytes('body',root);
 assert.equal(bytes.toString('utf8'),JSON.stringify({schema:'cssearth-prepared-object@1',id:'body',type:'layered-body',format:'cssearth-css-object@5',data}));
 await writeFile(resolve(directory,'prepared/runtime.json'),JSON.stringify({schema:'cssearth-object-runtime@5',id:'body'}));
 await assert.rejects(loadObjectPageData('body',root),/asset table/);
 await assert.rejects(loadObjectPageData('../body',root),/identity/);
 assert.throws(()=>objectPageStyles({id:'body',properties:{page:{stylesheets:['src/../escape.css']}}}),/invalid/);
});

test('objects own ordered CSS and scene-bound page metadata',async()=>{
 for(const id of ['earth','moon','saturn']){
  const descriptor=JSON.parse(await readFile(new URL(`../../src/objects/${id}/object.json`,import.meta.url),'utf8'));
  const page=await loadObjectPageData(id);
  const styles=objectPageStyles(descriptor);
  assert.equal(styles.at(-1),SHELL_STYLE_FILE);
  assert.equal(SHELL_STYLE_ID,'site/object-shell.css','the serialized data-object-style identity stays as published');
  assert.deepEqual(objectPageStyles(descriptor, { navigation: true }), styles.slice(0, -1),
    `${id}: navigation never resends the shared shell CSS`);
  for(const path of styles) await access(new URL(`../../${path}`,import.meta.url));
  const transport=await readPreparedObjectBytes(id);
  const data=JSON.parse(transport.bytes.toString('utf8')).data;
  // The page lists every dataset's entries; the transport carries its default dataset's (dataset-tables.ts in @cssearth/objects).
  const runtime=JSON.parse(await readFile(new URL(`../../src/objects/${id}/prepared/runtime.json`,import.meta.url),'utf8'));
  assert.deepEqual(page,{descriptor:transport.descriptor,assets:runtime.assets,controls:data.controls,motion:{spin:true,lightCurve:false}},id);
  assert.deepEqual(data.assets.startup,runtime.assets.startup,id);
 }
});
