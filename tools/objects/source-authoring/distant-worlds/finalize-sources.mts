import {refreshSourceRecord} from '../../../source-authoring-templates.mts';
import {requireRecord,requireArray,requireString,requireFiniteNumber} from '../../../source-values.mts';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {requireTerrainMesh} from '../../terrestrial-layers/radial-terrain.mts';
import { mkdir as ensureReportDirectory } from 'node:fs/promises';
await ensureReportDirectory('output/distant-worlds', {recursive:true});
// Use the common title and source-mesh snapshot owners; no scene technique lives here.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import * as fontkit from 'fontkit';
import { createPlanetTitleSource } from '../../../../tools/prepare-planet-title-sources.mts';
import { PLANET_TITLE_RECIPE } from '../../../../src/platform/planet-title-recipe.mts';
import { loadRadialTerrain } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import { renderRadialSnapshot } from '../../../../tools/objects/terrestrial-layers/radial-snapshot.mts';
import { paintMissingCoverage } from '../../../../src/platform/prepare-missing-coverage.mts';
const root = resolve(import.meta.dirname, '../../../..');
if (process.cwd() !== root) throw new Error('Run from the repository root.');
const read = async (path: string) => requireRecord(JSON.parse(await readFile(path, 'utf8')));
const records = (value: unknown) => requireArray(value).map(entry => requireRecord(entry));
const bodies = records((await read(process.argv.find(arg => arg.startsWith('--inputs='))?.slice('--inputs='.length) ?? 'tools/objects/source-authoring/distant-worlds/inputs.json')).bodies).map(b => ({...b,id:requireString(b.id),name:requireString(b.name),source:requireString(b.source),credit:requireString(b.credit),titleLabel:b.titleLabel===undefined?undefined:requireString(b.titleLabel)}));
const hash = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');
const write = (path: string, value: unknown) => writeFile(path, Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n');
const files = async (path: string): Promise<string[]> => (await Promise.all((await readdir(path, {withFileTypes:true})).map(e => e.isDirectory() ? files(resolve(path,e.name)) : [resolve(path,e.name)]))).flat();
const refreshOnly = process.argv.includes('--refresh-pins');
let font: fontkit.Font | undefined, map: Buffer | undefined;
if (!refreshOnly) {
  const fontPath = resolve('src/objects/oumuamua/source/presentation/InterVariable.ttf');
  if (hash(await readFile(fontPath)) !== PLANET_TITLE_RECIPE.sourceSha256) throw new Error('Title font changed.');
  const baseFont = fontkit.openSync(fontPath);
  if (!('getVariation' in baseFont)) throw new TypeError('The title source must contain one font face.');
  font = baseFont.getVariation({wght:PLANET_TITLE_RECIPE.weight,opsz:PLANET_TITLE_RECIPE.opticalSize});
  const width=512,height=256;
  const pixels=paintMissingCoverage(Buffer.alloc(width*height*3,160),{width,height,channels:3},new Uint8Array(width*height).fill(1));
  map=await sharp(pixels,{raw:{width,height,channels:3}}).png().toBuffer();
}
for (const b of bodies) {
  const pkg=resolve('src/objects',b.id),src=resolve(pkg,'source');
  const manifest=await read(resolve(src,'manifest.json'));
  if (!refreshOnly) {
    if (!font || !map) throw new TypeError('Title and source map preparation must finish before publication.');
    const title=createPlanetTitleSource(b.titleLabel ?? b.name,font);
    await write(resolve(src,'presentation/title-mark.json'),{schema:'cssearth-title-source@1',...title});
    const raw=await read(resolve(src,'preparation/terrestrial.json')), geometry=requireRecord(raw.geometry);
    const config={...raw,namespace:requireString(raw.namespace),geometry:{...geometry,radius:requireFiniteNumber(geometry.radius),radiusKm:requireFiniteNumber(geometry.radiusKm)}};
    const source=await createSourceManifest({planetId:b.id,planetName:b.name,sourceRoot:src});
    const radial=await loadRadialTerrain({config,sourceDirectory:src,source});
    if (!radial) throw new TypeError('The source snapshot requires a radial terrain.');
    const recipe={generator:'tools/objects/terrestrial-layers/radial-snapshot.mts',inputs:['published-shape','model-surface'],size:512,longitudeDegrees:55,latitudeDegrees:20,ambient:.45,diffuse:.55,lensId:'model'};
    const context=await renderRadialSnapshot({...recipe,faces:radial.faces,map});
    await write(resolve(src,'presentation/context.png'),context);
    const navigation=await read('src/objects/annefrank/source/preparation/navigation.json');
    const navigationPath=requireString(requireRecord(navigation.source).path);
    await write(resolve(src,'preparation/navigation.json'),{...navigation,planetId:b.id,source:{path:navigationPath}});
    manifest.generatedIntermediates=[refreshSourceRecord(records(manifest.generatedIntermediates),{id:'prepared-source-context',path:navigationPath,origin:b.source,credit:b.credit,expectedBytes:context.length,expectedSha256:hash(context),recipe})];
    console.log(JSON.stringify({id:b.id,sourceFaces:requireTerrainMesh(radial.grid).indices.length,faces:radial.faces.length,contextBytes:context.length}));
  }
  const declared=new Set([...records(manifest.inputs),...records(manifest.generatedIntermediates)].map(e=>requireString(e.path)));
  const documents: Record<string,unknown>[]=[];
  const previousDocuments=records(manifest.documents);
  manifest.documents=documents;
  for(const path of (await files(src)).sort()){
    const rel=relative(src,path);
    if(rel==='manifest.json'||declared.has(rel))continue;
    const bytes=await readFile(path);
    documents.push(refreshSourceRecord(previousDocuments,{path:rel,expectedBytes:bytes.length,expectedSha256:hash(bytes)}));
  }
  await write(resolve(src,'manifest.json'),manifest);
  const descriptor=await read(resolve(pkg,'object.json'));
  for(const ref of records(requireRecord(requireRecord(descriptor.properties).recipe).sources))ref.sha256=hash(await readFile(resolve(pkg,requireString(ref.path))));
  await write(resolve(pkg,'object.json'),descriptor);
}
