import {readJsonSource} from '../../source-values.mts';
import {parseSolidPreparationSource} from './profile-source.mts';
import {parseCameraMosaic} from './source-records.mts';
/** Preparation evidence for a controlled-camera mosaic. Retain contribution
 * weights outside runtime delivery and measure the same display-mesh samples
 * before and after adding frames. Usage: node audit-camera-mosaic.mts SOURCE OUT
 */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {createSourceManifest} from '../../../src/platform/source-manifest.mts';
import {loadRadialTerrain} from './radial-terrain.mts';
import {prepareShapeCameraMosaic} from './shape-camera-mosaic.mts';
import {sampleTrianglePoints} from './observation-mosaic.mts';
const [sourceArg,outputArg]=process.argv.slice(2);
if(!sourceArg||!outputArg)throw new Error('Usage: audit-camera-mosaic.mts SOURCE OUT');
const sourceDirectory=resolve(sourceArg),output=resolve(outputArg);
const config=parseSolidPreparationSource(await readJsonSource(resolve(sourceDirectory,'preparation/terrestrial.json')));
const source=await createSourceManifest({planetId:config.namespace,planetName:config.displayName,sourceRoot:sourceDirectory});
await source.verify();await mkdir(output,{recursive:true});
const authored=config.raster.mosaics?.find(r=>r.format==='controlled-shape-camera');
if(!authored)throw new Error('A controlled-camera mosaic is required.');
const recipe={...authored,...parseCameraMosaic(authored)};
if(recipe.frames.length<2)throw new Error('A controlled-camera mosaic requires at least two frames.');
const radial=await loadRadialTerrain({sourceDirectory,source,config}),entries=await source.validateGroup(recipe.consumer);
if(!radial)throw new Error('A controlled-camera mosaic audit requires the prepared radial mesh.');
const {width,height}=config.raster,samplesPerTriangle=64,points=sampleTrianglePoints(radial.faces,samplesPerTriangle);
const metersPerUnit=config.geometry.radiusKm*1000/config.geometry.radius;
const areas=radial.faces.map(({vertices:[a,b,c]})=>{const u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);
  return Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2*metersPerUnit**2;});
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
interface ContributionReceipt {id:string;path:string;sourceSha256:string;file:string;encoding:string;decodedBytes:number;decodedSha256:string;bytes:number;sha256:string}
interface MosaicRun {name:string;frames:string[];acceptedSquareMeters:number;totalSquareMeters:number;acceptedFraction:number;sourceSquareMeters:Record<string,number>;maximumWeightSumError:number;contributors:ContributionReceipt[];displayRgbSha256:string;coverageSha256:string;sourceGrid:Awaited<ReturnType<typeof prepareShapeCameraMosaic>>['grid']}
const runs:MosaicRun[]=[];
const report={schema:'cssearth-camera-mosaic-audit@1',object:config.namespace,width,height,
  layout:'Cylindrical source sampling grid, east longitude 0..360, rows north to south; pixel centres; no atlas bleed.',
  sampling:'64 stratified barycentric samples per displayed triangle, weighted by physical triangle area; nearest prepared sampling-grid cell. An estimate of the displayed mesh, not exact global coverage.',
  samplesPerTriangle,triangles:radial.faces.length,meshSha256:sha(Buffer.from(JSON.stringify(radial.faces.map(f=>f.vertices)))),
  recipeSha256:sha(await readFile(resolve(sourceDirectory,'preparation/terrestrial.json'))),runs};
for(const [name,frames] of [['before',[recipe.frames[0]]],['after',recipe.frames]] as const){
  const paths=new Set(frames.flatMap(f=>[f.path,f.labelPath,...Object.entries(f.cameraCatalog??{}).filter(([k])=>k==='path'||k.endsWith('Path')).map(([,v])=>v),...Object.entries(f.quality??{}).filter(([k])=>k.endsWith('Path')).map(([,v])=>v)]));
  const map=await prepareShapeCameraMosaic(sourceDirectory,entries.filter(e=>paths.has(e.path)),{...recipe,frames},width,height,config.geometry.radialTerrain,{retainContributions:true});
  const contributions=map.contributions;
  if(!contributions)throw new Error('Mosaic audit did not retain source contributions.');
  let maximumWeightSumError=0;
  for(let i=0;i<map.missing.length;i++){
    let sum=0;for(const c of contributions){const w=c.weights[i];if(!Number.isFinite(w)||w<0||w>1)throw new Error('Invalid contributor weight');sum+=w;}
    const error=Math.abs(sum-(map.missing[i]?0:1));maximumWeightSumError=Math.max(maximumWeightSumError,error);
    if(error>2e-7)throw new Error('Contribution weights disagree with coverage');
  }
  const contributors=[];
  for(const c of contributions){
    const raw=Buffer.alloc(c.weights.length*4);c.weights.forEach((w,i)=>raw.writeFloatLE(w,i*4));
    const bytes=gzipSync(raw,{level:9}),file=`${name}-${c.id}-weights.f32.gz`;await writeFile(resolve(output,file),bytes);
    contributors.push({id:c.id,path:c.path,sourceSha256:c.sha256,file,encoding:'gzip-f32le',decodedBytes:raw.length,decodedSha256:sha(raw),bytes:bytes.length,sha256:sha(bytes)});
  }
  let acceptedSquareMeters=0,totalSquareMeters=0;const sourceSquareMeters:Record<string,number>={};
  points.forEach((p,i)=>{
    const area=areas[Math.floor(i/samplesPerTriangle)]/samplesPerTriangle;totalSquareMeters+=area;
    const lon=(Math.atan2(p[1],p[0])*180/Math.PI+360)%360,lat=Math.atan2(p[2],Math.hypot(p[0],p[1]))*180/Math.PI;
    const x=Math.min(width-1,Math.floor(lon/360*width)),y=Math.min(height-1,Math.floor((90-lat)/180*height)),index=y*width+x;
    if(map.missing[index])return;acceptedSquareMeters+=area;
    for(const c of contributions)sourceSquareMeters[c.id]=(sourceSquareMeters[c.id]??0)+area*c.weights[index];
  });
  report.runs.push({name,frames:frames.map(f=>f.id),acceptedSquareMeters,totalSquareMeters,acceptedFraction:acceptedSquareMeters/totalSquareMeters,
    sourceSquareMeters,maximumWeightSumError,contributors,displayRgbSha256:sha(map.rgb),coverageSha256:sha(map.missing),sourceGrid:map.grid});
  console.log(config.namespace,name,acceptedSquareMeters/totalSquareMeters);
}
await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
