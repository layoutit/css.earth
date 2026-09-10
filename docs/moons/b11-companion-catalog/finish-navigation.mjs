// Finish this batch's standard atlas preparation using unchanged, pinned base contexts.
// Full reproduction remains: node tools/prepare-navigation.mjs.
import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {loadMarkerDescriptors} from '../../../tools/prepare-navigation.mjs';
import {OBJECTS} from '../../../site/objects.mjs';
const baseRef=execFileSync('git',['rev-parse','866646279'],{encoding:'utf8'}).trim();
const stage=resolve(process.argv[2]),fresh=new Set(['asteroid-2001-sn263','sn263-beta','sn263-gamma']);
const hash=b=>createHash('sha256').update(b).digest('hex');
const original=path=>execFileSync('git',['show',`${baseRef}:${path}`],{maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
const moduleText=original('site/prepared-navigation-markers.mjs').toString();
const {PREPARED_NAVIGATION_MARKERS:previous}=await import('data:text/javascript;base64,'+Buffer.from(moduleText).toString('base64'));
for(const path of ['tools/prepare-navigation.mjs','src/navigation/marker-recipe.mjs','src/navigation/marker-descriptors.mjs'])assert.equal(hash(await readFile(path)),hash(original(path)),'Navigation preparer changed');
const descriptors=await loadMarkerDescriptors(),markers={},report={base:baseRef,method:'Standard 435-object atlas and three generated contexts, with byte-pinned unchanged contexts reused from the merge base.',regeneratedUnchangedContexts:[],inheritedContexts:[],newFiles:[]};
for(const [index,d]of descriptors.entries()){
 let context;
 if(fresh.has(d.planetId)){const file=`${d.planetId}-context.webp`,meta=await sharp(resolve(stage,file)).metadata();assert.equal(meta.width,d.context.pixels);assert.equal(meta.height,d.context.pixels);context={url:`/navigation/${file}`,pixels:meta.width};}
 else{
  const recipe=`src/planets/${d.planetId}/source/preparation/navigation.json`;
  assert.deepEqual(d,JSON.parse(original(recipe)),'Existing marker recipe differs from base');
  context=previous[d.planetId].context;
  if(context){const path='public'+context.url,b=original(path);let current;try{current=await readFile(path)}catch(e){if(e.code!=='ENOENT')throw e;await writeFile(path,b);current=b}assert.equal(hash(current),hash(b),'Inherited context differs from tracked base');report.inheritedContexts.push({path,bytes:b.length,sha256:hash(b)});}
 }
 markers[d.planetId]={index,count:descriptors.length,presentation:d.presentation,...(context?{context}:{})};
}
for(const file of (await readdir(stage)).filter(f=>f.endsWith('-context.webp')&&!fresh.has(f.slice(0,-13)))){
 const expected=report.inheritedContexts.find(x=>x.path===`public/navigation/${file}`);if(!expected)continue;const b=await readFile(resolve(stage,file));assert.equal(hash(b),expected.sha256);report.regeneratedUnchangedContexts.push(file);
}
for(const file of ['planet-markers.webp','planet-markers@2x.webp',...[...fresh].map(id=>`${id}-context.webp`)]){const b=await readFile(resolve(stage,file));await copyFile(resolve(stage,file),resolve('public/navigation',file));report.newFiles.push({path:`public/navigation/${file}`,bytes:b.length,sha256:hash(b)})}
await writeFile('site/prepared-navigation-markers.mjs','// Generated from object-owned marker recipes. Do not edit.\nexport const PREPARED_NAVIGATION_MARKERS = Object.freeze('+JSON.stringify(markers)+');\n');
await writeFile(new URL('./navigation-reuse.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log({objects:OBJECTS.length,regeneratedUnchangedContexts:report.regeneratedUnchangedContexts.length,inheritedContexts:report.inheritedContexts.length,newFiles:report.newFiles.length});
