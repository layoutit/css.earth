import { object, string, number, boolean, optional, array, tuple, union, literal, nil, dictionary, json, parse } from '../material-composition/data-schema.mts';
import type { Guard, Infer } from '../material-composition/data-schema.mts';
import type { SurfaceProfile, ObservationRasterRecipe, SynopticEmissionRecipe, PhysicalFactsRecipe } from './contracts.mts';
import { requireObjectControls } from '../../../site/scene-contract.mts';

const pair = object({one: string, two: optional(string)});
const texture = object({one: string, two: optional(string), width: number, height: number, presentationCellSize: optional(number)});
import {camera} from '../camera-source.mts';
const parameters = {latitudeSegments: number, longitudeSegments: number, displayRadius: number, tileSize: number,
  surfaceOverlap: number, projectiveRasterScale: number, cameraPitch: number, cameraZoom: number};
const metadata = {schema: string, camera, counts: dictionary(union(number, boolean))};
const bandGeometry = object({schema: literal('cssearth-static-surface-geometry@1'), kind: literal('disc-poles'), namespace: string,
  parameters: object({...parameters, polarSurfaceOverlap: number, polarInnerOverlap: number, polarInnerInset: number, rotationSeconds: number}),
  surface: texture, poles: texture, rasterAtlas: optional(object({columns: number, rows: number, cellSize: number, gutter: number, width: number, height: number})),
  metadata: object({...metadata, body: object({systemTransform: string, meshTransform: string, latitudeSegments: number, assets: object({surface: texture, poles: texture})})})});
const emissiveGeometry = object({schema: literal('cssearth-static-surface-geometry@1'), kind: literal('segmented-poles'), namespace: string,
  parameters: object({...parameters, polarCellSize: number, polarInnerLatitudeDegrees: number, polarCenterOverlap: number, color: string, cameraYaw: number}),
  surface: texture, poles: object({one: string}), metadata: object({...metadata, body: object({axialTiltDegrees: number}),
    offLimbContext: object({defaultUrl: string, defaultUrl2x: optional(string)}), limbMaterial: object({defaultUrl: string, defaultUrl2x: optional(string)})})});
const geometry: Guard<SurfaceProfile> = union(bandGeometry, emissiveGeometry);
export const parseSurfaceGeometry = (value: unknown) => parse(value, geometry, 'static surface geometry');

const relief = object({referenceRadiusMeters: number, lightDirection: array(number), ambient: number, heightToMeters: optional(number)});
const scientific = union(
  object({categories: array(object({color: string})), minimum: optional(number), maximum: optional(number), colors: optional(array(string)), relief: optional(relief), outputLongitudeOrigin: optional(number), displaySampling: optional(string)}),
  object({categories: (value): value is undefined => value === undefined, minimum: number, maximum: number, colors: array(string), relief: optional(relief), outputLongitudeOrigin: optional(number), displaySampling: optional(string)}));
const observationLensFields={id: string, input: string, scientific: optional(scientific),
    elevation: optional(object({noData: number, palette: array(array(number)), rangeMetres: number, relief: optional(relief)})),
    coverage: optional(object({kind: string, southConnected: boolean})),
    presentation: optional(object({saturation: number, linearGain: number, linearOffset: number, sharpenSigma: number}))};
const observationLens=object({...observationLensFields,output:string});
const previewObservationLens=object({...observationLensFields,output:optional(string)});
export const parseObservationPreviewLens=(value:unknown)=>parse(value,previewObservationLens,"preview observation lens");
export const parseObservationLens=(value:unknown)=>parse(value,observationLens,"observation lens");
const observation: Guard<ObservationRasterRecipe> = object({schema: literal('cssearth-static-surface-raster@1'), kind: literal('observation-lenses'),
  surfaceProjection: string, densities: array(number), width: number, height: number, latitudeSegments: number, polarTile: number, thumbnail: string,
  material: object({frameSize: number, radiusScale: number, limbFloor: number, output: string}),
  lenses: array(observationLens)});
const fits = object({bitpix: number, width: number, height: number, latitude: literal('sine-latitude', 'equirectangular'),
  reverseLongitude: optional(boolean), positiveOnly: optional(boolean), nearestLatitudeLimit: number,
  color: union(object({kind: literal('signed-asinh'), palette: array(array(number)), softening: number, maximum: number}),
    object({kind: literal('positive-log'), palette: array(array(number)), range: tuple(number, number)}))});
const offLimb = union(object({observedFile: nil, center: nil, radius: nil}), object({observedFile: string, center: tuple(number, number), radius: number}));
const variant = union(object({id: string, polarDetailSigma: number, kind: literal('continuum-disc-mosaic'), mapFiles: array(string), limbMode: literal('continuum-darkening')}),
  object({id: string, polarDetailSigma: number, kind: literal('fits-map'), mapFile: string, fits, limbMode: literal('rim')}));
const emissionVariant: Guard<Infer<typeof variant> & Infer<typeof offLimb>> = (value): value is Infer<typeof variant> & Infer<typeof offLimb> => variant(value) && offLimb(value);
const emission: Guard<SynopticEmissionRecipe> = object({schema: literal('cssearth-static-surface-raster@1'), kind: literal('synoptic-emission'), namespace: string,
  mapWidth: number, mapHeight: number, latitudeSegments: number, polarTile: number, offLimbSize: number, limbSize: number, bodyDiameter: number,
  continuum: object({start: string, stop: string, maximumLatitudeDegrees: number, minimumDiscRadius: number, maximumDiscRadius: number, discBrightnessThreshold: number, solarPoleTiltDegrees: number}), variants: array(emissionVariant)});
export const parseSurfaceRaster = (value: unknown) => parse(value, union(observation, emission), 'static surface raster');
export const parseCelestialRecipe = (value: unknown) => parse(value, object({schema: literal('cssearth-static-celestial@1'), id: string, includeSun: boolean,
  sourceSchema: optional(string), directionalSun: optional(object({meanHeliocentricDistanceAu: number}))}), 'static celestial recipe');
const physical: Guard<PhysicalFactsRecipe> = object({schema: string, inputs: array(object({id: string, path: string, format: string,
  identity: optional(dictionary(json)), textPath: optional(string), anchors: optional(array(string)), tableRow: optional(string), expectedColumns: optional(array(number))})),
  constants: dictionary(json), fields: dictionary(object({source: string, path: string}))});
export const parsePhysicalRecipe = (value: unknown) => parse(value, physical, 'physical facts recipe');

const surfaceLens = {id: string, surfaceUrl: string, surface2xUrl: optional(string), polesUrl: string, poles2xUrl: optional(string)};
const bandLenses = object({defaultLens: string, material: pair, controls: array(object(surfaceLens))});
const emissiveLenses = object({defaultLens: string, controls: array(object({...surfaceLens, coronaUrl: string, corona2xUrl: optional(string), limbUrl: string, limb2xUrl: optional(string)}))});
export type BandLenses = Infer<typeof bandLenses>;
export type EmissiveLenses = Infer<typeof emissiveLenses>;
export const parseBandLenses = (value: unknown) => parse(value, bandLenses, 'band surface lenses');
export const parseEmissiveLenses = (value: unknown) => parse(value, emissiveLenses, 'emissive surface lenses');
const content = object({schema: literal('cssearth-static-surface-content@1'), id: string, displayName: string,
  panel: object({introduction: string, facts: array(object({id: string, label: string, value: string})), moreFacts: array(object({id: string, label: string, value: string}))}),
  controls: json, lenses: object({controls: array(object({id: string}))}), resources: json, provenance: json});
export function parseSurfaceContent(value: unknown) {
  const result = parse(value, content, 'static surface content');
  requireObjectControls(result.controls, result.id);
  return result;
}

export const parseTitleRecipe = (value: unknown) => parse(value, object({label: string, viewBox: string, path: string, source: string, sourceUrl: string, sourceSha256: string, width: number, height: number, weight: number, opticalSize: number, fontSize: number, letterSpacing: number, baseline: number}), 'title source');
