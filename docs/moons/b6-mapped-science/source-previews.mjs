import {readFile,mkdir} from 'node:fs/promises';
import sharp from 'sharp';
import {loadScienceSurface,paintScienceSurface} from '../../../tools/objects/terrestrial-layers/scientific-raster.mts';
const read=async path=>JSON.parse(await readFile(path));
await mkdir('output/b6-previews',{recursive:true});
for(const [body,id] of [['moon','geology'],['moon','silicate-signature'],['europa','geology'],['charon','albedo']]){
 let config=await read(`src/planets/${body}/source/preparation/${body==='moon'?'raster':'terrestrial'}.json`);
 let lens=body==='moon'?config.lenses.find(x=>x.id===id):config.raster.scientific.find(x=>x.id===id);
 const root=`src/planets/${body}/source/`+(body==='moon'?lens.input.slice(0,lens.input.lastIndexOf('/')):'');
 lens=body==='moon'?lens.scientific:lens;
 const raster=await loadScienceSurface(root,lens);const {rgb,missing}=paintScienceSurface(raster,{...lens,outputLongitudeOrigin:-180},1024,512);
 await sharp(rgb,{raw:{width:1024,height:512,channels:3}}).png().toFile(`output/b6-previews/${body}-${id}.png`);
 console.log(body,id,missing.reduce((sum,v)=>sum+v,0));
}
for(const body of ['europa','callisto'])await sharp(`src/planets/${body}/source/nims/${body}-nims-composite.tif`).resize(1024,512,{kernel:'nearest'}).png().toFile(`output/b6-previews/${body}-infrared.png`);
