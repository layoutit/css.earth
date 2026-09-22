import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, mkdtemp, rm, cp, copyFile, symlink } from 'node:fs/promises';
import { prepareContextProvenance } from './prepare-context-provenance.mts';
import { readPreparedContextProvenance } from './read-prepared-context-provenance.mts';
import { prepareVolumeProvenance } from './prepare-volume-provenance.mts';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { sha256 } from '../src/platform/sha256.mts';


test('context provenance binds every declared output and installs one complete inventory', async () => {
  const contexts=await prepareContextProvenance();
  assert.deepEqual(contexts.map(c=>c.id),['galaxy-clusters','local-group','nearby-universe']);
  for(const context of contexts){
    const inventories=context.outputs.filter(o=>o.path.endsWith('/runtime-assets.json'));
    assert.equal(inventories.length,1,'the inventory is published once, at the body root');
    const inventory=JSON.parse(inventories[0]!.text);
    for(const product of context.provenance.products)for(const output of product.outputs){
      const asset=inventory.assets.find((a:{filename:string})=>output.url.endsWith(`/prepared/${a.filename}`));
      assert.ok(asset);assert.equal(asset.sha256,output.sha256);assert.equal(asset.bytes,output.bytes);
    }
    for(const asset of inventory.assets){
      const generated=context.outputs.find(o=>o.path.endsWith(`/prepared/${asset.filename}`));
      const bytes=generated?Buffer.from(generated.text):await readFile(`${context.base}/prepared/${asset.filename}`).catch((error: unknown) => { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null; throw error; });
      if (!bytes) continue; // Recovered receipts are valid without installed generated assets.
      assert.equal(sha256(bytes),asset.sha256);assert.equal(bytes.length,asset.bytes);
    }
    assert.ok(context.provenance.sources.some(s=>s.sourceBinding?.kind==='catalogued'));
  }
});

test('deploy catalogue recovery reads prepared contexts without authoring intermediates', async () => {
  const contexts = await readPreparedContextProvenance({ input: path => {
    assert.doesNotMatch(path, /sun\/prepared\/world-context\.json/u);
    return readFile(path);
  } });
  assert.deepEqual(contexts.map(context => context.id), ['galaxy-clusters', 'local-group', 'nearby-universe']);
  assert.ok(contexts.every(context => context.outputs.length === 0));
});
test('changed prepared bytes are rejected; an authored source document is read as it is', async () => {
  await prepareContextProvenance({input:async path=>{ const bytes=await readFile(path); return path==='src/objects/nearby-universe/source/preparation/field.json' ? Buffer.concat([bytes,Buffer.from(' ')]) : bytes; }});
  for(const target of ['src/objects/local-group/prepared-receipt.json']) {
    await assert.rejects(prepareContextProvenance({input:async path=>{
      const bytes=await readFile(path);if(path !== target) return bytes;
      if(path.endsWith('prepared-receipt.json')) { const receipt=JSON.parse(bytes.toString()); receipt.outputs[0].sha256='0'.repeat(64); return Buffer.from(JSON.stringify(receipt)); }
      return Buffer.concat([bytes,Buffer.from(' ')]);
    }}),/Unpinned context output|Changed source document|Changed prepared descriptor bank/);
  }
});

test('committed runtime-assets.json matches what context provenance currently generates', async () => {
  const contexts=await prepareContextProvenance();
  for(const context of contexts){
    const generated=context.outputs.find(o=>o.path.endsWith('/runtime-assets.json'));
    assert.ok(generated,`${context.id}: missing generated inventory`);
    const committed=await readFile(`${context.base}/runtime-assets.json`,'utf8');
    assert.equal(committed,generated!.text,`${context.id}: committed runtime-assets.json is stale; run prepare:provenance and publish:runtime-assets`);
  }
});

test('committed image-layer-bank runtime-assets.json matches what volume provenance currently generates', async t => {
  // Only image-layer banks publish a body-root inventory. Build them in isolation so the check
  // needs no other volume's installed previews.
  const ids:string[]=[];
  for(const entry of await readdir('src/objects',{withFileTypes:true})){
    if(!entry.isDirectory())continue;
    const descriptor:unknown=JSON.parse(await readFile(`src/objects/${entry.name}/object.json`,'utf8').catch((error: unknown) => { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return 'null'; throw error; }));
    if(descriptor!==null&&typeof descriptor==='object'&&'type' in descriptor&&descriptor.type==='image-layer-bank')ids.push(entry.name);
  }
  assert.ok(ids.length>0,'at least one image-layer bank is registered');
  const root=await mkdtemp(join(tmpdir(),'image-layer-inventory-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'src/objects'),{recursive:true});
  for(const path of ['tools','site'])await symlink(resolve(path),join(root,path));
  for(const id of ids){
    await mkdir(join(root,'src/objects',id));
    for(const name of ['source','prepared','object.json'])await symlink(resolve('src/objects',id,name),join(root,'src/objects',id,name));
  }
  const volumes=await prepareVolumeProvenance({root});
  assert.deepEqual(volumes.map(v=>v.id).sort(),[...ids].sort());
  for(const volume of volumes){
    const generated=volume.outputs.find(o=>o.path===join(root,volume.base,'runtime-assets.json'));
    assert.ok(generated,`${volume.id}: missing generated inventory`);
    const committed=await readFile(`${volume.base}/runtime-assets.json`,'utf8');
    assert.equal(committed,String(generated!.text),`${volume.id}: committed runtime-assets.json is stale; run prepare:facilities and publish:runtime-assets`);
  }
});

test('offline context recovery is independent of installed generated images and filesystem insertion order', async t => {
  const root=await mkdtemp(join(tmpdir(),'context-offline-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  for(const id of ['nearby-universe','local-group','galaxy-clusters']) {
    const base=`src/objects/${id}`;
    await mkdir(join(root,base,'prepared'),{recursive:true});
    await cp(`${base}/source`,join(root,base,'source'),{recursive:true});
    await copyFile(`${base}/object.json`,join(root,base,'object.json'));
    await copyFile(`${base}/prepared-receipt.json`,join(root,base,'prepared-receipt.json'));
  }
  await mkdir(join(root,'src/objects/sun/source/navigation'),{recursive:true});
  await copyFile(
    'src/objects/sun/source/navigation/universe.json',
    join(root,'src/objects/sun/source/navigation/universe.json'),
  );
  const offline=await prepareContextProvenance({root,input:path=>readFile(path.startsWith('tools/')?path:join(root,path))});
  assert.deepEqual(offline.map(c=>c.id),['galaxy-clusters','local-group','nearby-universe']);
  const installed=await prepareContextProvenance();
  assert.deepEqual(offline.map(c=>c.provenance),installed.map(c=>c.provenance));
  assert.deepEqual(offline.map(c=>c.outputs.map(o=>o.text)),installed.map(c=>c.outputs.map(o=>o.text)));
});
