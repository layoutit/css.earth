/** SMASH counts -> coverage-normalized diffuse population, independent of the photo. */
import {readFile} from 'node:fs/promises';
import {ARCHIVE,makeRaster,at,need,type Sources,type Raster} from './inputs.mts';
import {bodyToIcrs,skyOf,DEG} from './geometry.mts';
import {discSurface,smoothstep} from './model.mts';
export function blur(values:Float64Array,w:number,h:number,sigmaX:number,sigmaY=sigmaX):Float64Array {
 let a=values;for(const axis of [0,1]){const sigma=axis?sigmaY:sigmaX,r=Math.ceil(3*sigma),kernel=Array.from({length:2*r+1},(_,i)=>Math.exp(-.5*((i-r)/sigma)**2)),norm=kernel.reduce((a,b)=>a+b,0),b=new Float64Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sum=0;for(let d=-r;d<=r;d++){const xx=x+(axis===0?d:0),yy=y+(axis===1?d:0);if(xx>=0&&yy>=0&&xx<w&&yy<h)sum+=a[yy*w+xx]*kernel[d+r];}b[y*w+x]=sum/norm;}a=b;
 }return a;
}
export function normalizedCounts(counts:Float64Array,coverage:Float64Array,w:number,h:number,sigma:number):{density:Float64Array;confidence:Float64Array}{
 const numerator=blur(counts,w,h,sigma),confidence=blur(coverage,w,h,sigma),density=Float64Array.from(numerator,(v,i)=>confidence[i]>1e-8?v/confidence[i]:0);return{density,confidence};
}
function bilinear(a:Float64Array,w:number,h:number,x:number,y:number):number{const i=Math.floor(x),j=Math.floor(y);if(i<0||j<0||i+1>=w||j+1>=h)return 0;const u=x-i,v=y-j,k=j*w+i;return(a[k]*(1-u)+a[k+1]*u)*(1-v)+(a[k+w]*(1-u)+a[k+w+1]*u)*v;}
export function surveyConfidence(c:number,x:number,y:number,w:number,h:number):number{return smoothstep(c/.3)*smoothstep(Math.min(x,y,w-1-x,h-1-y)/12);}
export async function youngStarDensity(sources:Sources,n=512,half=10):Promise<{map:Raster;metadata:Record<string,unknown>}> {
 const w=298,h=177,counts=new Float64Array(w*h),coverage=new Float64Array(w*h),occupancy=(await readFile(`${ARCHIVE}dataset-model/detail-stars/source/full-occupancy.csv`,'utf8')).trim().split(/\r?\n/u);need(occupancy.shift()==='ix,iy,n_catalogue','Wrong SMASH coverage schema');
 for(const line of occupancy){const r=line.split(',').map(Number);need(r.length===3&&r.every(Number.isFinite),'Invalid SMASH coverage');if(r[2]>0&&r[0]>=0&&r[0]<w&&r[1]>=0&&r[1]<h)coverage[r[1]*w+r[0]]=1;}
 const rows=(await readFile(`${ARCHIVE}dataset-model/detail-stars/source/full-grid.csv`,'utf8')).trim().split(/\r?\n/u),head=rows.shift()!.split(','),ix=head.indexOf('ix'),iy=head.indexOf('iy'),blue=head.indexOf('n0'),strict=head.indexOf('n_strict'),total=head.indexOf('n');need([ix,iy,blue,strict,total].every(i=>i>=0),'Missing SMASH count columns');let stars=0,qualified=0;
 for(const line of rows){const r=line.split(',').map(Number);need(r.length===head.length&&r.every(Number.isFinite),'Invalid SMASH count row');const x=r[ix],y=r[iy];if(x<0||x>=w||y<0||y>=h)continue;const k=y*w+x;if(r[strict]/r[total]<.8){coverage[k]=0;continue;}counts[k]=r[blue]/(.125*.05*Math.cos((-73.5+(y+.5)*.05)*DEG));stars+=r[blue];qualified++;}
 // A measured zero in a surveyed cell is kept. Missing cells have no exposure.
 const near=normalizedCounts(counts,coverage,w,h,4),far=normalizedCounts(counts,coverage,w,h,12),density=new Float64Array(w*h);
 for(let i=0;i<density.length;i++){const blend=smoothstep((near.confidence[i]-.12)/.5);density[i]=near.density[i]*blend+far.density[i]*(1-blend);}
 const outer:number[]=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(coverage[y*w+x]&&Math.hypot((61.5+(x+.5)*.125-80.3)*Math.cos(-69.7*DEG),-73.5+(y+.5)*.05+69.7)>7)outer.push(density[y*w+x]);outer.sort((a,b)=>a-b);const foreground=outer[Math.floor(outer.length*.25)]??0;
 const map=makeRaster(n,half),confidenceMap=new Float32Array(n*n),ratios:number[]=[];map.mask.fill(1);let sum=0,interpolated=0,observed=0;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const bx=((x+.5)/n*2-1)*half,by=((y+.5)/n*2-1)*half,r=Math.hypot(bx,by),[ra,dec]=skyOf(bodyToIcrs([bx,by,at(sources.warp,bx,by)])),sx=(ra-61.5)/.125-.5,sy=(dec+73.5)/.05-.5,k=y*n+x,c=bilinear(far.confidence,w,h,sx,sy),v=Math.max(0,bilinear(density,w,h,sx,sy)-foreground);map.values[k]=v;confidenceMap[k]=surveyConfidence(c,sx,sy,w,h);if(r>3&&r<4.5&&c>.8&&v>0)ratios.push(v/discSurface(r));if(r<8.5){if(bilinear(coverage,w,h,sx,sy)>.5)observed++;else interpolated++;}}
 ratios.sort((a,b)=>a-b);need(ratios.length>100,'No measured outer counts for the smooth continuation');const parentScale=ratios[Math.floor(ratios.length/2)];
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const r=Math.hypot(((x+.5)/n*2-1)*half,((y+.5)/n*2-1)*half),k=y*n+x,confidence=confidenceMap[k],v=map.values[k],parent=discSurface(r)*parentScale,taper=1-smoothstep((r-8.5)/.5);
  // Blend unobserved boundaries to the paper profile, not to a measured zero.
  map.values[k]=(v*confidence+parent*(1-confidence))*taper;sum+=map.values[k];
 }
 const area=(2*half/n)**2;need(sum>0&&stars>10000,'No usable young-star density');for(let i=0;i<map.values.length;i++)map.values[i]/=sum*area;
 return{map,metadata:{source:'SMASH DR2 full-grid blue counts and independent full-occupancy coverage',selectedBlueCandidates:stars,qualifiedCells:qualified,n,halfKpc:half,nearSmoothingKpcApprox:.15,gapSmoothingKpcApprox:.5,observedBodyCells:observed,interpolatedBodyCells:interpolated,foregroundCandidatesPerDeg2:foreground,parentScaleFromObservedCounts:parentScale,parentFitCells:ratios.length,layerSigmaKpc:.15,photoUsed:false,selection:'16 <= g,r,i < 22; -0.5 <= g-i < 0.5; errors <0.1 mag; cells with >=80% strict PSF quality.',gapTreatment:'Gaussian normalized convolution of counts and coverage separately, at 4 and 12 native cells. Broad unsupported boundaries blend to the paper disc, normalized to measured 3–4.5 kpc counts. Inferred gaps are not new observations.',limitations:'Observed-color candidates, not a complete age or membership sample. Positive catalogue occupancy does not establish exact exposure or completeness. Map controls relative diffuse luminosity, not an absolute stellar mass. Northern structure is never fitted to Horálek.'}};
}
