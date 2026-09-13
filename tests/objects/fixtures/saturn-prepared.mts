import {array,boolean,dictionary,number,nullable,optional,shape,text} from '../../../tools/objects/terrestrial-layers/source-records.mts';
import {requireRecord} from '../../../tools/source-values.mts';
import {preparedLeaf,textureLayer} from './prepared-schemas.mts';
const bands=array(shape({visualRotationSeconds:number,leaves:array(preparedLeaf)}));
const asset=shape({url:text,width:number,height:number,bytes:number,sha256:text});
const prepared=shape({url:text,width:number,height:number,asset});
const frame=shape({assetUrl:text,frameIndex:optional(number),rowIndex:optional(number),backgroundPosition:text,backgroundSize:text});
const shards=shape({model:text,defaultVariant:text,defaultPreparedFrame:number,defaultPreparedRow:number,initialWarmRows:array(number),
  maximumRetainedAtlasCount:number,variants:dictionary(shape({runtimeAtlas:shape({assetUrl:text}),defaultPresentation:frame,
    rows:array(shape({assetUrl:text})),presentations:array(frame)})),initialDecodedWorkingSetBytes:optional(number),maximumDecodedWorkingSetBytes:optional(number)});
export const parseSaturnScene=shape({schema:text,systemTransform:text,meshTransform:text,
  camera:shape({state:shape({rotX:number,rotY:number,zoom:number,distance:number,target:array(number)}),sceneStyle:text,orbitPlayback:shape({schema:text,minimumControlPitchDegrees:number,maximumControlPitchDegrees:number,
    defaultControlPitchDegrees:number,maximumScenePitchDegrees:number,durationMilliseconds:number,millisecondsPerControlDegree:number,
    keyframes:array(requireRecord),interpolation:text,runtimeTransport:text,runtimeMatrixConstructionForPitch:boolean,runtimeTransformStringFormattingForPitch:boolean})}),
  preparedSurface:shape({mode:text,assetUrl:text,assetBytes:number,assetSha256:text,faceCount:number,uvLayout:text,
    equivalentBodySampleWidth:number,equivalentBodySampleHeight:number,seamRepair:requireRecord}),
  transport:shape({sourceSchema:text,sourceMetadataModule:text,retainedLeafFields:array(text),minorMoonFields:array(text),runtimeSourceParsing:boolean}),
  preparedLighting:shape({mode:text,orbitAtlas:shape({frameCount:number,frameRows:number,minimumScenePitchDegrees:number,maximumScenePitchDegrees:number,runtimeShards:shards})}),
  fixedMaterialPlane:shape({transform:text,leaf:shape({tag:text,style:text}),interactionProjection:shape({equatorialRadius:number,polarRadius:number,
    coverageScale:number,textureSize:number,depthBias:number,presentationNodeDegrees:number,meshRotationDegrees:number,tileSize:number})}),
  preparedRingSource:shape({planeVisualOrbitSeconds:number,saturnGmKm3PerS2:number,shadowModel:shape({systemTiltDegrees:number,systemNodeDegrees:number})}),
  ringPlane:shape({style:text,projectiveTextureLayer:textureLayer}),ringShadowPlane:shape({style:text,projectiveTextureLayer:textureLayer}),
  ringMotionPlates:array(shape({population:text,durationSeconds:number,textureUrl:text,leaf:shape({style:text,projectiveTextureLayer:textureLayer})})),
  ringMotionExpansionPlates:array(requireRecord),ringPointGroups:array(requireRecord),bodyBands:bands,
  interior:shape({schema:text,outerBodyBands:bands,shells:array(shape({className:text,leaves:array(preparedLeaf)})),sectionLeaves:array(preparedLeaf),
    atmosphere:shape({model:text,frameCount:number,minimumScenePitchDegrees:number,maximumScenePitchDegrees:number,leaf:preparedLeaf,runtimeShards:shards}),leafCount:number}),
  preparedMotion:shape({referenceRotationVisualSeconds:number,obliquityDegrees:number,cameraRotationXDegrees:number}),counts:dictionary(number)});
export const parseSaturnViews=shape({schema:text,presentation:text,runtimeGeometry:boolean,runtimeRasterization:boolean,
  defaultView:optional(text),controls:optional(array(requireRecord)),
  lighting:shape({model:text,authority:text,objectLightDirection:array(number),sectionFaceLongitudesDegrees:array(number),sectionFaceCount:number,runtimeLighting:boolean}),
  cutaway:requireRecord,interiorLenses:dictionary(shape({id:text,model:text,qualification:text,sectionResponse:requireRecord,shellGain:dictionary(number),
    assets:dictionary(prepared),runtimeFiltering:boolean,runtimeRasterization:boolean})),
  assets:shape({section:prepared,metallic:prepared,core:prepared,metallicPoles:prepared,corePoles:prepared,outerPoles:dictionary(prepared),thumbnail:asset}),provenance:requireRecord});
const lensBase={id:text,materialLens:text,label:text,shortLabel:text,thumbnailUrl:text,qualification:text};
const exteriorFields={...lensBase,surfaceUrl:text,polesUrl:text,ringUrl:text,materialUrl:optional(text)};
const colorFields={...exteriorFields,materialVariant:text,materialPreparationFile:text,filter:text,
  falseColorPalette:array(array(number)),materialGain:number,sourceModel:text,detailPreparation:text,detailCarrierUrl:text,
  maximumDetailScale:number,sourceFiles:array(text),sourceUrls:array(text)};
function lens(value:unknown) {
 const record=requireRecord(value);
 if(record.view==='interior')return {...shape({...lensBase,interiorMaterialUrl:text})(value),view:'interior' as const,
  falseColor:undefined,surfaceUrl:undefined,polesUrl:undefined,ringUrl:undefined,materialUrl:undefined};
 if(record.falseColor===true)return {...shape(colorFields)(value),falseColor:true as const,view:undefined,interiorMaterialUrl:undefined};
 return {...shape(exteriorFields)(value),falseColor:undefined,view:undefined,interiorMaterialUrl:undefined};
}
export const parseSaturnLenses=shape({schema:text,defaultLens:text,runtimeFilters:boolean,runtimeRasterization:boolean,
  controls:array(lens),provenance:requireRecord});
export const parseSaturnLayouts=shape({schema:text,sources:dictionary(text),classes:dictionary(shape({width:text,height:text,backgroundSize:text}))});
