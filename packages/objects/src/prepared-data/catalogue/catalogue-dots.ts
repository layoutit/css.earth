import { preparedBankColumn, type PreparedBank } from '../../prepared-bank.js';
import type { PreparedGalaxyCatalog } from './galaxy-catalog.js';
import { parseGalaxyDisplaySample } from './galaxy-display-sample.js';

/**
 * The dots the world draws from the galaxy catalogue: one for each sampled Local Group galaxy that has no package of its
 * own. The page needs their ids and places and nothing else of the catalogue, so that is what travels: the build reads
 * the catalogues whole and writes this (site/pages/catalogues/dots.bin.ts), a prepared bank (prepared-bank.ts) whose header
 * names the dots and whose one column holds their places. The three catalogues as JSON were 717 KB the page fetched,
 * parsed and checked twice on its own thread, to draw fewer than fifty dots (2026-10-04).
 */
export const PREPARED_CATALOGUE_DOTS_SCHEMA = 'cssearth-catalogue-dots@1';
export interface PreparedCatalogueDots {
  readonly frame: { readonly referenceFrame: string; readonly epochJdTt: number };
  readonly ids: readonly string[];
  /** Each dot's x, y and z in the frame, in metres. */
  readonly positionsM: Float64Array;
  /** How many clusters the cluster catalogue holds: a count the mount reports. */
  readonly clusterCount: number;
}

/** A catalogue's dots: its named Local Group rows without a package, and only the sampled ones when a sample is given. */
export function catalogueDots(catalog: PreparedGalaxyCatalog, sample?: unknown, clusterCount = 0): PreparedCatalogueDots {
  const sampled = sample === undefined ? null : new Set(parseGalaxyDisplaySample(sample, catalog).ids);
  const rows = catalog.objects.filter(object => object.name && !object.detailedObjectId && object.membership.group === 'local-group' && (!sampled || sampled.has(object.id)));
  return { frame: { referenceFrame: catalog.frame.referenceFrame, epochJdTt: catalog.frame.epochJdTt }, ids: rows.map(row => row.id),
    positionsM: Float64Array.from(rows.flatMap(row => row.positionM)), clusterCount };
}

export function encodeCatalogueDots(dots: PreparedCatalogueDots): PreparedBank {
  return { schema: PREPARED_CATALOGUE_DOTS_SCHEMA, fields: { frame: dots.frame, ids: dots.ids, clusterCount: dots.clusterCount }, columns: { positionM: dots.positionsM } };
}

/** The dots of a fetched file, checked. */
export function decodeCatalogueDots(bank: PreparedBank, at = 'catalogue dots'): PreparedCatalogueDots {
  if (bank.schema !== PREPARED_CATALOGUE_DOTS_SCHEMA) throw new TypeError(`${at}: expected ${PREPARED_CATALOGUE_DOTS_SCHEMA}, got ${bank.schema}.`);
  const { frame, ids, clusterCount } = bank.fields as { frame?: { referenceFrame?: unknown; epochJdTt?: unknown }; ids?: unknown; clusterCount?: unknown };
  if (!frame || typeof frame.referenceFrame !== 'string' || !frame.referenceFrame || typeof frame.epochJdTt !== 'number' || !Number.isFinite(frame.epochJdTt)) {
    throw new TypeError(`${at}: its frame names a reference frame and an epoch, got ${JSON.stringify(frame ?? null)}.`);
  }
  if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string' && id) || new Set(ids).size !== ids.length) throw new TypeError(`${at}: its ids are distinct names, one for each dot.`);
  if (!Number.isSafeInteger(clusterCount) || (clusterCount as number) < 0) throw new TypeError(`${at}: clusterCount is a count, got ${JSON.stringify(clusterCount ?? null)}.`);
  const positionsM = preparedBankColumn(bank, 'positionM', 'f64', ids.length * 3, at);
  const bad = positionsM.findIndex(value => !Number.isFinite(value));
  if (bad >= 0) throw new TypeError(`${at}: dot ${ids[Math.floor(bad / 3)]} has no finite place.`);
  return { frame: { referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt }, ids: ids as string[], positionsM, clusterCount: clusterCount as number };
}
