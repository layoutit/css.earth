import { requireRecord, requireArray, requireString, requireFiniteNumber } from '../../source-values.mts';
export type Decoder<T> = (value: unknown) => T;
export const text = requireString;
export const number = requireFiniteNumber;
export const optional = <T,>(decode: Decoder<T>): Decoder<T | undefined> => value => value === undefined ? undefined : decode(value);
export const nullable = <T,>(decode: Decoder<T>): Decoder<T | null> => value => value === null ? null : decode(value);
export const array = <T,>(decode: Decoder<T>): Decoder<T[]> => value => requireArray(value).map(decode);
export function boolean(value: unknown): boolean { if (typeof value !== 'boolean') throw new TypeError('Expected source boolean'); return value; }
export function shape<const T extends Record<string, Decoder<unknown>>>(fields: T): Decoder<{ -readonly [K in keyof T]: ReturnType<T[K]> }> {
  return value => {
    const source = requireRecord(value), result: Record<string, unknown> = { ...source };
    for (const [key, decode] of Object.entries(fields)) {
      try { const field = decode(source[key]); if (field !== undefined || Object.hasOwn(source, key)) result[key] = field; }
      catch (error) { throw new TypeError(`Terrestrial source ${key}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    return result as { -readonly [K in keyof T]: ReturnType<T[K]> };
  };
}
export const dimensions = {width:number,height:number};
export const parseDimensions = shape(dimensions);
export const parseTransform = shape({scale:number,offset:number});
export const parseFloatMapGrid = shape({...dimensions,productId:text,dataSetId:text,targetName:text,pixelsPerDegree:number,
  referenceRadiusMeters:number,sampleProjectionOffset:number,lineProjectionOffset:number,projectionRotation:text,
  centerLongitudeWestDegrees:optional(number),longitudeRangeWest:optional(array(number)),
  centerLongitudeEastDegrees:optional(number),longitudeRangeEast:optional(array(number)),
  missingBits:optional(text),missingValue:optional(number),sampleType:optional(text),coordinateSystem:optional(text),
  latitudeRange:optional(array(number))});
export const parseFloatMapLens = shape({path:text,labelPath:optional(text),grid:parseFloatMapGrid,sampling:optional(text),valueTransform:optional(parseTransform)});
export const parseBytePolicy = shape({noData:optional(number),connectedEdge:optional(text)});
export const parseImageEntry = shape({...dimensions,id:optional(text),path:text,projection:shape({referenceRadiusMeters:number})});
export const parseRadialTableProfile = shape({latitudeStepDegrees:number,longitudeStepDegrees:number,metersPerUnit:number,
  expectedRecords:number,columns:optional(array(text)),longitudeDirection:text,noDataRadius:optional(number)});
export const parsePdsImagePolicy = shape({schema:text,format:text,sampling:text,datasetId:text,productId:text,productVersion:text,
  target:text,path:text,labelPath:text,sourceUnit:text,valueTransform:parseTransform,validRange:optional(array(number)),
  grid:shape({...dimensions,latitudeRange:array(number),longitudeRange:array(number),pixelsPerDegree:number,
    referenceRadiusMeters:number,frame:text,scalingFactor:number,offset:number,noData:nullable(number)})});
export const parseIsis3Grid = shape({...dimensions,allowMissingLongitudeBounds:optional(boolean),longitudeRange:array(number),
  targetName:text,centerLongitude:number,referenceRadiusMeters:number,polarRadiusMeters:number,origin:array(number),resolutionMeters:number});
export const parseScalarGridProfile = shape({...dimensions,member:text,pixelsPerDegree:number,noData:number,validRange:array(number)});
export const parsePds4Policy = shape({kind:text,labelPath:text,lidvid:text,bands:array(number),wavelengthsNm:array(number),displayRange:array(number)});
export const parseFitsPolicy = shape({bitpix:number,longitudeDirection:text,rowOrder:text,centerLongitude:number,noData:number,displayRange:array(number)});
export const parseEncounterPolicy = shape({...dimensions,instrument:text,startTime:text,filter:text,target:text,residualPolicy:optional(text),detectorBorderPixels:optional(number)});
export const meshDimensions = {metersPerUnit:number,expectedVertices:number,expectedFaces:number};
export const meshProfileFields = {...meshDimensions,member:optional(text),compression:optional(text)};
export const parseMeshProfile = shape(meshProfileFields);
export const parsePlateProfile = shape({...meshProfileFields,indexBase:number,provenanceFlags:optional(text)});
export const parseRadiusProfile = shape({...meshProfileFields,stepDegrees:number,longitudeDirection:text});
export const parseImageDemProfile = shape({columns:number,step:number,xyTransform:array(number),zOffsetMeters:number,expectedVertices:number,expectedFaces:number});
export const parseSurfaceSampling = shape({method:text,maximumDistanceMeters:number});
export const parseSurfaceLens = shape({surfaceSampling:parseSurfaceSampling,valueTransform:optional(parseTransform)});
export const parseShapeLens = shape({format:text,path:text,grid:parseMeshProfile,facetField:optional(requireRecord),
  sampleGrid:optional(shape({width:optional(number),height:optional(number)})),coverage:optional(shape({path:text,member:text,field:text})),
  surfaceSampling:optional(parseSurfaceSampling),valueTransform:optional(parseTransform)});
export const parseMeshLighting = shape({maximumDistanceMeters:number,rayOffsetMeters:number,ambient:number,diffuse:number,
  uniformFlood:optional(boolean),floodLights:array(shape({direction:array(number),weight:number}))});

export function decodeProfile<T>(decode: Decoder<T>, value: unknown, message: string): T {
  try { return decode(value); } catch (cause) { throw new TypeError(message, {cause}); }
}
export const projectionGrid = shape({pixelsPerDegree:number,sampleOffset:number,lineOffset:number});
export const pixelValidityFields = {noData:nullable(number),zeroValidity:optional(text),withholdLatitudeDegrees:optional(number),withholdLongitudeDegrees:optional(array(number))};
export const parseByteObservationPolicy = shape({kind:optional(text),centerLongitude:number,noData:nullable(number),
  connectedFillRange:optional(array(number)),connectedEdge:optional(text),grid:optional(projectionGrid)});
export const parseProjectedBytePolicy = shape({centerLongitude:number,noData:number,grid:projectionGrid});
export const parseRgbBandPolicy = shape({samples:array(number),alphaBand:number,sampleBytes:number,noData:number,grid:projectionGrid,
  centerLongitude:number,resolutionMeters:number,origin:array(number)});
export const parseFloatObservationPolicy = shape({kind:text,coordinates:optional(text),centerLongitude:number,sampleBytes:optional(number),
  noData:nullable(number),resolutionDegrees:optional(number),resolutionMeters:optional(number),origin:array(number),
  specialValueMagnitude:optional(number),displayRange:array(number),wrapLongitude:optional(boolean)});
export const parseMaskedObservationPolicy = shape({...pixelValidityFields,centerLongitude:number,resampling:optional(text),
  resolutionMeters:optional(number),channels:optional(text),colorSpace:optional(text),wrapLongitude:optional(boolean)});
/** A source declared to wrap must cover 360° of longitude to within one of its own pixels. */
export function requireWrappedLongitudeSpan(width: number, resolution: number, unitsPerDegree: number) {
  const span = width * resolution / unitsPerDegree;
  if (!(Math.abs(span - 360) <= 360 / width)) throw new TypeError(`A wrapped longitude source must span 360°, not ${span}°.`);
}
export const parseIsisObservationPolicy = shape({grid:parseIsis3Grid,displayRange:array(number)});
export type NumericRaster = Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array | Float32Array | Float64Array;
export function numericRaster(value: unknown): NumericRaster {
  if (value instanceof Uint8Array || value instanceof Uint16Array || value instanceof Uint32Array || value instanceof Int8Array ||
      value instanceof Int16Array || value instanceof Int32Array || value instanceof Float32Array || value instanceof Float64Array) return value;
  throw new TypeError('Source raster must contain numeric pixels');
}
export const numericRasterBands = array(numericRaster);
export const parseGeoImageEntry = shape({...dimensions,id:optional(text),projection:shape({referenceRadiusMeters:number})});
export const facetTableFields = {field:text,units:text,expectedRows:number,maximumCentroidErrorMeters:number,validityField:optional(text),registration:optional(text)};
export const parseFacetTable = shape({...facetTableFields,format:optional(text),member:optional(text),labelPath:optional(text),target:optional(text),meshFile:optional(text)});
export const parseFacetFitsTable = shape({...facetTableFields,target:text,meshFile:text});
const facetProfileFields = {meshPath:text,table:parseFacetTable,surfaceSampling:parseSurfaceSampling,sampling:text,additionalGrids:optional(array(requireRecord)),valueTransform:optional(parseTransform)};
export const parseFacetProfile = shape(facetProfileFields);
export const parseFacetLens = shape({path:text,minimum:number,maximum:number,...facetProfileFields});
export const parseFacetSampler = shape({surfaceSampling:shape({maximumDistanceMeters:number}),valueTransform:optional(parseTransform)});
export const parseTransferTerrain = shape({path:text,grid:shape({expectedFaces:number}),simplification:shape({method:text,maximumErrorMeters:number})});
export const parseFacetField = shape({format:text,path:text,labelPath:text,field:text,target:text,sourceVersion:text,mapVersion:text,
  facetOrder:optional(text),maximumCentroidResidualMeters:number,validity:text});
export const parseScalarMapGrid = shape({...dimensions,stepDegrees:number,noData:number,latitudeFirst:number,latitudeStep:number,frame:text});
export const parseAmbiguitySampling = shape({method:text,maximumDistanceMeters:number,ambiguityReference:shape({path:text,format:text,grid:parseMeshProfile})});
export const parseScalarMapLens = shape({path:text,labelPath:text,datasetId:text,productId:text,grid:parseScalarMapGrid,sampling:text,
  sourceValidRange:optional(array(number)),surfaceSampling:parseAmbiguitySampling,valueTransform:optional(parseTransform),minimum:number,maximum:number,
  sourceUnits:optional(text),displayUnits:optional(text)});
export const parseCategory = shape({value:text,label:text,color:text});
export const dictionary = <T,>(decode: Decoder<T>): Decoder<Record<string,T>> => value => Object.fromEntries(Object.entries(requireRecord(value)).map(([key,value])=>[key,decode(value)]));
export const parseSymbols = shape({paths:text,locations:text,shapeModel:text,expectedPaths:number,expectedLocations:number,
  lineWidthMeters:number,locationDiameterMeters:number,maximumSegmentMeters:number,maximumRegistrationDistanceMeters:number,colorCategories:dictionary(number)});
export const parseVtkGrid = shape({...meshDimensions,field:text});
export const parseVtkLens = shape({format:text,path:text,grid:parseVtkGrid,categories:array(parseCategory),cellCategories:array(nullable(number)),
  sampling:text,displaySampling:text,relief:optional(requireRecord),valueTransform:optional(parseTransform),symbols:optional(parseSymbols),
  surfaceSampling:shape({method:text,renderedMeshPath:text,maximumDistanceMeters:number,maximumRegistrationDistanceMeters:number})});
export const polygonGridFields = {expectedBounds:array(number),expectedRecords:number,withheldDegenerateRings:array(shape({record:number,ring:number,point:array(number)}))};
export const parsePolygonGrid = shape(polygonGridFields);
export const parseGeologyGrid = shape({...polygonGridFields,attributePath:text,projectionPath:text,coordinateSystem:text,referenceRadiusMeters:number,
  longitudeDirection:text,latitudeType:text,longitudeDomain:array(number),field:text,unknownValues:array(text)});
export const parseGeologyLens = shape({format:text,path:text,grid:parseGeologyGrid,overlapPolicy:text,sampling:text,categories:array(parseCategory),
  relief:optional(requireRecord),valueTransform:optional(parseTransform)});
export const parseScientificFocus = shape({longitudeDegrees:number,latitudeDegrees:number,zoom:number});
export const scientificCameraFields = {minimumZoom:number,maximumZoom:number,initialScenePitchDegrees:number,maximumControlPitchDegrees:number,defaultControlPitchDegrees:number,maximumScenePitchDegrees:number};
export const parseScientificCamera = shape(scientificCameraFields);
export const parseScienceGrid = shape({...dimensions,noData:optional(nullable(number)),specialValueMagnitude:optional(number),referenceRadiusMeters:number,coordinates:optional(text),
  projection:optional(text),poleLatitude:optional(number),centerLongitude:number,longitudeRange:optional(array(number)),wrapLongitude:optional(boolean),
  origin:optional(array(number)),resolutionMeters:optional(number),resolution:optional(array(number)),withholdLatitudeDegrees:optional(number),latitudeRange:optional(array(number))});
export const parseScienceInput = shape({format:text,path:text,grid:optional(requireRecord),sampling:optional(text),valueTransform:optional(parseTransform),
  qualityMasks:optional(array(requireRecord)),additionalGrids:optional(array(requireRecord)),sampleGrid:optional(shape({width:optional(number),height:optional(number)}))});
export const qualityMaskFields = {format:text,path:text,sampling:text,grid:parseDimensions,minimum:optional(number),maximum:optional(number),
  qualityMasks:optional(array(requireRecord)),additionalGrids:optional(array(requireRecord)),valueTransform:optional(parseTransform)};
export const parseQualityMask = shape(qualityMaskFields);
export const parseQualitySource = shape({format:optional(text),sampling:optional(text),qualityMasks:optional(array(parseQualityMask)),additionalGrids:optional(array(requireRecord))});
export const parseColorSourceProfile = shape({sampleFormat:number,sampleBytes:number,noData:nullable(number),referenceRadiusMeters:number,centerLongitude:number,
  standardParallel:number,specialValueMagnitude:optional(number),filters:array(text),displayRange:optional(array(number))});
export const parseColorEntry = shape({...dimensions,path:text,id:text,observation:text,wavelengthMicrometers:number,filter:text});
export const parseDemScience = shape({quantity:text,units:optional(text),relief:optional(requireRecord),comparison:optional(shape({path:text,grid:requireRecord,heightOffsetMeters:number})),
  surfaceSampling:optional(shape({maximumDistanceMeters:number})),valueTransform:optional(parseTransform)});
export const parsePdsRgbPolicy = shape({member:optional(text),targetName:text,centerLongitude:number,grid:projectionGrid,noData:optional(number)});
export function parseEllipsoidParameters(value: unknown) {
 const source = requireRecord(value);
 if (source.scaleConvention === 'published-semiaxes') return shape({schema:text,scaleConvention:choice('published-semiaxes'),semiaxesKm:array(number),subdivisions:number})(value);
 if (source.scaleConvention === 'effective-radius-as-volume-equivalent') return shape({schema:text,scaleConvention:choice('effective-radius-as-volume-equivalent'),axisRatioAB:number,axisRatioBC:number,effectiveRadiusKm:number,subdivisions:number})(value);
 return shape({schema:text,scaleConvention:choice('thermal-radius-as-volume-equivalent'),axisRatioAB:number,axisRatioBC:number,thermalRadiusKm:number,subdivisions:number})(value);
}
export const parseContactModel = shape({schema:text,origin:text,lobes:array(shape({semiaxesKm:array(number)})),fluxScale:number,subdivisions:number});
export function choice<const T extends readonly string[]>(...values: T): Decoder<T[number]> { return value => {const match=values.find(item=>item===value);if(match===undefined)throw new TypeError('Unsupported source choice');return match;}; }
export const parseEncounterControl = shape({bodyToJ2000:array(array(number)),offsetPixels:array(number),maximumOffsetPixels:number});
export const parseEncounterRegistration = shape({sourceShapeSha256:text,method:text,maximumRmsMeters:number,maximumResidualMeters:number,
  reference:optional(shape({id:text,imageSha256:text,controlSha256:text})),
  nominalPixelScaleMeters:number,limitations:text,controls:array(shape({id:text,partition:choice('fit','holdout'),sourcePointMeters:array(number),
    sourcePixel:array(number),referencePixel:optional(array(number)),projectionOffsetPixels:optional(array(number)),normal:optional(array(number))}))});
export const sipCameraFields = {matrix:array(array(number)),sip:shape({referencePixel:array(number),a:array(array(number)),b:array(array(number)),offsetPixels:array(number)})};
export const parseSipCamera = shape(sipCameraFields);
export const parseLlorriCamera = shape({...sipCameraFields,target:text,imageSha256:text,startTime:text,width:number,height:number});

export const archivedCameraFields = {schema:text,matrix:array(array(number)),rayMatrix:array(array(number)),positionKm:array(number),sunDirection:array(number)};
export const parseArchivedCamera = shape(archivedCameraFields);
export const parseReflectanceCamera = shape({...archivedCameraFields,...dimensions,target:text,startTime:text,filter:text,imageSha256:text,firstLine:number,firstSample:number});

export const controlledCameraFields = {observerLatitude:number,observerWestLongitude:number,sunLatitude:number,sunWestLongitude:number,
  rangeKm:number,northAzimuthDegrees:number,pixelAngleMicroradians:number,center:array(number)};
export const parseControlledCamera = shape(controlledCameraFields);
const partialControlledCameraFields = {observerLatitude:optional(number),observerWestLongitude:optional(number),sunLatitude:optional(number),sunWestLongitude:optional(number),
  rangeKm:optional(number),northAzimuthDegrees:optional(number),pixelAngleMicroradians:optional(number),center:optional(array(number))};
export const cameraFrameFields = {id:text,path:text,labelPath:optional(text),encoding:optional(text),allowFiniteSigned:optional(boolean),backgroundMaximum:optional(number),
  coverageInsetPixels:optional(number),backgroundOffset:optional(number),...partialControlledCameraFields,
  cameraCatalog:optional(shape({path:text,labelPath:text,instrumentPath:text,longitudeDirection:text,pixelOrigin:text,imageNumber:number})),
  quality:optional(shape({imageId:text,target:text,startTime:text,filter:text,rawPath:text,rawLabelPath:text,badDataPath:text,badDataLabelPath:text})),
  // An image reconstructed from interferometric visibilities: the epoch and band of those visibilities, and the merged file they were read from.
  reconstruction:optional(shape({startTime:text,filter:text,visibilitiesPath:text}))};
export const parseCameraFrame = shape(cameraFrameFields);
export const parseCameraShape = shape({format:text,path:text,grid:requireRecord});

export const levelMatchingFields = {maximumAngleDegrees:optional(number),minimumPairs:number,maximumGain:number,samplesPerTriangle:optional(number)};
export const parseLevelMatching = shape(levelMatchingFields);
/** Contributor separation is either a fixed distance or a multiple of each sample's measured pixel footprint. */
export const surfaceTransfer = shape({maximumSeparationMeters:optional(number),maximumSeparationFootprints:optional(number),visibilityToleranceMeters:number,maximumEmissionDegrees:number,interpretation:optional(text)});
export const parseSurfaceGeometry = shape({format:optional(text),sourceTopology:optional(text),simplification:shape({method:optional(text),maximumErrorMeters:number})});
export const parsePublishedPhotometry = shape({model:text,referenceDegrees:shape({incidence:number,emission:number,phase:number}),
 limits:shape({maximumIncidenceDegrees:number,maximumEmissionDegrees:number,phaseDegrees:array(number),minimumGain:number,maximumGain:number})});
const PUBLISHED_PHOTOMETRY_KEYS = ['model','referenceDegrees','limits'];
/** A photometry block names either a published model record under photometry/ or one of a route's historical forms, never a mix. */
export const publishedOr = <T,>(legacy: Decoder<T>): Decoder<T | ReturnType<typeof parsePublishedPhotometry>> => value => {
  const record = requireRecord(value), published = typeof record.model === 'string' && record.model.startsWith('photometry/');
  if (published && Object.keys(record).some(key => !PUBLISHED_PHOTOMETRY_KEYS.includes(key))) throw new TypeError('A published photometry block names only its model, reference geometry and limits.');
  if (!published && ('referenceDegrees' in record || 'limits' in record)) throw new TypeError('Only a published photometric model declares a reference geometry and limits.');
  return published ? parsePublishedPhotometry(value) : legacy(value);
};
export const parseEncounterSourceControl = shape({observation:parseEncounterPolicy,camera:parseEncounterControl,registration:parseEncounterRegistration});

export const parseControlledMosaic = shape({directory:text,imageIds:array(text),filter:text,photometry:shape({radiusKm:number,gamma:number,displayMaximum:number,
 weight:number,maximumGain:number,phaseNormalization:boolean,matchStride:number,minimumLevel:number,maximumLevel:number,
 referenceIncidenceDegrees:number,referenceEmissionDegrees:number,maximumIncidenceDegrees:number,maximumEmissionDegrees:number,
 minimumMatchSamples:number,vectors:shape({sun:text,observer:text})})});
export const parseControlledMetadata = shape({IsisCube:shape({BandBin:shape({FilterName:text}),Mapping:shape({PixelResolution:shape({value:number}),
 CenterLongitude:number,CenterLatitude:number,MaximumLatitude:number,MinimumLatitude:number,MaximumLongitude:number,MinimumLongitude:number})}),Table_BodyRotation:shape({CkTableStartTime:number})});

export const parsePhasePhotometry = shape({model:text,asymmetry:number,amplitude:number,width:number,minimumDegrees:number,maximumDegrees:number,referenceDegrees:number,maximumGain:number});
/** A PDS4 product whose Array_2D_Image planes carry an image with its geometric backplanes. The recipe names the planes by
 * their label identifiers, the archive identity and DSK to bind, and optional FITS header expectations. */
export const parseGeometryCube = shape({collection:text,target:text,observingSystem:array(text),shapeKernel:optional(text),quantity:text,
  planes:shape({image:text,x:text,y:text,z:text,incidence:text,emission:text,phase:text,pixelScale:optional(array(text))}),
  geometrySelection:optional(shape({plane:text,unit:text,minimum:number,maximum:number,interpretation:text})),
  header:optional(dictionary(text)),headerTime:optional(text),headerPlaneNames:optional(shape({prefix:text,names:dictionary(text)}))});
export type GeometryCubeDeclaration = ReturnType<typeof parseGeometryCube>;
/** A camera derived from SPICE kernels for an image without archived geometry: the kernel set in load order, the SPK ids and
 * body-fixed frame, the instrument whose kernel variables define the pixel model, how the exposure epoch is read from the
 * image header, the aberration correction, the instrument-frame axes stored columns and rows follow, and how the image is read. */
export const parseSpiceCamera = shape({kernels:array(text),kernelSet:optional(text),observer:number,target:number,bodyFrame:text,instrument:number,
  clock:shape({header:optional(text),utcHeader:optional(text),start:optional(text),stop:optional(text),spacecraft:number}),aberration:text,
  pixels:shape({focalLength:shape({key:text,unit:text}),pixelPitch:shape({key:text,unit:text}),center:text,boresight:text,samples:text,lines:text,frame:text,origin:number,column:text,row:text}),
  image:shape({format:optional(text),quantity:text,plane:optional(number),colorPlanes:optional(array(number)),header:optional(dictionary(text)),missingValueKeys:optional(array(text)),saturationKey:optional(text)})});
export type SpiceCameraDeclaration = ReturnType<typeof parseSpiceCamera>;
/** Pointing refinement of an archived or kernel camera against the retained mesh's lit limb, with its evidence budget. */
export const parseLimbRefinement = shape({method:text,maximumCorrectionDegrees:number,maximumResidualPixels:number,minimumControls:number,threshold:optional(number),searchPixels:optional(number),maximumControls:optional(number),minimumSharpness:optional(number)});
export const parseGeoCameraClosure = shape({...archivedCameraFields,meshSha256:text,provenance:array(shape({path:text,sha256:text}))});

/** Only fields used to interpret science values; source-specific readers own their grids. */
export function parseSciencePalette(value: unknown) {
  const input = requireRecord(value);
  const extra = shape({outputLongitudeOrigin:optional(number),relief:optional(shape({referenceRadiusMeters:number,
    lightDirection:array(number),ambient:number,heightToMeters:optional(number)}))})(input);
  if (input.categories !== undefined) return ({...input, ...extra, categories:array(parseCategory)(input.categories)});
  return ({...input, ...extra, ...shape({minimum:number,maximum:number,colors:array(text)})(input), categories:undefined});
}
