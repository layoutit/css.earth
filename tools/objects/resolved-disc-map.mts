/**
 * The shared boundary between a telescope-specific image reducer and a body map.
 *
 * An adapter supplies one calibrated measurement plane, its one-sigma uncertainty, a north-up/east-left pixel scale and
 * the observation identity. This module owns the astronomy that must not be reimplemented per instrument: fitting the
 * resolved limb, computing the body camera from the pinned geometry and rotation model, projecting onto the common body
 * grid, and writing the complete observation geometry used by the body-map contract.
 */
import { observerCamera, type BodyOrientation, type ObserverSighting } from './terrestrial-layers/observer-camera.mts';
import { fitDiscCentre, projectBandMap, topRowFirst, type BodyMap, type DiscCentre } from './jwst/cubes/body-map.mts';
import type { AngularResolution, BodyMapObservation } from './body-map-product.mts';

const ARCSEC_PER_RADIAN = 206_264.806_247;
const AU_KM = 1.495978707e8;

export interface ResolvedDiscPlane {
  readonly width: number;
  readonly height: number;
  /** FITS image order: the first stored row is the bottom of the north-up image; east is left. */
  readonly values: Float64Array;
  /** Optional image used only to register the limb when the measured plane does not trace the disc edge. */
  readonly registrationValues?: Float64Array;
  readonly uncertainty: Float64Array;
  readonly arcsecPerPixel: number;
}

export interface ResolvedDiscIdentity {
  readonly id: string;
  readonly telescope: string;
  readonly instrument: string;
  readonly mode: string;
  readonly programme: string;
  readonly midTimeJd: number; readonly startTimeJd?: number; readonly endTimeJd?: number; readonly startIso?: string; readonly endIso?: string;
  readonly exposureSeconds?: number;
}

export interface ResolvedDiscGeometry extends Omit<ObserverSighting, 'pixelAngleMicroradians' | 'center'> {}

export interface ResolvedDiscRequest {
  readonly plane: ResolvedDiscPlane;
  readonly identity: ResolvedDiscIdentity;
  readonly geometry: ResolvedDiscGeometry;
  readonly orientation: BodyOrientation;
  readonly radiusKm: number;
  readonly grid: { readonly width: number; readonly height: number };
  readonly maximumEmissionDegrees: number;
  readonly minimumDiscPixels?: number;
  /** Use an independently measured beam or PSF when one exists; otherwise the fitted limb blur is reported. */
  readonly angularResolution?: AngularResolution;
  readonly fittedResolutionBasis?: string;
}

export interface PlacedResolvedDisc {
  readonly map: BodyMap;
  readonly centre: DiscCentre;
  readonly radiusPixels: number;
  readonly camera: ReturnType<typeof observerCamera>;
  readonly observation: BodyMapObservation;
}

/** Place one resolved, sky-registered image on a body. Instrument physics ends at `plane`; body geometry starts here. */
export function placeResolvedDisc(request: ResolvedDiscRequest): PlacedResolvedDisc {
  const { plane, geometry } = request, samples = plane.width * plane.height;
  if (!Number.isSafeInteger(plane.width) || !Number.isSafeInteger(plane.height) || plane.width < 2 || plane.height < 2 ||
      plane.values.length !== samples || plane.uncertainty.length !== samples || (plane.registrationValues && plane.registrationValues.length !== samples))
    throw new RangeError('A resolved-disc plane has matching, two-dimensional value, registration, and uncertainty arrays.');
  if (!(plane.arcsecPerPixel > 0) || !Number.isFinite(plane.arcsecPerPixel)) throw new RangeError('A resolved-disc plane needs a positive plate scale.');
  if (!(request.radiusKm > 0) || !(geometry.rangeAu > 0)) throw new RangeError('A resolved-disc placement needs a positive body radius and observer range.');
  if (!plane.uncertainty.some(value => Number.isFinite(value) && value >= 0)) throw new RangeError('A resolved-disc plane carries a finite one-sigma uncertainty.');

  const radiusPixels = request.radiusKm / (geometry.rangeAu * AU_KM) * ARCSEC_PER_RADIAN / plane.arcsecPerPixel;
  if (2 * radiusPixels < (request.minimumDiscPixels ?? 3)) throw new RangeError(`The disc is ${(2 * radiusPixels).toFixed(1)} pixels across, below the requested ${request.minimumDiscPixels ?? 3}.`);
  const centre = fitDiscCentre(topRowFirst(plane.registrationValues ?? plane.values, plane.width, plane.height), plane.width, plane.height, radiusPixels);
  const camera = observerCamera({ ...geometry, pixelAngleMicroradians: plane.arcsecPerPixel / ARCSEC_PER_RADIAN * 1e6, center: centre.center }, request.orientation);
  const map = projectBandMap({ width: plane.width, height: plane.height, depth: plane.values, error: plane.uncertainty, continuum: plane.values }, camera,
    request.radiusKm, request.grid, request.maximumEmissionDegrees);
  const fittedArcsec = centre.blurPixels * 2.354_82 * plane.arcsecPerPixel;
  const angularResolution = request.angularResolution ?? { majorArcsec: fittedArcsec, minorArcsec: fittedArcsec,
    basis: request.fittedResolutionBasis ?? 'full width at half maximum of the Gaussian blur fitted to the resolved limb' };
  const observation: BodyMapObservation = { ...request.identity, rangeKm: camera.rangeKm,
    subObserver: { latitudeDegrees: camera.observerLatitude, westLongitudeDegrees: ((camera.observerWestLongitude % 360) + 360) % 360 },
    subSolar: { latitudeDegrees: camera.sunLatitude, westLongitudeDegrees: ((camera.sunWestLongitude % 360) + 360) % 360 }, angularResolution };
  return { map, centre, radiusPixels, camera, observation };
}
