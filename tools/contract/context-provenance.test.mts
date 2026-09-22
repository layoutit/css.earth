import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, rm, cp, copyFile } from 'node:fs/promises';
import { prepareContextProvenance } from '../prepare/prepare-context-provenance.mts';
import { readPreparedContextProvenance } from '../prepared/read-prepared-context-provenance.mts';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256 } from '../../src/platform/sha256.mts';


test('context provenance binds every declared output and installs one complete inventory', async () => {
  const contexts=await prepareContextProvenance();
  assert.deepEqual(contexts.map(c=>c.id),['galaxy-clusters','local-group','nearby-universe']);
  for(const context of contexts){
    const inventories=context.outputs.filter(o=>o.path.endsWith('/inventory.json'));
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
  for(const target of ['src/objects/local-group/inventory.json']) {
    await assert.rejects(prepareContextProvenance({input:async path=>{
      const bytes=await readFile(path);if(path !== target) return bytes;
      if(path.endsWith('inventory.json')) {
        const inventory=JSON.parse(bytes.toString());
        // The context's own baked bank, not the record or presentation this run rewrites.
        const bank=inventory.assets.find((a:{location:string;filename:string})=>a.location==='prepared'&&!['presentation.json','provenance.json'].includes(a.filename));
        bank.sha256='0'.repeat(64); return Buffer.from(JSON.stringify(inventory));
      }
      return Buffer.concat([bytes,Buffer.from(' ')]);
    }}),/Unpinned context output|Changed source document|Changed prepared descriptor bank/);
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
    await copyFile(`${base}/inventory.json`,join(root,base,'inventory.json'));
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
