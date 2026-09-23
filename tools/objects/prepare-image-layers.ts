/** Generic offline preparation entry point for retained extruded image layers. */
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseImageLayerRecipe } from '../../src/preparation/image-layers/config.js';
import { prepareImageLayers, sha256 } from '../../src/preparation/image-layers/prepare.js';

export async function prepareImageLayerObject(objectDirectory: string) {
  const root=resolve(objectDirectory), sourceDirectory=resolve(root,'source'), outputDirectory=resolve(root,'prepared');
  const descriptor=JSON.parse(await readFile(resolve(root,'object.json'),'utf8')) as {properties?:{preparation?:{source?:string}}};
  const ref=descriptor.properties?.preparation;
  // Git holds the tracked recipe; the descriptor names it and pins nothing.
  if(!ref?.source)throw new TypeError(`Image-layer object ${root} must name its source recipe in properties.preparation.source.`);
  const recipeBytes=await readFile(resolve(root,ref.source));
  const recipe=parseImageLayerRecipe(JSON.parse(recipeBytes.toString('utf8')) as unknown);
  await mkdir(outputDirectory,{recursive:true});
  let previous:string[]=[];try{const old=JSON.parse(await readFile(resolve(outputDirectory,'image-layers.json'),'utf8')) as {resources?:{path?:unknown}[]};previous=(old.resources??[]).flatMap(r=>typeof r.path==='string'?[r.path]:[]);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const prepared=await prepareImageLayers({sourceDirectory,outputDirectory,recipe});
  const preparedPath=resolve(outputDirectory,'image-layers.json'),preparedBytes=await readFile(preparedPath);
  const nextDescriptor={schema:'cssearth-object@1',id:recipe.id,type:'image-layer-bank',properties:{frame:prepared.frame,preparation:ref},
    prepared:{format:'cssearth-image-layer-bank@1',url:'prepared/image-layers.json'}};
  await writeFile(resolve(root,'object.json'),JSON.stringify(nextDescriptor,null,2)+'\n');
  const retained=new Set(prepared.resources.map(resource=>resource.path));
  for(const path of previous)if(!retained.has(path)){if(!path.startsWith('layers/')||path.split('/').includes('..'))throw new TypeError('Refusing to retire an uncontained image-layer resource.');try{await unlink(resolve(outputDirectory,path));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
  const total=prepared.resources.reduce((sum,r)=>sum+r.bytes,0), decoded=prepared.resources.reduce((sum,r)=>sum+r.width*r.height*4,0);
  console.log(`PREPARED ${recipe.id}: ${prepared.resources.length} retained images; ${total} bytes; ${decoded} decoded bytes; recipe ${sha256(recipeBytes)}`);
  return prepared;
}
const direct=process.argv[1]!==undefined&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href;
if(direct){if(!process.argv[2]||process.argv[3])throw new TypeError('Usage: prepare-image-layers <object-directory>');await prepareImageLayerObject(process.argv[2]);}
