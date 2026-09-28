import type { PreparedDestination } from '@cssearth/renderer/runtime/object-runtime-types.ts';
import { isRecord } from '@cssearth/core';
import { parseCatalogueRow, type CatalogueRow } from './catalogue-index.mts';

/** Search objects and named features, cities included, on the server. The browser sends its query and receives the rows
 * to show: it never downloads the object catalogue (2.3 MB), the cross-body feature index (3.3 MB) or a body's places
 * catalogue (Earth's is 14.8 MB).
 *
 *   GET /.netlify/functions/find?q=<query>&object=<body id>[&offset=<row>][&illustrations=1]   FindResponse
 *   GET /.netlify/functions/find?place=<id>&object=<body id>                                  { place: <the catalogue record> }
 *
 * A query answers one page of object rows from `offset`; the first page also carries the query's feature rows.
 */
export const FIND_PATH = '/.netlify/functions/find';
export const FIND_QUERY_LIMIT = 200;
/** Object rows per response: a phone sheet shows about 8, a pill such as Stars lists 1,499. */
export const FIND_PAGE_ROWS = 40;
export interface FindResult { readonly objectId: string; readonly id: string; readonly name: string; readonly context: string; readonly label: string; readonly href: string; readonly lensIds?: readonly string[]; }
export interface FindObjects { readonly total: number; readonly offset: number; readonly rows: readonly CatalogueRow[]; }
export interface FindResponse {
  readonly objects: FindObjects;
  /** The classification a category query ("planets", "stars") names; the matching pill shows it pressed. */
  readonly classification: string | null;
  /** Named features, on the first page only; null when the feature data could not load. */
  readonly features: readonly FindResult[] | null;
}

export function parseFindResults(value: unknown): FindResult[] {
  if (!Array.isArray(value)) throw new TypeError('Find results are invalid.');
  return value.map(result => {
    if (!isRecord(result) || ['objectId', 'id', 'name', 'context', 'label', 'href'].some(key => typeof result[key] !== 'string') ||
        (result.lensIds !== undefined && (!Array.isArray(result.lensIds) || !result.lensIds.every(id => typeof id === 'string')))) throw new TypeError('Find result is invalid.');
    return result as unknown as FindResult;
  });
}

export function parseFindResponse(value: unknown): FindResponse {
  if (!isRecord(value) || !isRecord(value.objects) || !Array.isArray(value.objects.rows) || (value.classification !== null && typeof value.classification !== 'string')) {
    throw new TypeError('Find response is invalid.');
  }
  const { total, offset } = value.objects;
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(offset) || Number(offset) < 0 || Number(total) < Number(offset) + value.objects.rows.length) {
    throw new TypeError(`Find response page is invalid: offset ${String(offset)}, total ${String(total)}.`);
  }
  return {
    objects: { total: Number(total), offset: Number(offset), rows: value.objects.rows.map(parseCatalogueRow) },
    classification: value.classification,
    features: value.features === null ? null : parseFindResults(value.features),
  };
}

export interface DestinationPlace extends PreparedDestination { readonly name: string; readonly context: string; }

/** Validate the one prepared city returned by find, before it reaches the native camera. */
export function parseDestinationPlace(value: unknown): DestinationPlace {
  const place = isRecord(value) ? value.place : null;
  if (!isRecord(place) || typeof place.name !== 'string' || typeof place.context !== 'string' || typeof place.coverage !== 'string' || !isRecord(place.camera)) {
    throw new TypeError('Destination place requires its prepared record.');
  }
  const camera = place.camera;
  if (['controlPitch', 'controlYaw', 'zoom'].some(key => typeof camera[key] !== 'number' || !Number.isFinite(camera[key])) ||
      (camera.controlRoll !== undefined && (typeof camera.controlRoll !== 'number' || !Number.isFinite(camera.controlRoll)))) {
    throw new TypeError('Invalid prepared destination camera.');
  }
  const transition = camera.transition;
  if (transition !== undefined && (!isRecord(transition) || typeof transition.durationMilliseconds !== 'number' ||
      !Number.isFinite(transition.durationMilliseconds) || transition.durationMilliseconds < 0 || typeof transition.preserveZoom !== 'boolean')) {
    throw new TypeError('Invalid prepared destination transition.');
  }
  return place as unknown as DestinationPlace;
}
