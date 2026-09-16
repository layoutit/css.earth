import { sha256 } from '../../src/platform/sha256.mts';
import { readAuthoredSources } from './authored-sources.ts';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { parseAuthoredObjectDescriptor } from '@cssearth/objects';
import { isArray } from '../../src/platform/is-array.mts';
import { isRecord } from '../source-values.mts';
import { preparePagedEllipsoidAssets } from './paged-ellipsoid/assets.mts';
import { parsePagedProfile } from './paged-ellipsoid/profile-source.mts';
import { createPagedSurfaceRaster, parsePreparedSurfaceRasterPlan } from './paged-ellipsoid/surface-raster.mts';
import { prepareTextureLevels, type TextureLevelBank } from './paged-ellipsoid/texture-levels.mts';


async function verifyPinnedSource(sourceDirectory: string, id: string, manifest: unknown, path: string) {
  if(!/^[a-z0-9][a-z0-9@._/-]*$/iu.test(path)||path.split('/').includes('..'))throw new TypeError('Photographic source path is unsafe.');
  const inputs=isRecord(manifest)&&isArray(manifest.inputs)?manifest.inputs:[];
  const pin=inputs.find((input): input is Record<string,unknown>=>isRecord(input)&&input.path===path);
  const expectedBytes=pin?.expectedBytes,expectedSha256=pin?.expectedSha256;
  if(!pin||typeof expectedBytes!=='number'||!Number.isSafeInteger(expectedBytes)||expectedBytes<0||typeof expectedSha256!=='string'||!/^[a-f0-9]{64}$/u.test(expectedSha256))throw new Error(`Photographic source pin is missing: ${path}`);
  const filename=resolve(sourceDirectory,path),details=await stat(filename),digest=createHash('sha256');
  if(details.size!==expectedBytes)throw new Error(`Photographic source byte length differs: ${path}`);
  for await(const chunk of createReadStream(filename))digest.update(chunk);
  const sha256=digest.digest('hex');
  if(sha256!==expectedSha256)throw new Error(`Photographic source digest differs: ${path}`);
  return {path:`src/objects/${id}/source/${path}`,sha256};
}

function textureBanks(input: unknown, maps: readonly {name: string}[], raster: ReturnType<typeof createPagedSurfaceRaster>, pageCount: number): TextureLevelBank[] {
  const entries=isRecord(input)&&isArray(input.entries)?input.entries:[];
  return maps.map(map=>{
    const urls=raster.surfacePageUrls(map.name,pageCount),ids=urls.map((url,page)=>{
      const matching=entries.flatMap(entry=>isRecord(entry)&&entry.url===url&&typeof entry.key==='string'&&new RegExp(`^page:([^:]+):${page}$`).test(entry.key)?[entry.key]:[]);
      if(matching.length!==1)throw new Error(`Prepared texture level bank is missing: ${url}`);
      return /^page:([^:]+):/u.exec(matching[0])?.[1];
    });
    const [id]=ids;
    if(!id||ids.some(candidate=>!candidate)||new Set(ids).size!==1)throw new Error(`Prepared texture level bank differs: ${map.name}`);
    return {id,urls};
  });
}

/** Stage only named native photographic maps against the already-retained raster layout. */
export async function refreshPagedPhotographs(id: string, mapNames: readonly string[]) {
  if(!/^[a-z][a-z0-9-]*$/u.test(id)||!mapNames.length||new Set(mapNames).size!==mapNames.length)throw new TypeError('Choose one body and distinct photographic map names.');
  sharp.concurrency(1);sharp.cache(false);
  const objectDirectory=resolve('src/objects',id),sourceDirectory=resolve(objectDirectory,'source'),outputDirectory=resolve(objectDirectory,'prepared');
  const recipePath=resolve(sourceDirectory,'preparation/paged-ellipsoid.json'),manifestPath=resolve(sourceDirectory,'manifest.json'),scenePath=resolve(outputDirectory,'surface-raster-plan.json'),textureLevelsPath=resolve(outputDirectory,'texture-levels.json');
  const [descriptorBytes,recipeBytes,manifestBytes,sceneBytes,textureLevelsBytes]=await Promise.all([readFile(resolve(objectDirectory,'object.json')),readFile(recipePath),readFile(manifestPath),readFile(scenePath),readFile(textureLevelsPath)]);
  const authored=await readAuthoredSources(objectDirectory,JSON.parse(descriptorBytes.toString('utf8'))),descriptor=authored.descriptor,recipeSource=authored.sources.get('paged-ellipsoid')?.reference;
  if(descriptor.id!==id||!recipeSource||recipeSource.path!=='source/preparation/paged-ellipsoid.json'||recipeSource.sha256!==sha256(recipeBytes))throw new Error('Paged photographic refresh requires the current manifest recipe pin.');
  const manifest=JSON.parse(manifestBytes.toString('utf8')),config=parsePagedProfile(JSON.parse(recipeBytes.toString('utf8'))),surfaceRasterPlan=parsePreparedSurfaceRasterPlan(JSON.parse(sceneBytes.toString('utf8')));
  if(surfaceRasterPlan.atlas.pageSize!==config.atlas.pageSize||surfaceRasterPlan.atlas.density!==config.atlas.density||surfaceRasterPlan.atlas.gutter!==config.atlas.gutter||surfaceRasterPlan.atlas.sourceWidth!==config.atlas.sourceWidth||surfaceRasterPlan.atlas.sourceHeight!==config.atlas.sourceWidth/2)throw new Error('Prepared surface raster layout differs from the selected recipe.');
  const selected=config.surface.maps.filter(map=>mapNames.includes(map.name));
  if(selected.length!==mapNames.length||selected.some(map=>!map.nativePhotographicSampling||map.scientific))throw new Error('Selective refresh requires declared native photographic maps.');
  const sourcePaths=[...new Set([...selected.map(map=>map.path),...(selected.some(map=>map.compositeClouds)?[config.surface.clouds.path]:[])])];
  const sourcePins=await Promise.all(sourcePaths.map(path=>verifyPinnedSource(sourceDirectory,id,manifest,path)));
  const stage=resolve('output/earth-photographs',id,[...mapNames].sort().join('--'));
  await rm(stage,{recursive:true,force:true});await mkdir(stage,{recursive:true});
  const raster=createPagedSurfaceRaster(config),result=await preparePagedEllipsoidAssets({config,sourceDirectory,publicDirectory:stage,surfaceRasterPlan,raster,mode:'maps',surfaceMapNames:mapNames});
  const canonical=selected.flatMap(map=>[...raster.surfacePageUrls(map.name,surfaceRasterPlan.pages.length),`${config.publicBase}${map.name}-poles.webp`]).sort();
  if(JSON.stringify(result.assets)!==JSON.stringify(canonical))throw new Error('Selective refresh produced an unexpected asset set.');
  const levels=await prepareTextureLevels({config,banks:textureBanks(JSON.parse(textureLevelsBytes.toString('utf8')),selected,raster,surfaceRasterPlan.pages.length),publicDirectory:stage});
  if(!levels)throw new Error('Selective refresh requires prepared texture levels.');
  const expected=[...new Set([...canonical,...levels.entries.map(entry=>entry.url)])].sort();
  const assets=await Promise.all(expected.map(async url=>{
    const filename=url.slice(config.publicBase.length),bytes=await readFile(resolve(stage,filename)),metadata=await sharp(bytes).metadata();
    if(!metadata.width||!metadata.height)throw new Error(`Staged photographic asset dimensions are missing: ${filename}`);
    return {filename,url,width:metadata.width,height:metadata.height,bytes:bytes.length,sha256:sha256(bytes)};
  }));
  const files=await readdir(stage);
  if(files.some(filename=>filename!=='receipt.json'&&!assets.some(asset=>asset.filename===filename)))throw new Error('Selective refresh stage contains an unexpected file.');
  const receipt={id,inputs:{[`src/objects/${id}/prepared/surface-raster-plan.json`]:sha256(sceneBytes),[`src/objects/${id}/prepared/texture-levels.json`]:sha256(textureLevelsBytes),[`src/objects/${id}/source/preparation/paged-ellipsoid.json`]:sha256(recipeBytes),[`src/objects/${id}/source/manifest.json`]:sha256(manifestBytes),...Object.fromEntries(sourcePins.map(pin=>[pin.path,pin.sha256]))},assets,
    textureLevelUpdates:{entries:levels.entries,receipts:levels.provenance.receipts}};
  await writeFile(resolve(stage,'receipt.json'),`${JSON.stringify(receipt,null,2)}\n`);
  return receipt;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const [id,...mapNames]=process.argv.slice(2);await refreshPagedPhotographs(id??'',mapNames);
}
