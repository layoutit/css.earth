import { sourceTest } from '../../objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { verifyReplayReferences } from '@cssearth/bake/nebula';
test('retained source references resolve without lab models and reject missing copied inputs',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'nebula-source-references-')),owner=resolve(root,'object');
  const bytes='{"scientific":"source"}\n',source={path:'labs/nebula/models/fixture.json'};
  try {
    await mkdir(resolve(owner,'source'),{recursive:true});
    await writeFile(resolve(owner,'source/reference.json'),bytes);
    await writeFile(resolve(owner,'source/replay-references.json'),JSON.stringify({schema:'cssearth-replay-references@1',references:[{
      originalPath:source.path,path:'source/reference.json',
    }]}));
    await verifyReplayReferences(root,owner,[source]);
    await rm(resolve(owner,'source/reference.json'));
    await assert.rejects(verifyReplayReferences(root,owner,[source]),{code:'ENOENT'});
  } finally {await rm(root,{recursive:true,force:true});}
});
