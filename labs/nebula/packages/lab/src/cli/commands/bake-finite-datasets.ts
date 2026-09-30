import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {bakeFiniteDataset} from '../../server/workflows/density/finite-dataset.ts';
import {parseLabModelJson} from '../../resources/model-paths.ts';
import { sourceBytes } from '@cssearth/bake/volume/node';
import { validateChannelGain, validateDatasetToneCurve } from '@cssearth/bake/volume';
const root=process.cwd(),path=process.argv[2],recipe=parseLabModelJson(await readFile(path,'utf8'));
if(recipe.schema!=='cssearth-finite-dataset-recipe@1'||!Array.isArray(recipe.sources))throw Error('Invalid finite dataset recipe');
const alignment=parseLabModelJson((await sourceBytes(root,recipe.alignmentReport)).toString()),results=[];
for(const source of recipe.sources){
 const baseline=parseLabModelJson(await readFile(resolve(root,'.local/nebula-lab/reconstructions',source.sourceResultId,'source/provenance.json'),'utf8'));
 const proof=alignment.sources.find((p:{id:string})=>p.id===source.imageId);
 if(!proof?.pass||proof.sourcePath!==baseline.request.original.path)throw Error(`Baseline ${source.sourceResultId} of ${source.imageId} was not made from the qualified original ${proof?.sourcePath}`);
 // One optional per-dataset display correction: every dataset wears the shared geometry's one fitted alpha, so
 // its own exposure against its own source image and its white balance can only live in the material.
 if(source.channelGain!==undefined)validateChannelGain(source.channelGain);
 // A fitted tone curve (`dataset-tone-fit`) is recorded here and in the dataset provenance.
 if(source.toneCurve!==undefined)validateDatasetToneCurve(source.toneCurve);
 const result=await bakeFiniteDataset(root,{modelResultId:recipe.modelResultId,sourceResultId:source.sourceResultId,channelGain:source.channelGain,...(source.toneCurve!==undefined?{toneCurve:source.toneCurve}:{})},undefined,p=>{if(p.current%48===0)console.log(p.message);});
 results.push({imageId:source.imageId,resultId:result.resultId,channelGain:source.channelGain??null,...(source.toneCurve!==undefined?{toneCurve:source.toneCurve}:{}),subject:result.subject});console.log(JSON.stringify({imageId:source.imageId,resultId:result.resultId,completed:results.length,total:recipe.sources.length}));
}
const bundle={schema:'cssearth-finite-dataset-bundle@1',recipe:{path},modelResultId:recipe.modelResultId,datasets:results,excluded:recipe.excluded};
const output=resolve(root,'.local/nebula-lab',`finite-datasets-${recipe.modelResultId}.json`);
// External index beside the model, not part of its artifact manifest.
await writeFile(output,JSON.stringify(bundle,null,2)+'\n');console.log(JSON.stringify({output,datasets:results.length}));
