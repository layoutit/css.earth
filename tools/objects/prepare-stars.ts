import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseDensityVolumeFrame } from '@cssearth/objects';
import { M_PER_PC } from '@cssearth/astronomy';
import { parseStarsRecipe, record, text } from '../../src/preparation/stars/config.js';
import { palette } from '../../src/preparation/stars/color.js';
import { loadStarSource } from '../../src/preparation/stars/source.js';
import { prepareStarHierarchy } from '../../src/preparation/stars/hierarchy.js';
import { preparePointAtlas, preparePointPhotometry } from '../../src/renderers/css/preparation/stars/material.js';
import { containedPath, verifiedBytes, sha256 } from '../../src/preparation/volume/source.js';
import type { PreparedCssPointField } from '../../src/preparation/stars/types.js';
import { prepareDiffuseSky } from '../../src/renderers/css/preparation/stars/diffuse-sky.js';

export async function prepareStarsObject(options: { objectDirectory: string; outputDirectory?: string }) {
  const objectDirectory = resolve(options.objectDirectory), outputDirectory = resolve(options.outputDirectory ?? resolve(objectDirectory,'prepared'));
  const descriptorPath = resolve(objectDirectory,'object.json'), descriptor = record(JSON.parse(await readFile(descriptorPath,'utf8')) as unknown,'Point-field descriptor');
  if (descriptor.schema !== 'cssearth-object@1' || descriptor.type !== 'point-field') throw new TypeError('Unsupported point-field descriptor.');
  const id = text(descriptor.id,'Point-field id'), properties = record(descriptor.properties,'Point-field properties'), preparation = record(properties.preparation,'Point-field preparation');
  const sourcePath = text(preparation.source,'Point-field source'), sourceHash = text(preparation.sha256,'Point-field source hash');
  const recipe = parseStarsRecipe(JSON.parse((await verifiedBytes(objectDirectory,{path:sourcePath,sha256:sourceHash})).toString('utf8')) as unknown);
  const frame = parseDensityVolumeFrame(properties.frame);
  if (frame.referenceFrame !== 'sun-icrf' || frame.metersPerUnit !== M_PER_PC || frame.originM.some(v=>v!==0) || frame.localToReferenceXyzw.some((v,i)=>v!==(i===3?1:0))) throw new TypeError('HYG Cartesian columns require the Sun-origin ICRS parsec frame.');
  const sourceDirectory=dirname(containedPath(objectDirectory,sourcePath));
  const colors = palette(recipe.colors), source = await loadStarSource(sourceDirectory,recipe,colors);
  const hierarchy = prepareStarHierarchy(source.stars,colors,recipe.tree.leafSize,recipe.tree.maximumDepth);
  if (JSON.stringify(hierarchy.boundsUnits)!==JSON.stringify(frame.boundsUnits)) throw new TypeError('Authored point-field frame bounds disagree with the prepared hierarchy.');
  await mkdir(outputDirectory,{recursive:true});
  const atlasPath = 'point-atlas.png', atlas = await preparePointAtlas(colors,recipe.atlas);
  await writeFile(resolve(outputDirectory,atlasPath),atlas);
  const diffuse=await prepareDiffuseSky(sourceDirectory,outputDirectory,recipe.diffuseSky);
  const data: PreparedCssPointField = { schema:'cssearth-css-point-field@1',id,frame,stars:hierarchy.stars,nodes:hierarchy.nodes,
    atlas:{path:atlasPath,columns:colors.length,tileSize:recipe.atlas.tileSize,colors,haloRadii:recipe.atlas.haloRadii},
    photometry:preparePointPhotometry(recipe.photometry),policy:recipe.policy,labels:recipe.labels,
    ...(recipe.diffuseSky ? {diffuseSky:diffuse.diffuseSky} : {}),
    resources:[{path:atlasPath,sha256:sha256(atlas),bytes:atlas.length,width:colors.length*recipe.atlas.tileSize,height:recipe.atlas.tileSize},...diffuse.resources],
    provenance:{source:source.provenance,catalogueMetadata:source.catalogueMetadata,qualification:'All catalogue rows retained at their recorded astrometry; no proper-motion propagation to the navigation epoch. Internal nodes approximate unresolved luminosity and position; no fixed pixel-error guarantee when the point pool is saturated.'} };
  const envelope = {schema:'cssearth-prepared-object@1',id,type:'point-field',format:'cssearth-css-point-field@1',data};
  const bytes = Buffer.from(JSON.stringify(envelope)+'\n'), outputPath = resolve(outputDirectory,'stars.json');
  await writeFile(outputPath,bytes);
  if (outputDirectory===resolve(objectDirectory,'prepared')) await writeFile(descriptorPath,JSON.stringify({...descriptor,prepared:{format:envelope.format,url:relative(objectDirectory,outputPath).split('\\').join('/'),sha256:sha256(bytes)}},null,2)+'\n');
  console.log(`PREPARED ${id}: ${data.stars.length} catalogue rows; ${data.nodes.length} hierarchy nodes; ${bytes.length} JSON bytes; ${atlas.length} atlas bytes`);
  return envelope;
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2] || process.argv[3]) throw new TypeError('Usage: prepare-stars <object-directory>');
  await prepareStarsObject({objectDirectory:process.argv[2]});
}
