import type {ObservedRgb} from './giant-observations/polar-continuation.mts';
export interface CoveredRgb extends ObservedRgb {missing: Uint8Array;}
export interface MeasuredPolarOptions {projection: 'latitude-linear' | 'orthographic'; boundaryLatitudeDegrees: number; overlap?: number; alphaOpaqueRadius?: number; alphaTransparentRadius?: number;}
import { blackFillCoverage, paintMissingCoverage } from '@cssearth/bake/raster';

/** Conservative coverage for display maps with opaque, exact-zero polar fill.
 * Isolated black terrain and every nonzero sample remain observations. */
export function polarZeroCoverage(data: Uint8Array, info: ObservedRgb['info']) {
  return blackFillCoverage(data, info, { northConnected: true, southConnected: true });
}

function bilinear(source: ObservedRgb & {missing?: Uint8Array}, x: number, y: number, respectCoverage: boolean) {
  if (respectCoverage && !source.missing) throw new TypeError('Measured interpolation requires coverage.');
  const { width, height, channels } = source.info;
  const fx = Math.floor(x), x0 = ((fx % width) + width) % width, x1 = (x0 + 1) % width;
  const cy = Math.max(0, Math.min(height - 1, y)), y0 = Math.floor(cy), y1 = Math.min(height - 1, y0 + 1);
  const u = x - fx, v = cy - y0;
  const indices = [y0 * width + x0, y0 * width + x1, y1 * width + x0, y1 * width + x1];
  const weights = [(1-u)*(1-v),u*(1-v),(1-u)*v,u*v];
  if (respectCoverage && indices.some((index, i) => weights[i] > 1e-12 && source.missing?.[index])) return null;
  return [0,1,2].map(c => Math.round(indices.reduce((sum, index, i) => sum + source.data[index * channels + c] * weights[i], 0)));
}

/** Resolve validity before interpolation; missing neighbors never supply color. */
export function resizeObservedRgb(source: CoveredRgb, width: number, height: number) {
  if (source.info.channels < 3 || source.missing.length !== source.info.width * source.info.height) throw new TypeError('Observed RGB coverage does not match its source.');
  const data = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
  for (let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const color=bilinear(source,(x+.5)*source.info.width/width-.5,(y+.5)*source.info.height/height-.5,true),i=y*width+x;
    if(color) data.set(color,i*3); else missing[i]=1;
  }
  const info={width,height,channels:3 as const};
  return {data:paintMissingCoverage(data,info,missing),info,missing};
}

/** Two retained polar tiles projected directly from the same observed raster.
 * The cartographic convention is explicit; no harmonic or boundary inpainting. */
export function prepareMeasuredPolarAtlas(source: CoveredRgb, tileSize: number, {
  projection, boundaryLatitudeDegrees, overlap=1.035,
  alphaOpaqueRadius=1, alphaTransparentRadius=1,
}: MeasuredPolarOptions) {
  if (!['latitude-linear','orthographic'].includes(projection) || !(boundaryLatitudeDegrees>0&&boundaryLatitudeDegrees<90) || !(overlap>0) || !Number.isSafeInteger(tileSize) || tileSize<2 || !(alphaOpaqueRadius>0&&alphaOpaqueRadius<=alphaTransparentRadius)) throw new TypeError('Invalid measured polar projection.');
  const gap={data:paintMissingCoverage(Buffer.alloc(source.info.width*source.info.height*3),{...source.info,channels:3},new Uint8Array(source.missing.length).fill(1)),info:{...source.info,channels:3}};
  const width=tileSize*2,height=tileSize,data=Buffer.alloc(width*height*4);
  let missingPixels=0,renderedPixels=0;
  for(let pole=0;pole<2;pole++) for(let y=0;y<tileSize;y++) for(let x=0;x<tileSize;x++) {
    const dx=(x+.5)/tileSize*2-1,dy=(y+.5)/tileSize*2-1,rawRadius=Math.hypot(dx,dy);
    const radius=projection==='latitude-linear'?rawRadius/overlap:rawRadius;
    if(radius>1)continue;
    const longitude=projection==='latitude-linear'?Math.atan2(dx,-dy):Math.atan2(dy,dx);
    const latitudeMagnitude=projection==='latitude-linear'?90-radius*(90-boundaryLatitudeDegrees):Math.acos(Math.min(1,radius*overlap*Math.cos(boundaryLatitudeDegrees*Math.PI/180)))*180/Math.PI;
    const latitude=pole===1?latitudeMagnitude:-latitudeMagnitude;
    const sx=(projection==='latitude-linear'?(longitude+Math.PI)/(2*Math.PI):((longitude/(2*Math.PI)+1)%1))*source.info.width-.5;
    const sy=(90-latitude)/180*source.info.height-.5;
    const observed=bilinear(source,sx,sy,true),color=observed??bilinear(gap,sx,sy,false);
    const offset=(y*width+pole*tileSize+x)*4;
    if (!color) throw new Error('Neutral coverage raster did not produce a color.');
    data.set(color,offset);
    const t=alphaTransparentRadius===alphaOpaqueRadius?0:Math.max(0,Math.min(1,(radius-alphaOpaqueRadius)/(alphaTransparentRadius-alphaOpaqueRadius)));
    data[offset+3]=Math.round(255*(1-t*t*t*(t*(t*6-15)+10)));
    if(data[offset+3]){renderedPixels++;if(!observed)missingPixels++;}
  }
  return {data,width,height,model:'measured-polar-projection-with-neutral-gaps',detailedPoles:[],missingPixels,renderedPixels,
    measuredProjectionEdgeLatitudeDegrees:boundaryLatitudeDegrees,
    stabilization:{model:'measured-polar-projection-with-neutral-gaps',runtimeProjection:false}};
}
