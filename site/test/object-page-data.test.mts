import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import {mkdtemp,mkdir,readFile,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {loadObjectPageData,readPreparedObjectBytes} from '../object-page-data.mts';
import {objectPageStyles} from '../object-page-contract.mts';
import {preparePageMetadata} from '../../tools/prepared/prepared-page-metadata.mts';
import {SCENE_OBJECTS} from '../objects.mts';

test('page metadata is emitted from the runtime without needing scene bytes',async t=>{
 const root=await mkdtemp(resolve(tmpdir(),'cssearth-page-data-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const directory=resolve(root,'src/objects/body');await mkdir(resolve(directory,'prepared'),{recursive:true});
 const data={id:'body',assets:{entries:[{key:'surface',url:'/scenes/body/surface.webp',pool:'body'}],pools:[{id:'body',capacity:1,concurrency:1,retention:'mount',reuse:false}],startup:['surface']},
  controls:{lenses:{defaultLens:'shape',controls:[{id:'shape',label:'Shape'}]},settings:{controls:[{kind:'toggle',name:'shadows',label:'Shadows',checked:false}]}},tree:{nodes:[{tag:'u'}]}};
 const payload=JSON.stringify({schema:'cssearth-prepared-object@1',id:'body',data});
 const page=preparePageMetadata('body',data);
 const descriptor={schema:'cssearth-object@1',id:'body',type:'layered-body',properties:{page:{metadata:page.reference}},prepared:{format:'cssearth-css-object@5',url:'prepared/object.json'}};
 await writeFile(resolve(directory,'object.json'),JSON.stringify(descriptor));
 await writeFile(resolve(directory,'prepared/page.json'),page.text);
 assert.deepEqual(await loadObjectPageData('body',root),{descriptor,assets:data.assets,controls:data.controls});
 assert.equal('tree' in JSON.parse(page.text),false);
 await writeFile(resolve(directory,'prepared/object.json'),payload);
 await readPreparedObjectBytes('body',root);
 await writeFile(resolve(directory,'prepared/page.json'),'{"schema":"cssearth-object-page@1","id":"body"}');
 await assert.rejects(loadObjectPageData('body',root),/incomplete/);
 await assert.rejects(loadObjectPageData('../body',root),/identity/);
});

test('all registry objects own ordered CSS and scene-bound page metadata',async()=>{
 for(const {id} of SCENE_OBJECTS){
  const descriptor=JSON.parse(await readFile(new URL(`../../src/objects/${id}/object.json`,import.meta.url),'utf8'));
  const page=await loadObjectPageData(id);
  const styles=objectPageStyles(descriptor);
  assert.equal(styles.at(-1),'site/planet-shell.css');
  for(const path of styles) await access(new URL(`../../${path}`,import.meta.url));
  const transport=await readPreparedObjectBytes(id);
  const data=JSON.parse(transport.bytes.toString('utf8')).data;
  assert.deepEqual(page,{descriptor:transport.descriptor,assets:data.assets,controls:data.controls},id);
 }
});

test('generic routes derive membership from SCENE_OBJECTS and never import scene transports',async()=>{
 for(const path of ['../pages/[id].astro','../pages/navigation/[id].astro']){
  const source=await readFile(new URL(path,import.meta.url),'utf8');
  assert.match(source,/SCENE_OBJECTS\.map/); assert.match(source,/getStaticPaths/);
 }
 const page=await readFile(new URL('../components/ObjectPage.astro',import.meta.url),'utf8');
 assert.match(page,/loadObjectPageData\(objectId\)/);
 assert.doesNotMatch(page,/prepared\/(?:object|runtime)\.json/);
 assert.throws(()=>objectPageStyles({id:'body',properties:{page:{stylesheets:['src/../escape.css']}}}),/invalid/);
});
