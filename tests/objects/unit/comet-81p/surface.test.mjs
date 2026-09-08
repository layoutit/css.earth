import assert from 'node:assert/strict';import test from 'node:test';import {readFile} from 'node:fs/promises';import {resolve} from 'node:path';
import {loadPdsPlateShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mjs';
import {inspectOpenSurface,orientObservedSurface,validateObservedReduction} from '../../../../tools/objects/terrestrial-layers/open-surface.mjs';
const root=resolve(import.meta.dirname,'../../../../src/planets/comet-81p'),json=async p=>JSON.parse(await readFile(resolve(root,p)));
test('Wild 2 retains original observed positions, open boundaries and all source patches',async()=>{
 const config=await json('source/preparation/terrestrial.json'),profile=config.geometry.radialTerrain;
 const source=await loadPdsPlateShape(resolve(root,'source',profile.path),profile.grid),terrain=await json('prepared/terrain.json');
 const meters=config.geometry.radiusKm*1000/config.geometry.radius,key=p=>p.map(n=>n.toFixed(4)).join(',');
 const lookup=new Map(source.positions.map((p,i)=>[key(p),i])),indices=[];
 for(const face of terrain.faces)for(const v of face.vertices){const index=lookup.get(key(v.map(n=>n*meters)));assert.notEqual(index,undefined,'every retained vertex belongs to the released surface');indices.push(index);}
 const before=inspectOpenSurface(Uint32Array.from(source.indices.flat()),source.positions).report;
 assert.equal(before.boundary.length,348);assert.equal(before.edgeComponents,8);assert.equal(before.windingConflicts.length,6);
 const corrected=orientObservedSurface(source);assert.deepEqual(corrected.sourceOrientation.reorientedFaces,[12386,12453]);
 const after=validateObservedReduction(Uint32Array.from(corrected.indices.flat()),Uint32Array.from(indices),source.positions);
 assert.equal(terrain.faces.length,996);assert.equal(after.boundaryEdges,348);assert.equal(after.edgeComponents,8);assert.equal(after.eulerCharacteristic,1);
 const runtime=await json('prepared/runtime.json');assert.equal(runtime.surfaceHit.frontFace,'clockwise');
 assert.equal(runtime.surfaceHit.triangles.length,996);assert.equal((await json('source/preparation/rotation.json')).schema,'cssearth-display-orientation@1');
});
