import type { AtmosphereSource, AtmosphereMaterial } from '@cssearth/objects';
import type { RasterRecipe } from '../../../../preparation/raster/config.js';
import { outputName } from '../../../../preparation/raster/io.js';
import type { GeometryProfile } from './profile.js';
export function prepareAtmosphericMaterial(profile:GeometryProfile,raster:RasterRecipe,source:AtmosphereSource,model:AtmosphereMaterial,sunDirection:readonly number[]) {
 const material=raster.atmosphere;
 if(!material)throw new TypeError('Atmospheric scene material needs a raster recipe.');
 const url=(template:string)=>raster.publicBase+outputName(template);
 return {schema:profile.output.materialSchema,model:'source-parameter-bound-light-terminator-and-atmosphere-phase-bank',
  materialUrl:url(material.materialOutput),observationMaterialUrl:url(material.observationOutput),lightingUrl:url(material.lightingOutput),
  logicalSize:material.logicalSize,tileSize:material.tileSize,directionalFrameCount:material.directionalFrameCount,frameCount:material.frameCount,frameColumns:material.columns,frameRows:material.rows,
  minimumLightViewZ:material.minimumLightViewZ,maximumLightViewZ:material.maximumLightViewZ,baseLightAzimuthDegrees:180,defaultFrame:material.frameCount-1,
  backgroundSize:`${material.columns*material.logicalSize}px ${material.rows*material.logicalSize}px`,backgroundPositions:Array.from({length:material.frameCount},(_,frame)=>`${-(frame%material.columns)*material.logicalSize}px ${-Math.floor(frame/material.columns)*material.logicalSize}px`),
  atmosphereHeightKm:source.atmosphereHeightKm,sourceRadiusKm:source.planetRadiusKm,outerRadiusScale:model.outerRadiusScale,presentationScale:material.coverageScale,materialScale:material.contentScale,
  silhouetteCoverage:{model:'prepared-analytic-sphere-proportional-overscan',coverageScale:material.coverageScale,materialScale:material.contentScale,rimFill:'prepared-radial-binary-clamp-to-material-limb',runtime:false},
  observationMaterial:{model:'prepared-surface-lighting-with-physical-exterior-atmosphere-limb',surfaceAtmosphereOpacity:0,exteriorAtmosphereMaximumKm:source.atmosphereHeightKm,runtimeOpacity:false,runtimeRasterization:false},
  atmosphereColor:model.color,atmosphereMaximumAlpha:model.maximumAlpha,atmosphereLimbExponent:model.limbExponent,atmosphereNightFloor:model.nightFloor,sourceParameters:source,
  lightingModel:{directionalLight:{direction:sunDirection,color:profile.projection.lightColor,intensity:Math.PI},ambientFromGroundReflectance:Math.sqrt(source.averageGroundReflectance),terminatorSmoothstep:material.terminator,
   surfaceResponse:{model:'prepared-directional-shadow-with-dedicated-flood-frame',colorOverlay:false,textureExposureShoulder:raster.surfaces[0].exposure,directionalShadowRelease:material.directionalShadowRelease,shadowlessFloodShadowRelease:material.floodShadowRelease,shadowReleaseSmoothstep:material.sunwardShadowRelease},presentationPhaseRemap:null,interpolation:'nearest-prepared-phase-with-runtime-css-roll'},runtimeLightingMath:false,runtimeRasterization:false};
}
