import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {prepareDskMesh, validateDskMeshRecipe} from './dsk-mesh.mts';
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
