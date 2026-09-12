import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildPolyMeshTransform, buildSeamBleedPolygonEdges } from '@layoutit/polycss';
import { createSurfacePatches, createPolarPatch } from '@cssearth/objects';
import type { AtmosphereSource, AtmosphereMaterial, Pole } from '@cssearth/objects';
import type { RasterRecipe } from '../../../../preparation/raster/config.js';
import type { GeometryProfile } from './profile.js';
import { createLeafProjector, rendererPolygon } from './projector.js';
import { prepareCutaway } from './cutaway.js';
import type { InteriorAssets } from './cutaway.js';
import { prepareAtmosphericMaterial } from './atmosphere.js';
export { parseGeometryProfile } from './profile.js';
export type { GeometryProfile } from './profile.js';
export interface PhysicalScene {
 camera:unknown;systemTransform:unknown;presentationFrame:unknown;heliocentricView:unknown;worldFrame:unknown;starfield:unknown;
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
 atmosphere?:{source:AtmosphereSource;model:AtmosphereMaterial};
 /** An unlit body: source-lit leaves, no lighting bank, stationary off-limb context and limb plate. */
 emission?:Record<string,unknown>&{offLimbContext:{logicalSize:number};limbMaterial:{logicalSize:number}};
}
export interface GeometrySceneOptions {
 profile:GeometryProfile;raster:RasterRecipe;assets:GeometrySceneAssets;solarSource:SolarSceneSource;
 starfield:Record<string,unknown> & {faces:readonly unknown[]};sun:Record<string,unknown>|null;
 /** The authored world context (prepared spatial context) of a body the ephemeris tables do not place, such as the Sun. */
 worldContext?:unknown;
 adapters:ScenePreparationAdapters;outputDirectory:string;
}
export async function prepareGeometryScene({profile,raster,assets,solarSource,starfield,sun,worldContext,adapters,outputDirectory}:GeometrySceneOptions) {
 if(profile.surface.radius!==solarSource.bodyRadiusUnits)throw new TypeError('Authored surface radius differs from the physical scene scale.');
 const physical=await adapters.preparePhysicalScene({...solarSource,starfield,sun,...(worldContext!==undefined?{worldContext}:{})});
 const polygons=createSurfacePatches(profile.surface,profile.projection.overlap);
 const topology=createSurfacePatches(profile.surface,0);
 const seamEdges=buildSeamBleedPolygonEdges(topology.map(rendererPolygon),{tileSize:profile.projection.tileSize,layerElevation:profile.projection.layerElevation});
 // An emissive body's leaves are source-lit; the ephemeris light is not consulted (the Sun has no entry there).
 const projector=createLeafProjector(profile,assets.emission?[0,0,1]:adapters.bodyFixedSunDirection(solarSource.bodyId));
 const leaves=polygons.map((patch,index)=>projector.surface(patch,index,seamEdges.get(index)));
 const innerPolarLeaves=profile.surface.innerPoles?(['north','south'] as Pole[]).map((pole,index)=>projector.surface(createPolarPatch(profile.surface,pole,true),polygons.length+index)):[];
 const bodyLeaves=[...leaves,...innerPolarLeaves];
 const interior=profile.cutaway&&assets.interior?prepareCutaway(profile,assets.interior,polygons,leaves,projector):undefined;
 if(Boolean(profile.cutaway)!==Boolean(assets.interior))throw new TypeError('Cutaway geometry and prepared assets must be supplied together.');
 const seamRepair={model:'prepared-zero-seam-bleed-with-compositor-overlap',seamBleed:profile.projection.seamBleed,presentationOverlap:profile.projection.overlap,rasterGutter:profile.projection.rasterGutter,rasterOverscan:profile.projection.rasterOverscan,runtimeEdgeDiscovery:false};
 const material=assets.atmosphere?prepareAtmosphericMaterial(profile,raster,assets.atmosphere.source,assets.atmosphere.model,adapters.sunReferenceViewDirection(solarSource)):
  assets.lighting?{schema:profile.output.materialSchema,frameCount:assets.lighting.frameCount,logicalDiameter:profile.surface.radius*2,defaultFrame:assets.lighting.defaultFrame,runtimeLighting:false}:
  assets.emission?{...assets.emission,schema:profile.output.materialSchema,model:'emissive',lighting:false,shadows:false,runtimeLighting:false}:undefined;
 if(!material)throw new TypeError('The prepared scene needs a declared material capability.');
 const common={schema:profile.output.schema,camera:physical.camera,systemTransform:physical.systemTransform,presentationFrame:physical.presentationFrame,heliocentricView:physical.heliocentricView,worldFrame:physical.worldFrame,material,starfield:physical.starfield};
 const scene=profile.output.layout==='retained'?{
  ...common,meshRotationDegrees:profile.bodyRotationDegrees,bodyTransform:buildPolyMeshTransform({rotation:[0,0,profile.bodyRotationDegrees]}),bodyLeaves,
  preparedSurface:{latitudeSegments:profile.surface.latitudeSegments,longitudeSegments:profile.surface.longitudeSegments,radius:profile.surface.radius,bodyFaceCount:leaves.filter(leaf=>!leaf.polar).length,polarLeafCount:leaves.filter(leaf=>leaf.polar).length+innerPolarLeaves.length,sourceWidth:profile.surface.surface.width,sourceHeight:profile.surface.surfaceLatitudeHeight,retainedSourceLongitudes:profile.surface.longitudeSegments,seamRepair},
  ...(interior?{interior}:{}),...(profile.output.motion?{motion:profile.output.motion}:{}),
  counts:{bodyLeafCount:bodyLeaves.length,interiorLeafCount:interior?.leafCount??0,textureLeafCount:bodyLeaves.length+1+(interior?.leafCount??0),retainedRootCount:profile.output.retainedRootCount,starfieldFaceCount:starfield.faces.length,sunBillboardCount:1,sunCubemapBakeCount:0}
 }:{...common,runtimeGeometry:false,runtimeRasterization:false,
  body:{leaves:bodyLeaves,equatorialRadius:profile.surface.radius,polarRadius:profile.surface.polarRadius,latitudeSegments:profile.surface.latitudeSegments,longitudeSegments:profile.surface.longitudeSegments,...profile.output.body,sourceMapSize:[profile.surface.surface.width,profile.surface.surface.height],seamRepair},
  ...(profile.output.animation?{animation:profile.output.animation}:{}),
  counts:{polygonCount:leaves.length,textureLeafCount:bodyLeaves.length,polarLeafCount:leaves.filter(leaf=>leaf.polarCap).length,starfieldFaceCount:starfield.faces.length,sunBillboardCount:1,sunCubemapBakeCount:0}
 };
 await mkdir(outputDirectory,{recursive:true});await writeFile(resolve(outputDirectory,'scene.json'),JSON.stringify(scene)+'\n');
 return scene;
}
