/** Local path pilot: source b30 radiance, NASA detail only as the observer approaches its measured location. */
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { parseDensityVolumeFrame,encodeCloudPatches,parsePreparedGalaxyStations,parseGalaxyStationSky,type Vector3 } from '@cssearth/objects';
import { packPreparedBank } from '@cssearth/objects/node';
import { cameraPoseToReferenceFrame } from '@cssearth/engine';
import { compileCssSky, SKY_BASES, type BakedSkyFace, skyRay } from '@cssearth/bake/sky';
import { writeLossyWebp } from '@cssearth/bake/raster';

const W=1024,H=512,G=[[-.0548755604162154,-.873437090234885,-.4838350155487132],[.4941094278755837,-.4448296299600112,.7469822444972189],[-.8676661490190047,-.1980763734312015,.4559837761750669]];
const luma=(v:readonly number[])=>.2126*v[0]!+.7152*v[1]!+.0722*v[2]!;
const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
function sample(a:ArrayLike<number>,x:number,y:number,c:number){x=(x%W+W)%W;y=Math.max(0,Math.min(H-1,y));const ix=Math.floor(x),iy=Math.floor(y),ax=x-ix,ay=y-iy,p=(xx:number,yy:number)=>a[(Math.min(H-1,yy)*W+xx%W)*3+c]!;return(p(ix,iy)*(1-ax)+p(ix+1,iy)*ax)*(1-ay)+(p(ix,iy+1)*(1-ax)+p(ix+1,iy+1)*ax)*ay;}
function tone(v:number[],exposure:number){const rgb=v.map(x=>x*exposure),peak=Math.max(...rgb),s=peak>.6?(.6+.4*(-Math.expm1(-(peak-.6)/.4)))/peak:1;const d=rgb.map(x=>{const c=Math.min(1,x*s);return c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055;});return d.map(x=>x*.12*.9362278639871702*smooth((luma(d)-.04)/.08));}
function floats(b:Buffer){if(b.length!==W*H*3*4)throw Error('Radiance dimensions');const a=new Float32Array(W*H*3);for(let i=0;i<a.length;i++){const v=b.readFloatLE(i*4);if(!Number.isFinite(v)||v<0)throw Error('Invalid radiance');a[i]=v;}return a;}
function vec(v:unknown):Vector3{if(!Array.isArray(v)||v.length!==3||v.some(n=>typeof n!=='number'||!Number.isFinite(n)))throw Error('Position');return[v[0],v[1],v[2]];}
type Job={id:string;ly:number;positionKpc:Vector3};
function jobs(v:unknown):Job[]{if(!Array.isArray(v))throw Error('Jobs');return v.map(v=>{if(!v||typeof v!=='object'||!('id'in v)||typeof v.id!=='string'||!/^path-[a-z0-9-]+$/.test(v.id)||!('ly'in v)||typeof v.ly!=='number'||!Number.isFinite(v.ly)||!('positionKpc'in v))throw Error('Job');return{id:v.id,ly:v.ly,positionKpc:vec(v.positionKpc)};});}
export async function preparePathSkies({objectDirectory,inputDirectory,plan,tuner,frame,pilot=false,only}: {
 objectDirectory:string;inputDirectory:string;plan:unknown;tuner:unknown;frame:ReturnType<typeof parseDensityVolumeFrame>;pilot?:boolean;only?:readonly string[];
}) {
 if(!plan||typeof plan!=='object'||!('sun'in plan)||!('sgr'in plan))throw new TypeError('Invalid sky plan');
 const base=resolve(objectDirectory,'prepared/galaxy-stations');
 const all=[...jobs(plan.sun),...jobs(plan.sgr)],selected=pilot?all.slice(-1):only?all.filter(j=>only.includes(j.id)):all;
 const sun=floats(await readFile(resolve(inputDirectory,'panoramas/path-sun-0.f32')));
const nasa=await Promise.all(SKY_BASES.map(async b=>{const {data,info}=await sharp(resolve(inputDirectory,'nasa/'+b.id+'.webp')).removeAlpha().raw().toBuffer({resolveWithObject:true});return{...b,data,width:info.width,height:info.height};}));
const blur=await sharp(resolve(inputDirectory,'nasa/low.png')).blur(1.75).removeAlpha().raw().toBuffer();
function nasaAt(gal:Vector3){const l=Math.atan2(gal[1],gal[0])-.088*Math.PI/180,b=Math.asin(gal[2])+.088*Math.PI/180,shift=[Math.cos(b)*Math.cos(l),Math.cos(b)*Math.sin(l),Math.sin(b)];
 const ray=[0,1,2].map(i=>shift.reduce((s,v,j)=>s+v*G[j]![i]!,0)),axis=ray.map(Math.abs).indexOf(Math.max(...ray.map(Math.abs))),f=nasa[axis*2+(ray[axis]!<0?1:0)]!,dot=(v:Vector3)=>v.reduce((s,v,i)=>s+v*ray[i]!,0),z=dot(f.forwardIcrf),x=Math.max(0,Math.min(f.width-1,(dot(f.rightIcrf)/z+1)*f.width/2-.5)),y=Math.max(0,Math.min(f.height-1,(1-dot(f.upIcrf)/z)*f.height/2-.5)),ix=Math.floor(x),iy=Math.floor(y),ax=x-ix,ay=y-iy;
 return [0,1,2].map(c=>{const p=(xx:number,yy:number)=>f.data[(Math.min(f.height-1,yy)*f.width+Math.min(f.width-1,xx))*3+c]!/255*.972;return(p(ix,iy)*(1-ax)+p(ix+1,iy)*ax)*(1-ay)+(p(ix,iy+1)*(1-ax)+p(ix+1,iy+1)*ax)*ay;});}
const receipts=[],bindings=[];
for(const job of selected){const isSun=job.id.startsWith('path-sun-'),file=resolve(inputDirectory,'panoramas/'+job.id+'.f32'),a=floats(await readFile(file));
 // Eye/camera adaptation: hold median linear luminance at 18% where that requires less than the Sun exposure.
 // The shoulder and final display gain remain identical; exposure is fixed per prepared station, never runtime metering.
 const sorted=Array.from({length:W*H},(_,i)=>luma([a[i*3]!,a[i*3+1]!,a[i*3+2]!])).sort((a,b)=>a-b),median=sorted[sorted.length>>1]!;
 const adapted=!isSun&&job.id.startsWith('path-sgr-');const exposure=adapted?Math.min(4.5,.18/Math.max(median,1e-12)):4.5;
 const size=isSun?(job.ly===0?1536:job.ly<=300?1024:job.ly<=1000?512:256):256;
 const postGain=isSun&&job.ly<=300?.16:.12;
 const destination=base+'/'+job.id;await mkdir(destination,{recursive:true});const faces:BakedSkyFace[]=[];
 let total=0,area=0,min=1,max=0,bytes=0;const detail=smooth(1-job.ly/2000);
 for(const basis of SKY_BASES){const pixels=Buffer.alloc(size*size*3);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const ray=skyRay(basis,2*(x+.5)/size-1,1-2*(y+.5)/size),gal=G.map(row=>row.reduce((s,v,i)=>s+v*ray[i]!,0)) as Vector3,l=Math.atan2(gal[1],gal[0]),b=Math.asin(gal[2]),px=(.5-l/(2*Math.PI))*W,py=(.5-b/Math.PI)*(H-1);
   let rgb=tone([0,1,2].map(c=>sample(a,px,py,c)),exposure);
   if(isSun&&detail>0){const n=nasaAt(gal),low=[0,1,2].map(c=>sample(blur,px+.088/360*W,py-.088/180*(H-1),c)/255*.972),s=tone([0,1,2].map(c=>sample(sun,px,py,c)),4.5);
    rgb=rgb.map((v,c)=>Math.max(0,v+detail*(n[c]!-low[c]!)+detail**3*(low[c]!-s[c]!)));}
   const lum=luma(rgb),u=2*(x+.5)/size-1,v=2*(y+.5)/size-1,w=(1+u*u+v*v)**-1.5;total+=w*lum;area+=w;min=Math.min(min,lum);max=Math.max(max,lum);
   for(let c=0;c<3;c++)pixels[(y*size+x)*3+c]=Math.round(255*Math.min(1,rgb[c]!/postGain));
  }
  const name=basis.id+'.webp',encoded=await writeLossyWebp(sharp(pixels,{raw:{width:size,height:size,channels:3}}),destination+'/'+name);bytes+=encoded.length;
  const vertices=([[-1,1],[1,1],[1,-1],[-1,-1]] as const).map(([u,v]):Vector3=>basis.forwardIcrf.map((f,i)=>f+u*basis.rightIcrf[i]!+v*basis.upIcrf[i]!) as Vector3);
  faces.push({...basis,vertices,uvs:[[0,0],[1,0],[1,1],[0,1]],texturePath:name,widthPx:size,heightPx:size,bytes:encoded.length});
 }
 const sky=compileCssSky({faces,provenance:{source:'source/b30-inputs/panoramas/'+job.id+'.f32.gz',exposure,adaptation:adapted?'median linear luminance to 0.18, exposure capped at 4.5':'NASA anchored fixed 4.5',nasa:detail?{gain:.972,longitudeOffsetDeg:-.088,latitudeOffsetDeg:.088,detailSigmaDeg:1.75*360/1024,detailWeight:detail,lowFrequencyWeight:detail**3}:null},approximation:{kind:'whole-sky-position-station',nearClouds:'All b30 light included; no duplicate local clouds',faceSize:size,limitation:'b30 central 80 pc cells do not resolve the nuclear cluster'}},frame);
 await writeFile(destination+'/sky.json',JSON.stringify({...sky,imageOpacity:postGain,exposureOpacity:.16*exposure/4.5}));
 await sharp({create:{width:1,height:1,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).webp({lossless:true}).toFile(destination+'/empty.webp');
 await writeFile(destination+'/clouds.bin',packPreparedBank(encodeCloudPatches({id:job.id,frame,count:0,atlas:{file:'empty.webp',width:1,height:1},cellPx:1,matrices:new Float32Array(),cells:new Uint16Array()}),job.id));
 const positionM=cameraPoseToReferenceFrame({positionM:job.positionKpc.map(v=>v*frame.metersPerUnit) as Vector3,orientationXyzw:[0,0,0,1]},frame).positionM;
 bindings.push({id:job.id,positionM,sky:job.id+'/sky.json',clouds:job.id+'/clouds.bin'});receipts.push({id:job.id,ly:job.ly,source:file,exposure,postGain,medianLinear:median,faceSize:size,downloadBytes:bytes,decodedBytes:size*size*6*4,meanDisplayLuminance:total/area,range:[min,max],detailWeight:detail});console.log('SKY BAKED',job.id,JSON.stringify(receipts.at(-1)));
}
if(!pilot){const index=parsePreparedGalaxyStations(tuner);await writeFile(base+'/tuner.json',JSON.stringify(index)+'\n');}
console.log('PATH SKY BAKE VERIFIED',selected.length,pilot?'PILOT':'INSTALLED');
return receipts;
}
