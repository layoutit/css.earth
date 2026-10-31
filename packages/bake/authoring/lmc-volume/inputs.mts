/** Source-only inputs. No fitted field, photograph-derived material, or old model is read. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { skyProjection, type FitsHeader } from '@cssearth/fits';
import { bodyToIcrs, skyOf, DEG, DISTANCE, unit, dot, type V3 } from './geometry.mts';
export const ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
export const LOCAL=`${ROOT}src/objects/lmc-volume/.local/`;
export const ARCHIVE=`${LOCAL}archive/`;
export function need(v: unknown, message: string): asserts v {if(!v)throw new TypeError(message);}
export function rec(v: unknown): Record<string,unknown> {need(v!==null&&typeof v==='object'&&!Array.isArray(v),'Expected object');return Object.fromEntries(Object.entries(v));}
export function num(v: unknown): number {need(typeof v==='number'&&Number.isFinite(v),'Expected finite number');return v;}
export function array(v: unknown): unknown[] {need(Array.isArray(v),'Expected array');return v;}
export function numbers(v: unknown, n?: number): number[] {const a=array(v).map(num);need(n===undefined||a.length===n,'Unexpected vector length');return a;}
export async function json(path: string): Promise<unknown> {return JSON.parse(await readFile(path,'utf8'));}
export interface Raster {n:number;half:number;values:Float32Array;mask:Uint8Array;}
export function at(map:Raster,x:number,y:number):number {
  const fx=(x/map.half+1)*map.n/2-.5,fy=(y/map.half+1)*map.n/2-.5,i=Math.floor(fx),j=Math.floor(fy);
  if(i<0||j<0||i+1>=map.n||j+1>=map.n)return 0;
  const a=j*map.n+i,b=a+map.n;
  if(!map.mask[a]||!map.mask[a+1]||!map.mask[b]||!map.mask[b+1])return 0;
  const u=fx-i,v=fy-j;
  return (map.values[a]*(1-u)+map.values[a+1]*u)*(1-v)+(map.values[b]*(1-u)+map.values[b+1]*u)*v;
}
export const makeRaster=(n:number,half:number):Raster=>({n,half,values:new Float32Array(n*n),mask:new Uint8Array(n*n)});
export function smooth(map:Raster,sigmaPixels:number,inferred=false):Raster {
  const radius=Math.ceil(sigmaPixels*3),k=Array.from({length:radius*2+1},(_,i)=>Math.exp(-.5*((i-radius)/sigmaPixels)**2));
  const weights=new Float64Array(map.n*map.n),first=new Float64Array(map.n*map.n),out=makeRaster(map.n,map.half);
  for(let y=0;y<map.n;y++)for(let x=0;x<map.n;x++){
    const i=y*map.n+x;let sum=0,w=0;
    for(let d=-radius;d<=radius;d++){const xx=x+d;if(xx<0||xx>=map.n)continue;const j=y*map.n+xx;if(map.mask[j]){sum+=k[d+radius]*map.values[j];w+=k[d+radius];}}
    first[i]=sum;weights[i]=w;
  }
  for(let y=0;y<map.n;y++)for(let x=0;x<map.n;x++){
    const i=y*map.n+x;let sum=0,w=0;
    for(let d=-radius;d<=radius;d++){const yy=y+d;if(yy<0||yy>=map.n)continue;const j=yy*map.n+x;sum+=k[d+radius]*first[j];w+=k[d+radius]*weights[j];}
    // No dilation of measured support: unknown cells remain unknown.
    if((map.mask[i]||inferred)&&w>0){out.mask[i]=1;out.values[i]=sum/w;}
    if(inferred)out.mask[i]=1;
  }return out;
}
interface Region {id:string;ra:number;dec:number;polygon:number[][];young:V3;old:V3;}
function contains(poly:number[][],x:number,y:number):boolean {
  let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }return inside;
}
const median=(v:number[])=>{v.sort((a,b)=>a-b);return v.length?v[Math.floor(v.length/2)]:0;};
export interface Sources {
  warp:Raster; dust:Raster; young:[Raster,Raster,Raster]; youngCoverage:Raster; youngFraction:number; oldColor:V3;
  gas:Raster; nativeStars?:NativeStars; metadata:Record<string,unknown>;
}
export interface NativeStars {count:number;positions:Float64Array;rgb:Float64Array;earthTau:Float32Array;metadata:Record<string,unknown>;}
export async function loadSources(n=256,half=20,smashDetail=true):Promise<Sources> {
  const [rawVmc,rawSsp,rawOden,bellText,smashText]=await Promise.all([
    json(`${ARCHIVE}dataset-model/stars/regions.json`),json(`${ARCHIVE}dataset-model/detail-stars/ssp-intake/bc03-Z008-optical-age-table.json`),
    json(`${ARCHIVE}dataset-model/depth/surface.json`),readFile(`${ARCHIVE}dataset-model/detail-dust/Bell2022-etg-qualified.tsv`,'utf8'),
    smashDetail?readFile(`${ARCHIVE}dataset-model/detail-stars/source/full-grid.csv`,'utf8'):Promise.resolve('ix,iy,n0,n_strict,n\n')]);
  const bins=array(rec(array(rec(rawSsp).solutions)[0]).bins).map(v=>numbers(rec(v).meanLnuWPerHzPerInitialMsun,3));
  need(bins.length===16,'Expected 16 VMC age-bin luminosities');
  const regions:Region[]=array(rec(rawVmc).regions).map(v=>{
    const row=rec(v),center=numbers(row.centerIcrsDeg,2),mass=numbers(row.formedMassPerEffectiveDeg2ByAgeBin,16);
    const young:V3=[0,0,0],old:V3=[0,0,0];
    for(let age=2;age<16;age++)for(let c=0;c<3;c++)(age<=5?young:old)[c]+=mass[age]*bins[age][2-c]/1e16;
    const polygon=array(row.cornersIcrsDeg).map(v=>numbers(v,2));
    polygon.sort((a,b)=>Math.atan2(a[1]-center[1],(a[0]-center[0])*Math.cos(center[1]*DEG))-Math.atan2(b[1]-center[1],(b[0]-center[0])*Math.cos(center[1]*DEG)));
    need(typeof row.id==='string','Region ID missing');return{id:row.id,ra:center[0],dec:center[1],polygon,young,old};
  });need(regions.length===756,'Wrong VMC source release');
  const regionIndex=new Map<string,Region[]>();
  for(const region of regions)for(let ra=Math.floor(Math.min(...region.polygon.map(v=>v[0])));ra<=Math.floor(Math.max(...region.polygon.map(v=>v[0])));ra++)
    for(let de=Math.floor(Math.min(...region.polygon.map(v=>v[1]))*2);de<=Math.floor(Math.max(...region.polygon.map(v=>v[1]))*2);de++){
      const key=`${ra},${de}`,bucket=regionIndex.get(key)??[];bucket.push(region);regionIndex.set(key,bucket);
    }
  const regionAt=(ra:number,dec:number)=>{const found=(regionIndex.get(`${Math.floor(ra)},${Math.floor(dec*2)}`)??[]).filter(r=>contains(r.polygon,ra,dec));return found.length===1?found[0]:undefined;};
  const blue=new Map<string,number>(),blueMeans=new Map<string,{sum:number;n:number}>();
  const csv=smashText.trim().split(/\r?\n/u),head=csv.shift()!.split(','),ci=(s:string)=>{const i=head.indexOf(s);need(i>=0,`Missing SMASH ${s}`);return i;};
  const [ix,iy,n0,strict,total]=['ix','iy','n0','n_strict','n'].map(ci);
  for(const line of csv){const r=line.split(',').map(Number);need(r.every(Number.isFinite),'Bad SMASH row');
    const ra=61.5+(r[ix]+.5)*.125,de=-73.5+(r[iy]+.5)*.05;
    if(r[strict]/r[total]<.8)continue;
    const density=r[n0]/(.125*.05*Math.cos(de*DEG));blue.set(`${r[ix]},${r[iy]}`,density);
    const region=regionAt(ra,de);if(region){const m=blueMeans.get(region.id)??{sum:0,n:0};m.sum+=density;m.n++;blueMeans.set(region.id,m);}
  }
  const bell=new Map<string,{ra:number;dec:number;ebv:number}[]>();const lines=bellText.trim().split(/\r?\n/u);lines.shift();
  for(const line of lines){const r=line.split('\t');const ra=Number(r[1]),dec=Number(r[2]),ebv=Number(r[4]);need([ra,dec,ebv].every(Number.isFinite)&&ebv>=0&&ebv<=.5,'Bad Bell sightline');
    const key=`${Math.floor(ra*2)},${Math.floor(dec*6)}`,bucket=bell.get(key)??[];bucket.push({ra,dec,ebv});bell.set(key,bucket);}
  const bellAt=(ra:number,de:number):number|null=>{
    const values:number[]=[];const dra=(5/60)/Math.cos(de*DEG);
    for(let i=Math.floor((ra-dra)*2);i<=Math.floor((ra+dra)*2);i++)for(let j=Math.floor((de-5/60)*6);j<=Math.floor((de+5/60)*6);j++)
      for(const p of bell.get(`${i},${j}`)??[])if(Math.hypot((p.ra-ra)*Math.cos(de*DEG),p.dec-de)<=5/60)values.push(p.ebv);
    return values.length>=10?median(values):null;
  };
  const oden=rec(rawOden),odenWidth=num(oden.width),odenHeight=num(oden.height),odenData=array(oden.distancesKpc).map(v=>v===null?NaN:num(v));
  const header:FitsHeader={};for(const [k,v]of Object.entries(rec(oden.header))){need(['number','string','boolean'].includes(typeof v),'Invalid WCS card');if(typeof v==='number'||typeof v==='string'||typeof v==='boolean')header[k]=v;}
  const wcs=skyProjection(header);need(odenData.length===odenWidth*odenHeight,'Wrong Oden cache shape');
  const sourceI=25.32*DEG,sourceNode=142.34*DEG,sourceRay=unit(80.60,-69.80);
  const sourceWest:V3=[Math.sin(80.60*DEG),-Math.cos(80.60*DEG),0];
  const sourceNorth:V3=[-Math.sin(-69.80*DEG)*Math.cos(80.60*DEG),-Math.sin(-69.80*DEG)*Math.sin(80.60*DEG),Math.cos(-69.80*DEG)];
  const sourceNormal:V3=[0,1,2].map(c=>-Math.cos(sourceNode)*Math.sin(sourceI)*sourceWest[c]-Math.sin(sourceNode)*Math.sin(sourceI)*sourceNorth[c]-Math.cos(sourceI)*sourceRay[c]) as V3;
  const planeConstant=-49.15*Math.cos(sourceI);
  const warp=makeRaster(n,half),dust=makeRaster(n,half),young:[Raster,Raster,Raster]=[makeRaster(n,half),makeRaster(n,half),makeRaster(n,half)],gas=makeRaster(n,half);
  let warpAvailable=0,dustAvailable=0,youngAvailable=0,blueUsed=0;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const k=j*n+i,x=((i+.5)/n*2-1)*half,y=((j+.5)/n*2-1)*half,sky=skyOf(bodyToIcrs([x,y,0])),[ra,de]=sky;
    const pixel=wcs.pixelOf(ra,de);
    if(pixel){const px=Math.floor(pixel[0]),py=Math.floor(pixel[1]);if(px>=0&&py>=0&&px+1<odenWidth&&py+1<odenHeight){const ids=[py*odenWidth+px,py*odenWidth+px+1,(py+1)*odenWidth+px,(py+1)*odenWidth+px+1],v=ids.map(id=>odenData[id]);
      if(v.every(Number.isFinite)){const u=pixel[0]-px,t=pixel[1]-py,d=(v[0]*(1-u)+v[1]*u)*(1-t)+(v[2]*(1-u)+v[3]*u)*t;
        const plane=planeConstant/dot(unit(ra,de),sourceNormal),r=Math.hypot(x,y),q=Math.min(1,Math.max(0,(r-4.5)/2));
        const edge=Math.min(1,Math.max(0,Math.min(pixel[0],pixel[1],odenWidth-1-pixel[0],odenHeight-1-pixel[1])/4));
        warp.values[k]=-(d-plane)*Math.cos(sourceI)*q*q*(3-2*q)*edge*edge*(3-2*edge);warp.mask[k]=1;warpAvailable++;
      }} }
    const ebv=bellAt(ra,de);if(ebv!==null){dust.mask[k]=1;dust.values[k]=ebv*3.41/1.0857362047581296*Math.cos(25.86*DEG);dustAvailable++;}
    // Locate stellar surface data on the warped midplane, preserving observed sky positions.
    const warpedSky=skyOf(bodyToIcrs([x,y,warp.values[k]])),region=regionAt(...warpedSky);
    if(region){let detail=1;const b=blue.get(`${Math.floor((warpedSky[0]-61.5)/.125)},${Math.floor((warpedSky[1]+73.5)/.05)}`),mean=blueMeans.get(region.id);
      if(b!==undefined&&mean&&mean.sum>0){detail=b/(mean.sum/mean.n);blueUsed++;}
      for(let c=0;c<3;c++){young[c].values[k]=region.young[c]*detail;young[c].mask[k]=1;}youngAvailable++;
    }
  }
  const sums:V3=[0,0,0],oldSums:V3=[0,0,0];for(const r of regions)for(let c=0;c<3;c++){sums[c]+=r.young[c];oldSums[c]+=r.old[c];}
  const youngFraction=sums[1]/(sums[1]+oldSums[1]);
  const sourceCoverage=makeRaster(n,half);sourceCoverage.mask.fill(1);for(let i=0;i<n*n;i++)sourceCoverage.values[i]=young[1].mask[i];
  const youngCoverage=smooth(sourceCoverage,1.6);
  // Fixed interpolation at native regional scales is a conditional model in gaps,
  // never a new observation. Blend to the independent smooth parent at the footprint.
  const smoothedYoung=young.map(m=>smooth(m,1.6,true)) as [Raster,Raster,Raster];
  const norm=smoothedYoung[1].values.reduce((sum,v,i)=>sum+v*youngCoverage.values[i],0)*(2*half/n)**2;need(norm>0,'No source-derived young population');
  // Unit-integrated V luminosity. Age-dependent colors remain from the source spectra.
  for(const map of smoothedYoung)for(let i=0;i<map.values.length;i++)map.values[i]/=norm;
  return {warp:smooth(warp,.47/(2*half/n)),dust,young:smoothedYoung,youngCoverage,gas,youngFraction,oldColor:[oldSums[0]/oldSums[1],1,oldSums[2]/oldSums[1]],metadata:{
    n,halfKpc:half,warpAvailable,dustAvailable,youngAvailable,blueUsed,youngFraction,
    sources:['Mazzi 2021 JKs: 756 native regional SFHs','BC03 Z=0.008 Chabrier optical spectra, fixed proxy for VMC Kroupa population colors','SMASH blue observed-color count positions; strict fraction >=0.8; no photograph-derived values','Oden release: qualified Astropy TAN cache, 64 by 64, 0.25 degree pixels','Bell 2022: 222749 selected background-galaxy sightlines'],
    limitations:['BC03 and VMC use different IMFs/tracks; luminosity conversion is a fixed proxy with global normalization, not a claimed reproduction of VMC synthesis.','SMASH selection is not a complete, foreground-free young-star catalogue. Counts only redistribute regional age-derived luminosity.','Young-population values are interpolated over 0.25 kpc at survey gaps and blended to the analytic parent. This is an explicit continuity assumption, not measured completeness or invented observations.','Oden cache covers less than the full native Galactic CAR release. Outside support the warp is unknown; a planar continuation with one-degree coverage taper is assumed.','Bell missing cells stay unsupported; no dust column is invented in gaps.','Warp is applied only beyond 4.5 kpc with a two-kpc smooth transition, preserving the accepted inner plane.','DeMCELS still needs qualified full-field input; the empty gas raster is not a measured zero.']}};
}
