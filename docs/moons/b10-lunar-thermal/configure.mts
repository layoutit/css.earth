import {readJsonSource,requireRecord,requireArray,requireString,requireFiniteNumber,isRecord} from '../../../tools/source-values.mts';
const records=(value:unknown):Record<string,unknown>[]=>{const list=requireArray(value);if(!list.every(isRecord))throw new TypeError('Expected an array of source records.');return list;};
// Authored Moon content and exact source closure for the three Diviner views.
import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative} from 'node:path';
const object=resolve('src/planets/moon'),root=resolve(object,'source'),dir=resolve(root,'science/diviner-ghrm');
const read=async (p:string|URL)=>requireRecord(await readJsonSource(p));
const write=async(p:string|URL,x:unknown)=>writeFile(p,JSON.stringify(x,null,2)+'\n');
const hash=async (p:string)=>{const h=createHash('sha256');for await(const c of createReadStream(p))h.update(c);return h.digest('hex');};
const baseUrl='https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_ghrm/img/';
const sourceUrl='https://doi.org/10.25346/S6/LFAVXU';
const views=[
 {id:'midnight-temperature',product:'tbol_m',label:'Midnight temperature',min:80,max:140,colors:['#24204f','#3a468b','#258da4','#81c9b0','#f4d17b','#ec803c','#9b283a'],labels:['≤80','110','≥140'],units:'K',detail:'Temperature',
  description:'False-color bolometric temperature fitted to local midnight from Diviner observations in 2009–2022. Colors span 80–140 K, with endpoint colors beyond that range. Gray grid marks missing data and latitudes beyond ±70°. This combines many nights; it is not a current temperature map.',legend:'Midnight temperature',summary:'False-color temperature fitted to local midnight from 2009–2022 Diviner observations within ±70°. Gray grid marks unavailable data. This combines many nights, not current temperatures.'},
 {id:'heat-anomalies',product:'tbol_anom',label:'Heat anomalies',min:-10,max:10,colors:['#344e99','#409eb5','#9bced1','#e5e2d7','#e9be80','#d67743','#a22c35'],labels:['≤−10','0','≥10'],units:'K difference',detail:'Anomaly',
  description:'False-color difference between Diviner bolometric temperature at slope-adjusted midnight and a model of typical lunar soil. Blue is cooler and red warmer than the model; colors span −10 to +10 K. Observations cover 2009–2022 within ±70°; gray grid marks unavailable data. Residual terrain effects remain, and warm colors do not establish geothermal activity.',legend:'Observed minus modeled temperature',summary:'False-color difference from a typical-soil thermal model at slope-adjusted midnight, 2009–2022, within ±70°. Blue is cooler and red warmer; gray grid is unavailable. Residual terrain effects remain. Warm colors do not establish geothermal activity.'},
 {id:'rock-abundance',product:'ra_sam',label:'Rock abundance',min:0,max:2,colors:['#292544','#456582','#5b9e95','#b7c85c','#fff0a0'],labels:['0','1','2+'],units:'% surface area',detail:'Rock area',
  description:'Surface area covered by rocks, inferred with a rock-and-soil thermal model from Diviner observations in 2009–2022 at slope-adjusted midnight. Colors span 0–2%; larger fractions share the brightest color. Gray grid marks missing or physically invalid values and latitudes beyond ±70°. This estimates rock area, not individual boulder counts.',legend:'Surface rock area',summary:'Modeled rock-area fraction from 2009–2022 Diviner observations at slope-adjusted midnight, within ±70°. Gray grid marks missing or physically invalid values. This estimates rock area, not individual boulder counts.'},
].filter(v=>!process.argv[2]||v.id===process.argv[2]);
const raster=await read(resolve(root,'preparation/raster.json'));
const content=await read(resolve(root,'content/static.json'));
const rasterLenses=records(raster.lenses),contentControls=requireRecord(content.controls),controlLenses=requireRecord(contentControls.lenses),surfaceLenses=requireRecord(content.lenses);
const uiControls=records(controlLenses.controls),surfaceControls=records(surfaceLenses.controls);
for(const v of views){
 const stem=`dghrm_${v.product}_70s70n_img`,plan=await read(resolve(dir,`prepare-${v.product}.json`));
 const receipt=await read(resolve(dir,`${v.product}-receipt.json`));
 const transform={scale:requireFiniteNumber(requireRecord(plan.encoding).scale)*(v.id==='rock-abundance'?100:1),offset:requireFiniteNumber(requireRecord(plan.encoding).offset)*(v.id==='rock-abundance'?100:1)};
 const input=`science/diviner-ghrm/${plan.output}`,output=`moon-${v.id}`;
 const entry={id:v.id,label:v.label,input,output,rasterScale:2,qualification:v.description,scientific:{
  format:'geotiff',path:plan.output,sampling:'nearest',displaySampling:'nearest',
  minimum:v.min,maximum:v.max,colors:v.colors,units:v.units,valueTransform:transform,
  outputLongitudeOrigin:-180,grid:{width:receipt.width,height:receipt.height,noData:receipt.noData,
   origin:receipt.origin,resolution:receipt.resolution,referenceRadiusMeters:1737400,centerLongitude:0,wrapLongitude:true}}};
 const i=rasterLenses.findIndex(x=>x.id===v.id);if(i>=0)rasterLenses[i]=entry;else rasterLenses.push(entry);
 const ui={id:v.id,label:v.label,thumbnailUrl:`/scenes/moon/${output}-thumbnail.webp`,title:`LRO Diviner GHRM: ${v.label.toLowerCase()}`,
  description:v.description,detail:v.detail,summary:v.summary,legend:{kind:'scale',title:v.legend,
   src:`/scenes/moon/${output}-legend.webp`,width:256,height:16,labels:v.labels,meta:v.units,sourceUrl:baseUrl+stem+'.xml'}};
 const ci=uiControls.findIndex(x=>x.id===v.id);if(ci>=0)uiControls[ci]=ui;else uiControls.push(ui);
 const lens={id:v.id,label:v.label,thumbnailUrl:ui.thumbnailUrl,surfaceUrl:`/scenes/moon/${output}.webp`,surface2xUrl:`/scenes/moon/${output}@2x.webp`,polesUrl:`/scenes/moon/${output}-poles.webp`,poles2xUrl:`/scenes/moon/${output}-poles@2x.webp`,qualification:v.description,detail:v.detail};
 const li=surfaceControls.findIndex(x=>x.id===v.id);if(li>=0)surfaceControls[li]=lens;else surfaceControls.push(lens);
 requireRecord(surfaceLenses.provenance)[v.id]='Powell et al. (2023), LRO Diviner team/UCLA; NASA PDS GHRM v1.0; 2009–2022';
}
// Keep visible color first; group the complementary thermal maps together.
const order=['surface','midnight-temperature','heat-anomalies','rock-abundance','topography','crust','silicate-signature','geology'];
for(const array of [rasterLenses,uiControls,surfaceControls])array.sort((a,b)=>order.indexOf(requireString(a.id))-order.indexOf(requireString(b.id)));
requireRecord(content.provenance).thermal='Powell et al. (2023), DOI 10.1029/2022JE007532; PDS GHRM float32 mosaics; author data CC0 DOI 10.25346/S6/LFAVXU';
content.resources=records(content.resources).filter(x=>x.description!=='Modeled surface rock abundance');
if(!records(content.resources).some(x=>x.href===sourceUrl))records(content.resources).push({label:'LRO Diviner',role:'science',description:'Nighttime temperature and rock maps',href:sourceUrl});
await write(resolve(root,'preparation/raster.json'),raster);await write(resolve(root,'content/static.json'),content);
const manifest=await read(resolve(root,'manifest.json'));
const acquisition=await read(resolve(root,'preparation/acquisition.json'));
const sourceInputs=records(manifest.inputs),sourceDocuments=records(manifest.documents),operations=records(acquisition.operations);
for(const v of views){
 const stem=`dghrm_${v.product}_70s70n_img`,plan=await read(resolve(dir,`prepare-${v.product}.json`));
 const prefix='science/diviner-ghrm/';
 for(const name of [stem+'.img',requireString(plan.output)]){
  const p=prefix+name,original=name.endsWith('.img');
  const e={id:`diviner-ghrm-${v.product}-${original?'original':'compact'}`,path:p,
   expectedSha256:await hash(resolve(root,p)),expectedBytes:(await stat(resolve(root,p))).size,
   origin:baseUrl+stem+'.img',credit:'T. M. Powell and LRO Diviner team, UCLA; NASA PDS Geosciences Node',
   license:'CC0 1.0 author dataset; NASA PDS scientific data',licenseEvidence:[sourceUrl],
   acquisition:original?'Exact PDS float32 IMG; streamed and SHA-256 pinned':`Windowed nearest-native sampling with explicit quantization; tools/objects/acquisition/diviner-ghrm.py ${prefix}prepare-${v.product}.json`,
   redistribution:'Scientific data with source attribution; original restored from its pin',consumers:[original?'ghrm-source':'lenses'],lensId:v.id,
   ...(original?{}:{sourcePins:[prefix+stem+'.img',prefix+stem+'.xml',prefix+`prepare-${v.product}.json`]})};
  const i=sourceInputs.findIndex(x=>x.path===p);if(i>=0)sourceInputs[i]=e;else sourceInputs.push(e);
 }
 for(const ext of ['img','xml'])if(!operations.some(x=>x.path===prefix+stem+'.'+ext))operations.push({kind:'download',groups:['diviner-ghrm'],path:prefix+stem+'.'+ext,url:baseUrl+stem+'.'+ext});
}
await write(resolve(root,'preparation/acquisition.json'),acquisition);
for(const name of await readdir(dir)){
 const p='science/diviner-ghrm/'+name;
 if(sourceInputs.some(x=>x.path===p))continue;
 const e={path:p,expectedSha256:await hash(resolve(root,p)),expectedBytes:(await stat(resolve(root,p))).size,purpose:'Diviner GHRM source identity, cartography, bounded preparation and numerical receipt'};
 const i=sourceDocuments.findIndex(x=>x.path===p);if(i>=0)sourceDocuments[i]=e;else sourceDocuments.push(e);
}
// Refresh only authored files this change actually edits.
for(const p of ['preparation/raster.json','content/static.json','preparation/acquisition.json']){
 const e=sourceDocuments.find(x=>x.path===p)??sourceInputs.find(x=>x.path===p);
 if(!e)throw Error('Existing recipe missing from source closure: '+p);
 e.expectedSha256=await hash(resolve(root,p));e.expectedBytes=(await stat(resolve(root,p))).size;
}
await write(resolve(root,'manifest.json'),manifest);
const descriptor=await read(resolve(object,'object.json'));
const recipe=requireRecord(requireRecord(descriptor.properties).recipe);
for(const ref of records(recipe.sources))ref.sha256=await hash(resolve(object,requireString(ref.path)));
records(recipe.surfaces)[0].lenses=surfaceControls.map(x=>({id:x.id,source:'content',material:'curvature'}));
await write(resolve(object,'object.json'),descriptor);
await write(new URL('./selected-views.json',import.meta.url),{moon:views.map(v=>v.id)});
console.log('Moon authored views and source closure configured.');
