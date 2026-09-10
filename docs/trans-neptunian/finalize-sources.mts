#!/usr/bin/env node
import {readJsonSource,requireRecord,requireString} from '../../tools/source-values.mts';
import {shape,array,text,optional} from '../../tools/objects/terrestrial-layers/source-records.mts';
import {createSourceManifest} from '../../src/platform/source-manifest.mts';
import {parseAuthoringManifest,parseAuthoringDescriptor} from '../../tools/source-authoring-templates.mts';
import {parseSolidPreparationSource} from '../../tools/objects/terrestrial-layers/profile-source.mts';
const parseBodies=shape({bodies:array(shape({id:text,titleLabel:optional(text),name:text,source:text,credit:text}))});
// Use the common title and source-mesh snapshot owners; no scene technique lives here.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import * as fontkit from 'fontkit';
import { createPlanetTitleSource } from '../../tools/prepare-planet-title-sources.mts';
import { PLANET_TITLE_RECIPE } from '../../src/platform/planet-title-recipe.mts';
import { loadRadialTerrain } from '../../tools/objects/terrestrial-layers/radial-terrain.mts';
import { renderRadialSnapshot } from '../../tools/objects/terrestrial-layers/radial-snapshot.mts';
import { paintMissingCoverage } from '../../src/platform/prepare-missing-coverage.mts';
const root = resolve(import.meta.dirname, '../..');
if (process.cwd() !== root) throw new Error('Run from the repository root.');
const { bodies } = parseBodies(await readJsonSource('docs/trans-neptunian/inputs.json'));
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const write = (path:string, value:unknown) => writeFile(path, Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n');
const files = async (path:string):Promise<string[]> => (await Promise.all((await readdir(path, {withFileTypes:true})).map(e => e.isDirectory() ? files(resolve(path,e.name)) : [resolve(path,e.name)]))).flat();
const refreshOnly = process.argv.includes('--refresh-pins');
let font: fontkit.Font | undefined, map: Buffer | undefined;
if (!refreshOnly) {
  const fontPath = resolve('src/planets/arrokoth/source/presentation/InterVariable.ttf');
  if (hash(await readFile(fontPath)) !== PLANET_TITLE_RECIPE.sourceSha256) throw new Error('Title font changed.');
  const fontSource = fontkit.openSync(fontPath);
  if(!('getVariation' in fontSource))throw new TypeError('Title preparation requires a variable font.');
  font = fontSource.getVariation({wght:PLANET_TITLE_RECIPE.weight,opsz:PLANET_TITLE_RECIPE.opticalSize});
  const width=512,height=256;
  const pixels=paintMissingCoverage(Buffer.alloc(width*height*3,160),{width,height,channels:3},new Uint8Array(width*height).fill(1));
  map=await sharp(pixels,{raw:{width,height,channels:3}}).png().toBuffer();
}
for (const b of bodies) {
  const pkg=resolve('src/planets',b.id),src=resolve(pkg,'source');
  const manifest=parseAuthoringManifest(await readJsonSource(resolve(src,'manifest.json')));
  if (!refreshOnly) {
    if(!font || !map)throw new TypeError('Missing source title font or prepared map.');
    const title=createPlanetTitleSource(b.titleLabel ?? b.name,font);
    await write(resolve(src,'presentation/title-mark.json'),{schema:'cssearth-title-source@1',...title});
    const config=parseSolidPreparationSource(await readJsonSource(resolve(src,'preparation/terrestrial.json')));
    const source=await createSourceManifest({planetId:b.id,planetName:b.name,sourceRoot:src});
    const radial=await loadRadialTerrain({config,sourceDirectory:src,source});
    if(!radial?.grid?.indices)throw new TypeError('Source finalization requires the published shape.');
    const recipe={generator:'tools/objects/terrestrial-layers/radial-snapshot.mts',inputs:['published-shape','model-surface'],size:512,longitudeDegrees:55,latitudeDegrees:b.id==='arrokoth'?-25:20,ambient:.45,diffuse:.55,lensId:'model'};
    const context=await renderRadialSnapshot({...recipe,faces:radial.faces,map});
    await write(resolve(src,'presentation/context.png'),context);
    const navigation=requireRecord(await readJsonSource('src/planets/annefrank/source/preparation/navigation.json'));
    const markerSource=requireRecord(navigation.source);
    navigation.planetId=b.id;
    Object.assign(markerSource,{id:'prepared-source-context',origin:b.source,credit:b.credit,expectedBytes:context.length,expectedSha256:hash(context),recipe});
    await write(resolve(src,'preparation/navigation.json'),navigation);
    manifest.generatedIntermediates=parseAuthoringManifest({...manifest,generatedIntermediates:[markerSource]}).generatedIntermediates;
    console.log(JSON.stringify({id:b.id,sourceFaces:radial.grid.indices.length,faces:radial.faces.length,contextBytes:context.length}));
  }
  const declared=new Set([...manifest.inputs,...manifest.generatedIntermediates].map(e=>e.path));
  manifest.documents=[];
  for(const path of (await files(src)).sort()){
    const rel=relative(src,path);
    if(rel==='manifest.json'||declared.has(rel))continue;
    const bytes=await readFile(path);
    manifest.documents.push({path:rel,expectedBytes:bytes.length,expectedSha256:hash(bytes),purpose:'Pinned source observation, interpretation or preparation input.'});
  }
  await write(resolve(src,'manifest.json'),manifest);
  const descriptor=parseAuthoringDescriptor(await readJsonSource(resolve(pkg,'object.json')));
  for(const ref of descriptor.properties.recipe.sources)ref.sha256=hash(await readFile(resolve(pkg,ref.path)));
  await write(resolve(pkg,'object.json'),descriptor);
}
// The shared context source changed only by the three new body entries.
// Its descriptor source pin is independent of the prepared context transport.
const universe=await readFile('src/planets/sun/source/navigation/universe.json');
const sunManifest=parseAuthoringManifest(await readJsonSource('src/planets/sun/source/manifest.json'));
const contextInput=sunManifest.inputs.find(entry=>entry.path==='navigation/universe.json');
if(!contextInput)throw new Error('Sun context source input is missing.');
Object.assign(contextInput,{expectedBytes:universe.length,expectedSha256:hash(universe)});
await write('src/planets/sun/source/manifest.json',sunManifest);
const sun=requireRecord(await readJsonSource('src/planets/sun/object.json'));
const sourceRefs=requireRecord(requireRecord(sun.properties).recipe).sources;
if(!Array.isArray(sourceRefs))throw new TypeError('Sun source references are missing.');
const originalContext=sourceRefs.map(value=>requireRecord(value)).find(entry=>entry.id==='world-context');
if(!originalContext)throw new Error('Sun context recipe is missing.');
originalContext.sha256=hash(universe);
await write('src/planets/sun/object.json',sun);
