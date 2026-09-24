import { sha256 } from '../../../src/platform/sha256.mts';
import { writeLossyWebp } from '../../../src/preparation/raster/lossy-lane.ts';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { requireFiniteNumber, requireRecord } from '@cssearth/core';
import { missingCoverageColor } from '../../../src/platform/prepare-missing-coverage.mts';
import type { PreparedTriangle } from './contracts.mts';
import { BASE_TILE } from '@layoutit/polycss';
import { loadNativePhotograph } from './native-photograph-source.mts';



export interface NativePhotographicSampling { samplesPerAxis: number; }
export function parseNativePhotographicSampling(value: unknown): NativePhotographicSampling {
  const record = requireRecord(value);
  const samplesPerAxis = requireFiniteNumber(record.samplesPerAxis);
  if (![1, 2, 3, 4].includes(samplesPerAxis)) throw new TypeError(`Native photographic sampling requires 1–4 samples per axis; got ${samplesPerAxis}.`);
  if ('quality' in record) throw new TypeError('nativePhotographicSampling.quality is no longer read; its files are encoded in the lossy lane (src/preparation/raster/lossy-lane.ts). Remove it from the recipe.');
  return {samplesPerAxis};
}

/** Subsample the existing CSS leaf-to-body transform, without changing it. */
export function samplePhotographicTexel(sampler: Awaited<ReturnType<typeof loadNativePhotograph>>, matrix: readonly number[],
  x: number, y: number, step: number, samplesPerAxis: number, color: number[]): boolean {
  color[0]=color[1]=color[2]=0;
  const sample=[0,0,0];
  for(let dy=0;dy<samplesPerAxis;dy++)for(let dx=0;dx<samplesPerAxis;dx++) {
    const px=x+(dx+.5)/samplesPerAxis*step, py=y+(dy+.5)/samplesPerAxis*step;
    const w=matrix[3]*px+matrix[7]*py+matrix[15];
    const cx=(matrix[0]*px+matrix[4]*py+matrix[12])/w, cy=(matrix[1]*px+matrix[5]*py+matrix[13])/w, cz=(matrix[2]*px+matrix[6]*py+matrix[14])/w;
    if(!sampler.sample(Math.atan2(cx,cy)*180/Math.PI,Math.atan2(cz,Math.hypot(cx,cy))*180/Math.PI,sample))return false;
    for(let c=0;c<3;c++)color[c]+=sample[c];
  }
  for(let c=0;c<3;c++)color[c]/=samplesPerAxis*samplesPerAxis;
  return true;
}

export interface PhotographicAtlas {
  width: number; height: number;
  plans: readonly {face: PreparedTriangle; rect: {x:number;y:number;width:number;height:number}; matrix: readonly number[]; geometry: {leafWidth:number;leafHeight:number}}[];
}

/** Repaint the existing atlas rectangles and exactly the existing lighting model. */
export async function prepareNativePhotographicAtlas({radial,sourceDirectory,source,validity,sampling,publicDirectory,publicBase,id,sunDirection,mapWidth}: {
  radial:PhotographicAtlas; sourceDirectory:string; source:unknown; validity:unknown; sampling:NativePhotographicSampling;
  publicDirectory:string; publicBase:string; id:string; sunDirection:readonly number[]; mapWidth:number;
}) {
  const sampler=await loadNativePhotograph(sourceDirectory,source,validity);
  const {width,height}=radial;
  if (![width,height].every(n=>Number.isSafeInteger(n)&&n>0) || width>16383 || height>16383 ||
    sunDirection.length!==3 || !sunDirection.every(Number.isFinite)) throw new TypeError('Invalid retained photographic atlas.');
  const flood=Buffer.alloc(width*height*4),shadow=Buffer.alloc(width*height*4),color=[0,0,0];
  let missingTexels=0;
  for(const {face,rect,matrix:m,geometry} of radial.plans) {
    if(face.estimated || m.length!==16 || !m.every(Number.isFinite) || geometry.leafWidth!==rect.width || geometry.leafHeight!==rect.height ||
      rect.x<0 || rect.y<0 || rect.x+rect.width>width || rect.y+rect.height>height) throw new Error('Native photograph requires unchanged, measured atlas faces.');
    const [a,b,c]=face.vertices,ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
    const aa=ab.reduce((v,n,i)=>v+n*ab[i],0),bb=ac.reduce((v,n,i)=>v+n*ac[i],0),abac=ab.reduce((v,n,i)=>v+n*ac[i],0),denominator=aa*bb-abac*abac;
    for(let py=0;py<rect.height;py++)for(let px=0;px<rect.width;px++) {
      const x=px+.5,y=py+.5,w=m[3]*x+m[7]*y+m[15];
      const cx=(m[0]*x+m[4]*y+m[12])/w,cy=(m[1]*x+m[5]*y+m[13])/w,cz=(m[2]*x+m[6]*y+m[14])/w;
      const ap=[cy/BASE_TILE-a[0],cx/BASE_TILE-a[1],cz/BASE_TILE-a[2]];
      const apab=ap.reduce((v,n,i)=>v+n*ab[i],0),apac=ap.reduce((v,n,i)=>v+n*ac[i],0);
      const u=(apab*bb-apac*abac)/denominator,v=(apac*aa-apab*abac)/denominator;
      const normal=face.vertexNormals[0].map((n,i)=>n*(1-u-v)+face.vertexNormals[1][i]*u+face.vertexNormals[2][i]*v);
      const length=Math.hypot(...normal),illumination=.12+.88*Math.max(0,normal.reduce((s,n,i)=>s+n/length*sunDirection[i],0));
      const observed=samplePhotographicTexel(sampler,m,px,py,1,sampling.samplesPerAxis,color);
      if(!observed) {
        missingTexels++;
        const missing=missingCoverageColor(Math.atan2(cx,cy)*180/Math.PI,Math.atan2(cz,Math.hypot(cx,cy))*180/Math.PI,360/mapWidth);
        color[0]=missing[0];color[1]=missing[1];color[2]=missing[2];
      }
      const offset=((rect.y+py)*width+rect.x+px)*4;
      for(let channel=0;channel<3;channel++) {
        flood[offset+channel]=Math.round(color[channel]);
        shadow[offset+channel]=Math.round(Math.round(color[channel])*illumination);
      }
      flood[offset+3]=shadow[offset+3]=255;
    }
  }
  const emit=async (suffix:string,pixels:Buffer)=>{
    const filename=`${id}-${suffix}@2x.webp`;
    // Each photograph and its shaded copy is written in the lossy lane (lossy-lane.ts).
    const bytes=await writeLossyWebp(sharp(pixels,{raw:{width,height,channels:4}}),resolve(publicDirectory,filename),{alphaQuality:100,effort:4});
    return {url:publicBase+filename,width,height,bytes:bytes.length,sha256:sha256(bytes)};
  };
  const surface=await emit('surface',flood),shadowSurface=await emit('shadow',shadow);
  return {surface,shadowSurface,polesUrl:surface.url,layout:{kind:'triangle-atlas',width,height,faceCount:radial.plans.length},
    nativeSampling:{method:'published-grid-bilinear-texel-footprint',...sampling,sourceWidth:sampler.width,sourceHeight:sampler.height,missingTexels,includesAtlasBleed:true}};
}
