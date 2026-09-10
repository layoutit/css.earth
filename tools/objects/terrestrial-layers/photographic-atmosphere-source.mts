import {array, number, object, parse, string, tuple} from '../material-composition/data-schema.mts';
const source = object({path: string, label: string});
const profile = object({schema: string, size: number, densities: array(number), surfaceRadius: number, coverageScale: number, contentScale: number,
  silhouetteSupersampling: number, referenceChannel: number, ambientIntensity: number, terminatorSmoothstep: tuple(number, number), displayTransfer: string,
  defaultScenePitchDegrees: number, integrationSamples: number, psg: source, atmosphere: source,
  reference: object({path: string, label: string, thresholdRgb8: number, limbAnnulus: tuple(number, number), interiorAnnulus: tuple(number, number), exteriorAnnulus: tuple(number, number)})});
export const parsePhotographicAtmosphere = (value: unknown) => parse(value, profile, 'photographic atmosphere source');
