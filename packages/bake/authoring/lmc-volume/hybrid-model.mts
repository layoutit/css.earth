/** l12: object-local observed shapes lifted into compact isotropic 3D clumps. */
import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {LOCAL,json,array,need,type Raster} from './inputs.mts';
import {catalogueRows,L11,type CatalogueRow} from './catalogue-data.mts';
import {loadHaCutout,sampleHaCutout,readHaGeometry,skyOffset} from './catalogue-ha.mts';
import {type CatalogueScene} from './catalogue-scene.mts';
import {volumeObject,planarBasis,type VolumeObject} from './catalogue-volume.mts';
import {youngStarDensity} from './young-density.mts';
import {solve3} from './photo-convert.mts';
import {inverseTone,sourceTarget} from './grade.mts';
import {targetOf,type Observation} from './report.mts';
import {rayInBody,unit,normalize,add,mul,dot,DEG,type V3} from './geometry.mts';
export const L12=LOCAL+'versions/l12/';
const quantile=(a:number[],p:number)=>a.length?[...a].sort((a,b)=>a-b)[Math.floor((a.length-1)*p)]:0;
function normal(id:string,index:number):number {let seed=0;for(const c of id)seed=(seed*31+c.charCodeAt(0))%1000003;const f=(k:number)=>{const q=Math.sin(seed*12.9898+(index*2+k)*78.233)*43758.5453;return q-Math.floor(q);};return Math.max(-2.5,Math.min(2.5,Math.sqrt(-2*Math.log(Math.max(1e-7,f(1))))*Math.cos(2*Math.PI*f(2))));}
export interface ShapeCell {u:number;v:number;value:number;}
export interface LiftSummary {clumps:VolumeObject[];skyRmsKpc:number;depthRmsKpc:number;}
/** Every emitting element is isotropic. No image is evaluated along a rendering ray. */
export function liftShape(row:CatalogueRow,base:VolumeObject,cells:ShapeCell[],n:number):LiftSummary {
 const centerRay=rayInBody(unit(row.ra,row.dec)),distance=Math.hypot(...add(base.center,mul(centerRay.origin,-1))),a=distance*Math.tan(row.majorArcmin/120*DEG),b=distance*Math.tan(row.minorArcmin/120*DEG),total=cells.reduce((s,c)=>s+c.value,0);need(total>0,'Empty object shape');
 let meanU=0,meanV=0;for(const c of cells){meanU+=c.value*c.u*a/total;meanV+=c.value*c.v*b/total;}
 let transverse=0;for(const c of cells)transverse+=c.value*((c.u*a-meanU)**2+(c.v*b-meanV)**2)/(2*total);const radius=Math.max(.0001,Math.sqrt(a*b)*3.4/n),radiusOf=(c:ShapeCell)=>Math.min(radius,Math.max(.0001,Math.min(a,b)*(1-Math.hypot(c.u,c.v))*.8)),kernelVariance=cells.reduce((s,c)=>s+c.value*radiusOf(c)**2/(9*total),0),targetVariance=transverse+kernelVariance,raw:{cell:ShapeCell;z:number}[]=[];
 for(let i=0;i<cells.length;i++)for(let j=0;j<3;j++)raw.push({cell:cells[i],z:normal(row.id,i*3+j)});
 const mean=raw.reduce((s,c)=>s+c.cell.value*c.z/(total*3),0),variance=raw.reduce((s,c)=>s+c.cell.value*(c.z-mean)**2/(total*3),0),scale=Math.sqrt(transverse/Math.max(1e-12,variance)),clumps:VolumeObject[]=[];
 for(let i=0;i<raw.length;i++){const {cell,z}=raw[i],ray=rayInBody(unit(...skyOffset(row,cell.u,cell.v))),center=add(ray.origin,mul(ray.direction,distance+(z-mean)*scale)),r=radiusOf(cell);clumps.push(volumeObject({id:`${row.id}-shape-${i}`,owner:base.owner,kind:'ball',component:base.component,center,basis:planarBasis(0),axes:[r,r,r],inner:0,color:base.color,weight:cell.value/(3*total),source:'Observed scalar morphology within this catalogue footprint; isotropic finite clump with adopted depth'}));}
 // The RMS convention includes each isotropic kernel's own variance (R^2/9).
 const depthRms=Math.sqrt(raw.reduce((s,c,i)=>s+c.cell.value*((c.z-mean)**2*scale*scale+clumps[i].axes[0]**2/9)/(total*3),0));return{clumps,skyRmsKpc:Math.sqrt(targetVariance),depthRmsKpc:depthRms};
}
function photoSampler(o:Observation,priors:V3[]){
 const data=inverseTone(sourceTarget(targetOf(o),o.metadata.normalization.commonFactor).data,0,1.6),colors:V3[]=[priors[0],priors[2],priors[3]];
 return(ra:number,dec:number,component:number):number=>{const p=o.pixelOf(unit(ra,dec));if(!p)return NaN;const x=Math.floor(p[0]),y=Math.floor(p[1]);if(x<0||y<0||x>=o.width||y>=o.height||!o.mask[y][x])return NaN;const i=(y*o.width+x)*3,rgb:V3=[data[i],data[i+1],data[i+2]],s=solve3(colors,rgb);return Math.max(0,s[component===4?2:component===3?1:0]);};
}
export async function buildHybridScene(scene:CatalogueScene,o:Observation):Promise<CatalogueScene>{
 await mkdir(L12,{recursive:true});const population=await youngStarDensity(scene.sources);scene.youngDensity=population.map;const m=population.map,positive=Array.from(m.values).filter(v=>v>0),p99=quantile(positive,.99),pixels=Buffer.alloc(m.n*m.n*3);for(let y=0;y<m.n;y++)for(let x=0;x<m.n;x++){const value=Math.min(1,Math.asinh(10*m.values[(m.n-1-y)*m.n+x]/p99)/Math.asinh(10)),i=(y*m.n+x)*3;pixels[i]=Math.round(value*170);pixels[i+1]=Math.round(value*210);pixels[i+2]=Math.round(value*255);}await sharp(pixels,{raw:{width:m.n,height:m.n,channels:3}}).png().toFile(L12+'young-counts-face.png');
 const {rows}=await catalogueRows(),morphology=new Map(array(await json(L11+'ha-geometry.json')).map(v=>{const r=readHaGeometry(v);return[r.id,r];})),owners=new Map(scene.owners.map(o=>[o.id,o])),byOwner=new Map<string,VolumeObject[]>();for(const v of scene.objects){const list=byOwner.get(v.owner)??[];list.push(v);byOwner.set(v.owner,list);}
 const output:VolumeObject[]=[],replaced=new Set<string>(),summaries:Record<string,unknown>[]=[],photo=photoSampler(o,scene.colors);let cachePath='',cache:Awaited<ReturnType<typeof loadHaCutout>>|undefined;
 for(const row of rows){if(row.kind==='molecular')continue;const ownerId=row.id==='KDS-SGS13'?'KDS-SGS12':row.id,owner=owners.get(ownerId),old=byOwner.get(ownerId);if(!owner||!old?.length)continue;const base=old[0],p=o.pixelOf(unit(row.ra,row.dec)),edge=o.pixelOf(unit(...skyOffset(row,1,0))),pixels=p&&edge?2*Math.hypot(edge[0]-p[0],edge[1]-p[1]):0;
  if((row.kind==='cluster'||row.kind==='association')&&pixels<2.5)continue;
  const ha=morphology.get(row.id),useHa=row.kind==='nebula'&&ha&&ha.coverage>.85,n=Math.max(4,Math.min(32,Math.ceil(useHa?row.majorArcmin/.4:pixels*1.5))),samples:{u:number;v:number;value:number}[]=[],border:number[]=[];let available=0,total=0;
  if(useHa&&cachePath!==ha.source){cache=await loadHaCutout(ha.source);cachePath=ha.source;}
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const u=(x+.5)/n*2-1,v=(y+.5)/n*2-1,q=Math.hypot(u,v);if(q>=.98)continue;total++;const sky=skyOffset(row,u,v),value=useHa&&cache?sampleHaCutout(cache,...sky):photo(...sky,owner.component);if(!Number.isFinite(value))continue;available++;samples.push({u,v,value});if(q>.75)border.push(value);}
  if(available<total*.25)continue;const background=quantile(border,.2),peak=Math.max(...samples.map(s=>s.value-background)),cells=samples.map(s=>({...s,value:Math.max(0,s.value-background)*(1-Math.max(0,(Math.hypot(s.u,s.v)-.85)/.15))})).filter(c=>c.value>Math.max(1e-12,peak*.003));if(cells.length<3)continue;
  const lifted=liftShape(row,base,cells,n),tara=row.aliases.includes('30 Doradus'),retain=tara?.15:row.kind==='supershell'?.001:0;
  const unseen=1-available/total,retained=Math.max(retain,unseen*.05);if(!replaced.has(ownerId)){if(retained)for(const v of old)output.push({...v,weight:v.weight*retained});replaced.add(ownerId);}for(const v of lifted.clumps)output.push({...v,weight:v.weight*(1-retained)});
  summaries.push({id:row.id,owner:ownerId,source:useHa?'DeMCELS H-alpha':'Registered cleaned Horálek scalar component',sourcePath:useHa?ha.source:o.metadata.sourcePath,footprint:{ra:row.ra,dec:row.dec,majorDiameterArcmin:row.majorArcmin,minorDiameterArcmin:row.minorArcmin,positionAngleDeg:row.pa},grid:n,clumps:lifted.clumps.length,coverage:available/total,skyRmsKpc:lifted.skyRmsKpc,depthRmsKpc:lifted.depthRmsKpc,retainedPublishedGeometryFraction:retained});
 }
 for(const [owner,objects]of byOwner)if(!replaced.has(owner))output.push(...objects);
 const sums=new Map<string,number>();for(const v of output)sums.set(v.owner,(sums.get(v.owner)??0)+v.weight);for(const v of output)v.weight/=sums.get(v.owner)!;
 need(output.length<250000,'Object-local morphology exceeded the pilot element cap');scene.objects=output;scene.youngOwner='SMASH-diffuse-young';scene.owners.push({id:scene.youngOwner,kind:'population',component:3,prior:1,maximum:25,measuredAge:false,logAge:null,aliases:['SMASH diffuse blue-count population']});
 scene.metadata={...scene.metadata,emissionPrimitives:output.length,ownerCount:scene.owners.length,catalogueLuminosityParameters:scene.owners.length-1,populationGainParameters:1,geometrySource:'l11 catalogue geometry plus object-local photo/H-alpha morphology. Diffuse young light comes only from SMASH counts.',hybrid:{shapedCatalogueEntries:summaries.length,shapedOwners:replaced.size,emissionPrimitives:output.length,depthConvention:'Object luminosity-weighted line-of-sight RMS equals its mean transverse RMS. Every subelement is isotropic and finite; three depth samples per shape cell. Depths are adopted, not measured.',photoObservation:{sourcePath:o.metadata.sourcePath,maskPath:o.metadata.maskPath,registration:o.metadata.registration,sourceUrl:o.metadata.sourceUrl},photoBoundary:'Only scalar component intensities inside each individual catalogue ellipse enter its compact clumps. No global photographic layer or color texture is retained. Partly observed objects retain a small catalogue prior in unknown support; wholly unobserved objects retain their original geometry.',dust:'All l11 molecular clouds, dust geometry and Bell normalization retained unchanged.',youngPopulation:population.metadata}};
 await writeFile(L12+'object-shapes.json',JSON.stringify(summaries,null,2)+'\n');await writeFile(L12+'young-density.f32le',Buffer.from(population.map.values.buffer));await writeFile(L12+'young-density.json',JSON.stringify(population.metadata,null,2)+'\n');return scene;
}
