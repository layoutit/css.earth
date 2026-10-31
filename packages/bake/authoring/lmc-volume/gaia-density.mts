/** Complete Gaia young-member counts on the accepted plane; SMASH never fills this map. */
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {LOCAL,makeRaster,need,num,rec,json,type Sources,type Raster} from './inputs.mts';
import {gaiaWarpLocator,type WarpPlacement} from './gaia-plane.mts';
import {blur} from './young-density.mts';
import {smoothstep} from './model.mts';
import {L13,loadGaiaSample,type GaiaStar} from './gaia-young.mts';
export function densityFromMembers(stars:Pick<GaiaStar,'ra'|'dec'>[],sources:Sources,n=512,half=10,placement?:WarpPlacement,sigmaKpc=.15,weights?:ArrayLike<number>):Raster {
 const map=makeRaster(n,half),counts=new Float64Array(n*n),cell=2*half/n,locate=gaiaWarpLocator(sources,placement);map.mask.fill(1);
 need(weights===undefined||weights.length===stars.length,'Stellar density weights differ from the catalogue');for(let k=0;k<stars.length;k++){const s=stars[k],weight=weights?.[k]??1;need(Number.isFinite(weight)&&weight>=0,'Invalid stellar density weight');const p=locate(s.ra,s.dec),x=(p[0]/half+1)*n/2-.5,y=(p[1]/half+1)*n/2-.5,i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j;
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const xx=i+dx,yy=j+dy;if(xx>=0&&yy>=0&&xx<n&&yy<n)counts[yy*n+xx]+=weight*(dx?u:1-u)*(dy?v:1-v);}
 }
 const smoothed=blur(counts,n,n,sigmaKpc/cell);let total=0;for(let y=0;y<n;y++)for(let x=0;x<n;x++){const r=Math.hypot(((x+.5)/n*2-1)*half,((y+.5)/n*2-1)*half),value=smoothed[y*n+x]*(1-smoothstep((r-8.5)/.5));map.values[y*n+x]=value;total+=value;}
 need(total>0,'Gaia members do not overlap the model');for(let i=0;i<n*n;i++)map.values[i]/=total*cell*cell;return map;
}
export async function makeGaiaDensity(sources:Sources,options:{directory:string;sigmaKpc:number}={directory:L13,sigmaKpc:.15}){
 const directory=options.directory;need(options.sigmaKpc>=.1&&options.sigmaKpc<=.2,'Gaia smoothing must stay within the adopted 100–200 pc range');
 const placement:WarpPlacement={bracketed:0,multipleIntersections:0,maximumResidualKpc:0};
 const sample=await loadGaiaSample(false,directory),map=densityFromMembers(sample.stars,sources,512,10,placement,options.sigmaKpc),metadata={...sample.summary,source:'Gaia DR3 Young 1 + Young 2 proper-motion members',warpPlacement:{...placement,method:'Exact bilinear-cell intersections when fixed-point iteration fails. For multiple crossings, adopt the one nearest the flat midplane. At discontinuous support edges with no crossing, maximize the adopted 150 pc Gaussian height prior and report that finite-layer offset separately. The warp itself is unchanged.'},n:map.n,halfKpc:map.half,smoothingSigmaKpc:options.sigmaKpc,layerSigmaKpc:.15,photoUsed:false,smashUsed:false,analyticContinuation:false,normalization:'Unit-integrated equal-weight member counts. One global population luminosity and the existing component grade calibrate appearance.',coverage:'Complete archive query to 20 degrees. Zero selected counts remain zero before Gaussian smoothing. No survey-gap interpolation or analytic young-disc continuation.',limitations:'All-sky coverage is not uniform completeness: crowding, extinction and astrometric/photometric selection can still suppress young members. These CMD groups are age proxies, not measured individual ages.'};
 await mkdir(directory,{recursive:true});await writeFile(directory+'young-density.f32le',Buffer.from(map.values.buffer));await writeFile(directory+'young-density.json',JSON.stringify(metadata,null,2)+'\n');
 const positive=Array.from(map.values).filter(v=>v>0).sort((a,b)=>a-b),p99=positive[Math.floor(.99*positive.length)],pixels=Buffer.alloc(map.n*map.n*3);for(let y=0;y<map.n;y++)for(let x=0;x<map.n;x++){const value=Math.min(1,Math.asinh(10*map.values[(map.n-1-y)*map.n+x]/p99)/Math.asinh(10)),i=(y*map.n+x)*3;pixels[i]=Math.round(value*170);pixels[i+1]=Math.round(value*210);pixels[i+2]=Math.round(value*255);}await sharp(pixels,{raw:{width:map.n,height:map.n,channels:3}}).png().toFile(directory+'young-counts-face.png');
 // This comparison cannot alter Gaia counts, smoothing, selection or normalization.
 const previous=rec(await json(LOCAL+'versions/l12/young-density.json')),raw=await readFile(LOCAL+'versions/l12/young-density.f32le');need(raw.byteLength===map.n*map.n*4&&num(previous.n)===map.n&&num(previous.halfKpc)===map.half,'SMASH check grid mismatch');const smash=new Float32Array(Uint8Array.from(raw).buffer);let a=0,b=0,aa=0,bb=0,ab=0,n=0;
 for(let y=0;y<map.n;y++)for(let x=0;x<map.n;x++){if(Math.hypot(((x+.5)/map.n*2-1)*map.half,((y+.5)/map.n*2-1)*map.half)>4)continue;const i=y*map.n+x,u=map.values[i],v=smash[i];a+=u;b+=v;aa+=u*u;bb+=v*v;ab+=u*v;n++;}
 const correlation=(ab-a*b/n)/Math.sqrt((aa-a*a/n)*(bb-b*b/n));await writeFile(directory+'smash-check.json',JSON.stringify({role:'Independent check only; no SMASH values enter Gaia density',inner4KpcMapCorrelation:correlation,comparison:'l12 SMASH map includes its declared smoothing, foreground removal and interpolation. This is a morphology check, not a same-selection completeness test.'},null,2)+'\n');return{map,metadata};
}
