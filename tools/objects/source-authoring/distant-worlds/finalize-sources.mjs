import { mkdir as ensureReportDirectory } from 'node:fs/promises';
await ensureReportDirectory('output/distant-worlds', {recursive:true});
// Use the common title and source-mesh snapshot owners; no scene technique lives here.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import * as fontkit from 'fontkit';
import { createPlanetTitleSource } from '../../../../tools/prepare-planet-title-sources.mjs';
import { PLANET_TITLE_RECIPE } from '../../../../src/platform/planet-title-recipe.mjs';
import { loadRadialTerrain } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mjs';
import { renderRadialSnapshot } from '../../../../tools/objects/terrestrial-layers/radial-snapshot.mjs';
import { paintMissingCoverage } from '../../../../src/platform/prepare-missing-coverage.mjs';
const root = resolve(import.meta.dirname, '../../../..');
if (process.cwd() !== root) throw new Error('Run from the repository root.');
const inputIndex = process.argv.indexOf('--inputs');
if (inputIndex >= 0 && !process.argv[inputIndex + 1]) throw new Error('--inputs requires a JSON path.');
const { bodies } = JSON.parse(await readFile(inputIndex >= 0 ? process.argv[inputIndex + 1] : 'tools/objects/source-authoring/distant-worlds/inputs.json'));
const hash = data => createHash('sha256').update(data).digest('hex');
const write = (path, value) => writeFile(path, Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n');
const files = async path => (await Promise.all((await readdir(path, {withFileTypes:true})).map(e => e.isDirectory() ? files(resolve(path,e.name)) : [resolve(path,e.name)]))).flat();
const refreshOnly = process.argv.includes('--refresh-pins');
let font, map;
if (!refreshOnly) {
  const fontPath = resolve('src/planets/oumuamua/source/presentation/InterVariable.ttf');
  if (hash(await readFile(fontPath)) !== PLANET_TITLE_RECIPE.sourceSha256) throw new Error('Title font changed.');
  font = fontkit.openSync(fontPath).getVariation({wght:PLANET_TITLE_RECIPE.weight,opsz:PLANET_TITLE_RECIPE.opticalSize});
  const width=512,height=256;
  const pixels=paintMissingCoverage(Buffer.alloc(width*height*3,160),{width,height,channels:3},new Uint8Array(width*height).fill(1));
  map=await sharp(pixels,{raw:{width,height,channels:3}}).png().toBuffer();
}
for (const b of bodies) {
  const pkg=resolve('src/planets',b.id),src=resolve(pkg,'source');
  const manifest=JSON.parse(await readFile(resolve(src,'manifest.json')));
  if (!refreshOnly) {
    const title=createPlanetTitleSource(b.titleLabel ?? b.name,font);
    await write(resolve(src,'presentation/title-mark.json'),{schema:'cssearth-title-source@1',...title});
    const config=JSON.parse(await readFile(resolve(src,'preparation/terrestrial.json')));
    const radial=await loadRadialTerrain({config,sourceDirectory:src,source:{manifest,async validatePath(path){
      const input=manifest.inputs.find(entry=>entry.path===path);
      const bytes=await readFile(resolve(src,path));
      if (!input || input.expectedBytes!==bytes.length || input.expectedSha256!==hash(bytes)) throw new Error(`Unpinned source: ${b.id}/${path}`);
    }}});
    const recipe={generator:'tools/objects/terrestrial-layers/radial-snapshot.mjs',inputs:['published-shape','model-surface'],size:512,longitudeDegrees:55,latitudeDegrees:20,ambient:.45,diffuse:.55,lensId:'model'};
    const context=await renderRadialSnapshot({...recipe,faces:radial.faces,map});
    await write(resolve(src,'presentation/context.png'),context);
    const navigation=JSON.parse(await readFile('src/planets/annefrank/source/preparation/navigation.json'));
    navigation.planetId=b.id;
    Object.assign(navigation.source,{id:'prepared-source-context',origin:b.source,credit:b.credit,expectedBytes:context.length,expectedSha256:hash(context),recipe});
    await write(resolve(src,'preparation/navigation.json'),navigation);
    manifest.generatedIntermediates=[{...navigation.source}];
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
  const descriptor=JSON.parse(await readFile(resolve(pkg,'object.json')));
  for(const ref of descriptor.properties.recipe.sources)ref.sha256=hash(await readFile(resolve(pkg,ref.path)));
  await write(resolve(pkg,'object.json'),descriptor);
}
// The shared context source changed only by the nine new body entries.
// Its descriptor source pin is independent of the prepared context transport.
const universe=await readFile('src/planets/sun/source/navigation/universe.json');
const sunManifest=JSON.parse(await readFile('src/planets/sun/source/manifest.json'));
const contextInput=sunManifest.inputs.find(entry=>entry.path==='navigation/universe.json');
if(!contextInput)throw new Error('Sun context source input is missing.');
Object.assign(contextInput,{expectedBytes:universe.length,expectedSha256:hash(universe)});
await write('src/planets/sun/source/manifest.json',sunManifest);
const sun=JSON.parse(await readFile('src/planets/sun/object.json'));
sun.properties.recipe.sources.find(entry=>entry.id==='world-context').sha256=hash(universe);
await write('src/planets/sun/object.json',sun);
