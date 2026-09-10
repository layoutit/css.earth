import {array, boolean, dictionary, json, number, object, parse, string, tuple} from '../material-composition/data-schema.mts';
const vector = tuple(number, number, number);
const reference = object({schema: string, sourceProduct: string, captureQualification: string, sampleCount: number,
  camera: object({orientation: dictionary(json), projection: object({horizontalFovDegrees: number, focalX: number}), cubicTransport: object({rotationResponse: number, zoomResponse: number})}),
  sky: object({googleTextureRedistributed: boolean, catalogue: object({drawCount: number, pointSizePixels: number})}),
  sun: object({sourcePixelsRedistributed: boolean, independentBillboard: boolean, bodyDirectionAtReference: vector,
    defaultCameraBinding: object({viewDirection: vector, nativeCamera: dictionary(json)}),
    appearance: object({nativeTextureSize: tuple(number, number), nativeBlend: array(string),
      analyticRadialFit: object({model: string, coreRadiusPixels: number, falloffScalePixels: number, falloffExponent: number, redProfileSumSquaredResidual: number, qualification: string})}),
    centerDistanceOverFar: number, halfExtentOverFar: number, halfExtentOverCenter: number, cullingStates: array(string), referenceTimeUtc: string, maximumCenterReplayResidualPixels: number})});
export const parseReferenceCelestialSource = (value: unknown) => parse(value, reference, 'measured celestial reference');
