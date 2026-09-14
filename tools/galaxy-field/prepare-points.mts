import { parseDensityVolumeFrame } from '@cssearth/objects';
import { fitClouds } from './cloud-fit.mts';
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { loadScientificCatalogue } from './catalogue.mts';
const catalogue = await loadScientificCatalogue(200);
const world = JSON.parse(await readFile('src/objects/sun/prepared/world-context.json', 'utf8'));
if (world.frame?.referenceFrame !== 'sun-icrf' || !Number.isFinite(world.frame.epochJdTt)) throw new TypeError('Invalid application world frame.');
const frame = parseDensityVolumeFrame({ referenceFrame: world.frame.referenceFrame, epochJdTt: world.frame.epochJdTt, originM: [0,0,0], localToReferenceXyzw: [0,0,0,1], metersPerUnit: 3.085677581491367e22, boundsUnits: { min: [-200,-200,-200], max: [200,200,200] } });
// Keep half the budget spread through the field; spend the rest on observed concentrations.
// Neighbouring 4 Mpc cells avoid making cell boundaries into cluster boundaries.
const cells = new Map<string, number>();
const cell = (p: {x:number;y:number;z:number}) => [p.x,p.y,p.z].map(v => Math.floor(v / 4));
for (const p of catalogue.points) { const key=cell(p).join(','); cells.set(key,(cells.get(key)??0)+1); }
const ranked = catalogue.points.map((p, i) => {
  const [x,y,z]=cell(p); let density=0;
  for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++)density+=cells.get([x!+a,y!+b,z!+c].join(','))??0;
  const rank=Math.imul(i + 1, 2654435761) >>> 0;
  return {p,rank,score:-Math.log((rank+1)/4294967297)/Math.sqrt(density)};
});
const spread=[...ranked].sort((a,b)=>Number(b.p.absoluteMagnitude!==null)-Number(a.p.absoluteMagnitude!==null)||a.rank-b.rank).slice(0,900);
const selected=new Set(spread);
const concentrated=ranked.filter(p=>!selected.has(p)).sort((a,b)=>a.score-b.score).slice(0,900);
const sampled=[...spread,...concentrated];
const points = sampled.map(({ p, rank }) => ({ position: [p.x, p.y, p.z],
  // Unknown photometry is deliberately faint and explicitly authored, not fabricated magnitudes.
  brightness: p.absoluteMagnitude === null ? .35 : Math.max(.16, Math.min(.75, .3 * 10 ** (-.12 * (p.absoluteMagnitude + 20)))),
  color: /^E/.test(p.morphology) ? '#ffe6cc' : /^S/.test(p.morphology) ? '#cbdfff' : '#e6e6ff',
  measuredMagnitude: p.absoluteMagnitude, sourceSampleKey: rank }));
await mkdir('src/objects/nearby-universe/prepared', { recursive: true });
const clouds=fitClouds(catalogue.points);
const pixels=Buffer.alloc(128*128*4);
for(let y=0;y<128;y++)for(let x=0;x<128;x++){const r=Math.hypot((x-63.5)/63.5,(y-63.5)/63.5);const a=r<1?Math.exp(-6*r*r)*(1-r*r)**2:0;const i=(y*128+x)*4;pixels[i]=125;pixels[i+1]=155;pixels[i+2]=200;pixels[i+3]=Math.round(a*255);}
await sharp(pixels,{raw:{width:128,height:128,channels:4}}).webp({lossless:true}).toFile('src/objects/nearby-universe/prepared/cloud.webp');
await writeFile('src/objects/nearby-universe/prepared/points.json', JSON.stringify({ schema: 'cssearth-galaxy-points@1', frame: frame,
  catalogueCount: catalogue.points.length, selection: 'Half spatially spread and half density-weighted deterministic sample; unknown luminosity uses authored count glyphs.', source: catalogue.lineage, clouds, cloudMeaning: 'Authored smoothed galaxy-count concentrations; not gas or measured matter density.', points }));
console.log(`CLOUDS: ${clouds.length}; POINTS PREPARED: ${points.length}/${catalogue.points.length}`);
