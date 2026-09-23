/** Archive metadata is evidence, not a qualified scientific product. */
import { createHash } from 'node:crypto';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../../sources/source-values.mts';

export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
export function jsonValue(value: unknown): Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value)) throw new TypeError('VO numbers must be finite and lossless.');
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(jsonValue);
  const record = requireRecord(value, 'VO JSON');
  if (![null, Object.prototype].includes(Object.getPrototypeOf(record))) throw new TypeError('VO JSON requires plain records.');
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => [key, jsonValue(entry)]));
}
/** Opaque strings are never folded or normalized. Null differs from an omitted key. */
export const canonical = (value: unknown): string => JSON.stringify(jsonValue(value));
export const digest = (value: unknown): string => createHash('sha256').update(canonical(value)).digest('hex');
export interface Pin { readonly path: string; readonly bytes: number; readonly sha256: string }
export function parsePin(value: unknown): Pin {
  const p = requireRecord(value), bytes = requireFiniteNumber(p.bytes), sha256 = requireString(p.sha256), path = requireString(p.path);
  if (!path || !Number.isSafeInteger(bytes) || bytes < 0 || !/^[a-f0-9]{64}$/u.test(sha256)) throw new TypeError('Invalid VO file pin.');
  return { path, bytes, sha256 };
}
export const DEFAULT_LIMITS = { scienceBytes: 1_073_741_824, metadataBytes: 33_554_432, nestedEdges: 3, metadataRequests: 32, expandedBytes: 1_073_741_824, packageMembers: 1024 } as const;
export interface TransferLimits { readonly scienceBytes: number; readonly metadataBytes: number; readonly nestedEdges: number; readonly metadataRequests: number; readonly expandedBytes: number; readonly packageMembers: number }
export function parseLimits(value: unknown = {}): TransferLimits {
  const raw = requireRecord(value);
  const read = (key: keyof TransferLimits): number => {
    const n = requireFiniteNumber(raw[key] === undefined ? DEFAULT_LIMITS[key] : raw[key], key);
    if (!Number.isSafeInteger(n) || n < (key === 'nestedEdges' ? 0 : 1)) throw new TypeError(`Invalid transfer limit ${key}.`);
    return n;
  };
  for (const key of Object.keys(raw)) if (!Object.hasOwn(DEFAULT_LIMITS, key)) throw new TypeError(`Unknown transfer limit ${key}.`);
  return { scienceBytes: read('scienceBytes'), metadataBytes: read('metadataBytes'), nestedEdges: read('nestedEdges'), metadataRequests: read('metadataRequests'), expandedBytes: read('expandedBytes'), packageMembers: read('packageMembers') };
}
export interface IcrsCircle { readonly frame: 'icrs'; readonly shape: 'circle'; readonly raDegrees: number; readonly decDegrees: number; readonly radiusDegrees: number }
export function parseRegion(value: unknown): IcrsCircle {
  const r = requireRecord(value), raDegrees = requireFiniteNumber(r.raDegrees), decDegrees = requireFiniteNumber(r.decDegrees), radiusDegrees = requireFiniteNumber(r.radiusDegrees);
  for (const key of Object.keys(r)) if (!['frame','shape','raDegrees','decDegrees','radiusDegrees'].includes(key)) throw new TypeError(`Unsupported region field ${key}.`);
  if (r.frame !== 'icrs' || r.shape !== 'circle' || raDegrees < 0 || raDegrees >= 360 || decDegrees < -90 || decDegrees > 90 || radiusDegrees <= 0 || radiusDegrees > 180)
    throw new TypeError('VO region requires an explicit ICRS circle in degrees.');
  return { frame: 'icrs', shape: 'circle', raDegrees, decDegrees, radiusDegrees };
}
export interface Field {
  readonly name: string; readonly id: string | null; readonly datatype: string; readonly arraysize: string | null;
  readonly unit: string | null; readonly ucd: string | null; readonly utype: string | null; readonly xtype: string | null; readonly ref: string | null;
}
export interface Parameter extends Field { readonly value: Json; readonly constraints?: Json }
export interface Resource {
  readonly id: string | null; readonly type: string | null; readonly utype: string | null;
  readonly parameters: readonly Parameter[]; readonly groups: readonly { readonly name: string | null; readonly parameters: readonly Parameter[] }[];
}
export const nullableString = (value: unknown): string | null => value === null ? null : requireString(value);
function parseField(value: unknown): Field {
  const f = requireRecord(value);
  return { name: requireString(f.name), id: nullableString(f.id), datatype: requireString(f.datatype), arraysize: nullableString(f.arraysize),
    unit: nullableString(f.unit), ucd: nullableString(f.ucd), utype: nullableString(f.utype), xtype: nullableString(f.xtype), ref: nullableString(f.ref) };
}
const parseParameter = (value: unknown): Parameter => ({ ...parseField(value), value: jsonValue(requireRecord(value).value),
  ...(requireRecord(value).constraints === undefined ? {} : { constraints: jsonValue(requireRecord(value).constraints) }) });
export interface MetadataResponse {
  readonly schema: 'cssearth-vo-metadata@1'; readonly pyvo: '1.9.1'; readonly raw: Pin;
  readonly effectiveUrl: string; readonly fetchedAt: string; readonly httpStatus: number;
  readonly queryStatus: 'OK' | 'OVERFLOW' | 'ERROR'; readonly fields: readonly Field[];
  readonly rows: readonly Readonly<Record<string, Json>>[]; readonly resources: readonly Resource[];
  readonly coordinateSystems: readonly Json[]; readonly timeSystems: readonly Json[]; readonly issues: readonly string[];
  readonly times: readonly Readonly<Record<string, string | null>>[];
  readonly bindings: readonly { readonly row: number; readonly serviceId: string; readonly url: string | null; readonly parameters: Readonly<Record<string, Json>>; readonly error: string | null }[];
}
export function parseMetadata(value: unknown): MetadataResponse {
  const r = requireRecord(value, 'VO metadata');
  if (r.schema !== 'cssearth-vo-metadata@1' || r.pyvo !== '1.9.1' || !['OK', 'OVERFLOW', 'ERROR'].includes(requireString(r.queryStatus))) throw new TypeError('Invalid VO metadata contract, package version or query status.');
  const fields = requireArray(r.fields).map(parseField), names = fields.map(f => f.name);
  if (new Set(names).size !== names.length) throw new TypeError('Duplicate VO field names.');
  const ids = fields.flatMap(f => f.id === null ? [] : [f.id]);
  if (new Set(ids).size !== ids.length) throw new TypeError('Duplicate VO field IDs.');
  const rows = requireArray(r.rows).map(row => {
    const record = requireRecord(row);
    if (Object.keys(record).length !== names.length || names.some(name => !(name in record))) throw new TypeError('VO row does not match its fields.');
    return Object.fromEntries(Object.entries(record).map(([key, entry]) => [key, jsonValue(entry)]));
  });
  const times = requireArray(r.times).map(row => Object.fromEntries(Object.entries(requireRecord(row)).map(([k, v]) => [k, nullableString(v)])));
  if (times.length !== rows.length) throw new TypeError('VO time coordinates do not match rows.');
  const resources = requireArray(r.resources).map(value => { const v = requireRecord(value); return {
    id: nullableString(v.id), type: nullableString(v.type), utype: nullableString(v.utype), parameters: requireArray(v.parameters).map(parseParameter),
    groups: requireArray(v.groups).map(value => { const g = requireRecord(value); return { name: nullableString(g.name), parameters: requireArray(g.parameters).map(parseParameter) }; }) }; });
  const bindings = requireArray(r.bindings).map(value => { const b = requireRecord(value), row = requireFiniteNumber(b.row);
    if (!Number.isSafeInteger(row) || row < 0 || row >= rows.length) throw new TypeError('Service binding has no matching row.');
    return { row, serviceId: requireString(b.serviceId), url: nullableString(b.url), parameters: Object.fromEntries(Object.entries(requireRecord(b.parameters)).map(([k, v]) => [k, jsonValue(v)])), error: nullableString(b.error) }; });
  const httpStatus = requireFiniteNumber(r.httpStatus), fetchedAt = requireString(r.fetchedAt), effectiveUrl = requireString(r.effectiveUrl);
  if (!Number.isInteger(httpStatus) || httpStatus < 100 || httpStatus > 599 || !Number.isFinite(Date.parse(fetchedAt))) throw new TypeError('Invalid VO response provenance.');
  if ((httpStatus < 200 || httpStatus >= 300) && r.queryStatus !== 'ERROR') throw new TypeError('VO query status contradicts HTTP failure.');
  new URL(effectiveUrl);
  return { schema: 'cssearth-vo-metadata@1', pyvo: '1.9.1', raw: parsePin(r.raw), effectiveUrl, fetchedAt, httpStatus,
    queryStatus: r.queryStatus as MetadataResponse['queryStatus'], fields, rows, resources, times, bindings,
    coordinateSystems: requireArray(r.coordinateSystems).map(jsonValue), timeSystems: requireArray(r.timeSystems).map(jsonValue), issues: requireArray(r.issues).map(v => requireString(v)) };
}
export interface DiscoverySnapshot {
  readonly schema: 'cssearth-vo-discovery@1'; readonly service: string; readonly table: string; readonly model: 'obscore-1.1' | 'epn-tap-2.0';
  readonly request: Json; readonly query: string; readonly scope: string; readonly sampleLimit: number;
  readonly response: MetadataResponse;
  /** A bounded MAST positional search that selected exact ObsCore observation ids. */
  readonly spatialSelection?: { readonly method: 'mast-filtered-position@1'; readonly region: IcrsCircle; readonly collection: string;
    readonly ids: readonly string[]; readonly complete: boolean; readonly pin: Pin };
  /** Query completion is distinct from a complete archive inventory. */
  readonly completeness: 'bounded-sample' | 'overflow' | 'failed';
}
export function recordKey(snapshot: DiscoverySnapshot, row: Readonly<Record<string, Json>>, identityColumns: readonly string[], rowIndex = snapshot.response.rows.indexOf(row)): string {
  const identity = identityColumns.map(column => row[column]);
  const unique = identity.length > 0 && identity.every(v => v !== undefined && v !== null && v !== '') &&
    snapshot.response.rows.filter(r => identityColumns.every(column => canonical(r[column]) === canonical(row[column]))).length === 1;
  return digest(unique ? { service: snapshot.service, table: snapshot.table, identityColumns, identity }
    : { service: snapshot.service, table: snapshot.table, snapshot: snapshot.response.raw.sha256, rowIndex, row });
}
export const productKey = (record: string, binding: Json): string => digest({ record, binding });
/** Fetch times are deliberately outside this identity. Descriptor content and limits are inside it. */
export const acquisitionKey = (product: string, operation: Json, descriptor: Json, limits: TransferLimits, implementation: string): string =>
  digest({ product, operation, descriptor, limits, implementation });
