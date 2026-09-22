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
import { convertMappedComposition, parseMappedCompositionRecipe } from './acquisition/mapped-composition.mts';

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const rawSource = (_bytes: Uint8Array) => ({path:'source.img',origin:'https://example.test/source.img'});
const rawManifest = (bytes: Uint8Array): SourceManifest => ({schema:'cssearth-authoritative-sources@2',
  inputs:[rawSource(bytes)],generatedIntermediates:[],documents:[]});
const rawPlan = parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1',operations:[{
  kind:'download',path:'source.img',url:'https://example.test/source.img',groups:['refresh'],headers:{'X-Source':'fixture'},
}]});
const temporary = async (work: (directory: string) => Promise<void>) => {
  const directory=await mkdtemp(join(tmpdir(),'cssearth-stream-source-'));
  try { await work(directory); } finally { await rm(directory,{recursive:true,force:true}); }
};

test('an empty acquisition plan is valid when every source input is already tracked',()=>{
  const plan=parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1',operations:[]});
  assert.deepEqual(plan.operations,[]);
});

test('mapped composition acquisition restores the pinned map and report through the selected group',()=>temporary(async directory=>{
  const values=Array.from({length:180},()=>Array.from({length:360},()=>0.25));
  const original=gzipSync(JSON.stringify({metadata:{target:'Fixture',observation_name:'published',nan_value:-99,
    latitudes:Array.from({length:180},(_,i)=>i-90),longitudes:Array.from({length:360},(_,i)=>i)},
    best_estimate_abundance:{ice:values},lower_bound_abundance:{ice:values},upper_bound_abundance:{ice:values}}));
  const recipe=parseMappedCompositionRecipe({schema:'cssearth-mapped-composition@1',target:'Fixture',observationName:'published',
    referenceRadiusMeters:1000,input:'native.json.gz',sha256:sha256(original),selections:[{id:'ice',kind:'posterior',field:'ice',statistic:'median'}]});
  const converted=convertMappedComposition(original,recipe),report=Buffer.from(JSON.stringify(converted.report,null,2)+'\n');
  await writeFile(join(directory,'native.json.gz'),original);
  await writeFile(join(directory,'recipe.json'),JSON.stringify(recipe));
  const manifest:SourceManifest={schema:'cssearth-authoritative-sources@2',inputs:[],documents:[],generatedIntermediates:
    [['ice.tif',converted.products.ice],['report.json',report]].map(([path,bytes])=>{
      assert.ok(typeof path==='string');assert.ok(bytes instanceof Uint8Array);
      return {path};
    })};
  const plan=parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1',operations:[
    {kind:'mapped-composition',path:'ice.tif',recipePath:'recipe.json',product:'ice',groups:['composition']},
    {kind:'mapped-composition',path:'report.json',recipePath:'recipe.json',product:'report',groups:['composition']}]});
  await executeAcquisition({sourceRoot:directory,manifest,plan,group:'composition',transport:{fetch:async()=>{throw new Error('No network needed for pinned native conversion');}}});
  assert.deepEqual(await readFile(join(directory,'ice.tif')),Buffer.from(converted.products.ice));
  assert.deepEqual(await readFile(join(directory,'report.json')),report);
}));
function chunkedResponse(chunks: Uint8Array[]): Response {
  let next=0;
  const response=new Response(new ReadableStream<Uint8Array>({
    pull(controller) { if(next<chunks.length)controller.enqueue(chunks[next++]!);else controller.close(); },
  },{highWaterMark:0}));
  response.arrayBuffer=async()=>{throw new Error('Raw acquisition must not buffer the response');};
  return response;
}

test('a plain download tries the object mirror first and falls back to the publisher, through the injected transport only',()=>temporary(async directory=>{
  const data=Buffer.from('mirrored source bytes, tried before the publisher'),manifest=rawManifest(data);
  const mirrorOrigin='https://mirror.test.invalid', mirrorUrl=`${mirrorOrigin}/source-cache/fixture/source.img`;
  const publisherUrl=manifest.inputs[0]!.origin;
  let mirrorHits=0, publisherHits=0, mirrorBehavior:'serve'|'miss'='serve';
  const transport={fetch:async(url:string)=>{
    if(url===mirrorUrl){
      mirrorHits++;
      if(mirrorBehavior==='miss')return new Response(null,{status:404});
      return new Response(data,{status:200});
    }
    if(url===publisherUrl){publisherHits++;return new Response(data,{status:200});}
    throw new Error(`Unexpected request in a network-free test: ${url}`);
  }};

  mirrorBehavior='serve';
  await executeAcquisition({sourceRoot:directory,manifest,plan:rawPlan,mirrorOrigin,objectId:'fixture',transport});
  assert.deepEqual(await readFile(join(directory,'source.img')),data);
  assert.equal(mirrorHits,1); assert.equal(publisherHits,0,'the publisher must not be contacted on a mirror hit');

  await rm(join(directory,'source.img'));
  mirrorBehavior='miss'; publisherHits=0;
  await executeAcquisition({sourceRoot:directory,manifest,plan:rawPlan,mirrorOrigin,objectId:'fixture',transport});
  assert.equal(publisherHits,1,'publisher must be contacted when the mirror misses');
  assert.deepEqual(await readFile(join(directory,'source.img')),data);

  // mirrorOrigin: null disables the lookup outright: no request may ever reach the mirror URL.
  await rm(join(directory,'source.img'));
  mirrorBehavior='serve'; mirrorHits=0; publisherHits=0;
  await executeAcquisition({sourceRoot:directory,manifest,plan:rawPlan,mirrorOrigin:null,objectId:'fixture',transport});
  assert.equal(mirrorHits,0,'a null mirrorOrigin must never reach the mirror URL');
  assert.equal(publisherHits,1);
}));

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

test('HRI-IR acquisition validates its recipe and preserves an existing output when preparation fails',()=>temporary(async directory=>{
  const step={kind:'hrii-facets',path:'source.img',recipePath:'scan.json',product:'fields',groups:['refresh']};
  for(const changed of [{recipePath:'../scan.json'},{recipePath:undefined},{product:'image'}]) {
    assert.throws(()=>parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1',operations:[{...step,...changed}]}));
  }
  const old=Buffer.from('previous qualified output');
  await writeFile(join(directory,'source.img'),old);
  await writeFile(join(directory,'scan.json'),'{}');
  await assert.rejects(executeAcquisition({sourceRoot:directory,manifest:rawManifest(old),
    plan:parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1',operations:[step]}),
    transport:{fetch:async()=>{throw new Error('Native facet preparation must use its restored inputs');}}}));
  assert.deepEqual(await readFile(join(directory,'source.img')),old);
}));

test('a Horizons time-list step asks again in batches and compares rows, not the dated header',()=>temporary(async directory=>{
  const epochs=Array.from({length:30},(_,i)=>2458462.7+i/1000);
  const step={kind:'horizons-time-list',path:'observer.txt',url:'https://ssd.jpl.nasa.gov/api/horizons.api',parameters:{format:'text',COMMAND:"'216;'"},epochs,groups:['refresh']};
  for(const changed of [{epochs:[]},{epochs:[Number.NaN]},{parameters:{TLIST:"'1'"}},{parameters:{COMMAND:216}},{path:undefined}]) {
    assert.throws(()=>parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1',operations:[{...step,...changed}]}));
  }
  const response=(list:readonly number[],asked:string)=>`JPL/HORIZONS ${asked}\n$$SOE\n${list.map(epoch=>` ${epoch.toFixed(9)} 1.0 2.0`).join('\n')}\n$$EOE\nfooter\n`;
  const urls:string[]=[];
  const transport={fetch:async(url:string)=>{urls.push(url);return new Response(response(String(new URL(url).searchParams.get('TLIST')).replace(/'/g,'').split(' ').map(Number),'2026-Sep-18 14:00:00'));}};
  const plan=parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1',operations:[step]});
  await writeFile(join(directory,'observer.txt'),response(epochs,'2026-Sep-17 09:00:00'));
  await executeAcquisition({sourceRoot:directory,manifest:rawManifest(Buffer.from('')),plan,transport});
  assert.equal(urls.length,2,'thirty epochs are asked in batches of at most 25');
  assert.equal(new URL(urls[0]).searchParams.get('COMMAND'),"'216;'");
  assert.equal(await readFile(join(directory,'observer.txt'),'utf8'),response(epochs,'2026-Sep-17 09:00:00'),'the pinned table is left as it was');
  await writeFile(join(directory,'observer.txt'),response(epochs.map((epoch,i)=>i===3?epoch+1:epoch),'2026-Sep-17 09:00:00'));
  await assert.rejects(executeAcquisition({sourceRoot:directory,manifest:rawManifest(Buffer.from('')),plan,transport}),/Horizons rows drifted from observer\.txt/);
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
  await assert.rejects(executeAcquisition({sourceRoot:directory,manifest:rawManifest(data),plan:rawPlan,mirrorOrigin:null,
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
  await assert.rejects(executeAcquisition({sourceRoot:directory,manifest:rawManifest(data),plan:rawPlan,mirrorOrigin:null,
    transport:{fetch:async()=>response}}),/size drifted/);
  assert.ok(cancelled,'Rejecting an overlong source must cancel the response');
  // The idle-timeout relay (a Transform and a PassThrough between the source and the pinned write) adds a little of
  // its own in-flight buffering, so this is looser than a direct pipe would need; it still proves boundedness, not
  // "eventually consumes the source's whole (unbounded) output".
  assert.ok(pulls<200,`Unexpectedly consumed ${pulls} chunks after exceeding the pin`);
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
    cache = resolve('.local/source-archives', `${digest(Buffer.from('https://example.test/archive.zip'))}.zip`);
    const step = {kind:'zip-member', path:'restored.bin', url:'https://example.test/archive.zip', member:'source.bin', groups:['restore']};
    const plan = parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1', operations:[step]});
    const manifest = {schema:'cssfixture-authoritative-sources@2', inputs:[{id:'fixture',path:'restored.bin'}], generatedIntermediates:[],documents:[]};
    await executeAcquisition({sourceRoot:directory,manifest,plan,group:'restore',
      transport:{fetch:async()=>new Response(archive)}});
    assert.deepEqual(await readFile(join(directory,'restored.bin')), content);
    await rm(join(directory,'restored.bin'));
    await executeAcquisition({sourceRoot:directory,manifest,plan,group:'restore',
      transport:{fetch:async()=>{throw new Error('A verified cache must be reusable');}}});
    assert.deepEqual(await readFile(join(directory,'restored.bin')), content);
    for (const member of ['../escape', '/absolute', '*.bin', '-option']) {
      assert.throws(()=>parseAcquisitionPlan({schema:plan.schema,operations:[{...step,member}]}));
    }
  } finally { if(cache) await rm(cache,{force:true}); await rm(directory,{recursive:true,force:true}); }
});

// A pinned slice of an archive member too large to keep whole: the request must be honoured as 206 Partial Content,
// and a server that answers with the whole body is refused instead of downloaded.
const slice=Buffer.from('exactly the pinned slice of a very large archive member');
const rangedManifest=(range={offset:13096944000,length:slice.length}): SourceManifest=>({schema:'cssearth-authoritative-sources@2',
  inputs:[{...rawSource(slice),range}],generatedIntermediates:[],documents:[]});
const rangedResponse=(body:Uint8Array<ArrayBuffer>,{status=206,contentRange=`bytes 13096944000-${13096944000+slice.length-1}/26173440000`,contentLength=String(body.length)}={})=>
  new Response(body,{status,headers:{'content-range':contentRange,'content-length':contentLength}});

test('a ranged input asks for exactly its pinned bytes and accepts only a matching 206 answer',()=>temporary(async directory=>{
  const asked:(string|undefined)[]=[];
  const transport={fetch:async(url:string,init?:RequestInit)=>{
    if(url!==rawSource(slice).origin)throw new Error(`Unexpected request in a network-free test: ${url}`);
    asked.push(new Headers(init?.headers).get('range')??undefined);
    return rangedResponse(slice);
  }};
  await executeAcquisition({sourceRoot:directory,manifest:rangedManifest(),plan:rawPlan,mirrorOrigin:null,transport});
  assert.deepEqual(asked,[`bytes=13096944000-${13096944000+slice.length-1}`]);
  assert.deepEqual(await readFile(join(directory,'source.img')),slice);
}));

test('a ranged input refuses a full-body answer, a short body and a mismatched content range',()=>temporary(async directory=>{
  const attempt=(response:Response)=>executeAcquisition({sourceRoot:directory,manifest:rangedManifest(),plan:rawPlan,mirrorOrigin:null,
    transport:{fetch:async()=>response}});
  // 200 means the server ignored the range and is about to hand over the whole member.
  await assert.rejects(attempt(new Response(slice,{status:200})),/answered 200 instead of 206 Partial Content/);
  await assert.rejects(attempt(rangedResponse(slice,{contentRange:'bytes 0-53/26173440000'})),/content range bytes 0-53/);
  await assert.rejects(attempt(rangedResponse(slice,{contentRange:''})),/content range \(none\)/);
  await assert.rejects(attempt(rangedResponse(Buffer.from(slice.subarray(0,10)),{contentLength:'10'})),/returned 10 bytes instead of 55/);
  // Headers that claim the whole slice but deliver less are still caught by the pin itself.
  await assert.rejects(attempt(rangedResponse(Buffer.from(slice.subarray(0,10)),{contentLength:String(slice.length)})),/size drifted/);
  assert.deepEqual(await readdir(directory),[]);
}));
