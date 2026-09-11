import {array,boolean,dictionary,number,optional,shape,text} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import {requireRecord} from '../../../../tools/source-values.mts';
import {validatePreparedCubicSky} from '../../../../src/platform/cubic-sky-contract.mts';
const asset=shape({width:number,height:number,bytes:number,sha256:text});
export const parseMarsScene=shape({schema:text,geometry:requireRecord,
  retainedDom:shape({transformGroupCount:number,bodyLeafCount:number,polarLeafCount:number,totalLeafCount:number,
    starfieldFaceCount:number,sunBillboardCount:number,sunCubemapBakeCount:number,runtimeTopology:boolean}),
  starfield:(value:unknown)=>validatePreparedCubicSky(value,{requireSun:false}),
  leaves:array(shape({tag:text,className:optional(text),style:text,latitudeIndex:optional(number),longitudeIndex:optional(number)})),
  surface:shape({encoding:text,seamRepair:requireRecord,polarCaps:shape({transparentPixelRatio:number,boundaryLatitudeDegrees:number,
    innerInset:number,singularityStabilization:requireRecord,runtimeProjection:boolean})}),
  motion:shape({runtimeJavaScriptPerFrame:boolean}),assets:shape({surface:asset,surface2x:asset,poles:asset,poles2x:asset})});
const row=shape({url:text,width:number,height:number,bytes:number,sha256:text,encoding:text,rowIndex:number});
const bank=shape({schema:text,preparedPixelDensity:number,frameSize:number,totalBytes:number,presentationFrameSize:number,
  transport:shape({model:text,encoding:text,preloadBeforeMount:boolean,retainedLeafCount:number,interpolation:text,frameGutter:number,
    rasterFrameGutter:number,framesPerRow:number,rowColumns:number,rowCount:number,defaultFrame:number,defaultRow:number,
    initialWarmRows:array(number),maximumRetainedRowCount:number,addressWritesOnlyOnInput:boolean,retainLastReadyPresentation:boolean,
    idleCallbacks:number,publicationModel:text,initialDecodedWorkingSetBytes:number,maximumDecodedWorkingSetBytes:number}),
  rows:array(row),presentations:array(shape({frameIndex:number,phaseFrame:number,shadows:boolean,lightViewZ:number,rowIndex:number,url:text,backgroundPosition:text,backgroundSize:text,cameraLightDirection:array(number)}))});
export const parseMarsLighting=shape({schema:text,model:text,bankFingerprint:text,generatorFingerprint:text,frameCount:number,
  minimumLightViewZ:number,maximumLightViewZ:number,baseLightAzimuthDegrees:number,shadowlessFrameOffset:number,presentationFrameSize:number,preparedPixelDensities:array(number),sourceWorldLightDirection:array(number),
  worldLightDirection:array(number),initialViewLightDirection:array(number),cameraContract:text,defaultFrame:number,illuminationGeometry:requireRecord,
  outerRadius:number,projection:shape({samples:array(shape({frameIndex:number,pitchDegrees:number}))}),
  atmosphere:shape({openSpace:shape({atmosphereRadiusRatio:number,mie:shape({anisotropy:number})}),runtimeRasterization:boolean,
    externalHalo:text,sourceReference:requireRecord,color:array(number)}),shadow:requireRecord,banks:dictionary(bank)});
export const parseMarsCamera=shape({schema:text,model:text,cameraModel:text,minimumControlPitchDegrees:number,maximumControlPitchDegrees:number,
  defaultControlPitchDegrees:number,defaultControlYawDegrees:number,initialScenePitchDegrees:number,maximumScenePitchDegrees:number,
  minimumZoom:number,maximumZoom:number,defaultZoom:number,logicalBodyDiameter:number,sceneScale:number,
  horizontalOrbit:boolean,pitchBounded:boolean,yawBounded:boolean,runtimeMatrixFormatting:boolean,stateCount:optional(number),zoomStateCount:optional(number),
  responsiveFit:requireRecord,oracleContract:shape({sampleCount:number,orientation:shape({maximumAngularResidualDegrees:number})}),materialDepthContract:shape({model:text,referenceScenePitchDegrees:number,
    planeTransform:text,depthBias:number,runtimeGeometry:boolean,runtimeRasterization:boolean})});

export const parseMarsLenses=shape({schema:text,defaultLens:text,runtimeFilters:boolean,runtimeRasterization:boolean,controls:array(shape({
 id:text,label:text,shortLabel:text,measurement:text,thumbnailUrl:text,surfaceUrl:text,surface2xUrl:text,polesUrl:text,poles2xUrl:text,
 falseColor:boolean,qualification:text,coveragePreparation:optional(text),polarPreparation:optional(shape({boundaryLatitudeDegrees:number,
 singularityStabilization:shape({model:text}),runtimeProjection:boolean}))}))});
export const parseMarsSkyMetadata=shape({source:text,sourceLicense:text,pointSourcePresentation:requireRecord,photographicSeparation:shape({standardDiffuseGain:number,standardDetailGain:number}),oracleCameraContract:shape({qualification:text})});
export const parseMarsSunMetadata=shape({asset:shape({googlePixelsRedistributed:boolean,sourcePixels:text,density1:shape({url:text,width:number,height:number,bytes:number,sha256:text}),density2:shape({url:text,width:number,height:number,bytes:number,sha256:text})}),
 projection:shape({fixedAngularSize:boolean,apparentViewportWidthShare:number}),distanceScaling:shape({physicalDiskViewportWidthShare:number}),
 defaultCameraBinding:shape({nativeSampleId:text}),appearance:shape({analyticRadialFit:requireRecord})});
