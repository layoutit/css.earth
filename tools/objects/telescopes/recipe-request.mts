import type { ResolutionAssumption } from '../resolution-evidence.mts';
import { parseLimits, parseRegion } from '@cssearth/telescope/node';
/** Band depth has three input windows. Keep their enclosing reduction range out of the measurement's band identity. */
import { requireArray, requireFiniteNumber, requireString } from '@cssearth/core';
export function inputWavelengths(request: CapabilityRequest): readonly [number,number] {
  if (!request.continuumMicrometres) return request.wavelengthMicrometres;
  if (request.kind && request.kind !== 'cube') throw new TypeError('Band-depth continuum windows require a cube.');
  const windows = requireArray(request.continuumMicrometres, 'continuum windows');
  if (windows.length !== 2) throw new TypeError('Band depth requires two continuum windows.');
  const [left,right] = windows.map(w => { const v=requireArray(w);if(v.length!==2)throw new TypeError('A continuum window has two bounds.');const a=requireFiniteNumber(v[0]),b=requireFiniteNumber(v[1]);if(!(a>0&&b>a))throw new TypeError('Continuum windows must be positive and increasing.');return [a,b] as const; });
  if(left![1]>request.wavelengthMicrometres[0] || right![0]<request.wavelengthMicrometres[1])throw new TypeError('Continuum windows must bracket the requested band.');
  return [left![0],right![1]];
}


export const PRODUCT_KINDS = ['image', 'cube', 'spectrum', 'table', 'photometry', 'events', 'strips'] as const;

export type ProductKind = typeof PRODUCT_KINDS[number];

export const REQUESTED_RESULTS = ['telescope-product', 'body-map'] as const;

export type RequestedResult = typeof REQUESTED_RESULTS[number];


export interface CapabilityRequest {
  readonly region?: import('@cssearth/telescope/node').IcrsCircle;
  readonly spectralFrame?: 'barycentric';
  readonly transferLimits?: import('@cssearth/telescope/node').TransferLimits;
  readonly continuumMicrometres?: readonly [readonly [number,number],readonly [number,number]];
  readonly acceptedAssumptions?: readonly ResolutionAssumption[];
  readonly target: string;
  readonly wavelengthMicrometres: readonly [number, number];
  readonly time?: { readonly any: true } | { readonly fromIso: string; readonly toIso: string };
  /** The coarsest sharpness that would still answer the question, in arcsec. */
  readonly angularResolutionArcsec?: number;
  /** The coarsest surface resolution that would still answer it, in kilometres. Needs `rangeKm`. */
  readonly surfaceResolutionKm?: number;
  /** The fewest resolution elements across the disc that would still answer it. Needs `rangeKm` and `bodyRadiusKm`. */
  readonly resolutionElements?: number;
  readonly rangeKm?: number;
  readonly bodyRadiusKm?: number;
  readonly kind?: ProductKind;
  /** The deliverable the caller needs. Exploratory queries may omit it; explicit selection may not. */
  readonly result?: RequestedResult;
}

export function validateCapabilityRequest(request: CapabilityRequest): void {
  const requestFields = new Set(['target','wavelengthMicrometres','continuumMicrometres','acceptedAssumptions','time','angularResolutionArcsec','surfaceResolutionKm','resolutionElements','rangeKm','bodyRadiusKm','kind','result','region','spectralFrame','transferLimits']);
  for (const key of Object.keys(request)) if (!requestFields.has(key)) throw new TypeError(`Unsupported scientific request constraint ${key}.`);
  if (request.region !== undefined) parseRegion(request.region);
  if (request.transferLimits !== undefined) parseLimits(request.transferLimits);
  if (request.spectralFrame !== undefined && request.spectralFrame !== 'barycentric') throw new TypeError('Only an explicit barycentric spectral frame is supported.');
  if (request.wavelengthMicrometres.length !== 2 || !request.wavelengthMicrometres.every(Number.isFinite) || !(request.wavelengthMicrometres[0] > 0 && request.wavelengthMicrometres[1] >= request.wavelengthMicrometres[0])) throw new RangeError('A request states its wavelengths in micrometres, shortest first.');
  for (const key of ['angularResolutionArcsec', 'surfaceResolutionKm', 'resolutionElements', 'rangeKm', 'bodyRadiusKm'] as const) {
    const value = request[key];
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) throw new RangeError(`${key} must be finite and positive.`);
  }
  if (request.time && !('any' in request.time)) {
    const from = Date.parse(request.time.fromIso), to = Date.parse(request.time.toIso);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) throw new RangeError('A request needs a valid, ordered time interval.');
  }
  if (request.time && 'any' in request.time && request.time.any !== true) throw new TypeError('Any-time acceptance must be true.');
  if (request.kind && !(PRODUCT_KINDS as readonly string[]).includes(request.kind)) throw new TypeError(`Unknown product kind ${request.kind}.`);
  if (request.result && !(REQUESTED_RESULTS as readonly string[]).includes(request.result)) throw new TypeError(`Unknown requested result ${request.result}.`);
  inputWavelengths(request);
  requireString(request.target, 'Request target');
}
