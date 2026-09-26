import {parse} from '@cssearth/core/schema';
import {bandedGeometryRecipe, type BandedGeometryRecipe} from './geometry-contract.mts';
import type {Vector3} from '../material-composition/ellipsoid.mts';
type SourceRectangle = {x:number;y:number;width:number;height:number};
interface GeometryPolygon extends Omit<Parameters<typeof computeTextureAtlasPlanPublic>[0], 'textureImageSource'> {
  latitudeIndex?: number; longitudeIndex?: number; polarCap?: 'north' | 'south'; polarRole?: string;
  textureImageSource: {url:string;width:number;height:number;sourceRect:SourceRectangle};
}
type TextureLeafOptions = {seamEdges?: Set<number>; seamBleed?:number; fitSurface?:boolean; leafSize?:number; imagePixels?:number};
/** Pixel widths of the published images the leaves show, measured from what the preparation run wrote. */
export interface BandedImagePixels {
  /** The widest image a surface face can show, over every lens. */
  surface: number;
  /** The width of the image at a URL; a tiled plane shows its own. */
  image: (url: string) => number;
}
import {buildSeamBleedPolygonEdges,computeTextureAtlasPlanPublic,resolvePolyTextureLeafGeometry,formatCssLength} from '@layoutit/polycss';
import {createProjectiveSurfaceRasterPresentation,fitTextureGeometry,fitProjectiveTextureGeometryToStableLayout,leafRasterScale,prepareProjectiveTextureLayer} from '../../../src/platform/projective-surface-raster.mts';
import {ellipsoidPoint} from '../material-composition/ellipsoid.mts';
import {POLAR_CAP_STYLE,requireOutwardCap} from '../../../src/renderers/css/preparation/scene/polar-cap.ts';

const presentation={backend:'image',lighting:'source',projection:'projective'} as const;
const replace=(template: string,values: Record<string,string>)=>template.replace(/\{([a-z]+)\}/gu,(_match: string,key: string)=>values[key]);
function source(url:string,width:number,height:number,sourceRect:SourceRectangle={x:0,y:0,width,height}){return{url,width,height,sourceRect};}

function bodyPolygon(config: BandedGeometryRecipe,latitudeIndex:number,longitudeIndex:number,overlap:number): GeometryPolygon & {latitudeIndex:number;longitudeIndex:number}{
  const {latitudeSegments:latitudes,longitudeSegments:longitudes,surface,shape}=config;
  if(config.coordinateArithmetic==='bounds'){
    if(!config.latitudeBoundsDegrees||surface.polarOverlapLatitudeDegrees===undefined||surface.polarOverlap===undefined)throw new TypeError('Latitude-bound surface overlap is missing.');
    const lat0=config.latitudeBoundsDegrees[latitudeIndex-1]*Math.PI/180,lat1=config.latitudeBoundsDegrees[latitudeIndex]*Math.PI/180,v0=(lat0+Math.PI/2)/Math.PI,v1=(lat1+Math.PI/2)/Math.PI,u0=longitudeIndex/longitudes,u1=(longitudeIndex+1)/longitudes,lon0=longitudeIndex/longitudes*Math.PI*2,lon1=(longitudeIndex+1)/longitudes*Math.PI*2;
    const bleed=overlap>0&&Math.max(Math.abs(lat0),Math.abs(lat1))>=surface.polarOverlapLatitudeDegrees*Math.PI/180?Math.max(overlap,surface.polarOverlap):overlap,a=lat0-(lat1-lat0)*bleed,b=lat1+(lat1-lat0)*bleed,left=lon0-Math.PI*2/longitudes*bleed,right=bleed===0&&longitudeIndex===longitudes-1?0:lon1+Math.PI*2/longitudes*bleed;
    return{latitudeIndex,longitudeIndex,vertices:[ellipsoidPoint(a,left,shape),ellipsoidPoint(a,right,shape),ellipsoidPoint(b,right,shape),ellipsoidPoint(b,left,shape)],uvs:[[u0,v0],[u1,v0],[u1,v1],[u0,v1]],texture:surface.url,textureImageSource:source(surface.url,surface.width,surface.height,{x:longitudeIndex*surface.width/longitudes,y:(1-v1)*surface.height,width:surface.width/longitudes,height:(v1-v0)*surface.height}),texturePresentation:presentation,color:surface.color};
  }
  const stepLat=Math.PI/latitudes,stepLon=Math.PI*2/longitudes,v0=latitudeIndex/latitudes,v1=(latitudeIndex+1)/latitudes,u0=longitudeIndex/longitudes;
  const fraction=config.coordinateArithmetic==='fraction',u1=fraction?u0+1/longitudes:(longitudeIndex+1)/longitudes;
  const lat0=fraction?-Math.PI/2+v0*Math.PI:-Math.PI/2+latitudeIndex*stepLat,lat1=fraction?-Math.PI/2+v1*Math.PI:lat0+stepLat;
  const lon0=fraction?u0*Math.PI*2:longitudeIndex*stepLon,lon1=fraction?(longitudeIndex+1)/longitudes*Math.PI*2:lon0+stepLon;
  const latOverlap=stepLat*overlap,lonOverlap=stepLon*overlap;
  let a=lat0-latOverlap,b=lat1+latOverlap;if(fraction){a=Math.max(-Math.PI/2,a);b=Math.min(Math.PI/2,b);}
  const left=lon0-lonOverlap,right=overlap===0&&longitudeIndex===longitudes-1?0:lon1+lonOverlap;
  return{latitudeIndex,longitudeIndex,vertices:[ellipsoidPoint(a,left,shape),ellipsoidPoint(a,right,shape),ellipsoidPoint(b,right,shape),ellipsoidPoint(b,left,shape)],uvs:[[u0,v0],[u1,v0],[u1,v1],[u0,v1]],
    texture:surface.url,textureImageSource:source(surface.url,surface.width,surface.height,{x:longitudeIndex*(surface.width/longitudes),y:(latitudes-1-latitudeIndex)*(surface.height/latitudes),width:surface.width/longitudes,height:surface.height/latitudes}),texturePresentation:presentation,color:surface.color};
}

function polarPolygon(config:BandedGeometryRecipe,pole:'north'|'south',role:string): GeometryPolygon{
  const {latitudeSegments,shape,polar}=config,north=pole==='north',inner=role==='inner',sign=north?1:-1,boundary=polar.boundaryLatitudeDegrees===undefined?Math.PI/2-Math.PI/latitudeSegments:polar.boundaryLatitudeDegrees*Math.PI/180;
  const overlayBoundary=polar.overlayLatitudeDegrees===undefined?boundary:polar.overlayLatitudeDegrees*Math.PI/180;
  const radius=shape.equatorialRadius*Math.cos(overlayBoundary)*(inner?polar.innerOverlap:polar.surfaceOverlap),boundaryZ=shape.polarRadius*Math.sin(boundary);
  const z=sign*(inner?(polar.innerOffsetBeforeSubtract?boundaryZ+polar.surfaceOffset-polar.innerInset:boundaryZ-polar.innerInset):boundaryZ+polar.surfaceOffset);
  const tile=polar.southFirst?(north?1:0):inner&&polar.separateInnerTiles?(north?2:3):(north?0:1);
  return{latitudeIndex:north?latitudeSegments-1:0,vertices:north?[[-radius,-radius,z],[radius,-radius,z],[radius,radius,z],[-radius,radius,z]]:[[-radius,radius,z],[radius,radius,z],[radius,-radius,z],[-radius,-radius,z]],uvs:north?[[0,0],[1,0],[1,1],[0,1]]:[[0,1],[1,1],[1,0],[0,0]],texture:polar.url,textureImageSource:source(polar.url,polar.tileSize*(polar.separateInnerTiles?4:2),polar.tileSize,{x:tile*polar.tileSize,y:0,width:polar.tileSize,height:polar.tileSize}),texturePresentation:presentation,color:config.surface.color,polarCap:pole,polarRole:role};
}

function textureLeaf(config:BandedGeometryRecipe,polygon:GeometryPolygon,index:number,{seamEdges,seamBleed=0,fitSurface=false,leafSize,imagePixels}:TextureLeafOptions){
  const plan=computeTextureAtlasPlanPublic(polygon,index,{...config.planOptions,seamBleed,...(seamEdges?{seamEdges}:{})}),geometry=plan&&resolvePolyTextureLeafGeometry(plan,presentation);
  if(!geometry)throw new Error(`Retained texture leaf ${index} did not prepare.`);
  let fitted=leafSize?fitTextureGeometry(geometry,leafSize,leafSize):geometry;if(fitSurface)fitted=fitProjectiveTextureGeometryToStableLayout(fitted);
  const address=fitSurface?createProjectiveSurfaceRasterPresentation({sourceWidth:config.surface.width,sourceHeight:config.surface.height,sourceRect:polygon.textureImageSource.sourceRect,addressSourceWidth:polygon.textureImageSource.width,addressSourceHeight:polygon.textureImageSource.height,addressSourceRect:polygon.textureImageSource.sourceRect,backgroundPosition:fitted.backgroundPosition,backgroundSize:fitted.backgroundSize,leafWidth:fitted.leafWidth,leafHeight:fitted.leafHeight,...(config.latitudeBoundsDegrees?{bands:latitudeRasterBands(config.latitudeBoundsDegrees,config.surface.height)}:{bandCount:config.latitudeSegments}),gutter:config.surface.gutter,overscan:config.surface.overscan}):fitted;
  // Only a surface face is a raster layer. It holds its widest image at TEXELS_PER_CSS_PIXEL, the recipe's scale as the ceiling:
  // at scale 4 Jupiter's 4,160 px lenses sat at one texel per CSS pixel, 768 faces estimated at 257 MB of layers at DPR 3, 64 at two.
  const projectiveLayer=()=>{
    if(imagePixels===undefined)throw new TypeError(`Surface leaf ${index} (${polygon.texture}): the width of the widest image it shows is missing.`);
    return{projectiveTextureLayer:prepareProjectiveTextureLayer(fitted.matrix,leafRasterScale(imagePixels,address.backgroundSize[0],config.surface.rasterScale))};
  };
  // Every lane's caps follow one rule (polar-cap.ts): a disc, facing out, culled when it turns away.
  if(polygon.polarCap)requireOutwardCap(config.polar.url,polygon.polarCap,fitted.matrix,polygon.polarRole==='inner');
  const cap=polygon.polarCap?POLAR_CAP_STYLE:'';
  if(config.leafRecord==='explicit'){
    const length=(value:number)=>value===0?'0px':formatCssLength(value);
    return{style:`transform:matrix3d(${fitted.matrix});width:${length(fitted.leafWidth)};height:${length(fitted.leafHeight)};background-position:${address.backgroundPosition.map(length).join(' ')};background-size:${address.backgroundSize.map(length).join(' ')}${cap}`,...(fitSurface?projectiveLayer():{})};
  }
  const compact=config.leafRecord==='compact';
  const position=address.backgroundPosition.map(value=>!compact&&value===0?'0px':formatCssLength(value)).join(' '),size=address.backgroundSize.map(value=>formatCssLength(value)).join(' ');
  const dimensions=compact?(fitted.leafWidth===64?'':`;--polycss-atlas-width:${formatCssLength(fitted.leafWidth)}`)+(fitted.leafHeight===64?'':`;--polycss-atlas-height:${formatCssLength(fitted.leafHeight)}`):(fitted.leafWidth===64&&fitted.leafHeight===64?'':`;--polycss-atlas-width:${fitted.leafWidth}px;--polycss-atlas-height:${fitted.leafHeight}px`);
  return{...(compact?{tag:'s'}:{}),style:`transform:matrix3d(${fitted.matrix})${dimensions}${compact&&polygon.polarCap?`;background-image:url(${fitted.url})`:''};background-position:${position};background-size:${size}${cap}`,
    ...(fitSurface?projectiveLayer():{}),...(!compact?{sourceRect:fitted.sourceRect,leafWidth:fitted.leafWidth,leafHeight:fitted.leafHeight,projection:fitted.projection,lighting:'source',lightingOverlay:false}:{})};
}

export function prepareBandedEllipsoid(input:unknown,images:BandedImagePixels){
  const config = parse(input, bandedGeometryRecipe, 'banded ellipsoid recipe');
  if(config?.schema!=='cssearth-banded-ellipsoid@1'||!['fraction','step','bounds'].includes(config.coordinateArithmetic)||!['compact','annotated','explicit'].includes(config.leafRecord))throw new TypeError('Invalid banded ellipsoid recipe.');
  if(!Number.isInteger(config.latitudeSegments)||config.latitudeSegments<3||!Number.isInteger(config.longitudeSegments)||config.longitudeSegments<3||config.latitudeSegments*config.longitudeSegments>100000)throw new TypeError('Invalid ellipsoid tessellation.');
  if(config.coordinateArithmetic==='bounds')return prepareLatitudeBoundGeometry(config,images);
  const topology=[];for(let lat=1;lat<config.latitudeSegments-1;lat++)for(let lon=0;lon<config.longitudeSegments;lon++)topology.push(bodyPolygon(config,lat,lon,0));
  const seams=buildSeamBleedPolygonEdges(topology,{tileSize:config.planOptions.tileSize,layerElevation:config.planOptions.layerElevation});
  if(config.verifyWrapSeams)for(const[index,polygon]of topology.entries())if(polygon.longitudeIndex===0&&!seams.get(index)?.has(3)||polygon.longitudeIndex===config.longitudeSegments-1&&!seams.get(index)?.has(1))throw new Error('Ellipsoid longitude wrap edge is not shared.');
  const prepared: {latitudeIndex:number|undefined;leaf:ReturnType<typeof textureLeaf>&{tag:string;className:string}}[]=[];
  for(const pole of['south','north'] as const)for(const role of['inner','surface']){
    const polygon=polarPolygon(config,pole,role),className=replace(config.classes[role==='inner'?'polarInner':'polarSurface'],{pole});
    const leaf=textureLeaf(config,polygon,prepared.length,{leafSize:config.polar.fitToTile?config.polar.tileSize:undefined});prepared.push({latitudeIndex:polygon.latitudeIndex,leaf:{tag:'s',className,...leaf}});
  }
  let index=0;for(let lat=1;lat<config.latitudeSegments-1;lat++)for(let lon=0;lon<config.longitudeSegments;lon++){
    const polygon=bodyPolygon(config,lat,lon,config.surface.overlap);prepared.push({latitudeIndex:lat,leaf:{tag:'s',className:config.classes.surface,...textureLeaf(config,polygon,index,{seamEdges:seams.get(index),seamBleed:config.surface.seamBleed,fitSurface:true,leafSize:config.surface.leafSize,imagePixels:images.surface})}});index++;
  }
  const bodyBands=Array.from({length:config.latitudeSegments},(_,latitudeIndex)=>({latitudeIndex,...(config.rotationSeconds?{latitudeDegrees:Number((-90+(latitudeIndex+0.5)*180/config.latitudeSegments).toFixed(3)),visualRotationSeconds:config.rotationSeconds}:{}),leaves:prepared.filter(item=>item.latitudeIndex===latitudeIndex).map(item=>item.leaf)}));
  const planes:Record<string,ReturnType<typeof textureLeaf>&{className?:string}>={};for(const plane of config.planes??[]){
    const r=plane.radius,z=plane.z,polygon:GeometryPolygon={vertices:[[-r,-r,z],[r,-r,z],[r,r,z],[-r,r,z]],uvs:[[0,0],[1,0],[1,1],[0,1]],texture:plane.url,textureImageSource:source(plane.url,plane.size,plane.size),texturePresentation:presentation,color:plane.color,doubleSided:true};
    const leaf=textureLeaf(config,polygon,0,{leafSize:plane.fitToSize?plane.size:undefined});planes[plane.id]={...(plane.className?{tag:'s',className:plane.className}:{}),...leaf,style:`${leaf.style};backface-visibility:visible`};
  }
  return{bodyBands,planes};
}

export function latitudeRasterBands(bounds:number[],height:number){
  if(!Number.isInteger(height)||height<=0||!Array.isArray(bounds)||bounds.length<2||bounds.some((value,index)=>!Number.isFinite(value)||value<-90||value>90||index>0&&value<=bounds[index-1]))throw new TypeError('Invalid latitude raster bands.');
  return Array.from({length:bounds.length-1},(_,index)=>{const y=Math.round((90-bounds[index+1])/180*height),bottom=Math.round((90-bounds[index])/180*height);return{y,height:bottom-y};});
}

function prepareLatitudeBoundGeometry(config:BandedGeometryRecipe,images:BandedImagePixels){
  if(!config.latitudeBoundsDegrees)throw new TypeError('Latitude bounds are missing.');
  latitudeRasterBands(config.latitudeBoundsDegrees,config.surface.height);
  const overlap=config.surface.overlap;
  if(overlap===undefined)throw new TypeError('Surface overlap is missing.');
  if(config.latitudeBoundsDegrees.length!==config.latitudeSegments+1)throw new TypeError('Authored latitude bounds disagree with tessellation.');
  const topology=[];for(let latitude=1;latitude<=config.latitudeSegments;latitude++)for(let longitude=0;longitude<config.longitudeSegments;longitude++)topology.push(bodyPolygon(config,latitude,longitude,0));
  const seams=buildSeamBleedPolygonEdges(topology,{tileSize:config.planOptions.tileSize,layerElevation:config.planOptions.layerElevation});
  if(config.verifyWrapSeams)for(const[index,polygon]of topology.entries())if(polygon.longitudeIndex===0&&!seams.get(index)?.has(3)||polygon.longitudeIndex===config.longitudeSegments-1&&!seams.get(index)?.has(1))throw new Error('Ellipsoid longitude wrap edge is not shared.');
  const body=topology.map((entry,index)=>({latitudeIndex:entry.latitudeIndex,longitudeIndex:entry.longitudeIndex,tag:'s',...textureLeaf(config,bodyPolygon(config,entry.latitudeIndex,entry.longitudeIndex,overlap),index,{seamEdges:seams.get(index),fitSurface:true,imagePixels:images.surface})}));
  const poles=['inner','outer'].flatMap(role=>(['south','north'] as const).map((pole,index)=>({latitudeIndex:pole==='north'?config.latitudeSegments-1:0,pole,tag:'s',className:replace(config.classes[role==='inner'?'polarInner':'polarSurface'],{pole}),...textureLeaf(config,polarPolygon(config,pole,role),index,{})})));
  const ringLeaves=[];for(const tile of config.tiledPlanes??[]){
    const radius=tile.radius*tile.worldScale,diameter=radius*2,size=diameter/tile.grid;
    // WebKit backs a tile at its box times the device pixel ratio, whatever its transform. Jupiter's page held 2,650 MB of
    // layers on the iPhone 17 simulator (DPR 3), about 147 MB for each of 16 tiles of 6,894 CSS px showing a 2,048 px image at
    // one texel per 13 CSS px. The box now holds the image at TEXELS_PER_CSS_PIXEL (a 258 px tile, an estimated 2.3 MB) and
    // the matrix scales it back onto the plane.
    const k=leafRasterScale(images.image(tile.url),diameter,1),box=(value:number)=>(value*k).toFixed(6),scale=Number((1/k).toFixed(9));
    for(let index=0;index<tile.grid**2;index++){const column=index%tile.grid,row=Math.floor(index/tile.grid),overlapX=column===tile.grid-1?0:tile.overlap,overlapY=row===tile.grid-1?0:tile.overlap;
      ringLeaves.push({component:tile.id,tileIndex:index,tileColumn:column,tileRow:row,className:tile.className,style:`width:${box(size+overlapX)}px;height:${box(size+overlapY)}px;transform:matrix3d(${scale},0,0,0,0,${scale},0,0,0,0,1,0,${(-radius+column*size).toFixed(6)},${(-radius+row*size).toFixed(6)},0,1);background-image:url("${tile.url}");background-position:${box(-column*size)}px ${box(-row*size)}px;background-size:${box(diameter)}px ${box(diameter)}px`});
    }
  }
  return{leaves:[...body,...poles],ringLeaves};
}

/** Prepared camera-facing support plane; no geometry is created by runtime. */
export function prepareFixedSpanMaterialPlane(config:{frameSize:number;layerElevation:number;span:number;equatorialRadius:number;depthBias:number;className:string},scenePitch:number){
  const halfSize=config.frameSize/2,radians=-scenePitch*Math.PI/180,cosine=Math.cos(radians),sine=Math.sin(radians),scale=config.layerElevation*config.span/config.frameSize,frontDepth=(config.equatorialRadius+config.depthBias)*config.layerElevation;
  const matrix=[scale,0,0,0,0,scale*cosine,scale*sine,0,0,-scale*sine,scale*cosine,0,-halfSize*scale,-halfSize*scale*cosine-frontDepth*sine,-halfSize*scale*sine+frontDepth*cosine,1].map(value=>Number(value.toFixed(6))).join(',');
  return{tag:'s',className:config.className,style:`transform:matrix3d(${matrix});--polycss-atlas-width:${config.frameSize}px;--polycss-atlas-height:${config.frameSize}px;background-position:0px 0px;background-size:${config.frameSize}px ${config.frameSize}px;backface-visibility:visible`,leafWidth:config.frameSize,leafHeight:config.frameSize,projection:'prepared-camera-facing-plane',lighting:'prepared-material',lightingOverlay:true};
}
