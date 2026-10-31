/** Photo detail on a measured warped plane, with component-specific conditional depths. */
import {at,makeRaster,type Raster,type Sources,need} from './inputs.mts';
import {bodyToIcrs,normalize,rayInBody,add,mul,type V3} from './geometry.mts';
import {barSurface,discSurface,outerSurface,gaussian,createModel,smoothstep,FOREGROUND_EBV,EXTINCTION_RGB,type Model} from './model.mts';
import {HEIGHTS,splitPixel,type PhotoSky} from './photo-convert.mts';
import type {Observation} from './report.mts';
export interface PhotoFields {maps:Raster[];colors:V3[];metadata:Record<string,unknown>;skyMaps?:Float32Array[];}
const observer=rayInBody([0,0,1]).origin;
export function photoFootpoint(warp:Raster,x:number,y:number,z:number):V3 {
  const dx=x-observer[0],dy=y-observer[1],dz=z-observer[2];let f=-observer[2]/dz,xx=observer[0]+f*dx,yy=observer[1]+f*dy,zz=0;
  for(let i=0;i<4;i++){zz=at(warp,xx,yy);f=(zz-observer[2])/dz;xx=observer[0]+f*dx;yy=observer[1]+f*dy;}
  return [xx,yy,zz];
}
export function skySample(s:PhotoSky,values:Float32Array|Float64Array,x:number,y:number,channel?:number):number {
  const xx=x-.5,yy=y-.5,i=Math.floor(xx),j=Math.floor(yy);if(i<0||j<0||i+1>=s.width||j+1>=s.height)return 0;
  const ids=[j*s.width+i,j*s.width+i+1,(j+1)*s.width+i,(j+1)*s.width+i+1];if(ids.some(k=>!s.valid[k]))return 0;
  const a=ids.map(k=>values[channel===undefined?k:k*3+channel]),u=xx-i,v=yy-j;return (a[0]*(1-u)+a[1]*u)*(1-v)+(a[2]*(1-u)+a[3]*u)*v;
}
const median=(v:number[])=>{need(v.length>0,'Empty profile normalization');v.sort((a,b)=>a-b);return v[Math.floor(v.length/2)];};
export function makePhotoFields(s:PhotoSky,o:Pick<Observation,'pixelOf'|'rayAt'>,sources:Sources,n=1024,half=12):PhotoFields {
  // Bell contributes one scalar column budget, never its pixel pattern or holes.
  const bell=sources.dust,dx=2*bell.half/bell.n;let measured=0,proxy=0,count=0;
  for(let y=0;y<bell.n;y++)for(let x=0;x<bell.n;x++){
    const i=y*bell.n+x;if(!bell.mask[i])continue;const bx=-bell.half+(x+.5)*dx,by=-bell.half+(y+.5)*dx,p:V3=[bx,by,at(sources.warp,bx,by)],pixel=o.pixelOf(bodyToIcrs(p));if(!pixel||skySample(s,s.distance,...pixel)<18)continue;
    const d=normalize(add(p,mul(observer,-1))),v=skySample(s,s.rawDust,...pixel);if(v<=0)continue;measured+=bell.values[i]/Math.abs(d[2]);proxy+=v;count++;
  }
  need(count>100&&proxy>0,'Bell/photo overlap is too small');const dustScale=measured/proxy,skyMaps=Array.from({length:4},()=>new Float32Array(s.width*s.height)),tau=new Float32Array(s.width*s.height),profileRatios:number[]=[];
  let clipped=0,observed=0,splitError=0,splitPower=0,profileNumerator=0,profileDenominator=0;
  const fg=FOREGROUND_EBV*3.41/1.0857362047581296;
  for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++){
    const i=y*s.width+x;if(!s.valid[i])continue;const ray=rayInBody(o.rayAt(x+.5,y+.5)),plane=photoFootpoint(sources.warp,...add(ray.origin,mul(ray.direction,-ray.origin[2]/ray.direction[2]))),d=discSurface(Math.hypot(plane[0],plane[1])),b=barSurface(plane[0],plane[1]),fb=b/(d+b);
    tau[i]=Math.min(8,s.rawDust[i]*dustScale);const rgb:V3=[0,1,2].map(c=>s.rgb[i*3+c]*Math.exp(fg*EXTINCTION_RGB[c])) as V3,result=splitPixel(rgb,s.colors,tau[i],fb);
    const old=result.weights[0];skyMaps[0][i]=old*(1-fb);skyMaps[1][i]=old*fb;skyMaps[2][i]=result.weights[1];skyMaps[3][i]=result.weights[2];
    observed++;clipped+=Number(result.clipped);for(let c=0;c<3;c++){splitError+=(result.reconstructed[c]-rgb[c])**2;splitPower+=rgb[c]**2;}
    const r=Math.hypot(plane[0],plane[1]);if(s.distance[i]>4&&s.distance[i]<28&&r>2.8&&r<6){const prior=(d+b+outerSurface(r))/Math.abs(ray.direction[2]);profileRatios.push(prior>0?old/prior:0);profileNumerator+=old*prior;profileDenominator+=prior*prior;}
  }
  need(profileDenominator>0&&profileNumerator>0,'No measured boundary light for the paper continuation');const priorNormalization=profileNumerator/profileDenominator,maps=Array.from({length:5},()=>makeRaster(n,half));for(const m of maps)m.mask.fill(1);
  let used=0;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const i=y*n+x,bx=((x+.5)/n*2-1)*half,by=((y+.5)/n*2-1)*half,z=at(sources.warp,bx,by),p:V3=[bx,by,z],pixel=o.pixelOf(bodyToIcrs(p)),direction=normalize(add(p,mul(observer,-1))),r=Math.hypot(bx,by),priorD=priorNormalization*(discSurface(r)+outerSurface(r))/Math.abs(direction[2]),priorB=priorNormalization*barSurface(bx,by)/Math.abs(direction[2]);
    const w=pixel?smoothstep(skySample(s,s.distance,...pixel)/20):0;if(w>0)used++;
    for(let k=0;k<4;k++)maps[k].values[i]=w*(pixel?skySample(s,skyMaps[k],...pixel):0)+(1-w)*(k===0?priorD:k===1?priorB:0);
    maps[4].values[i]=w*(pixel?skySample(s,tau,...pixel):0);
  }
  return {maps,colors:s.colors,metadata:{...s.metadata,sourceGrid:[s.width,s.height],bodyGrid:[n,n],halfKpc:half,heightsSigmaKpc:HEIGHTS,
    thicknessStatus:{old:'Kacharov Gaussian model width',bar:'Kacharov Gaussian shape with assumed vertical ratio 0.23',young:'Conditional thin prior, 100 pc; not a measured height',gas:'Conditional thin prior, 100 pc; not a measured HII height',dust:'Conditional intermediate layer, half the old-disc width'},
    bell:{overlapSamples:count,meanObservedLosTauV:measured/count,meanRawPhotoProxy:proxy/count,oneGlobalScale:dustScale,spatialColumnsConsumed:false},priorNormalization,extension:'Paper Gaussian disc and count-normalized outskirts, plus the bar, at one boundary least-squares normalization, including zero-light samples. A 20-source-pixel smooth overlap removes the photo boundary; young, gas and dust outside the frame remain unsupported.',profileNormalizationSamples:profileRatios.length,usedBodyCells:used,
    split:{validPixels:observed,nonnegativeConeProjectionPixels:clipped,fractionOutsidePositiveCone:clipped/observed,relativeRgbReconstructionRms:Math.sqrt(splitError/splitPower),method:'One fixed 3 by 3 spectral inverse per observed pixel, negative-cone clipping and algebraic total-light conservation. No local optimization.'},
    geometry:'Each photo sample is de-tilted to the fixed Choi/Oden plane. Component light is distributed vertically about that warped plane, using different Gaussian heights. The maps stay fixed in disc coordinates; no observer-ray extrusion is used.',surveysSupplySpatialDetail:false},skyMaps:[...skyMaps,tau]};
}
export function makePhotoModel(fields:PhotoFields,sources:Sources):Model {
  const model=createModel(8,[1,2,3,4,5,6,7,8],{...sources,nativeStars:undefined}),sigmas=[HEIGHTS.old,HEIGHTS.bar,HEIGHTS.young,HEIGHTS.gas],sample=new Float64Array(5);
  model.sampleField=(x,y,z,out)=>{
    out.fill(0);if(Math.hypot(x,y)>20||Math.abs(z)>12)return;
    // Skip empty height without loading all component maps. Broad warp is retained.
    if(Math.abs(z-at(sources.warp,x,y))>3)return;
    const p:V3=[x,y,at(sources.warp,x,y)],zz=z-p[2],d=normalize([x-observer[0],y-observer[1],p[2]-observer[2]]),jacobian=Math.abs(d[2]);
    const map=fields.maps[0],fx=(p[0]/map.half+1)*map.n/2-.5,fy=(p[1]/map.half+1)*map.n/2-.5,i=Math.floor(fx),j=Math.floor(fy);
    if(i>=0&&j>=0&&i+1<map.n&&j+1<map.n){const u=fx-i,v=fy-j,ids=[j*map.n+i,j*map.n+i+1,(j+1)*map.n+i,(j+1)*map.n+i+1],w=[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v];for(let k=0;k<5;k++){sample[k]=0;for(let a=0;a<4;a++)sample[k]+=fields.maps[k].values[ids[a]]*w[a];}}
    else{const r=Math.hypot(p[0],p[1]),norm=numMetadata(fields.metadata.priorNormalization);sample[0]=norm*(discSurface(r)+outerSurface(r))/jacobian;sample[1]=norm*barSurface(p[0],p[1])/jacobian;sample[2]=sample[3]=sample[4]=0;}
    const slots=[0,3,9,12];for(let k=0;k<4;k++){const profile=jacobian*gaussian(zz,sigmas[k]),color=fields.colors[k<2?0:k-1];for(let c=0;c<3;c++)out[slots[k]+c]=sample[k]*color[c]*profile;}
    out[15]=sample[4]*jacobian*gaussian(zz,HEIGHTS.dust);
  };return model;
}
function numMetadata(v:unknown):number {need(typeof v==='number'&&Number.isFinite(v),'Invalid field normalization');return v;}
