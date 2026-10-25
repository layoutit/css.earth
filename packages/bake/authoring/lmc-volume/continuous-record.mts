/** l14 source records preserve the l13 catalogue and Gaia selection lineage. */
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {ROOT,json,rec} from './inputs.mts';
import {CONTINUOUS_SETTINGS} from './continuous-model.mts';
import type {CatalogueScene} from './catalogue-scene.mts';
export async function recordContinuousVersion(scene:CatalogueScene,runs:unknown[],fit:unknown){
 const base=ROOT+'src/objects/lmc-volume/source/preparation/',dir=base+'l14/';await mkdir(dir,{recursive:true});const write=(name:string,value:unknown)=>writeFile(dir+name+'.json',JSON.stringify(value,null,2)+'\n'),parent=rec(await json(base+'l13/lineage.json'));
 await Promise.all([
  write('recipe',{schema:'lmc-continuous-gaia@1',generator:'packages/bake/authoring/lmc-volume/catalogue-run.mts',generatorArguments:['--version=14'],parent:'l13',acceptedByOwner:false,settings:CONTINUOUS_SETTINGS,geometry:scene.metadata,calibration:'Four new global controls: three diffuse-Gaia RGB factors and one outskirts gain. Two existing disc/bar gains may rebalance. Other l13 calibration values are retained.',replayStages:['catalogue-run.mts --version=14 --tiny-only','catalogue-run.mts --version=14','continuous-report.mts','record-manifest.mts']}),
  write('fit',fit),copyFile(base+'l13/frame.json',dir+'frame.json'),
  write('lineage',{...parent,hybridSources:{...rec(parent.hybridSources),populationMap:'src/objects/lmc-volume/.local/versions/l14/young-density.json'},parentModel:base.slice(ROOT.length)+'l13/',populationMap:'src/objects/lmc-volume/.local/versions/l14/young-density.json',modellingChoices:CONTINUOUS_SETTINGS,geometryPreservation:'src/objects/lmc-volume/.local/versions/l14/preservation.json'}),
  write('field',{generator:'packages/bake/authoring/lmc-volume/continuous-model.mts',workingGeometry:'src/objects/lmc-volume/.local/versions/l14/structure.json',populationMap:'src/objects/lmc-volume/.local/versions/l14/young-density.f32le',...scene.metadata}),
  write('provenance',{status:'Unaccepted l14 continuous-population prototype',rungs:runs,sheet:'src/objects/lmc-volume/.local/versions/l14/sheet.png',fullFit:false,slabs:false})]);
}
