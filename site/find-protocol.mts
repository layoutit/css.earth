import type { PreparedDestination } from '../src/renderers/css/runtime/object-runtime-types.js';
import { isRecord } from '@cssearth/core';

/** Search named features, cities included, on the server. The browser sends its query and receives the rows to show:
 * it never downloads the cross-body index (3.3 MB) or a body's places catalogue (Earth's is 14.8 MB).
 *
 *   GET /.netlify/functions/find?q=<query>&object=<body id>   { results: FindResult[] }
 *   GET /.netlify/functions/find?place=<id>&object=<body id>   { place: <the catalogue record> }
 */
export const FIND_PATH = '/.netlify/functions/find';
export const FIND_QUERY_LIMIT = 200;
export interface FindResult { readonly objectId: string; readonly id: string; readonly name: string; readonly context: string; readonly label: string; readonly href: string; readonly lensIds?: readonly string[]; }

export function parseFindResults(value: unknown): FindResult[] {
  if (!isRecord(value) || !Array.isArray(value.results)) throw new TypeError('Find response is invalid.');
  return value.results.map(result => {
    if (!isRecord(result) || ['objectId', 'id', 'name', 'context', 'label', 'href'].some(key => typeof result[key] !== 'string') ||
        (result.lensIds !== undefined && (!Array.isArray(result.lensIds) || !result.lensIds.every(id => typeof id === 'string')))) throw new TypeError('Find result is invalid.');
    return result as unknown as FindResult;
  });
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
