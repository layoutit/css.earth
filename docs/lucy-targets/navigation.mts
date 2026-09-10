#!/usr/bin/env node
import {shape,text,number,array,dictionary,optional} from '../../tools/objects/terrestrial-layers/source-records.mts';
import {validateMarkerPresentation} from '../../src/navigation/marker-presentation.mts';
const parseOldMarkers=dictionary(shape({index:number,count:number,presentation:value=>validateMarkerPresentation(value),context:optional(shape({url:text}))}));
const parseInputs=shape({bodies:array(shape({id:text}))});
// Carry forward exact checked-in marker pixels for unchanged bodies. New markers
// use the existing source-owned renderMarker and prepareContextMarkers recipes.
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { OBJECTS } from '../../site/objects.mts';
import { loadMarkerDescriptors, prepareContextMarkers } from '../../tools/prepare-navigation.mts';
import { renderMarker } from '../../src/navigation/marker-recipe.mts';

const argument = (name:string) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const base = argument('base') ?? 'e97ee9532b17beaf0c7ae38281c5bef12b64fa5b';
const root = resolve(import.meta.dirname, '../..');
const git = (path:string) => execFileSync('git', ['show', `${base}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
const oldText = git('site/prepared-navigation-markers.mjs').toString();
const old = parseOldMarkers(JSON.parse(oldText.split('Object.freeze(')[1].slice(0, -3)));
const inputsPath=argument('inputs'), evidencePath=argument('evidence');
const { bodies } = parseInputs(JSON.parse(await readFile(inputsPath ? resolve(root, inputsPath) : new URL('./inputs.json', import.meta.url),'utf8')));
const added = new Set(bodies.map(b => b.id));
const planets = OBJECTS.toSorted((a, b) => a.distanceAu - b.distanceAu);
if (planets.length !== Object.keys(old).length + added.size || planets.some(p => !old[p.id] && !added.has(p.id))) throw new Error('Unreviewed registry change.');
const descriptors = await loadMarkerDescriptors({ planets, projectRoot: root });
for (const d of descriptors.filter(d => !added.has(d.planetId))) {
  const path = `src/planets/${d.planetId}/source/preparation/navigation.json`;
  if (!Buffer.from(await readFile(resolve(root, path))).equals(git(path))) throw new Error(`Changed existing source recipe: ${d.planetId}`);
}
const evidence = [];
for (const density of [1, 2]) {
  const pixels = 16 * density, filename = `planet-markers${density === 2 ? '@2x' : ''}.webp`;
  const bytes = git(`public/navigation/${filename}`), prior = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (prior.info.width !== Object.keys(old).length * pixels || prior.info.height !== pixels) throw new Error('Base atlas dimensions differ.');
  const atlas = Buffer.alloc(planets.length * pixels * pixels * 4);
  for (let index = 0; index < descriptors.length; index++) {
    const d = descriptors[index];
    const input = added.has(d.planetId)
      ? await renderMarker(d, { sourcePath: resolve(root, 'src/planets', d.planetId, 'source', d.source.path), tileSize: pixels })
      : await sharp(bytes).extract({ left: old[d.planetId].index * pixels, top: 0, width: pixels, height: pixels }).png().toBuffer();
    const tile = await sharp(input).ensureAlpha().raw().toBuffer();
    for (let y = 0; y < pixels; y++) tile.copy(atlas, (y * planets.length * pixels + index * pixels) * 4, y * pixels * 4, (y + 1) * pixels * 4);
  }
  const output = await sharp(atlas, { raw: { width: planets.length * pixels, height: pixels, channels: 4 } }).webp({ lossless: true, effort: 6 }).toBuffer();
  const current = await sharp(output).ensureAlpha().raw().toBuffer();
  for (let i = 0; i < planets.length; i++) {
    const p = planets[i];
    if (added.has(p.id)) continue;
    for (let y = 0; y < pixels; y++) for (let x = 0; x < pixels; x++) {
      const from = (y * prior.info.width + old[p.id].index * pixels + x) * 4;
      const to = (y * planets.length * pixels + i * pixels + x) * 4;
      // RGB under fully transparent pixels has no rendered meaning in WebP.
      if (current[to + 3] !== prior.data[from + 3] || current[to + 3] && !current.subarray(to, to + 3).equals(prior.data.subarray(from, from + 3))) throw new Error(`Existing marker pixels changed: ${p.id}`);
    }
  }
  await writeFile(resolve(root, 'public/navigation', filename), output);
  evidence.push({ filename, baseSha256: createHash('sha256').update(bytes).digest('hex'), outputSha256: createHash('sha256').update(output).digest('hex'), preservedMarkers: Object.keys(old).length });
}
const newContexts = await prepareContextMarkers({ projectRoot: root, outputRoot: resolve(root, 'public/navigation'), descriptors: descriptors.filter(d => added.has(d.planetId)), planets });
const presentations = Object.fromEntries(descriptors.map((d, index) => [d.planetId, { index, count: descriptors.length, presentation: d.presentation, ...(newContexts[d.planetId] ?? old[d.planetId]?.context ? { context: newContexts[d.planetId] ?? old[d.planetId].context } : {}) }]));
await writeFile(resolve(root, 'site/prepared-navigation-markers.mjs'), '// Generated from object-owned marker recipes. Do not edit.\nexport const PREPARED_NAVIGATION_MARKERS = Object.freeze(' + JSON.stringify(presentations) + ');\n');
await writeFile(evidencePath ? resolve(root, evidencePath) : new URL('./navigation-evidence.json', import.meta.url), JSON.stringify({ base, added: [...added], atlases: evidence }, null, 2) + '\n');
console.log(JSON.stringify({ added: [...added], preservedMarkers: Object.keys(old).length }));
