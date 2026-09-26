import { buildPolyMeshTransform } from '@layoutit/polycss';
import { createSurfacePatches, createPolarPatch, createSectionPatch, outsideCutaway } from '@cssearth/objects';
import type { SurfaceGeometryProfile, SurfacePatch, Pole } from '@cssearth/objects';
import type { GeometryProfile } from './profile.ts';
import type { createLeafProjector, PreparedLeaf } from './projector.ts';
export interface InteriorAssets extends Record<string, unknown> {
 cutaway: {centerLongitudeDegrees:number;widthDegrees:number}; metallicCoreRadiusFraction:number;
 coreUrl:string;corePolesUrl:string;sectionUrl:string;outerPolesUrl:string;
}
export function prepareCutaway(profile:GeometryProfile, assets:InteriorAssets, polygons:SurfacePatch[], leaves:PreparedLeaf[], projector:ReturnType<typeof createLeafProjector>) {
 const cutaway=profile.cutaway;
 if(!cutaway)throw new TypeError('Cutaway assets require an authored geometry profile.');
 const ns=profile.namespace, center=assets.cutaway.centerLongitudeDegrees,width=assets.cutaway.widthDegrees;
 const outside=(patch:SurfacePatch,count:number)=>outsideCutaway(patch,count,center,width);
 const outerPoles=(['south','north'] as Pole[]).map((pole,index)=>{
  const polygon=createPolarPatch(profile.surface,pole);
  polygon.texture=assets.outerPolesUrl;
  polygon.textureImageSource={url:assets.outerPolesUrl,width:cutaway.polarWidth,height:cutaway.polarHeight,sourceRect:{x:pole==='north'?0:cutaway.polarTileSize,y:0,width:cutaway.polarTileSize,height:cutaway.polarTileSize}};
  return projector.surface(polygon,index,undefined,`${ns}-polar ${ns}-cutaway-outer-pole ${ns}-cutaway-outer-pole-${pole}`);
 });
 const outerBodyLeaves=[...outerPoles,...polygons.flatMap((patch,index)=>!patch.pole&&outside(patch,profile.surface.longitudeSegments)?[leaves[index]]:[])];
 const coreProfile:SurfaceGeometryProfile={radius:profile.surface.radius*assets.metallicCoreRadiusFraction,polarRadius:profile.surface.radius*assets.metallicCoreRadiusFraction,
  latitudeSegments:cutaway.coreLatitudeSegments,longitudeSegments:cutaway.coreLongitudeSegments,
  surface:{url:assets.coreUrl,width:cutaway.surfaceWidth,height:cutaway.surfaceHeight},surfaceLatitudeHeight:cutaway.surfaceHeight,packedBandGutter:0,
  poles:{url:assets.corePolesUrl,width:cutaway.polarWidth,height:cutaway.polarHeight},polarTileSize:cutaway.polarTileSize,
  polarRadiusScale:cutaway.polarRadiusScale,polarOffset:cutaway.polarOffset,uv:'global',color:cutaway.color,closeSeamAtZero:false};
 const corePolygons=createSurfacePatches(coreProfile);
 const coreLeaves=corePolygons.filter(patch=>patch.pole||outside(patch,cutaway.coreLongitudeSegments)).map((patch,index)=>projector.interior(patch,index,patch.pole?`${ns}-interior-core-leaf ${ns}-interior-pole ${ns}-interior-pole-${patch.pole}`:`${ns}-interior-core-leaf`));
 const sectionLeaves=[center-width/2,center+width/2].map((longitudeDegrees,index)=>({
  ...projector.interior(createSectionPatch(profile.surface.radius,longitudeDegrees,{url:assets.sectionUrl,width:cutaway.sectionWidth,height:cutaway.sectionHeight},index,cutaway.color),index,`${ns}-interior-section-leaf`,[cutaway.sectionPresentationWidth,cutaway.sectionPresentationHeight]),longitudeDegrees}));
 return {...assets,schema:profile.output.cutawaySchema,presentation:'retained-three-dimensional-source-dimensioned-cutaway',
  cutaway:{centerLongitudeDegrees:center,widthDegrees:width,
   removedLongitudeCount:polygons.filter(patch=>!patch.pole&&!outside(patch,profile.surface.longitudeSegments)).length/(profile.surface.latitudeSegments-2),
   removedCoreLongitudeCount:corePolygons.filter(patch=>!patch.pole&&!outside(patch,cutaway.coreLongitudeSegments)).length/(cutaway.coreLatitudeSegments-2)},
  coreLatitudeSegments:cutaway.coreLatitudeSegments,coreLongitudeSegments:cutaway.coreLongitudeSegments,
  bodyTransform:buildPolyMeshTransform({rotation:[0,0,cutaway.rotationDegrees]}),outerBodyLeaves,coreLeaves,sectionLeaves,
  leafCount:outerBodyLeaves.length+coreLeaves.length+sectionLeaves.length,runtimeGeometry:false,runtimeRasterization:false,
  cameraCoupling:'same-retained-scene-and-unbounded-accumulated-matrix3d-camera-as-exterior',
  // Control pitch past its maximum is a camera above the equator (negative scene pitch): the assist mirrors, tilting the other way.
  presentationOrbit:{schema:profile.output.interiorOrbitSchema,durationMilliseconds:2*cutaway.controlMaximumDegrees*cutaway.millisecondsPerDegree,
   millisecondsPerControlDegree:cutaway.millisecondsPerDegree,assistStartsAtControlPitchDegrees:cutaway.assistStartDegrees,maximumAssistDegrees:cutaway.assistMaximumDegrees,
   keyframes:[{transform:'rotateX(0deg)',offset:0},{transform:'rotateX(0deg)',offset:cutaway.assistStartDegrees/(2*cutaway.controlMaximumDegrees)},
    {transform:`rotateX(${cutaway.assistMaximumDegrees}deg)`,offset:0.5},{transform:`rotateX(${-cutaway.assistMaximumDegrees}deg)`,offset:0.5},
    {transform:'rotateX(0deg)',offset:1-cutaway.assistStartDegrees/(2*cutaway.controlMaximumDegrees)},{transform:'rotateX(0deg)',offset:1}],
   model:'presentation-only-pole-on-cutaway-legibility-assist',changesPhysicalAxialTiltClaim:false,runtimeTransformConstruction:false}};
}
