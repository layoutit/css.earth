import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

export const WISE_ATLAS_TILES_SCHEMA = 'cssearth-wise-atlas-tiles@1';
export const WISE_BAND_NAMES = ['W1', 'W2', 'W3', 'W4'] as const;
export type WiseBand = (typeof WISE_BAND_NAMES)[number];
export interface TilePins { readonly schema: typeof WISE_ATLAS_TILES_SCHEMA; readonly band: WiseBand; readonly tiles: readonly { readonly coaddId: string; readonly bytes: number }[] }

export function parseTilePins(value: unknown): TilePins {
  const row = requireRecord(value, 'WISE atlas tiles');
  if (row.schema !== WISE_ATLAS_TILES_SCHEMA || typeof row.band !== 'string' || !WISE_BAND_NAMES.some(band => band === row.band)) throw new TypeError('Unsupported WISE atlas tile list.');
  const tiles = requireArray(row.tiles).map(raw => {
    const tile = requireRecord(raw, 'WISE atlas tile'), coaddId = requireString(tile.coaddId, 'coadd_id');
    const bytes = requireFiniteNumber(tile.bytes, 'Tile bytes');
    if (!/^\d{4}[pm]\d{3}_ac51$/u.test(coaddId) || !Number.isSafeInteger(bytes) || bytes < 1) throw new TypeError(`Invalid WISE atlas tile pin: ${coaddId}`);
    return { coaddId, bytes };
  });
  if (!tiles.length || new Set(tiles.map(tile => tile.coaddId)).size !== tiles.length) throw new TypeError('WISE atlas tiles must be unique and non-empty.');
  return { schema: row.schema, band: row.band as WiseBand, tiles };
}
