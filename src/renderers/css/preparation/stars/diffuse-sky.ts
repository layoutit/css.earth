import sharp from 'sharp';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceBytes } from '@cssearth/bake/volume/node';
import { sha256 } from '@cssearth/core/node';
import type { PreparedCssPointFieldManifest as PreparedCssPointField,StarsRecipe } from '../../../../preparation/stars/types.js';
/** A low-pass photographic residual; compact points are suppressed, not identified or subtracted. */
export async function prepareDiffuseSky(sourceDirectory:string,outputDirectory:string,config:StarsRecipe['diffuseSky']) {
  const diffuseSky: {id:string;path:string}[]=[],resources:PreparedCssPointField['resources'][number][]=[];
  if (!config) return {diffuseSky,resources};
  await mkdir(resolve(outputDirectory,'diffuse-sky'),{recursive:true});
  for (const face of config.faces) {
    const source=await sourceBytes(sourceDirectory,face);
    const bytes=await sharp(source).resize(config.width,config.width).blur(config.blurSigmaPixels).webp({quality:90}).toBuffer();
    const path=`diffuse-sky/${face.id}.webp`;
    await writeFile(resolve(outputDirectory,path),bytes);
    diffuseSky.push({id:face.id,path});resources.push({path,sha256:sha256(bytes),bytes:bytes.length,width:config.width,height:config.width});
  }
  return {diffuseSky,resources};
}
