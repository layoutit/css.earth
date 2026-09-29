import assert from 'node:assert/strict';
import { sourceTest } from '../source-test.mts';
const test = sourceTest();
import {mkdir, mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {prepareDskMesh, validateDskMeshRecipe} from '@cssearth/bake/objects/acquisition';
const recipe={inputPath:'shape.bds',inputBytes:16,member:'shape.obj',targetId:602,frameId:10040,surfaceId:20122,sourceVertices:6,sourceFaces:4,weldedVertices:4,spiceypyVersion:'6.0.3',cspiceVersion:'CSPICE_N0067'};
test('DSK conversion rejects source escapes, unpinned tools and impossible dimensions before invocation',()=>{
 assert.equal(validateDskMeshRecipe(recipe),recipe);
 for(const patch of [{inputPath:'../shape.bds'},{inputPath:'/shape.bds'},{member:'../shape.obj'},{spiceypyVersion:'latest'},{weldedVertices:7},{sourceFaces:0}])assert.throws(()=>validateDskMeshRecipe({...recipe,...patch}),TypeError);
});
test('DSK input size is checked before any converter is launched',async()=>{
 const sourceRoot=await mkdtemp(resolve(tmpdir(),'dsk-pin-test-'));
 try {await writeFile(resolve(sourceRoot,'shape.bds'),Buffer.alloc(15));await assert.rejects(prepareDskMesh({sourceRoot,recipe}),/length differs/);}
 finally {await rm(sourceRoot,{recursive:true,force:true});}
});
test('the converter is launched from its source beside the acquisition topic, also from the built entry', async () => {
 // A stand-in interpreter answers the numpy probe, then checks the script it was given exists and writes a matching receipt.
 const directory = await mkdtemp(resolve(tmpdir(), 'dsk-converter-test-'));
 try {
  const python = resolve(directory, 'python'), sourceRoot = resolve(directory, 'source');
  await writeFile(python, `#!/bin/sh
[ "$1" = "-c" ] && exit 0
[ -f "$1" ] || { echo "no converter at $1" >&2; exit 3; }
printf '%s' "$1" > "${directory}/script"; printf 'mesh' > "$4"
printf '{"schema":"cssearth-dsk-mesh-conversion@1","bytes":4}'
`, { mode: 0o755 });
  await mkdir(sourceRoot); await writeFile(resolve(sourceRoot, 'shape.bds'), Buffer.alloc(16));
  const previous = process.env.CSSEARTH_SPICE_PYTHON; process.env.CSSEARTH_SPICE_PYTHON = python;
  try { assert.equal((await prepareDskMesh({sourceRoot, recipe})).toString(), 'mesh'); }
  finally { if (previous === undefined) delete process.env.CSSEARTH_SPICE_PYTHON; else process.env.CSSEARTH_SPICE_PYTHON = previous; }
  assert.equal(await readFile(resolve(directory, 'script'), 'utf8'), resolve(import.meta.dirname, '../../../packages/bake/src/objects/acquisition/dsk-mesh.py'));
 } finally {await rm(directory, {recursive:true, force:true});}
});
