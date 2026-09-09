import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {loadObjectPageData} from '../object-page-data.mjs';
import {OBJECTS} from '../objects.mjs';

test('page data retains the pinned controls and preloads without retaining the scene tree',async t=>{
 const root=await mkdtemp(resolve(tmpdir(),'cssearth-page-data-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const directory=resolve(root,'src/planets/body');await mkdir(resolve(directory,'prepared'),{recursive:true});
 const data={assets:{entries:[{key:'surface',url:'/scenes/body/surface.webp'}],startup:['surface']},
  controls:{lenses:{defaultLens:'shape'},settings:{controls:[{name:'shadows',checked:false}]}},tree:{nodes:[{tag:'u'}]}};
 const payload=JSON.stringify({schema:'cssearth-prepared-object@1',id:'body',data});
 const descriptor={id:'body',prepared:{url:'prepared/object.json',sha256:createHash('sha256').update(payload).digest('hex')}};
 await writeFile(resolve(directory,'object.json'),JSON.stringify(descriptor));
 await writeFile(resolve(directory,'prepared/object.json'),payload);
 assert.deepEqual(await loadObjectPageData('body',root),{assets:data.assets,controls:data.controls});
 await writeFile(resolve(directory,'prepared/object.json'),payload+' ');
 await assert.rejects(loadObjectPageData('body',root),/descriptor pin/);
 await assert.rejects(loadObjectPageData('../body',root),/identity/);
});

test('registered routes read page metadata without importing complete scene transports into the build graph',async()=>{
 for(const {id} of OBJECTS){
  const page=await readFile(new URL(`../pages/${id}.astro`,import.meta.url),'utf8');
  assert.ok(page.includes(`await loadObjectPageData("${id}")`),id);
  assert.doesNotMatch(page,/import\s+.*from\s+["'][^"']*prepared\/(?:object|runtime)\.json["']/u);
  assert.ok(page.includes('preparedAssets={preparedPage.assets}'),id);
  assert.ok(page.includes('preparedControls={preparedPage.controls}'),id);
 }
});
