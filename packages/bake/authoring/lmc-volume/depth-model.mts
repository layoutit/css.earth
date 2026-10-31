/** l9: finite, observed-footprint clouds plus source-backed population depths. */
import {at,makeRaster,smooth,need,type Raster,type Sources} from './inputs.mts';
import {rayInBody,normalize,bodyToIcrs,add,mul,dot,cross,INCLINATION,type V3} from './geometry.mts';
import {gaussian,barSurface,discSurface,outerSurface,createModel,smoothstep,SIGMA_BAR,type Model} from './model.mts';
import {HEIGHTS,type PhotoSky} from './photo-convert.mts';
import {makePhotoFields,photoFootpoint,skySample,type PhotoFields} from './photo-model.mts';
import type {Observation} from './report.mts';

// Ripepi et al. 2022 equation 9 is in residual sky Z, not disc-normal z.
export const CEPHEID_SKY_SECH_SCALE=1.94;
export const CEPHEID_NORMAL_SECH_SCALE=CEPHEID_SKY_SECH_SCALE*Math.cos(INCLINATION);
export const BAR_QZ_LIMIT=.35;
export const BAR_SIGMA_Z=SIGMA_BAR*BAR_QZ_LIMIT;
export const BAR_VERTICAL_OFFSET=0;
export const BLEND_PIXELS=64;
export const sechProfile=(z:number)=>1/(2*CEPHEID_NORMAL_SECH_SCALE*Math.cosh(z/CEPHEID_NORMAL_SECH_SCALE)**2);
export interface DepthLayers {version:9|10;young:'sech2'|'gaussian';youngSigmaKpc:number;gasSigmaKpc:number;dustSigmaKpc:number;}
const L9_LAYERS:Readonly<DepthLayers>={version:9,young:'sech2',youngSigmaKpc:0,gasSigmaKpc:HEIGHTS.gas,dustSigmaKpc:HEIGHTS.dust};
/** Owner-adopted Gaussian widths. These values are fixed, not measured or fitted. */
export const ADOPTED_LAYERS:Readonly<DepthLayers>={version:10,young:'gaussian',youngSigmaKpc:.15,gasSigmaKpc:.15,dustSigmaKpc:.25};
function cloudCentre(warp:Raster,ray:{origin:V3;direction:V3}):V3 {
  let p=add(ray.origin,mul(ray.direction,-ray.origin[2]/ray.direction[2]));
  for(let i=0;i<32;i++){const z=at(warp,p[0],p[1]),q=add(ray.origin,mul(ray.direction,(z-ray.origin[2])/ray.direction[2]));if(Math.hypot(...add(q,mul(p,-1)))<1e-8){p=q;break;}p=q;}
  need(Math.abs(p[2]-at(warp,p[0],p[1]))<1e-5,'The compact region does not have a converged mid-plane anchor');return p;
}
/** Compact quartic profile: normalized integral 1 and variance H^2/7. */
export function cloudProfile(q:number,halfDepth:number):number {
  if(!(halfDepth>0)||Math.abs(q)>=halfDepth)return 0;
  return 15/(16*halfDepth)*(1-(q/halfDepth)**2)**2;
}
export interface CloudRegion {id:number;component:'young'|'gas';pixels:number;centerKpc:V3;distanceKpc:number;skySigmaKpc:number;losSigmaKpc:number;halfDepthMaxKpc:number;transverseRadiusMaxKpc:number;flux:number;}
export interface CloudSplit {light:Float32Array;halfDepth:Float32Array;distance:Float32Array;labels:Int32Array;regions:CloudRegion[];fraction:number;}
export interface DepthFields extends PhotoFields {clouds:Raster[][];regions:CloudRegion[];barNormalization:number;}
const observer=rayInBody([0,0,1]).origin;
const quantile=(v:number[],q:number)=>{v.sort((a,b)=>a-b);return v[Math.floor(q*(v.length-1))]??0;};
function blurImage(v:Float32Array,w:number,h:number,sigma:number):Float32Array {
  const r=Math.ceil(3*sigma),weights=Array.from({length:r*2+1},(_,i)=>Math.exp(-.5*((i-r)/sigma)**2)),a=new Float32Array(v.length),b=new Float32Array(v.length);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sum=0,norm=0;for(let k=-r;k<=r;k++){const xx=x+k;if(xx>=0&&xx<w){sum+=v[y*w+xx]*weights[k+r];norm+=weights[k+r];}}a[y*w+x]=sum/norm;}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sum=0,norm=0;for(let k=-r;k<=r;k++){const yy=y+k;if(yy>=0&&yy<h){sum+=a[yy*w+x]*weights[k+r];norm+=weights[k+r];}}b[y*w+x]=sum/norm;}return b;
}
/** A deterministic watershed. Widths, flux and centres are moments of data, never optimized. */
export function splitClouds(values:Float32Array,sky:PhotoSky,o:Pick<Observation,'rayAt'>,warp:Raster,component:'young'|'gas'):CloudSplit {
  const {width:w,height:h}=sky,background=blurImage(values,w,h,10),light=new Float32Array(values.length),halfDepth=new Float32Array(values.length),distance=new Float32Array(values.length),labels=new Int32Array(values.length).fill(-1);
  for(let i=0;i<light.length;i++)light[i]=sky.valid[i]?Math.max(0,values[i]-(component==='young'?1:.3)*background[i])*smoothstep(sky.distance[i]/BLEND_PIXELS):0;
  const detection=blurImage(light,w,h,1.2),threshold=quantile(Array.from(detection).filter(v=>v>0),.7),candidates:number[]=[],seeds:number[]=[];
  for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){
    const i=y*w+x;if(detection[i]<threshold)continue;let peak=true;
    for(let dy=-2;dy<=2&&peak;dy++)for(let dx=-2;dx<=2;dx++){const j=(y+dy)*w+x+dx;if(detection[j]>detection[i]||(detection[j]===detection[i]&&j<i)){peak=false;break;}}
    if(peak)candidates.push(i);
  }
  // Measure coherent complexes rather than every noisy subpeak in one nebula.
  const separation=component==='gas'?8:5;
  for(const i of candidates.sort((a,b)=>detection[b]-detection[a]))if(seeds.every(j=>(i%w-j%w)**2+(Math.floor(i/w)-Math.floor(j/w))**2>=separation**2))seeds.push(i);
  // Flood in descending intensity; each pixel drains into one observed local maximum.
  const order=Array.from({length:light.length},(_,i)=>i).filter(i=>light[i]>threshold*.12).sort((a,b)=>detection[b]-detection[a]);
  seeds.forEach((i,id)=>labels[i]=id);
  for(const i of order){if(labels[i]>=0)continue;const x=i%w,y=Math.floor(i/w);let best=-1,v=-1;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;const j=yy*w+xx;if(labels[j]>=0&&detection[j]>v){v=detection[j];best=labels[j];}}
    if(best>=0)labels[i]=best;
  }
  // Finish plateau pixels with a bounded spatial nearest seed, without bridging the galaxy.
  for(const i of order)if(labels[i]<0){let best=-1,d=25**2;const x=i%w,y=Math.floor(i/w);for(let j=0;j<seeds.length;j++){const q=(x-seeds[j]%w)**2+(y-Math.floor(seeds[j]/w))**2;if(q<d){d=q;best=j;}}labels[i]=best;}
  const groups=seeds.map(()=>[] as number[]);for(let i=0;i<labels.length;i++)if(labels[i]>=0)groups[labels[i]].push(i);
  const regions:CloudRegion[]=[],edge=new Float32Array(values.length);
  for(let id=0;id<groups.length;id++){
    const pixels=groups[id];let flux=0,cx=0,cy=0;for(const i of pixels){flux+=light[i];cx+=light[i]*(i%w+.5);cy+=light[i]*(Math.floor(i/w)+.5);}
    if(pixels.length<4||flux<=0){for(const i of pixels){labels[i]=-1;light[i]=0;}continue;}
    cx/=flux;cy/=flux;const ray=rayInBody(o.rayAt(cx,cy)),center=cloudCentre(warp,ray),d=Math.hypot(...add(center,mul(observer,-1))),dir=normalize(add(center,mul(observer,-1))),e1=normalize(cross(dir,Math.abs(dir[2])<.9?[0,0,1]:[0,1,0])),e2=cross(dir,e1);
    let xx=0,xy=0,yy=0,radiusMax=0;
    for(const i of pixels){const r=rayInBody(o.rayAt(i%w+.5,Math.floor(i/w)+.5)),p=add(mul(r.direction,d),mul(dir,-d)),u=dot(p,e1),v=dot(p,e2);xx+=light[i]*u*u;xy+=light[i]*u*v;yy+=light[i]*v*v;radiusMax=Math.max(radiusMax,Math.hypot(u,v));edge[i]=1e6;}
    const rx=rayInBody(o.rayAt(cx+1,cy)).direction,ry=rayInBody(o.rayAt(cx,cy+1)).direction,dx=mul(add(rx,mul(dir,-1)),d),dy=mul(add(ry,mul(dir,-1)),d),ux=dot(dx,e1),vx=dot(dx,e2),uy=dot(dy,e1),vy=dot(dy,e2);
    // An observed pixel is a finite area, not a dimensionless point source.
    const cxx=xx/flux+(ux*ux+uy*uy)/12,cyy=yy/flux+(vx*vx+vy*vy)/12,cxy=xy/flux+(ux*vx+uy*vy)/12,sigma=Math.max(0,cxx*cyy-cxy*cxy)**.25;
    // Distance to this watershed boundary defines shrinking off-centre cross sections.
    for(const i of pixels){const x=i%w,y=Math.floor(i/w);if(!x||!y||x===w-1||y===h-1||labels[i-1]!==id||labels[i+1]!==id||labels[i-w]!==id||labels[i+w]!==id)edge[i]=.5;}
    for(const i of [...pixels].sort((a,b)=>a-b)){const x=i%w,y=Math.floor(i/w);if(x&&labels[i-1]===id)edge[i]=Math.min(edge[i],edge[i-1]+1);if(y&&labels[i-w]===id)edge[i]=Math.min(edge[i],edge[i-w]+1);}
    for(const i of [...pixels].sort((a,b)=>b-a)){const x=i%w,y=Math.floor(i/w);if(x+1<w&&labels[i+1]===id)edge[i]=Math.min(edge[i],edge[i+1]+1);if(y+1<h&&labels[i+w]===id)edge[i]=Math.min(edge[i],edge[i+w]+1);}
    let weightedDepth=0;for(const i of pixels)weightedDepth+=light[i]*edge[i];
    const scale=7*sigma*sigma*flux/weightedDepth;let max=0,variance=0;
    for(const i of pixels){halfDepth[i]=Math.sqrt(scale*edge[i]);distance[i]=d;max=Math.max(max,halfDepth[i]);variance+=light[i]*halfDepth[i]**2/7;}
    regions.push({id,component,pixels:pixels.length,centerKpc:center,distanceKpc:d,skySigmaKpc:sigma,losSigmaKpc:Math.sqrt(variance/flux),halfDepthMaxKpc:max,transverseRadiusMaxKpc:radiusMax,flux});
  }
  let assigned=0,total=0;for(let i=0;i<light.length;i++){if(labels[i]<0)light[i]=0;assigned+=light[i];total+=values[i]*smoothstep(sky.distance[i]/BLEND_PIXELS);}
  return {light,halfDepth,distance,labels,regions,fraction:assigned/Math.max(total,1e-20)};
}

export function makeDepthFields(sky:PhotoSky,o:Pick<Observation,'pixelOf'|'rayAt'>,sources:Sources,n:number,half=12):DepthFields {
  const original=makePhotoFields(sky,o,sources,n,half),skyMaps=original.skyMaps;need(skyMaps?.length===5,'Missing deterministic photo split');
  const splits=[splitClouds(skyMaps[2],sky,o,sources.warp,'young'),splitClouds(skyMaps[3],sky,o,sources.warp,'gas')],diffuse=skyMaps.map(v=>v.slice());
  // Remove each measured clump exactly once before adding its finite 3D replacement.
  for(let k=0;k<2;k++)for(let i=0;i<diffuse[k+2].length;i++)diffuse[k+2][i]-=splits[k].light[i]/Math.max(1e-10,smoothstep(sky.distance[i]/BLEND_PIXELS));
  const fluxBudget=splits.map((s,k)=>{let source=0,remaining=0,compact=0;for(let i=0;i<s.light.length;i++){const w=smoothstep(sky.distance[i]/BLEND_PIXELS);source+=skyMaps[k+2][i]*w;remaining+=diffuse[k+2][i]*w;compact+=s.light[i];}const relativeError=(remaining+compact)/Math.max(source,1e-20)-1;need(Math.abs(relativeError)<1e-6,'Compact light was lost or counted twice');return{source,remaining,compact,relativeError};});
  const maps=Array.from({length:5},()=>makeRaster(n,half)),clouds=Array.from({length:2},()=>Array.from({length:3},()=>makeRaster(n,half)));for(const m of [...maps,...clouds.flat()])m.mask.fill(1);
  const weightedClouds=splits.map(s=>[s.light,Float32Array.from(s.light,(v,i)=>v*s.halfDepth[i]),Float32Array.from(s.light,(v,i)=>v*s.distance[i])]);
  const norm=original.metadata.priorNormalization;need(typeof norm==='number'&&norm>0,'Invalid exterior normalization');
  let boundaryOld=0,boundaryYoung=0,barFlux=0,folds=0,photoCells=0;
  for(let i=0;i<sky.distance.length;i++)if(sky.distance[i]>12&&sky.distance[i]<64){boundaryOld+=skyMaps[0][i];boundaryYoung+=diffuse[2][i];}
  const youngRatio=boundaryYoung/Math.max(boundaryOld,1e-10),cellArea=(2*half/n)**2;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const i=y*n+x,bx=((x+.5)/n*2-1)*half,by=((y+.5)/n*2-1)*half,z=at(sources.warp,bx,by),p:V3=[bx,by,z],pixel=o.pixelOf(bodyToIcrs(p)),dir=normalize(add(p,mul(observer,-1))),r=Math.hypot(bx,by),priorD=norm*(discSurface(r)+outerSurface(r))/Math.abs(dir[2]),priorB=norm*barSurface(bx,by)/Math.abs(dir[2]);
    const back=photoFootpoint(sources.warp,...p),branch=Math.hypot(back[0]-bx,back[1]-by),unique=1-smoothstep((branch-.04)/.12);
    const edge=pixel?smoothstep(skySample(sky,sky.distance,...pixel)/BLEND_PIXELS):0,w=edge*unique;if(edge>0){photoCells++;if(unique<1)folds++;}
    for(let k=0;k<4;k++)maps[k].values[i]=w*(pixel?skySample(sky,diffuse[k],...pixel):0)+(1-w)*(k===0?priorD:k===1?priorB:0);
    maps[4].values[i]=w*(pixel?skySample(sky,skyMaps[4],...pixel):0);
    barFlux+=maps[1].values[i]*Math.abs(dir[2])*cellArea;
    // Compact blobs are placed in observer coordinates only within their finite measured widths.
    const flatPixel=o.pixelOf(bodyToIcrs([bx,by,0]));if(flatPixel)for(let k=0;k<2;k++){
      for(let c=0;c<3;c++)clouds[k][c].values[i]=skySample(sky,weightedClouds[k][c],...flatPixel);
    }
  }
  // Smooth diffuse population structure only. Resolved clumps retain the photo's pixels.
  const before=maps[2].values.reduce((a,b)=>a+b,0),smoothed=smooth(maps[2],.18/(2*half/n),true),after=smoothed.values.reduce((a,b)=>a+b,0);for(let i=0;i<smoothed.values.length;i++)smoothed.values[i]*=before/after;maps[2]=smoothed;
  // A Gaussian ellipsoid replaces the bar's repeated photograph. Its total light is retained.
  let barIntegral=0;for(let y=0;y<n;y++)for(let x=0;x<n;x++)barIntegral+=barSurface(((x+.5)/n*2-1)*half,((y+.5)/n*2-1)*half)*cellArea;
  const barNormalization=barFlux/barIntegral;
  // A wider footprint fade must not silently lower Bell's one global column budget.
  let bellSum=0,proxySum=0,bellSamples=0;const bell=sources.dust;
  for(let y=0;y<bell.n;y++)for(let x=0;x<bell.n;x++){
    const i=y*bell.n+x;if(!bell.mask[i])continue;const bx=((x+.5)/bell.n*2-1)*bell.half,by=((y+.5)/bell.n*2-1)*bell.half,p:V3=[bx,by,at(sources.warp,bx,by)],pixel=o.pixelOf(bodyToIcrs(p));if(!pixel||skySample(sky,sky.distance,...pixel)<18)continue;
    const d=normalize(add(p,mul(observer,-1))),proxy=at(maps[4],bx,by);if(proxy<=0)continue;bellSum+=bell.values[i]/Math.abs(d[2]);proxySum+=proxy;bellSamples++;
  }
  need(bellSamples>100&&proxySum>0,'Missing final dust-budget overlap');const dustFadeCorrection=bellSum/proxySum;for(let i=0;i<maps[4].values.length;i++)maps[4].values[i]*=dustFadeCorrection;
  return {maps,colors:sky.colors,clouds,regions:splits.flatMap(s=>s.regions),barNormalization,metadata:{...original.metadata,version:9,blendPixels:BLEND_PIXELS,boundaryYoungToOld:youngRatio,foldSuppressedCells:folds,photoCells,barNormalization,
    splitCalibrationWidthsSigmaKpc:original.metadata.heightsSigmaKpc,heightsSigmaKpc:{old:HEIGHTS.old,bar:BAR_SIGMA_Z,young:null,gasDiffuse:HEIGHTS.gas,dust:HEIGHTS.dust},
    bellFinal:{overlapSamples:bellSamples,fadeCorrection:dustFadeCorrection,meanObservedLosTauV:bellSum/bellSamples,meanInferredLosTauV:proxySum*dustFadeCorrection/bellSamples,freeParameters:0},
    thicknessStatus:{old:'Unchanged Kacharov Gaussian disc',bar:'Gaussian ellipsoid at the adopted published qz upper limit',young:'Observed VMC/OGLE Cepheid sech-squared profile for diffuse light; finite width-based clouds for compact light',gas:'Width-based compact volumes plus unchanged thin diffuse emission',dust:'Unchanged intermediate Gaussian layer and Bell column budget'},
    geometry:'The diffuse fields remain in the accepted Choi/Oden disc coordinates. Each compact source has a finite, shrinking three-dimensional cross section around its observed position and warped-plane centre. The bar is an analytic triaxial ellipsoid, not a repeated photo.',
    cloudFractions:splits.map(s=>s.fraction),fluxBudget,cloudDefinition:'Deterministic watershed of compact photo emission. Each region has its measured on-sky RMS width, including finite pixel areas, as its line-of-sight RMS depth. Compact quartic cross sections shrink towards their 3D boundary. Region centres are on the accepted warped mid-plane. Flux is subtracted before replacement; no regional fitting.',
    cloudSegmentation:{sourceGrid:[sky.width,sky.height],minimumSeedSeparationPixels:{young:5,gas:8},status:'Fixed global image-segmentation choices, not measured individual memberships or fitted parameters. All native pixels within a complex retain their light.'},
    youngDepth:{skySechScaleKpc:CEPHEID_SKY_SECH_SCALE,normalSechScaleKpc:CEPHEID_NORMAL_SECH_SCALE,normalSigmaKpc:Math.PI*CEPHEID_NORMAL_SECH_SCALE/Math.sqrt(12),source:'Ripepi et al. 2022, section 7.1, equation 9 and Table 6; 4220 VMC/OGLE Cepheids. The reported sky-Z residual scale is converted to the disc normal. Observed ensemble spread includes distance errors and non-planar substructure; not an intrinsic height of newborn clusters.'},
    barDepth:{sigmaZKpc:BAR_SIGMA_Z,minorToMajor:BAR_QZ_LIMIT,verticalOffsetKpc:BAR_VERTICAL_OFFSET,status:'Kacharov 2024 section 5.2 gives only qz <= 0.35, not a measured best thickness. Adopt the upper allowed value as an explicit choice. Keep Rathore placement and Kacharov planar axes. OGLE 2016 finds no significant global vertical offset.'},
    extension:'64-source-pixel smooth fade into the accepted old stellar paper profile. Young, gas and dust beyond the photo remain unsupported, as in l8. Non-converged or ambiguous warp projection branches revert smoothly to the paper profile. The boundary young/old ratio is a diagnostic only.',diffuseYoungSmoothingSigmaKpc:.18}};
}

export function adoptedDepthFields(fields:DepthFields):DepthFields {
  return {...fields,metadata:{...fields.metadata,version:10,depthLayers:ADOPTED_LAYERS,
    heightsSigmaKpc:{old:HEIGHTS.old,bar:BAR_SIGMA_Z,young:.15,gasDiffuse:.15,dust:.25},
    youngDepth:{profile:'Gaussian',normalSigmaKpc:.15,status:'Adopted by the owner, not a measurement or fit.'},
    thicknessStatus:{old:'Unchanged Kacharov Gaussian sigma, 410 pc',bar:'Unchanged l9 Gaussian ellipsoid',young:'Adopted Gaussian sigma, 150 pc, for diffuse light; knots retain their measured sky-width prior',gas:'Adopted Gaussian sigma, 150 pc, for diffuse gas; knots retain their measured sky-width prior',dust:'Adopted Gaussian sigma, 250 pc; Bell column budget unchanged'}}};
}
export function makeDepthModel(fields:DepthFields,sources:Sources,layers:Readonly<DepthLayers>=fields.metadata.version===10?ADOPTED_LAYERS:L9_LAYERS):Model {
  const model=createModel(layers.version,[1,2,3,4,5,6,7,8,9,...(layers.version===10?[10]:[])],{...sources,nativeStars:undefined}),sample=new Float64Array(5),cloudSample=new Float64Array(6),map=fields.maps[0],n=map.n,half=map.half;
  const read=(maps:Raster[],x:number,y:number,out:Float64Array)=>{
    const fx=(x/half+1)*n/2-.5,fy=(y/half+1)*n/2-.5,i=Math.floor(fx),j=Math.floor(fy);out.fill(0);if(i<0||j<0||i+1>=n||j+1>=n)return;
    const u=fx-i,v=fy-j,a=j*n+i,b=a+n;for(let k=0;k<maps.length;k++){const d=maps[k].values;out[k]=(d[a]*(1-u)+d[a+1]*u)*(1-v)+(d[b]*(1-u)+d[b+1]*u)*v;}
  };
  const cloudMaps=fields.clouds.flat(),cloudZBound=Math.max(0,...fields.regions.map(r=>Math.abs(r.centerKpc[2])+r.halfDepthMaxKpc+1.1*r.transverseRadiusMaxKpc))+8*half/n;
  model.sampleField=(x,y,z,out)=>{
    out.fill(0);if(Math.hypot(x,y)>20||Math.abs(z)>12)return;
    const warp=at(sources.warp,x,y),zz=z-warp,dirZ=Math.abs((warp-observer[2])/Math.hypot(x-observer[0],y-observer[1],warp-observer[2]));
    if(Math.abs(zz)<4.5)read(fields.maps,x,y,sample);else{sample.fill(0);sample[2]=at(fields.maps[2],x,y);}
    if(Math.max(Math.abs(x),Math.abs(y))>=half*(1-1/n)){
      const norm=fields.metadata.priorNormalization;need(typeof norm==='number'&&norm>0,'Missing exterior profile normalization');sample[0]=norm*(discSurface(Math.hypot(x,y))+outerSurface(Math.hypot(x,y)))/dirZ;
    }
    const profiles=[dirZ*gaussian(zz,HEIGHTS.old),0,dirZ*(layers.young==='gaussian'?gaussian(zz,layers.youngSigmaKpc):sechProfile(zz)),dirZ*gaussian(zz,layers.gasSigmaKpc)],slots=[0,3,9,12];
    for(let k=0;k<4;k++){const color=fields.colors[k<2?0:k-1];for(let c=0;c<3;c++)out[slots[k]+c]=sample[k]*color[c]*profiles[k];}
    const b=fields.barNormalization*barSurface(x,y)*gaussian(z-BAR_VERTICAL_OFFSET,BAR_SIGMA_Z);for(let c=0;c<3;c++)out[3+c]=b*fields.colors[0][c];
    out[15]=sample[4]*dirZ*gaussian(zz,layers.dustSigmaKpc);
    // The finite region's own depth is used, never a galaxy-wide extrusion.
    if(Math.abs(z)>cloudZBound)return;
    const f=-observer[2]/(z-observer[2]),px=observer[0]+f*(x-observer[0]),py=observer[1]+f*(y-observer[1]);
    read(cloudMaps,px,py,cloudSample);
    if(cloudSample[0]>0||cloudSample[3]>0){const d=Math.hypot(x-observer[0],y-observer[1],z-observer[2]);for(let k=0;k<2;k++){
      const a=cloudSample[k*3];if(!(a>0))continue;const amp=a*cloudProfile(d-cloudSample[k*3+2]/a,cloudSample[k*3+1]/a),color=fields.colors[k+1];for(let c=0;c<3;c++)out[9+k*3+c]+=amp*color[c];
    }}
  };return model;
}
