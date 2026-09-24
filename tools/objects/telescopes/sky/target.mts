/** A target that is not in the application catalogue, named and placed by SIMBAD (CDS).
 *
 * The catalogue names what cssEarth ships; a search should not need a package first. SIMBAD owns object names and
 * positions, so a name the catalogue does not know is resolved there, through the pinned PyVO TAP client, and the search
 * then uses SIMBAD's identifiers and its position. The resolution travels in the request and is saved with the
 * exploration, so a later `get` reuses the same identity. The pinned SIMBAD answers are evidence beside the request, not
 * part of it: SIMBAD names each result table after the request time, so its bytes differ on every call. */
import { resolve } from 'node:path';
import { astroquery } from '../../astronomy-packages/client.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import type { IcrsCircle, MetadataResponse, Pin } from '../vo/contracts.mts';
import type { TargetCatalogueEntry } from '../targets.mts';

export const SIMBAD_TAP = 'https://simbad.cds.unistra.fr/simbad/sim-tap';
const SIMBAD_BYTES = 1_048_576;
const MAS_PER_DEGREE = 3_600_000;

export interface SkyTarget {
  /** A path-safe id derived from SIMBAD's main identifier. */
  readonly id: string;
  readonly mainId: string;
  readonly identifiers: readonly string[];
  readonly raDegrees: number;
  readonly decDegrees: number;
  /** Major axis of SIMBAD's position error ellipse, in milliarcseconds; null when SIMBAD gives none. */
  readonly positionErrorMas: number | null;
  readonly positionBibcode: string | null;
  readonly objectType: string | null;
  /** The queries that named and placed the target; their pinned answers are `SkyResolution.evidence`. */
  readonly resolver: { readonly service: typeof SIMBAD_TAP; readonly queries: readonly string[] };
}
/** A resolution and the SIMBAD answers it was read from, pinned. */
export interface SkyResolution { readonly target: SkyTarget; readonly evidence: readonly { readonly query: string; readonly raw: Pin }[] }

const literal = (value: string): string => {
  if (!value.trim() || /[\u0000-\u001f]/u.test(value)) throw new TypeError('Invalid SIMBAD identifier.');
  return `'${value.replaceAll("'", "''")}'`;
};
export const skyTargetId = (mainId: string): string =>
  `simbad-${mainId.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')}`;

/** SIMBAD normalises the identifier on `ident.id` equality, so "Sgr A*" finds NAME Sgr A*. */
export const simbadObjectQuery = (name: string): string =>
  `SELECT basic.oid, basic.main_id, basic.ra, basic.dec, basic.coo_err_maj, basic.coo_bibcode, basic.otype FROM basic JOIN ident ON ident.oidref = basic.oid WHERE ident.id = ${literal(name)}`;
export const simbadIdentifiersQuery = (oid: number): string => {
  if (!Number.isSafeInteger(oid) || oid < 0) throw new TypeError('Invalid SIMBAD object id.');
  return `SELECT id FROM ident WHERE oidref = ${oid}`;
};

const unit = (response: MetadataResponse, name: string): string | null => {
  const field = response.fields.find(entry => entry.name === name);
  if (!field) throw new TypeError(`SIMBAD answered without the ${name} column.`);
  return field.unit;
};

/** Read SIMBAD's two answers: the object row (position in degrees, error in mas) and its identifiers. */
export function readSkyTarget(object: MetadataResponse, identifiers: MetadataResponse, queries: readonly string[]): SkyTarget | undefined {
  for (const response of [object, identifiers]) if (response.queryStatus !== 'OK') throw new Error(`SIMBAD query status ${response.queryStatus}.`);
  if (!object.rows.length) return undefined;
  if (object.rows.length > 1) throw new TypeError('SIMBAD resolved the name to more than one object.');
  if (unit(object, 'ra') !== 'deg' || unit(object, 'dec') !== 'deg') throw new TypeError('SIMBAD position columns are not in degrees.');
  const row = object.rows[0]!, mainId = requireString(row.main_id, 'SIMBAD main_id');
  const raDegrees = requireFiniteNumber(row.ra, 'SIMBAD ra'), decDegrees = requireFiniteNumber(row.dec, 'SIMBAD dec');
  if (raDegrees < 0 || raDegrees >= 360 || decDegrees < -90 || decDegrees > 90) throw new RangeError('SIMBAD position is outside its angular domain.');
  let positionErrorMas: number | null = null;
  if (row.coo_err_maj !== null && row.coo_err_maj !== undefined) {
    if (unit(object, 'coo_err_maj') !== 'mas') throw new TypeError('SIMBAD position error is not in milliarcseconds.');
    positionErrorMas = requireFiniteNumber(row.coo_err_maj, 'SIMBAD coo_err_maj');
    if (!(positionErrorMas > 0)) positionErrorMas = null;
  }
  const names = identifiers.rows.map(entry => requireString(entry.id, 'SIMBAD identifier').replace(/\s+/gu, ' ').trim());
  return { id: skyTargetId(mainId), mainId, identifiers: [...new Set([mainId, ...names])], raDegrees, decDegrees, positionErrorMas,
    positionBibcode: typeof row.coo_bibcode === 'string' && row.coo_bibcode ? row.coo_bibcode : null,
    objectType: typeof row.otype === 'string' && row.otype ? row.otype : null, resolver: { service: SIMBAD_TAP, queries } };
}

export async function resolveSkyTarget(root: string, name: string, run: typeof astroquery = astroquery): Promise<SkyResolution | undefined> {
  const directory = resolve(root, 'output/telescopes/simbad');
  const tap = async (query: string) => {
    const response = (await run({ operation: 'vo-tap', service: SIMBAD_TAP, query, maxrec: 1000, directory, byteLimit: SIMBAD_BYTES })).vo;
    if (!response) throw new Error('SIMBAD returned no VO response.');
    return response;
  };
  const objectQuery = simbadObjectQuery(name), object = await tap(objectQuery);
  if (object.queryStatus !== 'OK') throw new Error(`SIMBAD query status ${object.queryStatus}.`);
  if (!object.rows.length) return undefined;
  const oid = requireFiniteNumber(object.rows[0]!.oid, 'SIMBAD oid'), identifiersQuery = simbadIdentifiersQuery(oid), identifiers = await tap(identifiersQuery);
  const target = readSkyTarget(object, identifiers, [objectQuery, identifiersQuery])!;
  return { target, evidence: [{ query: objectQuery, raw: object.raw }, { query: identifiersQuery, raw: identifiers.raw }] };
}

/** The catalogue entry a sky target contributes: SIMBAD's identifiers, matched exactly against archive target names. */
export const skyCatalogueEntry = (target: SkyTarget, requested?: string): TargetCatalogueEntry =>
  ({ id: target.id, name: target.mainId.replace(/^NAME /u, ''), aliases: [...new Set([...target.identifiers, ...requested ? [requested] : []])] });

/** The footprint circle for a sky target: SIMBAD's own position error, never a radius chosen here. */
export function skyRegion(target: SkyTarget): IcrsCircle | undefined {
  if (target.positionErrorMas === null) return undefined;
  return { frame: 'icrs', shape: 'circle', raDegrees: target.raDegrees, decDegrees: target.decDegrees, radiusDegrees: target.positionErrorMas / MAS_PER_DEGREE };
}

/** Validate a sky target read back from a saved request. */
export function parseSkyTarget(value: unknown): SkyTarget {
  const record = requireRecord(value, 'sky target'), resolver = requireRecord(record.resolver, 'sky target resolver');
  if (resolver.service !== SIMBAD_TAP) throw new TypeError('A sky target is resolved by SIMBAD.');
  const mainId = requireString(record.mainId, 'SIMBAD main_id'), id = requireString(record.id, 'sky target id');
  if (id !== skyTargetId(mainId)) throw new TypeError('Sky target id does not derive from its SIMBAD main identifier.');
  const optionalNumber = (raw: unknown, label: string) => raw === null ? null : requireFiniteNumber(raw, label);
  const optionalString = (raw: unknown, label: string) => raw === null ? null : requireString(raw, label);
  return { id, mainId, identifiers: requireArray(record.identifiers, 'SIMBAD identifiers').map(entry => requireString(entry, 'SIMBAD identifier')),
    raDegrees: requireFiniteNumber(record.raDegrees, 'SIMBAD ra'), decDegrees: requireFiniteNumber(record.decDegrees, 'SIMBAD dec'),
    positionErrorMas: optionalNumber(record.positionErrorMas, 'SIMBAD position error'), positionBibcode: optionalString(record.positionBibcode, 'SIMBAD position bibcode'),
    objectType: optionalString(record.objectType, 'SIMBAD object type'),
    resolver: { service: SIMBAD_TAP, queries: requireArray(resolver.queries, 'SIMBAD queries').map(query => requireString(query, 'SIMBAD query text')) } };
}
