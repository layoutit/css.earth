import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { publishPreparedAssets, readPreparedJsonOutputs } from '../../tools/objects/publication.mjs';
const manifest = (values) => ({ schema: 'cssfixture-runtime-assets@1', assets: Object.entries(values).map(([filename,text]) => ({filename,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')})) });
test('private material masters stay staged while all consumer JSON is preflighted',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cssearth-publication-json-'));
 try {
  await mkdir(join(root,'.material-masters'));
  await writeFile(join(root,'.material-masters','surface.png'),'private intermediate');
  await writeFile(join(root,'runtime.json'),'{}\n');
  await writeFile(join(root,'content.json'),'{}\n');
  assert.deepEqual(await readPreparedJsonOutputs(root),[
   {filename:'content.json',path:join(root,'content.json')},
   {filename:'runtime.json',path:join(root,'runtime.json')},
  ]);
  await writeFile(join(root,'runtime.json'),'{');
  await assert.rejects(readPreparedJsonOutputs(root),SyntaxError);
  await writeFile(join(root,'runtime.json'),'{}\n');
  await writeFile(join(root,'unexpected.mjs'),'export default null;');
  await assert.rejects(readPreparedJsonOutputs(root),/only regular JSON/);
  await rm(join(root,'unexpected.mjs'));
  await symlink(join(root,'runtime.json'),join(root,'linked.json'));
  await assert.rejects(readPreparedJsonOutputs(root),/only regular JSON/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('publication ships only verified consumers and keeps recoverable previous assets',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cssearth-publication-')),stage=join(root,'stage'),destination=join(root,'public'),recovery=join(root,'previous');
 try {
  await mkdir(stage);await mkdir(destination);
  for(const [name,value]of Object.entries({'one.webp':'new','two.webp':'two','unused.webp':'offline'}))await writeFile(join(stage,name),value);
  await writeFile(join(destination,'one.webp'),'old');await writeFile(join(destination,'retired.webp'),'retired');
  const args={id:'fixture',stage,destination,recovery,previous:manifest({'one.webp':'old','retired.webp':'retired'}),manifest:manifest({'one.webp':'new','two.webp':'two'})};
  const result=await publishPreparedAssets(args);
  assert.deepEqual((await readdir(destination)).sort(),['one.webp','two.webp']);assert.deepEqual(result.retired,['retired.webp']);
  assert.equal(await readFile(join(recovery,'one.webp'),'utf8'),'old');assert.equal(await readFile(join(recovery,'retired.webp'),'utf8'),'retired');
  assert.equal(await readFile(join(stage,'unused.webp'),'utf8'),'offline');
 } finally { await rm(root,{recursive:true,force:true}); }
});
test('drift and unknown files fail before overwriting canonical files',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cssearth-publication-')),stage=join(root,'stage'),destination=join(root,'public');
 try {
  await mkdir(stage);await mkdir(destination);await writeFile(join(stage,'one.webp'),'corrupt');await writeFile(join(destination,'one.webp'),'old');
  const args={id:'fixture',stage,destination,recovery:join(root,'previous'),previous:manifest({'one.webp':'old'}),manifest:manifest({'one.webp':'new'})};
  await assert.rejects(publishPreparedAssets(args),/drifted/);assert.equal(await readFile(join(destination,'one.webp'),'utf8'),'old');
  await writeFile(join(stage,'one.webp'),'new');await writeFile(join(destination,'user.txt'),'keep');
  await assert.rejects(publishPreparedAssets(args),/Unowned canonical asset/);assert.equal(await readFile(join(destination,'user.txt'),'utf8'),'keep');assert.equal(await readFile(join(destination,'one.webp'),'utf8'),'old');
 }finally{await rm(root,{recursive:true,force:true});}
});
