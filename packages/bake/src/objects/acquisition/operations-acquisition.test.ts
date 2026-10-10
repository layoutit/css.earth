import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { mkdtemp, readFile, writeFile, rm, readdir, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { commandOutput, executeAcquisition, parseAcquisitionPlan, convertMappedComposition, parseMappedCompositionRecipe, zipMemberFromTail, zipTailRange } from '@cssearth/bake/objects/acquisition';
import { acquirePinnedDownloads, verifySources, type SourceManifest } from '@cssearth/bake/objects/sources';
import { gzipSync } from 'node:zlib';
const test = sourceTest();

const rawSource = (_bytes: Uint8Array) => ({path:'source.img',origin:'https://example.test/source.img'});
const rawManifest = (bytes: Uint8Array): SourceManifest => ({schema:'cssearth-authoritative-sources@3',
  inputs:[rawSource(bytes)],generatedIntermediates:[],documents:[]});
const rawPlan = parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1',operations:[{
  kind:'download',path:'source.img',url:'https://example.test/source.img',groups:['refresh'],headers:{'X-Source':'fixture'},
}]});
const temporary = async (work: (directory: string) => Promise<void>) => {
  const directory=await mkdtemp(join(tmpdir(),'cssearth-stream-source-'));
  try { await work(directory); } finally { await rm(directory,{recursive:true,force:true}); }
};

test('the default transport names this project and keeps a step\'s own headers',t=>temporary(async directory=>{
  // Zenodo refused the runtime's default user agent with 403 (2026-10-03); a request that names who asks is served.
  const data=new TextEncoder().encode('source bytes'),manifest=rawManifest(data),asked:Headers[]=[];
  t.mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{asked.push(new Headers(init?.headers));return new Response(data);});
  await executeAcquisition({sourceRoot:directory,manifest,plan:rawPlan});
  assert.match(asked[0]!.get('user-agent')??'',/^cssEarth\/[\d.]+ \(https:\/\/github\.com\/layoutit\/css\.earth; source restore\)$/u);
  assert.equal(asked[0]!.get('x-source'),'fixture');
  assert.deepEqual(await readFile(join(directory,'source.img')),Buffer.from(data));
}));

test('an empty acquisition plan is valid when every source input is already tracked',()=>{
  const plan=parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1',operations:[]});
  assert.deepEqual(plan.operations,[]);
});

for(const kind of ['geotiff-grid','geotiff-image'] as const)test(`${kind} restores from the source cache and rejects an invalid recipe before replacing bytes`,()=>temporary(async directory=>{
  const plan=parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1',operations:[{
    kind,path:'source.img',recipePath:'grid.json',groups:['refresh']}]});
  const recipe={schema:kind==='geotiff-image'?'cssearth-geotiff-image@1':'cssearth-geotiff-grid@1',source:{url:'https://example.test/native.tif',productId:'native',
    width:8,height:4,origin:[-180,90],resolution:[45,-45],coordinates:'degrees',radius:1000,centerLongitude:0,
    noData:kind==='geotiff-image'?0:-9999,bits:kind==='geotiff-image'?8:32,sampleFormat:kind==='geotiff-image'?1:3,samples:1},output:{width:4,height:2,radius:1000}};
  const bytes=Buffer.from('compact fixture bytes'),manifest=rawManifest(bytes);
  await writeFile(join(directory,'grid.json'),JSON.stringify(recipe));
  const urls:string[]=[];
  const transport={fetch:async(url:string)=>{urls.push(url);return chunkedResponse([bytes]);}};
  await executeAcquisition({sourceRoot:directory,objectId:'fixture',mirrorOrigin:'https://mirror.test.invalid',manifest,plan,transport});
  assert.deepEqual(urls,['https://mirror.test.invalid/source-cache/fixture/source.img']);
  assert.deepEqual(await readFile(join(directory,'source.img')),bytes);
  await writeFile(join(directory,'grid.json'),'{}');
  await assert.rejects(executeAcquisition({sourceRoot:directory,manifest,plan,transport}));
  assert.equal(urls.length,1);
  assert.deepEqual(await readFile(join(directory,'source.img')),bytes);
}));

test('mapped composition acquisition restores the pinned map and report through the selected group',()=>temporary(async directory=>{
  const values=Array.from({length:180},()=>Array.from({length:360},()=>0.25));
  const original=gzipSync(JSON.stringify({metadata:{target:'Fixture',observation_name:'published',nan_value:-99,
    latitudes:Array.from({length:180},(_,i)=>i-90),longitudes:Array.from({length:360},(_,i)=>i)},
    best_estimate_abundance:{ice:values},lower_bound_abundance:{ice:values},upper_bound_abundance:{ice:values}}));
  const recipe=parseMappedCompositionRecipe({schema:'cssearth-mapped-composition@1',target:'Fixture',observationName:'published',
    referenceRadiusMeters:1000,input:'native.json.gz',selections:[{id:'ice',kind:'posterior',field:'ice',statistic:'median'}]});
  const converted=convertMappedComposition(original,recipe),report=Buffer.from(JSON.stringify(converted.report,null,2)+'\n');
  await writeFile(join(directory,'native.json.gz'),original);
  await writeFile(join(directory,'recipe.json'),JSON.stringify(recipe));
  const manifest:SourceManifest={schema:'cssearth-authoritative-sources@3',inputs:[],documents:[],generatedIntermediates:
    [['ice.tif',converted.products.ice],['report.json',report]].map(([path,bytes])=>{
      assert.ok(typeof path==='string');assert.ok(bytes instanceof Uint8Array);
      return {path,generator:'fixture spectral-band converter'};
    })};
  const plan=parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1',operations:[
    {kind:'mapped-composition',path:'ice.tif',recipePath:'recipe.json',product:'ice',groups:['composition']},
    {kind:'mapped-composition',path:'report.json',recipePath:'recipe.json',product:'report',groups:['composition']}]});
  await executeAcquisition({sourceRoot:directory,manifest,plan,group:'composition',transport:{fetch:async()=>{throw new Error('No network needed for pinned native conversion');}}});
  assert.deepEqual(await readFile(join(directory,'ice.tif')),Buffer.from(converted.products.ice));
  assert.deepEqual(await readFile(join(directory,'report.json')),report);
}));
function chunkedResponse(chunks: Uint8Array[], declared: string|null = String(chunks.reduce((total,chunk)=>total+chunk.length,0))): Response {
  let next=0;
  const response=new Response(new ReadableStream<Uint8Array>({
    pull(controller) { if(next<chunks.length)controller.enqueue(chunks[next++]!);else controller.close(); },
  },{highWaterMark:0}),declared===null?undefined:{headers:{'content-length':declared}});
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

// Manifests carry no byte or hash pins, so the answer's own declared length is what a raw transfer is held to.
for(const [name,received,declared,error] of [
  ['short',Buffer.from('pin'),'11',/size drifted: received 3 bytes of the declared 11/],
  ['overlong',Buffer.from('pinned data extra'),'11',/size drifted: the answer passed its declared 11 bytes/],
] as const)test(`raw ${name} transfer preserves the destination and removes partial files`,()=>temporary(async directory=>{
  const data=Buffer.from('pinned data'),old=Buffer.from('previous pin');await writeFile(join(directory,'source.img'),old);
  await assert.rejects(executeAcquisition({sourceRoot:directory,manifest:rawManifest(data),plan:rawPlan,mirrorOrigin:null,
    transport:{fetch:async()=>chunkedResponse([received.subarray(0,2),received.subarray(2)],declared)}}),error);
  assert.deepEqual(await readFile(join(directory,'source.img')),old);
  assert.deepEqual(await readdir(directory),['source.img']);
}));

// A server that compresses the transfer declares the compressed length, and fetch hands over the decoded file:
// raw.githubusercontent.com answers a 4.6 MB table with content-length 637707. That length says nothing about the file.
test('a compressed answer is not held to the length of its transfer',()=>temporary(async directory=>{
  const data=Buffer.from('pinned data');
  await executeAcquisition({sourceRoot:directory,manifest:rawManifest(data),plan:rawPlan,mirrorOrigin:null,
    transport:{fetch:async()=>new Response(data,{headers:{'content-length':'4','content-encoding':'gzip'}})}});
  assert.deepEqual(await readFile(join(directory,'source.img')),data);
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

// An endless body is the case that fills a disk: the write has to stop at the declared size while the bytes are
// still flowing, not after the answer has been written out and measured.
test('an unbounded overlong response is cancelled after bounded chunk consumption',()=>temporary(async directory=>{
  const data=Buffer.alloc(32),old=Buffer.from('previous pin');await writeFile(join(directory,'source.img'),old);
  let pulls=0,cancelled=false;
  const response=new Response(new ReadableStream<Uint8Array>({
    pull(controller){pulls++;controller.enqueue(new Uint8Array(1024));},
    cancel(){cancelled=true;},
  },{highWaterMark:0}),{headers:{'content-length':String(data.length)}});
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

// Tracked bytes are git's to keep, so verification is coverage and file kind: every declared source present, every
// present file declared. It reads the file as it stands and never hashes it against a manifest pin.
test('source verification covers every declared source and refuses an undeclared file',()=>temporary(async directory=>{
  const data=Buffer.alloc(256*1024+7,37),manifest=rawManifest(data);await writeFile(join(directory,'source.img'),data);
  assert.equal((await verifySources({sourceRoot:directory,manifest})).verifiedCount,1);
  await writeFile(join(directory,'stray.img'),data);
  await assert.rejects(verifySources({sourceRoot:directory,manifest}),/Undeclared: stray\.img/);
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
  // The archive cache is local state; remove whatever this test added to it.
  const archives = resolve('.local/source-archives');
  const listArchives = async () => new Set(await readdir(archives).catch(() => []));
  const before = await listArchives();
  try {
    const content = Buffer.from(`Pinned source fixture ${randomUUID()}\n`);
    await mkdir(join(directory, 'transit spectrum'));
    await writeFile(join(directory, 'transit spectrum/source.bin'), content);
    execFileSync('zip', ['-q', 'archive.zip', 'transit spectrum/source.bin'], {cwd: directory});
    const archive = await readFile(join(directory, 'archive.zip'));
    const step = {kind:'zip-member', path:'restored.bin', url:'https://example.test/archive.zip', member:'transit spectrum/source.bin', groups:['restore']};
    const plan = parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1', operations:[step]});
    const manifest = {schema:'cssearth-authoritative-sources@3', inputs:[{id:'fixture',path:'restored.bin'}], generatedIntermediates:[],documents:[]};
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
  } finally {
    for (const name of await listArchives()) if (!before.has(name)) await rm(join(archives, name), { recursive: true, force: true });
    await rm(directory,{recursive:true,force:true});
  }
});

test('one member of a remote ZIP is restored by byte range, and the archive is taken whole only when it must be', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-zip-range-')), archives = resolve('.local/source-archives');
  const listArchives = async () => new Set(await readdir(archives).catch(() => [])), before = await listArchives();
  /** An archive host: it answers a range with those bytes and their place, or ignores ranges as some servers do. */
  const serving = (archive: Buffer, asked: string[], ranges = true) => ({ fetch: async (_url: string, init?: RequestInit) => {
    const range = new Headers(init?.headers).get('range'); asked.push(range ?? 'whole');
    if (!range || !ranges) return new Response(new Uint8Array(archive));
    const suffix = /^bytes=-(\d+)$/u.exec(range), span = /^bytes=(\d+)-(\d+)$/u.exec(range);
    const first = suffix ? Math.max(0, archive.length - Number(suffix[1])) : Number(span![1]), last = suffix ? archive.length - 1 : Math.min(Number(span![2]), archive.length - 1);
    return new Response(new Uint8Array(archive.subarray(first, last + 1)), { status: 206, headers: { 'content-range': `bytes ${first}-${last}/${archive.length}` } });
  } });
  try {
    // A deflated model file beside a larger neighbour, and a stored one: the two methods the reader takes.
    const model = Buffer.from(`${'field '.repeat(4000)}${randomUUID()}\n`), stored = Buffer.from(`stored ${randomUUID()}\n`);
    await mkdir(join(directory, 'run/DATA'), { recursive: true });
    await writeFile(join(directory, 'run/DATA/model.nc'), model); await writeFile(join(directory, 'run/neighbour.bin'), Buffer.alloc(200_000, 7)); await writeFile(join(directory, 'run/stored.txt'), stored);
    execFileSync('zip', ['-q', 'archive.zip', 'run/neighbour.bin', 'run/DATA/model.nc'], { cwd: directory }); execFileSync('zip', ['-q', '-0', 'archive.zip', 'run/stored.txt'], { cwd: directory });
    const archive = await readFile(join(directory, 'archive.zip')), url = `https://example.test/${randomUUID()}.zip`;
    const step = (member: string, path: string) => ({ kind: 'zip-member', path, url, member, groups: ['restore'] });
    const run = (member: string, path: string, transport: { fetch(url: string, init?: RequestInit): Promise<Response> }) => executeAcquisition({ sourceRoot: directory, group: 'restore', transport,
      plan: parseAcquisitionPlan({ schema: 'cssearth-acquisition-plan@1', operations: [step(member, path)] }), manifest: { schema: 'cssearth-authoritative-sources@3', inputs: [{ id: 'fixture', path }], generatedIntermediates: [], documents: [] } });
    const asked: string[] = [];
    await run('run/DATA/model.nc', 'model.nc', serving(archive, asked));
    assert.deepEqual(await readFile(join(directory, 'model.nc')), model);
    // The tail holds this small archive's directory: the member's header and its bytes are the only other requests.
    assert.equal(asked[0], 'bytes=-65557'); assert.equal(asked.length, 3); assert.equal(asked.includes('whole'), false);
    assert.ok(asked.slice(1).every(range => { const [first, last] = /^bytes=(\d+)-(\d+)$/u.exec(range)!.slice(1).map(Number); return last! - first! < model.length; }), 'only the header and the packed member are asked for');
    await run('run/stored.txt', 'stored.txt', serving(archive, [])); assert.deepEqual(await readFile(join(directory, 'stored.txt')), stored);
    assert.deepEqual([...await listArchives()].filter(name => !before.has(name)), [], 'no archive is kept for a member read by range');
    // A member the directory does not list is refused at once, and so is one whose bytes are not the directory's.
    await assert.rejects(run('run/DATA/absent.nc', 'absent.nc', serving(archive, [])), /lists no member run\/DATA\/absent\.nc/u);
    const damaged = Buffer.from(archive); damaged[damaged.indexOf(stored) + 3] ^= 0xff;
    await assert.rejects(run('run/stored.txt', 'damaged.txt', serving(damaged, [])), /run\/stored\.txt of .* does not unpack to the \d+ bytes and the CRC-32 its archive records/u);
    // An archive this reader is not for is taken whole: ZIP64 counts in its end record, a member packed another way, an encrypted one.
    const end = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])), entry = archive.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    const changed = (change: (bytes: Buffer) => void) => { const bytes = Buffer.from(archive); change(bytes); return bytes; };
    const tail = async (bytes: Buffer, member: string) => { const host = serving(bytes, []), ranged = (range: string) => host.fetch(url, { headers: { Range: range } }); return zipMemberFromTail(await ranged(zipTailRange), ranged, url, member); };
    // The directory's first entry, whose fields are changed below.
    const listed = archive.subarray(entry + 46, entry + 46 + archive.readUInt16LE(entry + 28)).toString();
    assert.equal(await tail(changed(bytes => { bytes.writeUInt16LE(0xffff, end + 8); bytes.writeUInt16LE(0xffff, end + 10); }), 'run/DATA/model.nc'), null);
    assert.equal(await tail(changed(bytes => { bytes.writeUInt16LE(12, entry + 10); }), listed), null);
    assert.equal(await tail(changed(bytes => { bytes.writeUInt16LE(bytes.readUInt16LE(entry + 8) | 1, entry + 8); }), listed), null);
    await assert.rejects(tail(Buffer.alloc(5000, 1), 'run/DATA/model.nc'), /does not end as a ZIP archive does/u);
    // A directory that begins before the archive's last bytes is asked for on its own: one request more.
    for (let i = 0; i < 1500; i++) await writeFile(join(directory, `run/neighbour-with-a-long-name-so-the-directory-grows-${String(i).padStart(5, '0')}.bin`), Buffer.from([i & 255]));
    execFileSync('zip', ['-q', '-r', 'many.zip', 'run'], { cwd: directory });
    const many = await readFile(join(directory, 'many.zip')), far: string[] = [], manyHost = serving(many, far), manyRanged = (range: string) => manyHost.fetch(url, { headers: { Range: range } });
    assert.deepEqual(Buffer.from((await zipMemberFromTail(await manyRanged(zipTailRange), manyRanged, url, 'run/DATA/model.nc'))!), model); assert.equal(far.length, 4);
    // A server that ignores ranges sends the archive: that one answer is the download, and unzip takes the member out.
    const whole: string[] = [];
    await run('run/DATA/model.nc', 'whole.nc', serving(archive, whole, false));
    assert.deepEqual(whole, ['bytes=-65557']); assert.deepEqual(await readFile(join(directory, 'whole.nc')), model);
  } finally {
    for (const name of await listArchives()) if (!before.has(name)) await rm(join(archives, name), { recursive: true, force: true });
    await rm(directory, { recursive: true, force: true });
  }
});

// The ZIP test above restored an empty file on CI: unzip had finished a 59-byte member before the pinned write began to
// read it, and Node discards what a finished child wrote that nothing reads yet. The reader here arrives late on purpose.
test('a command\'s output is kept for a reader that arrives after the command has finished', async () => {
  const output = commandOutput(process.execPath, ['-e', 'process.stdout.write("a small member")'], 'node');
  await new Promise(done => { setTimeout(done, 400); });
  const parts: Buffer[] = [];
  for await (const chunk of output) parts.push(chunk as Buffer);
  assert.equal(Buffer.concat(parts).toString(), 'a small member');
  // A command that fails ends the stream with the first line of its complaint.
  const failing = commandOutput(process.execPath, ['-e', 'process.stdout.write("part");console.error("caution: filename not matched\\nmore");process.exit(11)'], 'unzip could not read member.bin');
  await assert.rejects(async () => { for await (const _chunk of failing) { /* read to the end */ } }, /^Error: unzip could not read member\.bin: caution: filename not matched\.$/u);
});

// A pinned slice of an archive member too large to keep whole: the request must be honoured as 206 Partial Content,
// and a server that answers with the whole body is refused instead of downloaded.
const slice=Buffer.from('exactly the pinned slice of a very large archive member');
const rangedManifest=(range={offset:13096944000,length:slice.length}): SourceManifest=>({schema:'cssearth-authoritative-sources@3',
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
