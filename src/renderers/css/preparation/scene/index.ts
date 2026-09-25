import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildPolyMeshTransform, buildSeamBleedPolygonEdges } from '@layoutit/polycss';
import { createSurfacePatches, createPolarPatch } from '@cssearth/objects';
import type { Pole } from '@cssearth/objects';
import type { prepareAtmosphere } from '../../../../preparation/raster/materials.js';
import type { RasterRecipe } from '../../../../preparation/raster/config.js';
import { RASTER_DENSITY } from '../../../../preparation/raster/config.js';
import { rasterPagePlan } from '../../../../preparation/raster/pages.js';
import type { GeometryProfile } from './profile.js';
import { createLeafProjector, rendererPolygon, type LeafImagePixels } from './projector.js';
import { prepareCutaway } from './cutaway.js';
import { prepareSeamOutsetSteps } from './seam-outset.js';
import { ringWedgeLayout, wedgeMatrix } from './ring-wedges.js';
import type { InteriorAssets } from './cutaway.js';
import { prepareAtmosphericMaterial } from './atmosphere.js';
export { parseGeometryProfile } from './profile.js';
export type { GeometryProfile } from './profile.js';
export type { LeafImagePixels } from './projector.js';
export { leafImageCandidates, widestLeafImages } from './leaf-images.js';
export interface PhysicalScene {
 camera:unknown;systemTransform:unknown;presentationFrame:unknown;worldFrame:unknown;starfield:unknown;
}
export interface SolarSceneSource extends Record<string, unknown> { bodyId:string;bodyRadiusUnits:number;bodyRadiusKilometers:number;displayName:string; }
export interface ScenePreparationAdapters {
 preparePhysicalScene(input:SolarSceneSource & {starfield:Record<string,unknown>;sun:Record<string,unknown>|null;worldContext?:unknown}):Promise<PhysicalScene>;
 bodyFixedSunDirection(id:string):[number,number,number];
 sunReferenceViewDirection(source:SolarSceneSource):readonly number[];
}
export interface GeometrySceneAssets {
 lighting?:{frameCount:number;defaultFrame:number};
 interior?:InteriorAssets;
 atmosphere?:Awaited<ReturnType<typeof prepareAtmosphere>>;
 /** An unlit body: source-lit leaves, no lighting bank, stationary off-limb context and limb plate. */
 emission?:Record<string,unknown>&{offLimbContext:{logicalSize:number};limbMaterial:{logicalSize:number}};
 /** Rings the radial lane drew as wedges, by atlas file name: how many, and where the field first draws. */
 ringWedges?:Readonly<Record<string,{count:number;contentPixels:number}>>;
}
export interface GeometrySceneOptions {
 profile:GeometryProfile;raster:RasterRecipe;assets:GeometrySceneAssets;solarSource:SolarSceneSource;
 starfield:Record<string,unknown>;sun:Record<string,unknown>|null;
 /** The authored world context (prepared spatial context) of a body the ephemeris tables do not place, such as the Sun. */
 worldContext?:unknown;
 adapters:ScenePreparationAdapters;outputDirectory:string;
 /** Pixel width of the widest published image each leaf texture can show (leaf-images.ts measures the run's own files). */
 imagePixels:LeafImagePixels;
}

export async function prepareGeometryScene({profile,raster,assets,solarSource,starfield,sun,worldContext,adapters,outputDirectory,imagePixels}:GeometrySceneOptions) {
 if(profile.surface.radius!==solarSource.bodyRadiusUnits)throw new TypeError('Authored surface radius differs from the physical scene scale.');
 const physical=await adapters.preparePhysicalScene({...solarSource,starfield,sun,...(worldContext!==undefined?{worldContext}:{})});
 const polygons=createSurfacePatches(profile.surface,profile.projection.overlap,profile.projection.rasterScale,profile.projection.rasterOverscan);
 const topology=createSurfacePatches(profile.surface,0);
 const seamEdges=buildSeamBleedPolygonEdges(topology.map(rendererPolygon),{tileSize:profile.projection.tileSize,layerElevation:profile.projection.layerElevation});
 // An emissive body's leaves are source-lit; the ephemeris light is not consulted (the Sun has no entry there).
 const pages=rasterPagePlan(raster,RASTER_DENSITY);
 if(pages&&(profile.output.layout==='retained'||profile.cutaway))throw new TypeError(`${profile.namespace}: a paged surface needs the composite layout without a cutaway.`);
 const projector=createLeafProjector(profile,assets.emission?[0,0,1]:adapters.bodyFixedSunDirection(solarSource.bodyId),pages,imagePixels);
 const leaves=polygons.map((patch,index)=>projector.surface(patch,index,seamEdges.get(index)));
 const innerPolarLeaves=profile.surface.innerPoles?(['north','south'] as Pole[]).map((pole,index)=>projector.surface(createPolarPatch(profile.surface,pole,true),polygons.length+index)):[];
 const bodyLeaves=[...leaves,...innerPolarLeaves];
 // A ring is its prepared image scaled to the plane's diameter in tile units and centred on the body. It hangs under the
 // same system node as the surface, so it takes the body's orientation and never states one of its own. One square leaf
 // passes through the body's centre and the browser can sort its far side over the body, so a ring the radial lane drew
 // as wedges is one leaf per wedge, each starting outside the body.
 const planes=(profile.planes??[]).map(plane=>{
  const scale=2*plane.radius*profile.projection.tileSize/plane.size,half=scale*plane.size/2,round=(value:number)=>Number(value.toFixed(6));
  const className=`${profile.namespace}-${plane.id}-leaf`,wedges=assets.ringWedges?.[plane.url.slice(plane.url.lastIndexOf('/')+1)];
  const leaves=wedges?wedgeLeaves(plane,wedges,scale,className):[{tag:'s',className,
    style:`transform:matrix3d(0,${round(scale)},0,0,${round(scale)},0,0,0,0,0,1,0,${round(-half)},${round(-half)},0,1);`+
     `--polycss-atlas-width:${plane.size}px;--polycss-atlas-height:${plane.size}px;background-position:0 0;`+
     `background-size:${plane.size}px ${plane.size}px;backface-visibility:visible`}];
  return {id:plane.id,className:`${profile.namespace}-${plane.id}-plane`,url:plane.url,color:plane.color,radius:plane.radius,leaves};
 });
 function wedgeLeaves(plane:{size:number;id:string},wedges:{count:number;contentPixels:number},scale:number,className:string){
  const layout=ringWedgeLayout({size:plane.size,count:wedges.count,contentPixels:wedges.contentPixels});
  if(layout.innerPixels*scale<=profile.surface.radius*profile.projection.tileSize)throw new TypeError(`Ring ${plane.id} wedges would reach into the body; they need more wedges or a ring that begins farther out.`);
  return layout.angles.map((_,k)=>({tag:'s',className,
   style:`transform:matrix3d(${wedgeMatrix(layout,k,scale)});--polycss-atlas-width:${layout.width}px;--polycss-atlas-height:${layout.height}px;`+
    `background-position:0 ${-k*layout.height}px;background-size:${layout.width}px ${layout.height*layout.count}px;backface-visibility:visible`}));
 }
 const interior=profile.cutaway&&assets.interior?prepareCutaway(profile,assets.interior,polygons,leaves,projector):undefined;
 if(Boolean(profile.cutaway)!==Boolean(assets.interior))throw new TypeError('Cutaway geometry and prepared assets must be supplied together.');
 // A stepped outset replaces the stretched compositor overlap. Leaves overlap only by their matched raster overscan,
 // which keeps texels continuous across a seam when magnified, and grow by a prepared amount per silhouette step,
 // so their antialiased edges stay covered at every zoom (see seam-outset.ts).
 const outset=profile.projection.seamOutset?prepareSeamOutsetSteps(profile.projection.seamOutset):undefined;
 const seamRepair=outset?{model:profile.projection.rasterOverscan>0?'prepared-matched-raster-overscan-with-silhouette-stepped-outset':'prepared-exact-tiling-with-silhouette-stepped-outset',seamBleed:0,presentationOverlap:profile.projection.overlap,rasterGutter:profile.projection.rasterGutter,rasterOverscan:profile.projection.rasterOverscan,runtimeEdgeDiscovery:false,outset}
  :{model:'prepared-zero-seam-bleed-with-compositor-overlap',seamBleed:profile.projection.seamBleed,presentationOverlap:profile.projection.overlap,rasterGutter:profile.projection.rasterGutter,rasterOverscan:profile.projection.rasterOverscan,runtimeEdgeDiscovery:false};
 const material=assets.atmosphere?prepareAtmosphericMaterial(profile,raster,assets.atmosphere,adapters.sunReferenceViewDirection(solarSource)):
  assets.lighting?{schema:profile.output.materialSchema,frameCount:assets.lighting.frameCount,logicalDiameter:profile.surface.radius*2,defaultFrame:assets.lighting.defaultFrame,runtimeLighting:false}:
  assets.emission?{...assets.emission,schema:profile.output.materialSchema,model:'emissive',lighting:false,shadows:false,runtimeLighting:false}:undefined;
 if(!material)throw new TypeError('The prepared scene needs a declared material capability.');
 const common={schema:profile.output.schema,camera:physical.camera,systemTransform:physical.systemTransform,presentationFrame:physical.presentationFrame,worldFrame:physical.worldFrame,material,starfield:physical.starfield};
 const scene=profile.output.layout==='retained'?{
  ...common,meshRotationDegrees:profile.bodyRotationDegrees,bodyTransform:buildPolyMeshTransform({rotation:[0,0,profile.bodyRotationDegrees]}),bodyLeaves,
  preparedSurface:{latitudeSegments:profile.surface.latitudeSegments,longitudeSegments:profile.surface.longitudeSegments,radius:profile.surface.radius,bodyFaceCount:leaves.filter(leaf=>!leaf.polarCap).length,polarLeafCount:leaves.filter(leaf=>leaf.polarCap).length+innerPolarLeaves.length,sourceWidth:profile.surface.surface.width,sourceHeight:profile.surface.surfaceLatitudeHeight,retainedSourceLongitudes:profile.surface.longitudeSegments,seamRepair},
  ...(interior?{interior}:{}),...(profile.output.motion?{motion:profile.output.motion}:{}),
  counts:{bodyLeafCount:bodyLeaves.length,interiorLeafCount:interior?.leafCount??0,textureLeafCount:bodyLeaves.length+1+(interior?.leafCount??0),retainedRootCount:profile.output.retainedRootCount}
 }:{...common,runtimeGeometry:false,runtimeRasterization:false,...(planes.length?{planes}:{}),
  body:{leaves:bodyLeaves,equatorialRadius:profile.surface.radius,polarRadius:profile.surface.polarRadius,latitudeSegments:profile.surface.latitudeSegments,longitudeSegments:profile.surface.longitudeSegments,...profile.output.body,sourceMapSize:[profile.surface.surface.width,profile.surface.surface.height],seamRepair,...(pages?{surfacePages:pages}:{})},
  ...(profile.output.animation?{animation:profile.output.animation}:{}),
  counts:{polygonCount:leaves.length,textureLeafCount:bodyLeaves.length,polarLeafCount:leaves.filter(leaf=>leaf.polarCap).length}
 };
 await mkdir(outputDirectory,{recursive:true});await writeFile(resolve(outputDirectory,'scene.json'),JSON.stringify(scene)+'\n');
 return scene;
}
