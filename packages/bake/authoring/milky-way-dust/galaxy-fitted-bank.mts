/** Opt-in model adapter for the locked galaxy slab pipeline. All fitting scores decoded runtime pixels. */
import {hybridOpticalOpacity} from '@cssearth/core';
import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {type VolumeOpticalRole} from '@cssearth/objects';
import {mergedAlpha} from './galaxy-merged-copies.mts';
import {slabDomain,type GalaxySlabDomain} from './galaxy-slab-domain.mts';
export type Triple=[number,number,number];
export interface GalaxyBankBox {min:Triple;max:Triple;}
export interface GalaxyPlane {axis:0|1|2;index:number;center:number;width:number;height:number;rgb:Float64Array;tau:Float64Array;}
export interface GalaxyBankFit {rgb:Triple;gamma:number;dust:number;emissionOpacity?:number;}
export interface GalaxyBankSpec {box:GalaxyBankBox;counts:Triple;size:number;record:string;texturePrefix:string;hybrid?:{densePerAxis:Triple};}
export interface GalaxyDecodedPlane extends Omit<GalaxyPlane,'rgb'|'tau'> {rgba:Uint8Array;border?:number;opticalRole?:VolumeOpticalRole;}
export const IDENTITY_BANK_FIT:GalaxyBankFit={rgb:[1,1,1],gamma:1,dust:1};
function requireValue(value:unknown,message:string):asserts value {if(!value)throw new TypeError(message);}
export function bankSpec(spec:GalaxyBankSpec):GalaxyBankSpec {
 requireValue(spec.box.min.every((v,a)=>Number.isFinite(v)&&Number.isFinite(spec.box.max[a])&&v<spec.box.max[a]!)&&spec.counts.every((n,a)=>Number.isSafeInteger(n)&&n>0&&n<=[13,13,7][a]!)&&spec.counts.reduce((a,b)=>a+b)<=33,'A fitted galaxy bank must use at most 13/13/7 slabs');
 if(spec.hybrid)requireValue(spec.hybrid.densePerAxis.every((n,a)=>Number.isSafeInteger(n)&&n>=0&&n<=spec.counts[a]!)&&spec.counts.reduce((a,b)=>a+b)+spec.hybrid.densePerAxis.reduce((a,b)=>a+b)<=33,'Hybrid galaxy exceeds 33 optical layers');
 requireValue(Number.isSafeInteger(spec.size)&&spec.size>=16&&spec.size<=2048&&/^[a-z0-9-]+$/u.test(spec.texturePrefix)&&spec.record.length>0,'Invalid fitted galaxy bank identity');return spec;
}
export function planeLayout(spec:GalaxyBankSpec,axis:0|1|2,index:number){
 bankSpec(spec);requireValue(Number.isSafeInteger(index)&&index>=0&&index<spec.counts[axis],'Invalid slab index');
 const h=axis===0?1:0,v=axis===2?1:2,pitch=(spec.box.max[axis]-spec.box.min[axis])/spec.counts[axis],min=spec.box.min[axis]+index*pitch,max=min+pitch;
 return{axis,index,center:(min+max)/2,width:spec.size,height:Math.max(4,Math.round(spec.size*(spec.box.max[v]-spec.box.min[v])/(spec.box.max[h]-spec.box.min[h]))),domain:slabDomain(axis,min,max)};
}
/** Physical coordinates, image top and pixel area match galaxy-slices.mts exactly. */
export function planeCamera(spec:GalaxyBankSpec,layout:ReturnType<typeof planeLayout>){
 const {axis,width,height}=layout,h=axis===0?1:0,v=axis===2?1:2,area=(spec.box.max[h]-spec.box.min[h])*(spec.box.max[v]-spec.box.min[v])/(width*height);
 return{name:'local-galaxy-'+axis,width,height,foreground:false,areaAt:()=>area,pixelOf:(p:Triple):[number,number]=>[(p[h]-spec.box.min[h])/(spec.box.max[h]-spec.box.min[h])*width,(spec.box.max[v]-p[v])/(spec.box.max[v]-spec.box.min[v])*height],ray(x:number,y:number){
  const origin:Triple=[0,0,0],direction:Triple=[0,0,0];origin[axis]=50;origin[h]=spec.box.min[h]+x/width*(spec.box.max[h]-spec.box.min[h]);origin[v]=spec.box.max[v]-y/height*(spec.box.max[v]-spec.box.min[v]);direction[axis]=-1;return{origin,direction};
 }};
}
function encodeSrgb(x:number):number {return x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055;}
export function encodeGalaxyPlane(plane:GalaxyPlane,fit:GalaxyBankFit,merge=true):GalaxyDecodedPlane {
 requireValue(fit.rgb.every(v=>Number.isFinite(v)&&v>=.001&&v<=20)&&fit.gamma>=.25&&fit.gamma<=4&&fit.dust>=.01&&fit.dust<=4,'Fitted slab material exceeded its declared bounds');
 requireValue(fit.emissionOpacity===undefined||Number.isFinite(fit.emissionOpacity)&&fit.emissionOpacity>=0&&fit.emissionOpacity<=16,'Invalid local display-opacity encoding');
 requireValue(plane.rgb.length===plane.width*plane.height*3&&plane.tau.length===plane.width*plane.height,'Incomplete local slab projection');
 const rgba=new Uint8Array(plane.width*plane.height*4);
 for(let p=0;p<plane.tau.length;p++){
  requireValue(Number.isFinite(plane.tau[p])&&plane.tau[p]!>=0,'Nonfinite or negative local optical depth');
  const color:Triple=[0,0,0];for(let c=0;c<3;c++){const value=plane.rgb[p*3+c]!;requireValue(Number.isFinite(value)&&value>=0,'Nonfinite or negative local emission');color[c]=Math.min(1,fit.rgb[c]*encodeSrgb(value)**fit.gamma);}
  // A scalar display opacity approximates the reference's concave post-sum tone.
  // It is tied to this interval's own light, never a completed image or a dust-column adjustment.
  const alpha=Math.min(1,Math.max(...color,-Math.expm1(-Math.max(0,plane.tau[p]!)*fit.dust-Math.max(...color)*(fit.emissionOpacity??0))));
  for(let c=0;c<3;c++)rgba[p*4+c]=alpha>0?Math.round(color[c]/alpha*255):0;
  const byte=Math.round(alpha*255);rgba[p*4+3]=merge?mergedAlpha(byte):byte;
 }
 return{axis:plane.axis,index:plane.index,center:plane.center,width:plane.width,height:plane.height,rgba};
}
export interface GalaxyRayCamera {width:number;height:number;ray(x:number,y:number):{origin:Triple;direction:Triple};}
function texel(p:GalaxyDecodedPlane,u:number,v:number):number[]{
 const x=u*p.width-.5,y=v*p.height-.5,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,out=[0,0,0,0];
 // Bilinear filtering uses premultiplied texels, as image sampling does in the compositor.
 for(let b=0;b<2;b++)for(let a=0;a<2;a++){
  const xx=ix+a,yy=iy+b;if(xx<0||yy<0||xx>=p.width||yy>=p.height)continue;
  const i=(yy*p.width+xx)*4,alpha=p.rgba[i+3]!/255,w=(a?fx:1-fx)*(b?fy:1-fy);out[3]+=alpha*w;
  for(let c=0;c<3;c++)out[c]+=p.rgba[i+c]!/255*alpha*w;
 }return out;
}
/** One complete stack on its black matte, using the retained merged-copy opacity and 8-bit source-over. */
export function compositeGalaxyStack(planes:readonly GalaxyDecodedPlane[],box:GalaxyBankBox,camera:GalaxyRayCamera,axis:0|1|2,merged=true):Float64Array {
 const out=new Float64Array(camera.width*camera.height*3),bank=planes.filter(p=>p.axis===axis),h=axis===0?1:0,v=axis===2?1:2;
 const centre=camera.ray(camera.width/2,camera.height/2).direction,cosine=Math.abs(centre[axis])/Math.hypot(...centre);if(cosine<1e-8)return out;
 const gain=Math.min(3,Math.max(1,1/cosine)),opacity=merged?Math.min(.999,Math.max(.001,Math.round(gain/3*255)/255)):1;
 for(let y=0;y<camera.height;y++)for(let x=0;x<camera.width;x++){
  const ray=camera.ray(x+.5,y+.5);
  const hits=bank.map(p=>({p,t:(p.center-ray.origin[axis])/ray.direction[axis]})).filter(h=>h.t>0).sort((a,b)=>b.t-a.t),rgb=[0,0,0];
  for(const hit of hits){const u=(ray.origin[h]+ray.direction[h]*hit.t-box.min[h])/(box.max[h]-box.min[h]),vv=(box.max[v]-ray.origin[v]-ray.direction[v]*hit.t)/(box.max[v]-box.min[v]);if(u<0||u>1||vv<0||vv>1)continue;const border=hit.p.border??0,q=texel(hit.p,(u*(hit.p.width-2*border)+border)/hit.p.width,(vv*(hit.p.height-2*border)+border)/hit.p.height),leafOpacity=hit.p.opticalRole?hybridOpticalOpacity(hit.p.opticalRole,gain):opacity,alpha=q[3]!*leafOpacity;
   if(merged)for(let c=0;c<3;c++)rgb[c]=Math.round((rgb[c]!*(1-alpha)+q[c]!*leafOpacity)*255)/255;
   else for(let copy=0;copy<3;copy++){const a=Math.min(.999,Math.max(0,gain-copy));for(let c=0;c<3;c++)rgb[c]=Math.round((rgb[c]!*(1-q[3]!*a)+q[c]!*a)*255)/255;}
  }
  for(let c=0;c<3;c++)out[(y*camera.width+x)*3+c]=Math.round(rgb[c]!*.999*255)/255;
 }return out;
}
/** Allocate the extra layers by the normal-incidence loss of the source's own alpha. */
export function selectDenseSlabs(planes:readonly GalaxyPlane[],spec:GalaxyBankSpec):Set<string>{
 const selected=new Set<string>();if(!spec.hybrid)return selected;
 for(const axis of [0,1,2] as const){
  const candidates=planes.filter(p=>p.axis===axis).map(p=>{const rgba=encodeGalaxyPlane(p,IDENTITY_BANK_FIT,false).rgba;let loss=0;for(let i=3;i<rgba.length;i+=4)loss+=rgba[i]!/255-mergedAlpha(rgba[i]!)/765;return{key:axis+':'+p.index,loss};}).sort((a,b)=>b.loss-a.loss||a.key.localeCompare(b.key));
  for(const entry of candidates.slice(0,spec.hybrid.densePerAxis[axis]))selected.add(entry.key);
 }return selected;
}
/** The original and pair keep identical RGB and geometry. Only their prepared alpha differs. */
export function hybridGalaxyPlanes(planes:readonly GalaxyPlane[],fits:readonly GalaxyBankFit[],dense:ReadonlySet<string>):GalaxyDecodedPlane[]{
 const output:GalaxyDecodedPlane[]=[];
 for(const p of planes){
  const original=encodeGalaxyPlane(p,fits[p.axis]!,false),split=dense.has(p.axis+':'+p.index);
  if(split){output.push({...original,opticalRole:'single'});const pair=original.rgba.slice();for(let i=3;i<pair.length;i+=4)pair[i]=Math.floor((1-(1-pair[i]!/255)**2)*255);output.push({...original,rgba:pair,opticalRole:'merged-two'});}
  else output.push({...encodeGalaxyPlane(p,fits[p.axis]!),opticalRole:'merged-three'});
 }return output;
}
export async function writeGalaxyModelBank(directory:string,spec:GalaxyBankSpec,planes:readonly GalaxyPlane[],fits:readonly GalaxyBankFit[],dense=selectDenseSlabs(planes,spec)){
 bankSpec(spec);requireValue(fits.length===3&&planes.length===spec.counts.reduce((a,b)=>a+b),'Incomplete fitted galaxy bank');const leaves=[];
 const encoded=spec.hybrid?hybridGalaxyPlanes(planes,fits,dense):planes.map(p=>encodeGalaxyPlane(p,fits[p.axis]!));
 for(const image of encoded){const axis='xyz'[image.axis]!,suffix=image.opticalRole==='merged-two'?'-pair':'',path=axis+'/'+String(image.index).padStart(3,'0')+suffix+'.png';await mkdir(directory+axis,{recursive:true});
  await sharp(image.rgba,{raw:{width:image.width,height:image.height,channels:4}}).extend({top:3,bottom:3,left:3,right:3,background:{r:0,g:0,b:0,alpha:0}}).png({compressionLevel:9}).toFile(directory+path);
  const h=image.axis===0?1:0,v=image.axis===2?1:2,dx=(spec.box.max[h]-spec.box.min[h])/image.width,dy=(spec.box.max[v]-spec.box.min[v])/image.height;
  leaves.push({axis,index:image.index,center:image.center,texturePath:path,width:image.width+6,height:image.height+6,imageBounds:[spec.box.min[h]-3*dx,spec.box.max[h]+3*dx,spec.box.min[v]-3*dy,spec.box.max[v]+3*dy],...(image.opticalRole?{opticalSlab:{id:axis+'-'+image.index,role:image.opticalRole}}:{})});
 }
 const box=spec.box,prototype={field:{box:box.min.flatMap((v,a)=>[v,box.max[a]]),record:spec.record,dims:[spec.size,spec.size,Math.round(spec.size*(box.max[2]-box.min[2])/(box.max[0]-box.min[0]))]},counts:spec.counts,leaves,gain:1,completedImageOpacity:1,slabLocalTransfer:true,mergedOpticalCopies:3,bakeControls:{modelAdapter:'local-galaxy-model@1',texturePrefix:spec.texturePrefix},rows:[{samplesPerSlab:1}],fits};
 await writeFile(directory+'prototype.json',JSON.stringify(prototype,null,2)+'\n');return prototype;
}
export type LocalSlabProjection=(domain:GalaxySlabDomain,camera:ReturnType<typeof planeCamera>)=>Promise<{rgb:Float64Array;tau:Float64Array}>;
export async function projectGalaxyBank(spec:GalaxyBankSpec,project:LocalSlabProjection):Promise<GalaxyPlane[]>{
 bankSpec(spec);const planes:GalaxyPlane[]=[];
 for(const axis of [0,1,2] as const)for(let index=0;index<spec.counts[axis];index++){
  const layout=planeLayout(spec,axis,index),projection=await project(layout.domain,planeCamera(spec,layout));planes.push({...layout,...projection});
 }
 return planes;
}
