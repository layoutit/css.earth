/** Final output evidence must observe late bundler rewrites without changing output bytes. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {finalizeMetadata} from './finalize-metadata.mts';
test('final digest observes post-generateBundle bytes, preserving module code and order',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cssearth-l3-final-'));
 try{
  await mkdir(join(root,'metadata'));await mkdir(join(root,'dist'));
  const modules=[{id:'first',code:'one'},{id:'second',code:'two'}];
  await writeFile(join(root,'metadata/client.json'),JSON.stringify({chunks:[{fileName:'entry.js',emittedDigest:'early',modules},{fileName:'deleted-ssr.js',emittedDigest:'ssr',modules}]}));
  await writeFile(join(root,'dist/entry.js'),'late rewritten bytes');
  await finalizeMetadata(root,join(root,'dist'));
  const record=JSON.parse(await readFile(join(root,'metadata/client.json'),'utf8'));
  assert.equal(record.emittedDigestStage,'final-dist');
  assert.equal(record.chunks[0].emittedDigest,createHash('md5').update('late rewritten bytes').digest('hex'));
  assert.equal(record.chunks[1].emittedDigest,'ssr');
  assert.deepEqual(record.chunks[0].modules,modules);
  assert.equal(await readFile(join(root,'dist/entry.js'),'utf8'),'late rewritten bytes');
 }finally{await rm(root,{recursive:true,force:true});}
});
