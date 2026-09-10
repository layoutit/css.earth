import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { executeAcquisition, parseAcquisitionPlan } from './operations-acquisition.js';
import { acquirePinnedDownloads, verifySources, type SourceManifest } from './operations.js';
import { gzipSync } from 'node:zlib';

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const rawSource = (bytes: Uint8Array) => ({path:'source.img',origin:'https://example.test/source.img',
  expectedBytes:bytes.length,expectedSha256:sha256(bytes)});
const rawManifest = (bytes: Uint8Array): SourceManifest => ({schema:'cssearth-authoritative-sources@1',
  inputs:[rawSource(bytes)],generatedIntermediates:[],documents:[]});
const rawPlan = parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1',operations:[{
  kind:'download',path:'source.img',url:'https://example.test/source.img',groups:['refresh'],headers:{'X-Source':'fixture'},
}]});
const temporary = async (work: (directory: string) => Promise<void>) => {
  const directory=await mkdtemp(join(tmpdir(),'cssearth-stream-source-'));
  try { await work(directory); } finally { await rm(directory,{recursive:true,force:true}); }
};
function chunkedResponse(chunks: Uint8Array[]): Response {
  let next=0;
  const response=new Response(new ReadableStream<Uint8Array>({
    pull(controller) { if(next<chunks.length)controller.enqueue(chunks[next++]!);else controller.close(); },
  },{highWaterMark:0}));
  response.arrayBuffer=async()=>{throw new Error('Raw acquisition must not buffer the response');};
  return response;
}

test('raw downloads install exact streamed bytes and verify source closure',()=>temporary(async directory=>{
  const data=Buffer.from('eight separate source chunks'),manifest=rawManifest(data),old=Buffer.from('previous pin');
  await writeFile(join(directory,'source.img'),old);
  let offset=0;
  const response=new Response(new ReadableStream<Uint8Array>({
    async pull(controller) {
      // Publication must not replace the previous pin while the transfer is incomplete.
      assert.deepEqual(await readFile(join(directory,'source.img')),old);
      if(offset<data.length){controller.enqueue(data.subarray(offset,offset+4));offset+=4;}
      else controller.close();
    },
  },{highWaterMark:0}));
  response.arrayBuffer=async()=>{throw new Error('Raw acquisition must not buffer the response');};
  await executeAcquisition({sourceRoot:directory,manifest,plan:rawPlan,transport:{fetch:async(url,init)=>{
    assert.equal(url,manifest.inputs[0]!.origin);assert.deepEqual(init?.headers,{'X-Source':'fixture'});return response;
  }}});
  assert.deepEqual(await readFile(join(directory,'source.img')),data);
  assert.deepEqual(await readdir(directory),['source.img']);
  assert.equal((await verifySources({sourceRoot:directory,manifest})).verifiedCount,1);
}));

for(const [name,received,error] of [
  ['short',Buffer.from('pin'),/size drifted/],
  ['overlong',Buffer.from('pinned data extra'),/size drifted/],
  ['wrong hash',Buffer.from('mutant data'),/hash drifted/],
] as const)test(`raw ${name} transfer preserves the destination and removes partial files`,()=>temporary(async directory=>{
  const data=Buffer.from('pinned data'),old=Buffer.from('previous pin');await writeFile(join(directory,'source.img'),old);
  await assert.rejects(executeAcquisition({sourceRoot:directory,manifest:rawManifest(data),plan:rawPlan,
    transport:{fetch:async()=>chunkedResponse([received.subarray(0,2),received.subarray(2)])}}),error);
  assert.deepEqual(await readFile(join(directory,'source.img')),old);
  assert.deepEqual(await readdir(directory),['source.img']);
}));

test('abrupt source stream errors clean up without replacing the previous pin',()=>temporary(async directory=>{
  const data=Buffer.from('pinned data'),old=Buffer.from('previous pin');await writeFile(join(directory,'source.img'),old);
  let pulls=0;
  const response=new Response(new ReadableStream<Uint8Array>({pull(controller){
    if(pulls++===0)controller.enqueue(data.subarray(0,4));else controller.error(new Error('Source connection interrupted'));
  }},{highWaterMark:0}));
  await assert.rejects(executeAcquisition({sourceRoot:directory,manifest:rawManifest(data),plan:rawPlan,
    transport:{fetch:async()=>response}}),/Source connection interrupted/);
  assert.deepEqual(await readFile(join(directory,'source.img')),old);assert.deepEqual(await readdir(directory),['source.img']);
}));

test('an unbounded overlong response is cancelled after bounded chunk consumption',()=>temporary(async directory=>{
  const data=Buffer.alloc(32),old=Buffer.from('previous pin');await writeFile(join(directory,'source.img'),old);
  let pulls=0,cancelled=false;
  const response=new Response(new ReadableStream<Uint8Array>({
    pull(controller){pulls++;controller.enqueue(new Uint8Array(1024));},
    cancel(){cancelled=true;},
  },{highWaterMark:0}));
  await assert.rejects(executeAcquisition({sourceRoot:directory,manifest:rawManifest(data),plan:rawPlan,
    transport:{fetch:async()=>response}}),/size drifted/);
  assert.ok(cancelled,'Rejecting an overlong source must cancel the response');
  assert.ok(pulls<8,`Unexpectedly consumed ${pulls} chunks after exceeding the pin`);
  assert.deepEqual(await readFile(join(directory,'source.img')),old);assert.deepEqual(await readdir(directory),['source.img']);
}));

test('direct pinned acquisition also consumes raw response chunks',async context=>temporary(async directory=>{
  const data=Buffer.from('direct source');
  context.mock.method(globalThis,'fetch',async()=>chunkedResponse([data.subarray(0,3),data.subarray(3)]));
  await acquirePinnedDownloads({sourceRoot:directory,manifest:rawManifest(data),paths:['source.img']});
  assert.deepEqual(await readFile(join(directory,'source.img')),data);assert.deepEqual(await readdir(directory),['source.img']);
}));

test('source verification hashes multi-chunk files and detects late byte drift',()=>temporary(async directory=>{
  const data=Buffer.alloc(256*1024+7,37),manifest=rawManifest(data);await writeFile(join(directory,'source.img'),data);
  assert.equal((await verifySources({sourceRoot:directory,manifest})).verifiedCount,1);
  data[data.length-1]=38;await writeFile(join(directory,'source.img'),data);
  await assert.rejects(verifySources({sourceRoot:directory,manifest}),/hash drifted/);
}));

test('gzip and pretty-json downloads preserve their existing transformations and pins',()=>temporary(async directory=>{
  const input=Buffer.from('{"identity":{"id":"fixture"},"value":3}');
  for(const encoding of ['gzip','pretty-json'] as const){
    const output=encoding==='gzip'?gzipSync(input,{level:9}):Buffer.from(JSON.stringify(JSON.parse(input.toString()),null,2)+'\n');
    const plan=parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1',operations:[{
      kind:'download',path:'source.img',url:'https://example.test/source.img',groups:['refresh'],encoding,
      expectedJsonFields:{'identity.id':'fixture'},
    }]});
    await executeAcquisition({sourceRoot:directory,manifest:rawManifest(output),plan,transport:{fetch:async()=>new Response(input)}});
    assert.deepEqual(await readFile(join(directory,'source.img')),output);assert.deepEqual(await readdir(directory),['source.img']);
  }
}));

test('ZIP restoration verifies both the streamed archive and its exact extracted member', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-zip-source-'));
  const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  let cache: string | undefined;
  try {
    const content = Buffer.from(`Pinned source fixture ${randomUUID()}\n`);
    await writeFile(join(directory, 'source.bin'), content);
    execFileSync('zip', ['-q', 'archive.zip', 'source.bin'], {cwd: directory});
    const archive = await readFile(join(directory, 'archive.zip'));
    cache = resolve('.local/source-archives', `${digest(archive)}.zip`);
    const step = {kind:'zip-member', path:'restored.bin', url:'https://example.test/archive.zip',
      archiveSha256:digest(archive), archiveBytes:archive.length, member:'source.bin', groups:['restore']};
    const plan = parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1', operations:[step]});
    const manifest = {schema:'cssfixture-authoritative-sources@1', inputs:[{id:'fixture',path:'restored.bin',
      expectedBytes:content.length,expectedSha256:digest(content)}], generatedIntermediates:[],documents:[]};
    await assert.rejects(executeAcquisition({sourceRoot:directory,manifest,plan,group:'restore',
      transport:{fetch:async()=>new Response(Buffer.from('wrong archive'))}}), /ZIP source pin differs/);
    await executeAcquisition({sourceRoot:directory,manifest,plan,group:'restore',
      transport:{fetch:async()=>new Response(archive)}});
    assert.deepEqual(await readFile(join(directory,'restored.bin')), content);
    await rm(join(directory,'restored.bin'));
    await executeAcquisition({sourceRoot:directory,manifest,plan,group:'restore',
      transport:{fetch:async()=>{throw new Error('A verified cache must be reusable');}}});
    assert.deepEqual(await readFile(join(directory,'restored.bin')), content);
    await assert.rejects(executeAcquisition({sourceRoot:directory,
      manifest:{...manifest,inputs:[{...manifest.inputs[0]!,expectedSha256:'0'.repeat(64)}]},plan,group:'restore'}), /pin|hash/i);
    assert.deepEqual(await readFile(join(directory,'restored.bin')), content);
    for (const member of ['../escape', '/absolute', '*.bin', '-option']) {
      assert.throws(()=>parseAcquisitionPlan({schema:plan.schema,operations:[{...step,member}]}));
    }
  } finally { if(cache) await rm(cache,{force:true}); await rm(directory,{recursive:true,force:true}); }
});
