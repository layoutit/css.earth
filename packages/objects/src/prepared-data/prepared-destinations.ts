import { isRecord } from '@cssearth/core';

export const PREPARED_DESTINATIONS_SCHEMA = 'cssearth-prepared-destinations@1';

export interface PreparedDestination {
  readonly id: string; readonly name: string; readonly context: string; readonly names: readonly string[];
  readonly searchContext: string; readonly population: number; readonly latitude: number; readonly longitude: number;
  readonly camera: { readonly controlPitch: number; readonly controlYaw: number; readonly zoom: number; readonly controlRoll?: number };
  readonly coverage: string;
}
export interface PreparedDestinations {
  readonly schema: typeof PREPARED_DESTINATIONS_SCHEMA; readonly source: string; readonly snapshotDate: string;
  readonly qualification: string; readonly places: readonly PreparedDestination[];
}
/** Search accepts the historical minimal record; camera and provenance are preparation metadata. */
export interface DestinationSearchRecord {
  readonly id: string; readonly name: string; readonly context: string; readonly names: readonly string[]; readonly searchContext: string;
}
export function parsePreparedDestinations(catalog: unknown, pin: { readonly objectId: string; readonly count: number }): readonly DestinationSearchRecord[] {
  if (!isRecord(catalog) || catalog.schema !== PREPARED_DESTINATIONS_SCHEMA || !Array.isArray(catalog.places) || catalog.places.length !== pin.count) throw new TypeError(`${pin.objectId}: places catalogue differs from its pin.`);
  return catalog.places.map((place: unknown) => {
    if (!isRecord(place) || typeof place.name !== 'string' || typeof place.context !== 'string' || typeof place.searchContext !== 'string' ||
        !Array.isArray(place.names) || !place.names.every(name => typeof name === 'string')) throw new TypeError(`${pin.objectId}: place record is invalid.`);
    const id = String(place.id);
    if (!/^[0-9]+$/u.test(id)) throw new TypeError(`${pin.objectId}: place id is invalid.`);
    return { id, name: place.name, context: place.context, names: place.names, searchContext: place.searchContext };
  });
}

/** Build-time settlement matching needs coordinates, without camera or source metadata. */
export function readDestinationSettlements(catalog: unknown, pin: { readonly objectId: string; readonly count: number }) {
  if (!isRecord(catalog) || catalog.schema !== PREPARED_DESTINATIONS_SCHEMA || !Array.isArray(catalog.places) || catalog.places.length !== pin.count)
    throw new TypeError(`${pin.objectId}: places catalogue count or schema differs from its descriptor.`);
  return catalog.places.map((place: unknown) => {
    if (!isRecord(place)) throw new TypeError(`${pin.objectId}: place record is invalid.`);
    const id = place.id;
    if (!(typeof id === 'number' && Number.isSafeInteger(id)) && !(typeof id === 'string' && /^[0-9]+$/u.test(id))) throw new TypeError(`${pin.objectId}: place id is invalid.`);
    if (typeof place.name !== 'string' || !place.name) throw new TypeError('place name must be text.');
    if (typeof place.latitude !== 'number' || !Number.isFinite(place.latitude)) throw new TypeError('place latitude must be finite.');
    if (typeof place.longitude !== 'number' || !Number.isFinite(place.longitude)) throw new TypeError('place longitude must be finite.');
    return { id: String(id), name: place.name, latitudeDeg: place.latitude, longitudeDeg: place.longitude };
  });
}
