import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {GALAXY_SLICES} from './galaxy-slice-source.mts';
import {EXTENT_FIXTURE} from './galaxy-slice-extent-fixture.mts';
import {parseGalaxySliceControls} from './slice-galaxy.mts';

test('opt-in image extension preserves every original pixel and three empty border cells',()=>{
 const dir=mkdtempSync(resolve(tmpdir(),'galaxy-image-extent-'));
 try{
  writeFileSync(dir+'/slices.py',process.env.CSSEARTH_SLAB_MUTATION_SOURCE?readFileSync(process.env.CSSEARTH_SLAB_MUTATION_SOURCE,'utf8'):GALAXY_SLICES);
  writeFileSync(dir+'/fixture.py',EXTENT_FIXTURE);
  const run=spawnSync(process.env.CSSEARTH_TORCH_PYTHON??'python3',[dir+'/fixture.py',dir,dir+'/slices.py',JSON.stringify(parseGalaxySliceControls({mode:'outside-display',counts:'2,2,2'}))],{encoding:'utf8',timeout:60_000});
  assert.equal(run.status,0,run.stdout+run.stderr);assert.match(run.stdout,/IMAGE EXTENSION CORE AND EMPTY BORDER VERIFIED/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
