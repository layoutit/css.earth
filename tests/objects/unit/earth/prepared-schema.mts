import {array,boolean,dictionary,number,optional,shape,text,choice,nullable} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import {requireRecord} from '../../../../tools/sources/source-values.mts';

const dimensions={width:number,height:number};
const pair=shape({one:text,two:text});
const rectangle=shape({x:number,y:number,...dimensions});
const layer=shape({schema:text,rasterScale:number,frameMatrix:text,textureMatrix:text});
const leaf=shape({tag:choice('s','u'),className:text,style:text,projectiveTextureLayer:optional(layer),geographicFrameMatrix:optional(text),
  sourceRect:optional(rectangle),leafWidth:number,leafHeight:number,projection:text,lighting:text,lightingOverlay:boolean,
  asset:optional(shape({one:text,two:text,width:optional(number),height:optional(number)})),backfaceVisible:optional(boolean)});
const bands=array(shape({latitudeIndex:number,visualRotationSeconds:number,leaves:array(leaf)}));
const transport=shape({model:text,defaultRow:number,initialWarmRows:array(number),maximumRetainedRowCount:number,framesPerShard:number,
  shardCount:number,retainLastReadyPresentation:boolean,addressWritesOnlyOnInput:boolean,idleCallbacks:number,
  initialDecodedWorkingSetBytes:shape({one:number,two:number}),maximumDecodedWorkingSetBytes:shape({one:number,two:number})});
const material=shape({id:text,model:text,source:nullable(requireRecord),frameCount:number,columns:number,rows:number,framesPerShard:number,
  shardCount:number,preparedRows:array(shape({rowIndex:number,assets:pair})),planetRadius:number,physicalRadius:number,
  sourceTileSize:number,presentationTileSize:number,gutter:number,stride:number,shardWidth:number,shardHeight:number,defaultFrame:number,
  defaultRow:number,defaultAssets:pair,shadowlessAssets:optional(pair),defaultScenePitchDegrees:number,
  defaultPresentation:shape({transform:text,assets:pair,backgroundPosition:text,backgroundSize:text}),
  shadowlessPresentation:optional(shape({assets:pair,backgroundPosition:text,backgroundSize:text})),
  frames:array(shape({frameIndex:number,rowIndex:number,columnIndex:number,tileRowIndex:number,scenePitchDegrees:number,assets:pair,
    backgroundPosition:text,backgroundSize:text,transform:text})),transformPlayback:shape({schema:text,keyframes:array(requireRecord),runtimeTransformConstruction:boolean}),

  leaf:shape({tag:choice('s','u'),className:text,style:text}),transport,runtimeLightingMath:boolean,runtimeRasterization:boolean});
const atmosphereSource=shape({outerRadiusRatio:number,planetRadiusKm:number,atmosphereHeightKm:number});
export const parseEarthScene=shape({schema:text,
  camera:shape({state:shape({target:array(number),rotX:number,rotY:number,zoom:number,distance:number}),style:text,sceneStyle:text,
    minimumPitchDegrees:number,defaultPitchDegrees:number,maximumPitchDegrees:number,defaultScenePitchDegrees:number,
    minimumZoom:number,defaultZoom:number,maximumZoom:number,sceneScale:number,orbitPlayback:shape({schema:text,
      minimumControlPitchDegrees:number,maximumControlPitchDegrees:number,durationMilliseconds:number,millisecondsPerControlDegree:number,
      keyframes:array(requireRecord),runtimeTransport:text,runtimeTransformConstruction:boolean})}),
  earth:shape({equatorialRadiusKm:number,polarRadiusKm:number,surfaceRotationSeconds:number,bodyMatrix:array(number),
    systemTransform:text,meshTransform:text,faceRetention:text}),
  body:shape({latitudeSegments:number,longitudeSegments:number,polarCapBandSpan:number,bands,
    assets:shape({surface:shape({url:text,...dimensions,presentationCellSize:number,urls:array(text),pages:array(shape(dimensions)),
      raster:shape({...dimensions,bandCount:number,gutter:number,overscan:number}),
      atlas:shape({pageSize:number,density:number,gutter:number,sourceWidth:number,sourceHeight:number})}),poles:shape({url:text,...dimensions})}),
    seamRepair:shape({model:text,seamBleed:number,presentationOverlap:number,rasterGutter:number,rasterOverscan:number,runtimeEdgeDiscovery:boolean})}),
  material:shape({transform:text,lighting:material,atmosphere:(value:unknown)=>({...material(value),source:atmosphereSource(requireRecord(value).source),illumination:shape({minimumLightViewZ:number,maximumLightViewZ:number})(requireRecord(value).illumination)})}),
  interior:shape({schema:text,qualification:text,source:requireRecord,cutaway:shape({centerLongitudeDegrees:number,widthDegrees:number,qualification:text}),
    outerBodyBands:bands,outerAssets:shape({surface:shape({one:text,two:text,oneUrls:array(text),twoUrls:array(text)}),poles:pair,
      litSurface:shape({urls:array(text)}),litPoles:pair}),shells:array(shape({id:text,label:text,radiusScale:number,cutaway:boolean,className:text,leaves:array(leaf)})),
    sectionLeaves:array(leaf),leafCount:number,runtimeGeometry:boolean,runtimeRasterization:boolean}),
  counts:shape({surfaceLeafCount:number,cloudLeafCount:number,lightingLeafCount:number,atmosphereLeafCount:number,
    interiorLeafCount:number,cityPageLeafCount:number,noisePageLeafCount:number,retainedLeafCount:number,
    maximumRetainedLeafCount:number,runtimeGeometryPreparation:boolean,runtimeRasterization:boolean})});

export const parseEarthLenses=shape({schema:text,defaultLens:text,runtimeFilters:boolean,runtimeRasterization:boolean,
  controls:array(shape({id:text,label:text,shortLabel:text,thumbnailUrl:text,view:optional(text),surfaceUrl:optional(text),surfaceUrls:optional(array(text)),
    polesUrl:optional(text),surfaceBankId:optional(text),qualification:text,maximumZoom:optional(number)})),provenance:dictionary(text)});
export const parseEarthPlaces=shape({url:text,bytes:number,sha256:text,count:number,sourcePage:text,license:text,snapshotDate:text});
const source=shape({url:text,label:text,checked:optional(text)});
const fact=shape({id:text,label:text,value:text,source:optional(source)});
export const parseEarthTitle=shape({label:text,viewBox:text,width:number,height:number,path:text});
export const parseEarthPanel=shape({facts:array(fact),moreFacts:array(fact)});
export const parseEarthPageMetadata=shape({schema:text,dataset:text,qualification:text,credit:text,sourcePage:text,assetOrigin:text,
  rasterScale:number,poolSize:number,minimumZoom:number,decodedPageBytes:number,maximumDecodedBytes:number,maximumConcurrentLoads:number,
  targetCssPixels:number,roots:array(requireRecord),initialLayer:requireRecord,index:shape({maximumDirectories:number,maximumBytes:number,
    maximumDirectoryBytes:number,maximumConcurrentLoads:number}),geometryOrigin:optional(text),geometryVersion:optional(text),
  camera:optional(shape({controlPitch:number,controlYaw:number,zoom:number})),topology:optional(text),pageTemplate:optional(text),maximumZoom:optional(number),canonicalDprIndependent:optional(boolean)});
