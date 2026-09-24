import {numericRaster} from '../../../tools/objects/terrestrial-layers/source-records.mts';
import { array, dictionary, number, optional, shape, text, requireFiniteNumber, invertPreparedAffineMatrix4 } from '@cssearth/core';
import {required} from '../../../tools/contract/test-values.mts';
import type {GeoTIFFImage} from 'geotiff';
import assert from 'node:assert/strict';
import {readFile, type FileHandle} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,basename} from 'node:path';
import sharp from 'sharp';
import type { PathLike } from 'node:fs';

const root=resolve(import.meta.dirname,'../../..');
const contexts=new Map<string,ReturnType<typeof loadContext>>();
const asset=shape({bytes:number,sha256:text});
const manifestShape=shape({assets:array(shape({filename:text,bytes:number,sha256:text}))});
const materialShape=shape({surfaces:array(shape({id:text,surface:shape({url:text,bytes:number,sha256:text}),polesUrl:text,missingPixels:number,monochromePixels:optional(number),withheldSyntheticPixels:optional(number),
 sourceGeoreference:optional(shape({origin:array(number),resolution:array(number)})),
 photometry:optional(shape({observations:dictionary(shape({correctedPixels:number,withheldPixels:number}))})),
 observationCoverage:optional(dictionary(shape({pixels:number}))),
 layout:shape({width:number,height:number,gutter:number,packedWidth:number,packedHeight:number,bands:array(shape({height:number,packedY:number}))})}))});
const sceneShape=shape({bodyLeaves:array(shape({style:text,polar:optional(text),projectiveTextureLayer:shape({frameMatrix:text,textureMatrix:text,rasterScale:number})}))});
const json=async (path: PathLike|FileHandle):Promise<unknown>=>JSON.parse(await readFile(path,'utf8'));
const point=(m: number[],p: readonly number[],w: number)=>[0,1,2].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]*w);
const numbers=(value: string)=>value.split(' ').map(parseFloat);
export const canonicalPoint=(x: number,y: number,width: number,height: number)=>({longitude:(x+.5)/width*360,latitude:90-(y+.5)/height*180});

async function loadContext(body: string) {
    const directory=resolve(root,'src/objects',body);
    const material=materialShape(await json(resolve(directory,'prepared/material.json')));
    const scene=sceneShape(await json(resolve(directory,'prepared/scene.json')));
    const manifest=manifestShape(await json(resolve(directory,'runtime-assets.json')));
    const leaves=scene.bodyLeaves.map(leaf=>{
      const layer=leaf.projectiveTextureLayer;assert.ok(layer,'Use the actual retained projective texture frame');
      const matrix=required(leaf.style.match(/matrix3d\(([^)]+)\)/))[1].split(',').map(Number);
      const inverse=invertPreparedAffineMatrix4(layer.frameMatrix.split(',').map(Number));
      const texture=layer.textureMatrix.split(',').map(Number);
      const position=numbers(required(leaf.style.match(new RegExp(`--${body}-(?:surface|pole)-position:([^;]+)`)))[1]);
      const size=numbers(required(leaf.style.match(/background-size:([^;]+)/))[1]);
      const cssSize=['width','height'].map(key=>Number(required(leaf.style.match(new RegExp(`atlas-${key}:([\\d.]+)`)))[1]));
      return {...leaf,matrix,inverse,texture,position,size,cssSize,scale:layer.rasterScale};
    });
    return {material,manifest,leaves};
}
function context(body:string) {
 const existing=contexts.get(body);if(existing)return existing;
 const pending=loadContext(body);contexts.set(body,pending);return pending;
}

async function decode(body:string,url: string,manifest:ReturnType<typeof manifestShape>,expected?:ReturnType<typeof asset>) {
  assert.ok(url.startsWith(`/scenes/${body}/`));
  const entry=manifest.assets.find(asset=>asset.filename===basename(url));assert.ok(entry,`${url} belongs to the canonical runtime inventory`);
  const bytes=await readFile(resolve(root,'public',url.slice(1)));
  const sha=createHash('sha256').update(bytes).digest('hex');assert.equal(bytes.length,entry.bytes);assert.equal(sha,entry.sha256);
  if(expected){assert.equal(sha,expected.sha256);assert.equal(bytes.length,expected.bytes);}
  const image=await sharp(bytes).toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});
  return {...image,url};
}

export async function publishedObservation(body: string,id: string) {
  const {material,manifest,leaves}=await context(body),record=material.surfaces.find(surface=>surface.id===id);assert.ok(record);
  const atlas=await decode(body,record.surface.url,manifest,record.surface);
  const poles=await decode(body,record.polesUrl,manifest);
  assert.deepEqual([atlas.info.width,atlas.info.height],[record.layout.packedWidth,record.layout.packedHeight]);
  function sample(longitude: number,latitude: number) {
    const lon=((longitude%360)+360)%360,band=Math.max(0,Math.min(15,Math.floor((90-latitude)/180*16)));
    const leaf=band===0||band===15?leaves.find(l=>l.polar===(band===0?'north':'south'))
      :leaves[1+(14-band)*32+Math.floor(lon/360*32)];
    assert.ok(leaf,'Expected the geographic retained leaf');
    const phi=latitude*Math.PI/180,lambda=lon*Math.PI/180;
    // Source XYZ swaps X/Y in the actual PolyCSS carrier.
    const direction=[Math.cos(phi)*Math.sin(lambda),Math.cos(phi)*Math.cos(lambda),Math.sin(phi)];
    const o=point(leaf.inverse,[0,0,0],1),d=point(leaf.inverse,direction,0),t=-o[2]/d[2];assert.ok(t>0);
    const frame=[o[0]+t*d[0],o[1]+t*d[1]],denom=leaf.texture[15]/(1-leaf.texture[3]*frame[0]-leaf.texture[7]*frame[1]);
    const xy=frame.map(n=>n*denom/leaf.scale);
    assert.ok(xy.every((n,i)=>n>=-1e-5&&n<=leaf.cssSize[i]+1e-5),'Geographic point lies on its retained leaf');
    const image=leaf.polar?poles:atlas;
    const ax=Math.floor((xy[0]-leaf.position[0])*image.info.width/leaf.size[0]);
    const ay=Math.floor((xy[1]-leaf.position[1])*image.info.height/leaf.size[1]);
    assert.ok(ax>=0&&ax<image.info.width&&ay>=0&&ay<image.info.height);
    const local=[(ax+.5)*leaf.size[0]/image.info.width+leaf.position[0],(ay+.5)*leaf.size[1]/image.info.height+leaf.position[1],0];
    const m=leaf.matrix,w=m[3]*local[0]+m[7]*local[1]+m[15],p=point(m,local,1).map(n=>n/w);
    const latitudeAtPixel=Math.atan2(p[2],Math.hypot(p[0],p[1]))*180/Math.PI;
    const longitudeAtPixel=(Math.atan2(p[0],p[1])*180/Math.PI+360)%360;
    const offset=(ay*image.info.width+ax)*4;
    assert.equal(image.data[offset+3],255,'The sampled runtime texel is opaque');
    return {rgb:[...image.data.subarray(offset,offset+3)],longitude:longitudeAtPixel,latitude:latitudeAtPixel};
  }
  return {record,atlas,poles,sample};
}

/** Independent native-window oracle: reconstruct only the four canonical map
 * contributors to one actual retained atlas texel, never a whole source map. */
export const parseObservedSource=shape({path:text,lensId:text,projection:shape({referenceRadiusMeters:number})});
export const parseColorSource=shape({path:text,id:text,imageId:text,observation:text});
export async function expectedMonochromeTexel(image:GeoTIFFImage,entryInput:unknown,layout:{width:number;height:number},location:{longitude:number;latitude:number}) {
  const entry=parseObservedSource(entryInput);
  const origin=image.getOrigin(),resolution=image.getResolution(),radius=entry.projection.referenceRadiusMeters;
  const center=requireFiniteNumber(required(image.getGeoKeys()).ProjCenterLongGeoKey),middle=center+(origin[0]+image.getWidth()*resolution[0]/2)/radius*180/Math.PI;
  const mx=location.longitude/360*layout.width-.5,my=Math.max(0,Math.min(layout.height-1,(90-location.latitude)/180*layout.height-.5));
  const x0=Math.floor(mx),y0=Math.floor(my),fx=mx-x0,fy=my-y0;let value=0;
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
    const weight=(dx?fx:1-fx)*(dy?fy:1-fy);if(!weight)continue;
    const x=(x0+dx+layout.width)%layout.width,y=Math.min(layout.height-1,y0+dy),p=canonicalPoint(x,y,layout.width,layout.height);
    const lon=p.longitude+360*Math.round((middle-p.longitude)/360);
    const sx=((lon-center)*Math.PI/180*radius-origin[0])/resolution[0]-.5;
    const sy=(p.latitude*Math.PI/180*radius-origin[1])/resolution[1]-.5;
    const ix=Math.floor(sx),iy=Math.floor(sy);assert.ok(ix>=0&&iy>=0&&ix+1<image.getWidth()&&iy+1<image.getHeight());
    const cells=numericRaster(await image.readRasters({window:[ix,iy,ix+2,iy+2],interleave:true}));assert.equal(cells.length,4);
    assert.ok([...cells].every(v=>v!==image.getGDALNoData()),'Every native interpolation contributor is observed');
    const u=sx-ix,v=sy-iy;
    value+=Math.round(cells[0]*(1-u)*(1-v)+cells[1]*u*(1-v)+cells[2]*(1-u)*v+cells[3]*u*v)*weight;
  }
  return Math.round(value);
}

// This guards a terminal quality-90 WebP display, not source-value precision.
// Native coordinate and missing-contributor rules are checked independently.
export function assertDisplayClose(actual:readonly number[],expected: readonly number[],message: string) {
  assert.ok(actual.every((n: number,i: number)=>Math.abs(n-expected[i])<=8),`${message}: ${actual} vs ${expected}`);
}

export function countInteriorPixels(surface:Awaited<ReturnType<typeof publishedObservation>>,predicate:(r:number,g:number,b:number)=>boolean,firstBand=1,lastBand=14) {
  const {layout}=surface.record,{data,info}=surface.atlas;let count=0;
  for(const [index,band]of layout.bands.entries())if(index>=firstBand&&index<=lastBand)
    for(let y=0;y<band.height;y++)for(let x=0;x<layout.width;x++){
      const i=((band.packedY+y)*info.width+layout.gutter+x)*4;
      if(predicate(data[i],data[i+1],data[i+2]))count++;
    }
  return count;
}
