import { RASTER_DENSITY, type RasterRecipe } from '../../../../preparation/raster/config.js';
import { outputName } from '../../../../preparation/raster/io.js';
import type { prepareAtmosphere } from '../../../../preparation/raster/materials.js';
import type { GeometryProfile } from './profile.js';
/** The scene record of a body with an atmosphere: its prepared frame atlases, the published disc law and the PSG halo when it has one. */
export function prepareAtmosphericMaterial(profile:GeometryProfile,raster:RasterRecipe,prepared:Awaited<ReturnType<typeof prepareAtmosphere>>,sunDirection:readonly number[]) {
 const material=raster.atmosphere;
 if(!material)throw new TypeError('Atmospheric scene material needs a raster recipe.');
 const url=(template:string)=>raster.publicBase+outputName(template,RASTER_DENSITY);
 return {schema:profile.output.materialSchema,model:prepared.halo?'published-disc-law-and-psg-limb-halo-phase-bank':'published-disc-law-phase-bank',
  materialUrl:url(material.materialOutput),material2xUrl:url(material.materialOutput),observationMaterialUrl:url(material.observationOutput),observationMaterial2xUrl:url(material.observationOutput),lightingUrl:url(material.lightingOutput),lighting2xUrl:url(material.lightingOutput),
  logicalSize:material.logicalSize,tileSize:material.tileSize,directionalFrameCount:material.directionalFrameCount,frameCount:material.frameCount,frameColumns:material.columns,frameRows:material.rows,
  minimumLightViewZ:material.minimumLightViewZ,maximumLightViewZ:material.maximumLightViewZ,baseLightAzimuthDegrees:180,defaultFrame:material.frameCount-1,
  backgroundSize:`${material.columns*material.logicalSize}px ${material.rows*material.logicalSize}px`,backgroundPositions:Array.from({length:material.frameCount},(_,frame)=>`${-(frame%material.columns)*material.logicalSize}px ${-Math.floor(frame/material.columns)*material.logicalSize}px`),
  presentationScale:material.coverageScale,materialScale:material.contentScale,outerRadiusScale:prepared.halo?.outerRadiusScale??1,
  silhouetteCoverage:{model:'prepared-analytic-sphere-proportional-overscan',coverageScale:material.coverageScale,materialScale:material.contentScale,rimFill:'prepared-radial-binary-clamp-to-material-limb',runtime:false},
  observationMaterial:{model:prepared.halo?'published-disc-law-and-psg-limb-halo-for-false-colour-lenses':'published-disc-law-for-false-colour-lenses',runtimeOpacity:false,runtimeRasterization:false},
  limb:prepared.limb,halo:prepared.halo,
  lightingModel:{directionalLight:{direction:sunDirection,color:profile.projection.lightColor,intensity:Math.PI},surfaceResponse:{model:'published-photometric-models-with-dedicated-flood-frame',colorOverlay:true,textureExposureShoulder:raster.surfaces[0].exposure},presentationPhaseRemap:null,interpolation:'nearest-prepared-phase-with-runtime-css-roll'},runtimeLightingMath:false,runtimeRasterization:false};
}
