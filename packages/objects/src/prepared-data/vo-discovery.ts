import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
export const VO_METADATA_SCHEMA = 'cssearth-vo-metadata@1';
export const VO_DISCOVERY_SCHEMA = 'cssearth-vo-discovery@1';
import type { JsonValue } from '@cssearth/core/schema';
export type Json = JsonValue;
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
/** A saved VO file by where it is and its byte count. */
export interface Pin { readonly path: string; readonly bytes: number }
export function parsePin(value: unknown): Pin {
  const p = requireRecord(value, 'VO file'), path = requireString(p.path, 'VO file path'), bytes = requireFiniteNumber(p.bytes, `VO file ${path} bytes`);
  if (p.sha256 !== undefined) throw new TypeError(`VO file ${path} has a sha256 field (${String(p.sha256)}); VO files carry no content digest.`);
  if (!path || !Number.isSafeInteger(bytes) || bytes < 0) throw new TypeError(`VO file ${path}: bytes ${bytes} is not a byte count.`);
  return { path, bytes };
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
  readonly schema: typeof VO_METADATA_SCHEMA; readonly pyvo: '1.9.1'; readonly raw: Pin;
  readonly effectiveUrl: string; readonly fetchedAt: string; readonly httpStatus: number;
  readonly queryStatus: 'OK' | 'OVERFLOW' | 'ERROR'; readonly fields: readonly Field[];
  readonly rows: readonly Readonly<Record<string, Json>>[]; readonly resources: readonly Resource[];
  readonly coordinateSystems: readonly Json[]; readonly timeSystems: readonly Json[]; readonly issues: readonly string[];
  readonly times: readonly Readonly<Record<string, string | null>>[];
  readonly bindings: readonly { readonly row: number; readonly serviceId: string; readonly url: string | null; readonly parameters: Readonly<Record<string, Json>>; readonly error: string | null }[];
}
export function parseMetadata(value: unknown): MetadataResponse {
  const r = requireRecord(value, 'VO metadata');
  if (r.schema !== VO_METADATA_SCHEMA || r.pyvo !== '1.9.1' || !['OK', 'OVERFLOW', 'ERROR'].includes(requireString(r.queryStatus))) throw new TypeError('Invalid VO metadata contract, package version or query status.');
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
  return { schema: VO_METADATA_SCHEMA, pyvo: '1.9.1', raw: parsePin(r.raw), effectiveUrl, fetchedAt, httpStatus,
    queryStatus: r.queryStatus as MetadataResponse['queryStatus'], fields, rows, resources, times, bindings,
    coordinateSystems: requireArray(r.coordinateSystems).map(jsonValue), timeSystems: requireArray(r.timeSystems).map(jsonValue), issues: requireArray(r.issues).map(v => requireString(v)) };
}
export interface DiscoverySnapshot {
  readonly schema: typeof VO_DISCOVERY_SCHEMA; readonly service: string; readonly table: string; readonly model: 'obscore-1.1' | 'epn-tap-2.0';
  readonly request: Json; readonly query: string; readonly scope: string; readonly sampleLimit: number;
  readonly response: MetadataResponse;
  /** A bounded MAST positional search that selected exact ObsCore observation ids. */
  readonly spatialSelection?: { readonly method: 'mast-filtered-position@1'; readonly region: IcrsCircle; readonly collection: string;
    readonly ids: readonly string[]; readonly complete: boolean; readonly pin: Pin };
  /** Query completion is distinct from a complete archive inventory. */
  readonly completeness: 'bounded-sample' | 'overflow' | 'failed';
}
export function parseSnapshot(value: unknown): DiscoverySnapshot {
  const r = requireRecord(value);
  if (r.schema !== VO_DISCOVERY_SCHEMA || !['obscore-1.1','epn-tap-2.0'].includes(requireString(r.model))) throw new TypeError('Unsupported VO snapshot.');
  const response = parseMetadata(r.response), sampleLimit = requireFiniteNumber(r.sampleLimit), query = requireString(r.query), request = jsonValue(r.request);
  if (!Number.isSafeInteger(sampleLimit) || sampleLimit < 1) throw new TypeError('Invalid VO sample limit.');
  let spatialSelection: DiscoverySnapshot['spatialSelection'];
  if (r.spatialSelection !== undefined) {
    const raw = requireRecord(r.spatialSelection, 'MAST spatial selection');
    if (raw.method !== 'mast-filtered-position@1' || typeof raw.complete !== 'boolean') throw new TypeError('Unsupported MAST spatial selection.');
    const ids = requireArray(raw.ids, 'MAST spatial ids').map(value => requireString(value, 'MAST spatial id'));
    if (ids.length > sampleLimit || new Set(ids).size !== ids.length || ids.some(id=>!id.trim()||/[\u0000-\u001f]/u.test(id))) throw new TypeError('Invalid bounded MAST spatial ids.');
    spatialSelection = { method: 'mast-filtered-position@1', region: parseRegion(raw.region), collection: requireString(raw.collection),
      ids, complete: raw.complete, pin: parsePin(raw.pin) };
    const savedRequest = requireRecord(request, 'spatial discovery request');
    const region = parseRegion(savedRequest.region ?? savedRequest.footprint);
    const clause = `obs_id IN (${ids.map(id=>`'${id.replaceAll("'", "''")}'`).join(',')})`;
    if (r.model !== 'obscore-1.1' || canonical(region) !== canonical(spatialSelection.region) ||
      (ids.length > 0 && !query.includes(clause)))
      throw new TypeError('MAST positional selection disagrees with its bounded query.');
  }
  const completeness = response.queryStatus === 'ERROR' ? 'failed' : response.queryStatus === 'OVERFLOW' || spatialSelection?.complete === false ? 'overflow' : 'bounded-sample';
  if (r.completeness !== completeness) throw new TypeError('VO completeness contradicts response status.');
  return { schema: VO_DISCOVERY_SCHEMA, service: requireString(r.service), table: requireString(r.table), model: r.model as DiscoverySnapshot['model'],
    request, query, scope: requireString(r.scope), sampleLimit, response,
    ...(spatialSelection ? { spatialSelection } : {}), completeness };
}
