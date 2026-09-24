import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {bakeFiniteLens} from '../../server/workflows/density/finite-lens.ts';
import {parseLabModelJson} from '../../resources/model-paths.ts';
import {sourceBytes} from '@cssearth/volume-bake/compact-inputs/density-grid';
import { sha256 } from '@cssearth/core/node';
import {validateChannelGain,validateLensToneCurve} from '@cssearth/volume-core/materials/slab-material';
const root=process.cwd(),path=process.argv[2],bytes=await readFile(path),recipe=parseLabModelJson(bytes.toString());
if(recipe.schema!=='cssearth-finite-lens-recipe@1'||!Array.isArray(recipe.sources))throw Error('Invalid finite lens recipe');
const alignment=parseLabModelJson((await sourceBytes(root,recipe.alignmentReport)).toString()),results=[];
for(const source of recipe.sources){
 const baseline=parseLabModelJson(await readFile(resolve(root,'.local/nebula-lab/reconstructions',source.sourceResultId,'source/provenance.json'),'utf8'));
 const proof=alignment.sources.find((p:{id:string})=>p.id===source.imageId);
 if(!proof?.pass||proof.sourceSha256!==baseline.request.original.sha256||proof.sourcePath!==baseline.request.original.path)throw Error('Baseline differs from qualified original: '+source.imageId);
 // One optional per-lens display correction: every lens wears the shared geometry's one fitted alpha, so
 // its own exposure against its own source image and its white balance can only live in the material.
 if(source.channelGain!==undefined)validateChannelGain(source.channelGain);
 // A fitted tone curve (`lens-tone-fit`) is recorded here and in the lens provenance.
 if(source.toneCurve!==undefined)validateLensToneCurve(source.toneCurve);
 const result=await bakeFiniteLens(root,{modelResultId:recipe.modelResultId,sourceResultId:source.sourceResultId,channelGain:source.channelGain,...(source.toneCurve!==undefined?{toneCurve:source.toneCurve}:{})},undefined,p=>{if(p.current%48===0)console.log(p.message);});
 results.push({imageId:source.imageId,resultId:result.resultId,channelGain:source.channelGain??null,...(source.toneCurve!==undefined?{toneCurve:source.toneCurve}:{}),subject:result.subject});console.log(JSON.stringify({imageId:source.imageId,resultId:result.resultId,completed:results.length,total:recipe.sources.length}));
}
const bundle={schema:'cssearth-finite-lens-bundle@1',recipe:{path,sha256:sha256(bytes)},modelResultId:recipe.modelResultId,lenses:results,excluded:recipe.excluded};
const output=resolve(root,'.local/nebula-lab',`finite-lenses-${recipe.modelResultId}.json`);
// External index beside immutable model, not part of its historical artifact manifest.
await writeFile(output,JSON.stringify(bundle,null,2)+'\n');console.log(JSON.stringify({output,lenses:results.length}));
