// Decoders for the shape and camera records the geometry loaders read: mesh, plate, radius and radial-table profiles, shape
// and surface datasets, facet fields, and controlled-camera frames. Layer pipelines keep their own records beside them.
import { array, boolean, number, optional, requireRecord, shape, text } from '@cssearth/core';
export const parseTransform = shape({scale:number,offset:number});
export const parseRadialTableProfile = shape({latitudeStepDegrees:number,longitudeStepDegrees:number,metersPerUnit:number,
  expectedRecords:number,columns:optional(array(text)),longitudeDirection:text,noDataRadius:optional(number)});
export const meshDimensions = {metersPerUnit:number,expectedVertices:number,expectedFaces:number};
export const meshProfileFields = {...meshDimensions,member:optional(text),compression:optional(text)};
export const parseMeshProfile = shape(meshProfileFields);
export const parsePlateProfile = shape({...meshProfileFields,indexBase:number,provenanceFlags:optional(text)});
export const parseRadiusProfile = shape({...meshProfileFields,stepDegrees:number,longitudeDirection:text});
export const parseSurfaceSampling = shape({method:text,maximumDistanceMeters:number});
export const parseSurfaceDataset = shape({surfaceSampling:parseSurfaceSampling,valueTransform:optional(parseTransform)});
export const parseShapeDataset = shape({format:text,path:text,grid:parseMeshProfile,facetField:optional(requireRecord),
  sampleGrid:optional(shape({width:optional(number),height:optional(number)})),coverage:optional(shape({path:text,member:text,field:text})),
  surfaceSampling:optional(parseSurfaceSampling),valueTransform:optional(parseTransform)});
export const parseFacetField = shape({format:text,path:text,labelPath:text,field:text,target:text,sourceVersion:text,mapVersion:text,
  facetOrder:optional(text),maximumCentroidResidualMeters:number,validity:text});
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
