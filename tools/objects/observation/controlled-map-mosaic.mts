import {resolve,relative,isAbsolute} from 'node:path';
import {fromFile} from 'geotiff';
import {requireArray,requireFiniteNumber,requireRecord,requireString} from '@cssearth/core';
import {numericRasterBands} from '../terrestrial-layers/source-records.mts';
import {linearToSrgb,srgbToLinear} from '../color-transfer.mts';

/** Area integrals of native pixel squares. The validity integral is independent
 * of brightness: a valid black sample is still an observation. */
export function areaSampler(data:ArrayLike<number>,width:number,height:number,noData:number|null) {
  if(![width,height].every(n=>Number.isSafeInteger(n)&&n>0)||data.length!==width*height)throw new TypeError('Invalid photographic raster dimensions.');
  const stride=width+1, sum=new Float64Array(stride*(height+1)), valid=new Uint32Array(sum.length);
  for(let y=0;y<height;y++) {
    let rowSum=0,rowValid=0;
    for(let x=0;x<width;x++) {
      const value=data[y*width+x]!;
      if(Number.isFinite(value)&&value!==noData&&Math.abs(value)<1e30) {rowSum+=value;rowValid++;}
      const i=(y+1)*stride+x+1;sum[i]=sum[i-stride]!+rowSum;valid[i]=valid[i-stride]!+rowValid;
    }
  }
  const integral=(a:ArrayLike<number>,x:number,y:number)=>{
    const ix=Math.min(width-1,Math.floor(x)),iy=Math.min(height-1,Math.floor(y)),dx=x-ix,dy=y-iy,i=iy*stride+ix;
    return a[i]!*(1-dx)*(1-dy)+a[i+1]!*dx*(1-dy)+a[i+stride]!*(1-dx)*dy+a[i+stride+1]!*dx*dy;
  };
  const box=(a:ArrayLike<number>,x0:number,y0:number,x1:number,y1:number)=>integral(a,x1,y1)-integral(a,x0,y1)-integral(a,x1,y0)+integral(a,x0,y0);
  return (x:number,y:number,stepX:number,stepY:number):number|null=>{
    if(![x,y,stepX,stepY].every(Number.isFinite)||stepX<0||stepY<0)return null;
    // At magnification, bilinear reconstruction uses all nonzero contributors.
    if(stepX<1&&stepY<1) {
      const px=x-.5,py=y-.5,ix=Math.floor(px),iy=Math.floor(py),dx=px-ix,dy=py-iy;
      let result=0;
      for(let j=0;j<2;j++)for(let k=0;k<2;k++) {
        const weight=(k?dx:1-dx)*(j?dy:1-dy);if(weight===0)continue;
        if(ix+k<0||ix+k>=width||iy+j<0||iy+j>=height)return null;
        const value=data[(iy+j)*width+ix+k]!;
        if(!Number.isFinite(value)||value===noData||Math.abs(value)>=1e30)return null;
        result+=weight*value;
      }
      return result;
    }
    const x0=x-stepX/2,x1=x+stepX/2,y0=y-stepY/2,y1=y+stepY/2;
    if(x0<0||y0<0||x1>width||y1>height)return null;
    const area=stepX*stepY,observed=box(valid,x0,y0,x1,y1);
    if(Math.abs(observed-area)>1e-7*Math.max(1,area))return null;
    return box(sum,x0,y0,x1,y1)/area;
  };
}

interface Profile {radius:number; maximum:number; wavelength:number; polarBoundary:number;}
export function parseControlledMapProfile(value:unknown):Profile {
  const p=requireRecord(value),radius=requireFiniteNumber(p.referenceRadiusMeters),wavelength=requireFiniteNumber(p.wavelengthMicrometers);
  const range=requireArray(p.displayRange).map(value=>requireFiniteNumber(value));
  const polarBoundary=requireFiniteNumber(p.polarBoundaryDegrees);
  if(!(radius>0)||range.length!==2||range[0]!==0||!(range[1]!>0)||p.filter!=='CLEAR'||!(wavelength>0)||!(polarBoundary>0&&polarBoundary<90))throw new TypeError('Unsupported controlled photographic frame or display.');
  return {radius,maximum:range[1]!,wavelength,polarBoundary};
}
export interface ControlledFrame {
  id:string;path:string;width:number;height:number;noData:number|null;transform:readonly number[];
  projection:'equirectangular'|'polar-stereographic';centerLongitude:number;poleLatitude:number;
}
export function parseControlledFrames(entries:readonly unknown[]):ControlledFrame[] {
  const frames=entries.map(value=>{
    const e=requireRecord(value),transform=requireArray(e.transform).map(v=>requireFiniteNumber(v));
    const width=requireFiniteNumber(e.width),height=requireFiniteNumber(e.height);
    const projection=e.projection??'equirectangular',centerLongitude=requireFiniteNumber(e.centerLongitude),poleLatitude=e.poleLatitude===undefined?0:requireFiniteNumber(e.poleLatitude);
    if(![width,height].every(n=>Number.isSafeInteger(n)&&n>0)||transform.length!==6||!(transform[1]!>0)||!(transform[5]!<0)||transform[2]!==0||transform[4]!==0||
      !['equirectangular','polar-stereographic'].includes(String(projection))||centerLongitude<0||centerLongitude>=360||
      (projection==='equirectangular'?poleLatitude!==0:Math.abs(poleLatitude)!==90))throw new TypeError('Invalid controlled image grid.');
    return {id:requireString(e.id),path:requireString(e.path),width,height,noData:e.noData===null?null:requireFiniteNumber(e.noData),transform,
      projection:projection==='equirectangular'?'equirectangular' as const:'polar-stereographic' as const,centerLongitude,poleLatitude};
  }).sort((a,b)=>Math.max(b.transform[1]!,-b.transform[5]!)-Math.max(a.transform[1]!,-a.transform[5]!)||a.id.localeCompare(b.id));
  if(!frames.length||new Set(frames.map(f=>f.id)).size!==frames.length||new Set(frames.map(f=>f.path)).size!==frames.length||frames.length>=65535)throw new TypeError('Expected unique controlled frames.');
  return frames;
}
const radians=Math.PI/180;
export function controlledMapPoint(frame:ControlledFrame,radius:number,longitude:number,latitude:number):readonly[number,number] {
  if(frame.projection==='equirectangular') {
    const delta=((longitude-frame.centerLongitude+180)%360+360)%360-180;
    return [delta*radians*radius,latitude*radians*radius];
  }
  const sign=Math.sign(frame.poleLatitude),angle=(longitude-frame.centerLongitude)*radians,distance=2*radius*Math.tan(Math.PI/4-sign*latitude*radians/2);
  return [distance*Math.sin(angle),-sign*distance*Math.cos(angle)];
}
/** Bounds come from the actual projected raster rectangle, including a pole enclosed by it.
 * STAC footprint bounds are not used to crop the released pixels. */
export function controlledMapBounds(frame:ControlledFrame,radius:number) {
  const t=frame.transform,x0=t[0]!,x1=x0+frame.width*t[1]!,y1=t[3]!,y0=y1+frame.height*t[5]!;
  if(frame.projection==='equirectangular')return {west:frame.centerLongitude+x0/radius/radians,east:frame.centerLongitude+x1/radius/radians,south:y0/radius/radians,north:y1/radius/radians};
  const nearest=Math.hypot(x0>0?x0:x1<0?x1:0,y0>0?y0:y1<0?y1:0),farthest=Math.max(...[x0,x1].flatMap(x=>[y0,y1].map(y=>Math.hypot(x,y))));
  const sign=Math.sign(frame.poleLatitude),lat=(r:number)=>sign*(90-2*Math.atan(r/(2*radius))/radians);
  const south=Math.min(lat(nearest),lat(farthest)),north=Math.max(lat(nearest),lat(farthest));
  if(nearest===0)return {west:0,east:360,south,north};
  const angles=[x0,x1].flatMap(x=>[y0,y1].map(y=>(Math.atan2(x,-sign*y)/radians+frame.centerLongitude+360)%360)).sort((a,b)=>a-b);
  let gap=-1,start=0;
  for(let i=0;i<angles.length;i++){const next=angles[(i+1)%angles.length]!+(i===angles.length-1?360:0),size=next-angles[i]!;if(size>gap){gap=size;start=(i+1)%angles.length;}}
  const west=angles[start]!;return {west,east:west+360-gap,south,north};
}
async function loadFrame(sourceDirectory:string,frame:ControlledFrame,profile:Profile) {
  const path=resolve(sourceDirectory,frame.path),offset=relative(resolve(sourceDirectory),path);
  if(offset==='..'||offset.startsWith('../')||isAbsolute(offset))throw new TypeError('Photograph path escapes its source root.');
  const tiff=await fromFile(path);
  try {
    const image=await tiff.getImage(),keys=image.getGeoKeys(),origin=image.getOrigin(),resolution=image.getResolution(),band=await image.getGDALMetadata(0);
    const projectionMatches=keys&&(frame.projection==='equirectangular'
      ?keys.ProjCoordTransGeoKey===17&&keys.ProjCenterLongGeoKey===frame.centerLongitude&&keys.ProjStdParallel1GeoKey===0&&keys.ProjCenterLatGeoKey===0
      :keys.ProjCoordTransGeoKey===15&&keys.ProjNatOriginLatGeoKey===frame.poleLatitude&&keys.ProjStraightVertPoleLongGeoKey===frame.centerLongitude&&keys.ProjScaleAtNatOriginGeoKey===1);
    if(!keys||!band||!projectionMatches||keys.GTModelTypeGeoKey!==1||keys.GTRasterTypeGeoKey!==1||keys.GeogAngularUnitsGeoKey!==9102||keys.ProjLinearUnitsGeoKey!==9001||
      (keys.ProjFalseEastingGeoKey??0)!==0||(keys.ProjFalseNorthingGeoKey??0)!==0||(keys.GeogPrimeMeridianLongGeoKey??0)!==0||
      keys.GeogSemiMajorAxisGeoKey!==profile.radius||keys.GeogSemiMinorAxisGeoKey!==profile.radius||image.getWidth()!==frame.width||image.getHeight()!==frame.height||
      image.getSamplesPerPixel()!==1||image.getSampleFormat(0)!==3||image.getSampleByteSize(0)!==4||image.getGDALNoData()!==frame.noData||band.DESCRIPTION!=='CLEAR'||Number(band.WAVELENGTH)!==profile.wavelength||
      [origin[0],resolution[0],0,origin[1],0,resolution[1]].some((v,i)=>v!==frame.transform[i]))throw new Error(`Controlled source changed: ${frame.id}`);
    const data=numericRasterBands(await image.readRasters())[0];if(!data)throw new Error('Missing photographic band');
    let maximum=0;
    for(const value of data)if(Number.isFinite(value)&&value!==frame.noData&&Math.abs(value)<1e30)maximum=Math.max(maximum,value);
    return Object.assign(areaSampler(data,frame.width,frame.height,frame.noData),{maximum});
  }finally{await tiff.close();}
}
function pixelPoint(frame:ControlledFrame,profile:Profile,longitude:number,latitude:number) {
  const [x,y]=controlledMapPoint(frame,profile.radius,longitude,latitude),t=frame.transform;
  return [(x-t[0]!)/t[1]!, (y-t[3]!)/t[5]!] as const;
}
/** Integrate a polar map with a geographic subgrid whose spacing is no greater
 * than one source pixel along either edge. No display-sized intermediate is read. */
export function samplePolarCell(sample:ReturnType<typeof areaSampler>,frame:ControlledFrame,profile:Profile,lon:number,lat:number,step:number):number|null {
  const point=(dx:number,dy:number)=>pixelPoint(frame,profile,lon+dx*step,lat+dy*step);
  const a=point(-.5,-.5),b=point(.5,-.5),c=point(-.5,.5),d=point(.5,.5);
  const distance=(a:readonly number[],b:readonly number[])=>Math.hypot(a[0]!-b[0]!,a[1]!-b[1]!);
  const nx=Math.max(1,Math.ceil(Math.max(distance(a,b),distance(c,d)))),ny=Math.max(1,Math.ceil(Math.max(distance(a,c),distance(b,d))));
  let sum=0;
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const [px,py]=point((x+.5)/nx-.5,(y+.5)/ny-.5),value=sample(px,py,0,0);
    if(value===null)return null;sum+=value;
  }
  return sum/(nx*ny);
}
/** Keep one photograph per delivered pixel. Preserve measured I/F and original
 * illumination; no brightness fitting, terrain model or cross-image blending. */
export async function prepareControlledMapMosaic(sourceDirectory:string,entries:readonly unknown[],profileValue:unknown,width:number,height:number,onFrame?:(id:string)=>void) {
  const profile=parseControlledMapProfile(profileValue),frames=parseControlledFrames(entries),count=width*height;
  if(!Number.isSafeInteger(width)||width<2||height*2!==width)throw new TypeError('Expected a 2:1 output grid.');
  const values=new Float32Array(count),owners=new Uint16Array(count),missing=new Uint8Array(count).fill(1),step=360/width,units=profile.radius*radians;
  const nativeMaxima:number[]=[];
  for(const [frameIndex,frame] of frames.entries()) {
    const sample=await loadFrame(sourceDirectory,frame,profile),b=controlledMapBounds(frame,profile.radius),t=frame.transform;
    nativeMaxima.push(sample.maximum);
    const firstY=Math.max(0,Math.floor((90-b.north)/step)),lastY=Math.min(height,Math.ceil((90-b.south)/step));
    const firstX=Math.floor(b.west/step),lastX=Math.ceil(b.east/step);
    for(let y=firstY;y<lastY;y++)for(let col=firstX;col<lastX;col++){
      const x=(col%width+width)%width,lon=(col+.5)*step,lat=90-(y+.5)*step;
      let value:number|null;
      if(frame.projection==='equirectangular') {
        // Preserve the raster's unwrapped interval across the 0/360 seam.
        const px=((lon-frame.centerLongitude)*units-t[0]!)/t[1]!,py=(lat*units-t[3]!)/t[5]!;
        value=sample(px,py,step*units/t[1]!,step*units/-t[5]!);
      }else value=samplePolarCell(sample,frame,profile,lon,lat,step);
      if(value===null)continue;const i=y*width+x;values[i]=value;owners[i]=frameIndex+1;missing[i]=0;
    }
    onFrame?.(frame.id);
  }
  const rgb=new Uint8Array(count*3),coverage=frames.map((frame,i)=>({id:frame.id,pixels:0,surfacePercent:0,nativeMaximum:nativeMaxima[i]!}));
  let areaTotal=0,areaCovered=0,clippedHighlights=0,clippedNegative=0,minimum=Infinity,maximum=-Infinity;
  for(let y=0;y<height;y++) {
    const weight=Math.sin((90-y*step)*radians)-Math.sin((90-(y+1)*step)*radians);areaTotal+=weight*width;
    for(let x=0;x<width;x++) {const i=y*width+x;if(missing[i])continue;
      const owner=coverage[owners[i]!-1]!;owner.pixels++;owner.surfacePercent+=weight;areaCovered+=weight;
      const value=values[i]!;minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);if(value>profile.maximum)clippedHighlights++;if(value<0)clippedNegative++;
      const gray=Math.round(255*linearToSrgb(value/profile.maximum));rgb.fill(gray,i*3,i*3+3);
    }
  }
  for(const frame of coverage)frame.surfacePercent=frame.surfacePercent/areaTotal*100;
  return {rgb,missing,values,owners,report:{method:'smallest-projected-pixel-valid-single-frame',sampling:{equirectangular:'native pixel-area integration; bilinear at magnification',polar:'geographic subgrid at source-pixel spacing; complete bilinear samples'},
    photometricCorrection:false,display:{range:[0,profile.maximum],encoding:'IEC sRGB'},surfacePercent:areaCovered/areaTotal*100,clippedHighlights,clippedNegative,minimum:Number.isFinite(minimum)?minimum:null,maximum:Number.isFinite(maximum)?maximum:null,frames:coverage}};
}

/** One display exposure per photograph, fitted to co-located valid base pixels
 * inside its selected boundary. This changes no coordinates or local contrast,
 * and is not photometric normalization or albedo recovery. */
export function matchControlledMapLevels(result:{values:Float32Array;owners:Uint16Array;rgb:Uint8Array;missing:Uint8Array;report:{display:{range:number[]};frames:{id:string;nativeMaximum:number}[]}},
  base:{rgb:Uint8Array;missing:Uint8Array},width:number,height:number,settings:unknown) {
  const boundaryPixels=requireFiniteNumber(requireRecord(settings).boundaryPixels),count=width*height;
  if(!Number.isSafeInteger(boundaryPixels)||boundaryPixels<1||boundaryPixels>=Math.min(width,height)/2||
    result.values.length!==count||result.owners.length!==count||result.rgb.length!==count*3||result.missing.length!==count||base.rgb.length!==count*3||base.missing.length!==count)throw new TypeError('Invalid photographic display-matching grid.');
  const maximum=result.report.display.range[1]!;
  const samples=result.report.frames.map(():number[]=>[]),linear=Array.from({length:256},(_,i)=>srgbToLinear(i/255));
  for(let y=boundaryPixels;y<height-boundaryPixels;y++)for(let x=0;x<width;x++) {
    const i=y*width+x,owner=result.owners[i]!;
    if(!owner||base.missing[i]||result.missing[i])continue;
    if([i-boundaryPixels*width,i+boundaryPixels*width,y*width+(x+boundaryPixels)%width,y*width+(x+width-boundaryPixels)%width].every(j=>result.owners[j]===owner))continue;
    const reference=.2126*linear[base.rgb[i*3]!]!+.7152*linear[base.rgb[i*3+1]!]!+.0722*linear[base.rgb[i*3+2]!]!,value=result.values[i]!/maximum;
    if(reference>0&&value>0)samples[owner-1]!.push(reference/value);
  }
  const levels=result.report.frames.map((frame,i)=>{
    const ratios=samples[i]!.sort((a,b)=>a-b),requestedGain=ratios.length?ratios[Math.floor(ratios.length/2)]!:1;
    return {id:frame.id,boundarySamples:ratios.length,requestedGain,gain:Math.min(requestedGain,frame.nativeMaximum>0?maximum/frame.nativeMaximum:1)};
  });
  for(let i=0;i<count;i++) {
    const owner=result.owners[i]!;
    if(owner) {const gray=Math.round(255*linearToSrgb(result.values[i]!/maximum*levels[owner-1]!.gain));result.rgb.fill(gray,i*3,i*3+3);}
    else if(!base.missing[i]) {result.rgb.set(base.rgb.subarray(i*3,i*3+3),i*3);result.missing[i]=0;}
  }
  return {method:'bounded-median-display-ratio-at-selected-footprint-boundaries',boundaryPixels,photometricCorrection:false,levels};
}
/** Only photographs intersecting a polar cap remain decoded for its direct sampler. */
export async function loadControlledMapPoles(sourceDirectory:string,entries:readonly unknown[],profileValue:unknown,gains:ReadonlyMap<string,number>=new Map()) {
  const profile=parseControlledMapProfile(profileValue);
  const selected: {frame: ReturnType<typeof parseControlledFrames>[number];sample: Awaited<ReturnType<typeof loadFrame>>}[]=[];
  for(const frame of parseControlledFrames(entries).reverse()) {
    const bounds=controlledMapBounds(frame,profile.radius);
    if(bounds.north<profile.polarBoundary&&bounds.south>-profile.polarBoundary)continue;
    selected.push({frame,sample:await loadFrame(sourceDirectory,frame,profile)});
  }
  return {sample(longitude:number,latitude:number,color:number[]) {
    for(const {frame,sample} of selected) {
      const [px,py]=pixelPoint(frame,profile,longitude,latitude),value=sample(px,py,0,0);if(value===null)continue;
      const gray=Math.round(255*linearToSrgb(value/profile.maximum*(gains.get(frame.id)??1)));color[0]=gray;color[1]=gray;color[2]=gray;color[3]=255;return true;
    }
    return false;
  }};
}
