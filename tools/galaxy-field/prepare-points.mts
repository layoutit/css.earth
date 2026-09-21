import { sha256 } from '../../src/platform/sha256.mts';
import { sourceObject } from '../../src/platform/source-catalog.mts';
import { readFieldRecipe } from './recipe.mts';
import { parseDensityVolumeFrame } from '@cssearth/objects';
import { fitClouds } from './cloud-fit.mts';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { manifestSources } from '../context-source-records.mts';
import { writePreparedSet } from '../write-prepared-set.mts';
import { loadScientificCatalogue } from './catalogue.mts';
const root=process.cwd();
const manifest=sourceObject(JSON.parse(await readFile('src/objects/nearby-universe/source/manifest.json','utf8')));
if(manifest.schema!=='cssearth-volume-source-manifest@1'||manifest.pathBase!=='repository')throw new TypeError('Invalid galaxy field source manifest');
await manifestSources(manifest,root,path=>readFile(resolve(root,path)));
const recipe = await readFieldRecipe();
const presentation=sourceObject(JSON.parse(await readFile('src/objects/nearby-universe/source/presentation.json','utf8')));
const appearance=Object.fromEntries(['pointExposure','pointReferenceDistanceMpc','cloudExposure','cloudMaximumOpacity'].map(key=>{const value=presentation[key];if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw new TypeError('Invalid field presentation');return [key,value];}));
const catalogue = await loadScientificCatalogue(recipe.maximumDistanceMpc, recipe.minimumDistanceMpc, recipe.hubbleKmSPerMpc);
const world = JSON.parse(await readFile('src/objects/sun/source/navigation/universe.json', 'utf8'));
if (world.frame?.referenceFrame !== 'sun-icrf' || !Number.isFinite(world.frame.epochJdTt)) throw new TypeError('Invalid application world frame.');
const frame = parseDensityVolumeFrame({ referenceFrame: world.frame.referenceFrame, epochJdTt: world.frame.epochJdTt, originM: [0,0,0], localToReferenceXyzw: [0,0,0,1], metersPerUnit: 3.085677581491367e22, boundsUnits: { min: [-200,-200,-200], max: [200,200,200] } });
// Keep half the budget spread through the field; spend the rest on observed concentrations.
// Neighbouring 4 Mpc cells avoid making cell boundaries into cluster boundaries.
const cells = new Map<string, number>();
const cell = (p: {x:number;y:number;z:number}) => [p.x,p.y,p.z].map(v => Math.floor(v / recipe.sampling.cellSizeMpc));
for (const p of catalogue.points) { const key=cell(p).join(','); cells.set(key,(cells.get(key)??0)+1); }
const ranked = catalogue.points.map((p, i) => {
  const [x,y,z]=cell(p); let density=0;
  for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++)density+=cells.get([x!+a,y!+b,z!+c].join(','))??0;
  const rank=Math.imul(i + 1, 2654435761) >>> 0;
  return {p,rank,score:-Math.log((rank+1)/4294967297)/Math.sqrt(density)};
});
const spread=[...ranked].sort((a,b)=>Number(b.p.absoluteMagnitude!==null)-Number(a.p.absoluteMagnitude!==null)||a.rank-b.rank).slice(0,recipe.sampling.spreadCount);
const selected=new Set(spread);
const concentrated=ranked.filter(p=>!selected.has(p)).sort((a,b)=>a.score-b.score).slice(0,recipe.sampling.concentrationCount);
const sampled=[...spread,...concentrated];
const points = sampled.map(({ p, rank }) => ({ position: [p.x, p.y, p.z],
  // Unknown photometry is deliberately faint and explicitly authored, not fabricated magnitudes.
  brightness: p.absoluteMagnitude === null ? recipe.points.unknownBrightness : Math.max(.16, Math.min(.75, .3 * 10 ** (-.12 * (p.absoluteMagnitude + 20)))),
  color: /^E/.test(p.morphology) ? recipe.points.ellipticalColor : /^S/.test(p.morphology) ? recipe.points.spiralColor : recipe.points.unknownColor,
  measuredMagnitude: p.absoluteMagnitude, sourceSampleKey: rank, pgc: p.pgc, distance: p.distance }));
const clouds=fitClouds(catalogue.points, recipe.clouds);
const size=recipe.texture.size, middle=(size-1)/2;
const pixels=Buffer.alloc(size*size*4);
for(let y=0;y<size;y++)for(let x=0;x<size;x++){const r=Math.hypot((x-middle)/middle,(y-middle)/middle);const a=r<1?Math.exp(-recipe.texture.falloff*r*r)*(1-r*r)**2:0;const i=(y*size+x)*4;pixels[i]=recipe.texture.rgb[0]!;pixels[i+1]=recipe.texture.rgb[1]!;pixels[i+2]=recipe.texture.rgb[2]!;pixels[i+3]=Math.round(a*255);}
const cloudBytes=await sharp(pixels,{raw:{width:size,height:size,channels:4}}).webp({lossless:true}).toBuffer();
const resource={path:'cloud.webp',sha256:sha256(cloudBytes),bytes:cloudBytes.length};
const prepared = JSON.stringify({ schema: 'cssearth-galaxy-points@1', frame: frame,
  appearance, resources:[resource], catalogueCount: catalogue.points.length, selection: 'Half spatially spread and half density-weighted deterministic sample; unknown luminosity uses authored count glyphs.', source: catalogue.lineage, clouds, cloudMeaning: 'Authored smoothed galaxy-count concentrations; not gas or measured matter density.', points });

const recipeBytes=await readFile('src/objects/nearby-universe/source/preparation/field.json');
const descriptor=JSON.stringify({schema:'cssearth-object@1',id:'nearby-universe',type:'galaxy-point-field',properties:{preparation:{source:'source/preparation/field.json',sha256:sha256(recipeBytes)}},prepared:{format:'cssearth-galaxy-points@1',url:'prepared/points.json',sha256:sha256(prepared)}},null,2)+'\n';
const receipt=JSON.stringify({schema:'cssearth-galaxy-points@1',outputs:[{path:'points.json',sha256:sha256(prepared),bytes:Buffer.byteLength(prepared)},resource]},null,2)+'\n';

await writePreparedSet([
  {path:'src/objects/nearby-universe/prepared/points.json',text:prepared},
  {path:'src/objects/nearby-universe/prepared/cloud.webp',text:cloudBytes},
  {path:'src/objects/nearby-universe/object.json',text:descriptor},
  {path:'src/objects/nearby-universe/prepared/manifest.json',text:receipt},
]);
console.log(`CLOUDS: ${clouds.length}; POINTS PREPARED: ${points.length}/${catalogue.points.length}`);
