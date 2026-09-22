import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {loadRadialModels,combineRadialModels} from '../../../../tools/objects/terrestrial-layers/radial-models.mts';
import {prepareSolidRasters} from '../../../../tools/objects/terrestrial-layers/solid-raster.mts';
import {parseTerrestrialProfile} from '../../../../tools/objects/terrestrial-layers/index.mts';
import {requireRecord,requireArray,requireString} from '../../../../tools/sources/source-values.mts';

test('Dinkinesh keeps both source shapes and their provenance separate',async()=>{
 const sourceDirectory=resolve('src/objects/dinkinesh/source');
 const read=async(path:string):Promise<unknown>=>JSON.parse(await readFile(resolve(sourceDirectory,path),'utf8'));
 const source=await createSourceManifest({planetId:'dinkinesh',planetName:'Dinkinesh',sourceRoot:sourceDirectory});
 await source.verify();
 const config=parseTerrestrialProfile(await read('preparation/terrestrial.json'));
 const models=await loadRadialModels({config,sourceDirectory,source});
 assert.deepEqual(models.map(m=>[m.id,m.lensIds,m.radial.grid.faces,m.radial.faces.length]),[
  ['tempest-shape',['tempest-shape'],1266,1266],['shape',['shape'],101512,1200],
 ]);
 assert.equal(models[0].radial.grid.vertices,635);
 const combined=combineRadialModels(models,'dinkinesh');assert.ok(combined);
 assert.deepEqual(combined.lensRanges,[{lensId:'tempest-shape',start:0,count:1266},{lensId:'shape',start:1266,count:1200}]);
 assert.ok(combined.leaves.every(leaf=>leaf.tag==='u'&&leaf.attributes['data-polycss-texture-leaf-sizing']==='raster'));
 assert.deepEqual(requireRecord(await read('preparation/features.json')).lensIds,['shape'],'legacy coordinates must not transfer to the recovered frame');
 assert.equal(config.presentation.defaultLens,'tempest-shape');
 assert.equal(config.raster.observations.length,0,'unregistered photography stays deferred');
 const content=requireRecord(await read('content/object.json'));
 const settings=requireArray(requireRecord(content.settings).controls).map(value=>requireRecord(value));
 assert.equal(settings.find(c=>c.name==='shadows')?.checked,false);
 const directory=await mkdtemp(resolve(tmpdir(),'dinkinesh-shape-provenance-'));
 try{
  const surfaces=await prepareSolidRasters({sourceDirectory,source,config,radial:models[0].radial,radialModels:models,publicDirectory:directory,outputDirectory:directory});
  const recorded=surfaces.map(s=>[s.id,requireString(requireRecord(s.source).id)]);
  assert.deepEqual(recorded,[['tempest-shape','tempest-dinkinesh-model'],['shape','shape-model']]);
 }finally{await rm(directory,{recursive:true,force:true});}
});
