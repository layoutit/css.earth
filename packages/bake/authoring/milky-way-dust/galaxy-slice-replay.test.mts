import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import {GALAXY_SLICES} from './galaxy-slice-source.mts';
import {REPLAY_FIXTURE} from './galaxy-slice-replay-fixture.mts';
import {galaxyGoldenBytes} from './galaxy-slice-golden.mts';
import {parseGalaxySliceControls} from './slice-galaxy.mts';

test('default outside recipe replays the step-one accepted producer pixel for pixel',async()=>{
 const dir=mkdtempSync(resolve(tmpdir(),'galaxy-default-replay-'));
 try{
  writeFileSync(dir+'/slices.py',process.env.CSSEARTH_SLAB_MUTATION_SOURCE?readFileSync(process.env.CSSEARTH_SLAB_MUTATION_SOURCE,'utf8'):GALAXY_SLICES);
  writeFileSync(dir+'/fixture.py',REPLAY_FIXTURE);
  const controls=parseGalaxySliceControls({mode:'outside-display',counts:'2,2,2'});
  const run=spawnSync(process.env.CSSEARTH_TORCH_PYTHON??'python3',[dir+'/fixture.py',dir,dir+'/slices.py',JSON.stringify(controls)],{encoding:'utf8',timeout:60_000});
  assert.equal(run.status,0,run.stdout+run.stderr);
  const expected=new URL('./fixtures/galaxy-slice-replay/',import.meta.url);
  const golden=galaxyGoldenBytes();
  assert.equal(golden.size,12);
  const actual=readdirSync(dir+'/out',{recursive:true}).filter(file=>typeof file==='string'&&file.endsWith('.png')).sort();
  assert.deepEqual(actual,[...golden.keys()].sort());
  // Pixels, not PNG bytes: Pillow's zlib differs between platforms (Linux CI wrote 105 bytes where macOS wrote 109 for the
  // same image), so only the decoded image is the producer's output.
  const pixels=async(input:Buffer)=>{const {data,info}=await sharp(input).raw().toBuffer({resolveWithObject:true});return {data,width:info.width,height:info.height,channels:info.channels};};
  for(const [file,bytes]of golden)assert.deepEqual(await pixels(readFileSync(dir+'/out/'+file)),await pixels(Buffer.from(bytes)),file);
  // Ordering of os.walk is filesystem-owned, and a file's byte count is its platform's zlib; every other value is pinned.
  const normalize=(text:string)=>{const data:unknown=JSON.parse(text);assert.ok(data&&typeof data==='object'&&'files' in data&&Array.isArray(data.files));for(const file of data.files){assert.ok(file&&typeof file==='object'&&'bytes' in file);delete file.bytes;}data.files.sort((a:unknown,b:unknown)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));return data;};
  assert.deepEqual(normalize(readFileSync(dir+'/out/prototype.json','utf8')),normalize(readFileSync(new URL('prototype.json',expected),'utf8')));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
