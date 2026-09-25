import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { astroquery } from '@cssearth/telescope/node';
import { mastService, type MastServiceRequest, type MastServiceResult } from '@cssearth/telescope/node';
import type { ProductKind } from '../recipe-request.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { canonical, digest, jsonValue, parseMetadata, parsePin, parseRegion, recordKey, type DiscoverySnapshot, type IcrsCircle, type Json, type TransferLimits } from '@cssearth/telescope/node';
import { sha256File } from '@cssearth/core/node';
import { mapIvoaProductType, type ProductTypeMapping } from '../product-type.mts';
import type { FamilyId } from '../product-descriptor.mts';
import { productTypeFamilyEvidence, type ObservationFamilyEvidence } from '../observation-families.mts';

export interface ServiceProfile {
  readonly authority: string; readonly service: string; readonly table: string; readonly model: DiscoverySnapshot['model'];
  readonly identityColumns: readonly string[]; readonly timeScale?: 'utc' | 'tai' | 'tt' | 'tdb'; readonly documentation: string;
  readonly label?: string;
  /** Archive collection restriction when one TAP service mixes unrelated missions. */
  readonly collections?: readonly string[];
  readonly compactNameVariants?: boolean;
  readonly facetByInstrument?: boolean;
  /** MAST's positional API selects exact ids when its TAP endpoint rejects INTERSECTS. */
  readonly spatialMatch?: 'mast-api-cone';
}
/** The archive boundary needs only explicit discovery/subset inputs. Scientific acceptance
 * criteria remain in CapabilityRequest and are never synthesized for target exploration. */
export interface DiscoveryRequest {
  readonly target: string;
  /** Exact entered name for this saved request, only associated after unique catalogue resolution to `target`. */
  readonly requestedTargetName?: string;
  readonly wavelengthMicrometres?: readonly [number, number];
  readonly continuumMicrometres?: readonly [readonly [number, number], readonly [number, number]];
  readonly time?: { readonly any: true } | { readonly fromIso: string; readonly toIso: string };
  readonly kind?: ProductKind;
  readonly family?:FamilyId;
  /** Archive instrument name (ObsCore and EPN-TAP `instrument_name`), matched exactly by the service. */
  readonly instrument?: string;
  readonly region?: import('@cssearth/telescope/node').IcrsCircle;
  /** A circle to search by footprint only, never a cutout (`region` is the cutout). A SIMBAD target supplies SIMBAD's
   * position and position error here. */
  readonly footprint?: import('@cssearth/telescope/node').IcrsCircle;
  /** A target outside the application catalogue, named and placed by SIMBAD (sky/target.mts). */
  readonly skyTarget?: import('../sky/target.mts').SkyTarget;
  readonly spectralFrame?: 'barycentric';
  readonly transferLimits?: TransferLimits;
}
/** A bounded service list, with no target-specific selection rules. */
export const SERVICES: readonly ServiceProfile[] = [
  { authority: 'ivo://eso.org', service: 'https://archive.eso.org/tap_obs', table: 'ivoa.ObsCore', model: 'obscore-1.1', identityColumns: ['obs_publisher_did', 'obs_id'], timeScale: 'utc', documentation: 'https://archive.eso.org/tap_obs' },
  { authority: 'ivo://alma', service: 'https://almascience.eso.org/tap', table: 'ivoa.obscore', model: 'obscore-1.1', identityColumns: ['obs_publisher_did', 'obs_id'], timeScale: 'utc', documentation: 'https://almascience.eso.org/alma-data/archive/archive-notebooks/nb9_ALMA_Download_data.html' },
  { authority: 'ivo://esa/psa', service: 'https://psa.esa.int/psa-tap/tap', table: 'psa.epn_core', model: 'epn-tap-2.0', identityColumns: ['granule_uid'], documentation: 'https://archives.esac.esa.int/psa/' },
  { authority: 'ivo://archive.stsci.edu/caomtap', service: 'https://mast.stsci.edu/vo-tap/api/v0.1/caom/', table: 'ivoa.obscore',
    model: 'obscore-1.1', identityColumns: ['access_format', 'obs_publisher_did', 'obs_id', 'access_url'], timeScale: 'utc', collections: ['JWST'], label: 'MAST JWST', compactNameVariants: true, facetByInstrument: true, spatialMatch: 'mast-api-cone',
    documentation: 'https://mast.stsci.edu/vo-tap/api/v0.1/caom/examples' },
  { authority: 'ivo://archive.stsci.edu/caomtap', service: 'https://mast.stsci.edu/vo-tap/api/v0.1/caom/', table: 'ivoa.obscore',
    model: 'obscore-1.1', identityColumns: ['access_format', 'obs_publisher_did', 'obs_id', 'access_url'], timeScale: 'utc', collections: ['HST'], label: 'MAST HST', compactNameVariants: true, facetByInstrument: true, spatialMatch: 'mast-api-cone',
    documentation: 'https://mast.stsci.edu/vo-tap/api/v0.1/caom/examples' },
];
export interface ArchiveTarget { readonly id: string; readonly names: readonly string[]; readonly classification?: string; readonly classificationSource?: string }
/** `in-field` means a region query selected a record named for another target. The saved reason says whether the
 * service matched footprint intersection or only its reported center. Neither establishes target identity. */
export interface TargetAssociation { readonly status: 'confirmed' | 'ambiguous' | 'unmatched' | 'in-field'; readonly target: string; readonly reason: string }
const nameKey = (s: string) => s.trim().toLocaleLowerCase('en-US').replace(/\s+/gu, ' ');
const compactKey = (s: string) => nameKey(s).replace(/[\s-]+/gu, '');
const catalogueDesignation = /^[A-Za-z]{1,12}[\s-]*\d+[A-Za-z0-9\s-]*$/u;
const archiveNameMatch = (left: string, right: string) => nameKey(left) === nameKey(right) ||
  catalogueDesignation.test(left) && catalogueDesignation.test(right) && compactKey(left) === compactKey(right);
export function associateTarget(rawName: Json | undefined, rawClass: Json | undefined, target: ArchiveTarget, catalogue: readonly ArchiveTarget[]): TargetAssociation {
  if (typeof rawName !== 'string' || !rawName.trim()) return { status: 'unmatched', target: target.id, reason: 'No archive target name.' };
  // EPN multi-target lists cannot be treated as a measurement of one named body.
  if (/[#;,]/u.test(rawName)) return { status: 'ambiguous', target: target.id, reason: 'Multiple archive target names; no per-target measurement association.' };
  // A numbered minor-planet name can collide with a satellite name. Its class is required to disambiguate that shortened spelling.
  const matches = catalogue.filter(t => t.names.some(n => archiveNameMatch(n, rawName) || t.classification === 'asteroid' && nameKey(n.replace(/^\(?\d+\)?\s+/u, '')) === nameKey(rawName)));
  const classified = typeof rawClass === 'string' && rawClass.trim() ? matches.filter(t => t.classificationSource && nameKey(t.classification ?? '') === nameKey(rawClass)) : matches;
  if (classified.length === 1 && classified[0]!.id === target.id) return { status: 'confirmed', target: target.id, reason: 'Unique catalogue name/alias under archive designation spelling, and any supplied classification agree.' };
  return { status: matches.some(t => t.id === target.id) ? 'ambiguous' : 'unmatched', target: target.id,
    reason: 'Archive target name/class does not establish a unique catalogue identity; sky overlap is not target association.' };
}
export interface DiscoveredObservation {
  readonly key: string; readonly snapshot: string; readonly service: string; readonly table: string;
  readonly facility: string | null; readonly collection: string | null; readonly telescopeName: string | null; readonly instrument: string | null;
  readonly identities: Readonly<Record<string, Json>>; readonly target: TargetAssociation; readonly rawTarget: Json;
  readonly kind: string | null; readonly productType:ProductTypeMapping|null; readonly familyEvidence: ObservationFamilyEvidence; readonly calibration: { readonly scheme: string; readonly token: Json };
  readonly wavelengthsMicrometres: readonly [number | null, number | null]; readonly startIso: string | null; readonly endIso: string | null;
  readonly spatial: { readonly frame: string | null; readonly description: Json; readonly coordinates: Readonly<Record<string, Json>> };
  readonly access: { readonly url: string | null; readonly mime: string | null; readonly estimatedKilobytes: number | null };
  readonly issues: readonly string[];
}
export function normalizeSnapshot(snapshot: DiscoverySnapshot, profile: ServiceProfile, target: ArchiveTarget, catalogue: readonly ArchiveTarget[]): DiscoveredObservation[] {
  if (snapshot.service !== profile.service || snapshot.table !== profile.table || snapshot.model !== profile.model) throw new TypeError('VO profile does not match snapshot.');
  const epn = profile.model === 'epn-tap-2.0';
  return snapshot.response.rows.map((row, index) => {
    const issues: string[] = [...snapshot.response.issues];
    const number = (key: string, unit?: string): number | null => {
      const raw = row[key];
      if (raw === null || raw === undefined) return null;
      const field = snapshot.response.fields.find(f => f.name === key);
      if (unit && field?.unit !== unit) { issues.push(`${key}: expected unit ${unit}, found ${field?.unit ?? 'undeclared'}.`); return null; }
      if (typeof raw !== 'number' || !Number.isFinite(raw)) { issues.push(`${key}: not a finite numeric coordinate.`); return null; }
      return raw;
    };
    const positive = (key: string, unit: string) => { const n = number(key, unit); if (n !== null && n <= 0) { issues.push(`${key}: non-positive spectral coordinate.`); return null; } return n; };
    const lower = positive(epn ? 'spectral_range_min' : 'em_min', epn ? 'Hz' : 'm'), upper = positive(epn ? 'spectral_range_max' : 'em_max', epn ? 'Hz' : 'm');
    let wavelengths: [number | null, number | null] = epn ? [upper === null ? null : 299792458e6 / upper, lower === null ? null : 299792458e6 / lower] : [lower === null ? null : lower * 1e6, upper === null ? null : upper * 1e6];
    if (wavelengths[0] !== null && wavelengths[1] !== null && wavelengths[0] > wavelengths[1]) { issues.push('Inverted spectral interval.'); wavelengths = [null, null]; }
    const string = (key: string): string | null => typeof row[key] === 'string' ? row[key] : null;
    const time = (key: string): string | null => {
      const value = snapshot.response.times[index]?.[key];
      if (value && Number.isFinite(Date.parse(value)) && !/:60(?:\.|Z)/u.test(value)) return value;
      if (row[key] !== undefined && row[key] !== null) issues.push(`${key}: no representable UTC instant established.`);
      return null;
    };
    const mime = string('access_format');
    if (mime && !/^[\w.+-]+\/[\w.+-]+(?:\s*;.*)?$/u.test(mime)) issues.push(`Malformed access_format ${JSON.stringify(mime)}; access protocol is unresolved.`);
    const keys = epn ? ['granule_uid', 'granule_gid', 'obs_id'] : profile.identityColumns;
    const uniqueIdentity = profile.identityColumns.every(k => row[k] !== undefined && row[k] !== null && row[k] !== '') && snapshot.response.rows.filter(r => profile.identityColumns.every(k => canonical(r[k] ?? null) === canonical(row[k] ?? null))).length === 1;
    if (!uniqueIdentity) issues.push('Declared row identity is absent or repeated; this record key is bound to its snapshot and row position.');
    const kind=epn && row.dataproduct_type === 'im' ? 'image' : epn && row.dataproduct_type === 'sc' ? 'cube' : string('dataproduct_type'),productType=mapIvoaProductType(kind);
    const collection = string('obs_collection'), facility = string('facility_name');
    return { key: recordKey(snapshot, row, profile.identityColumns, index), snapshot: snapshot.response.raw.sha256, service: snapshot.service, table: snapshot.table,
      collection, facility, telescopeName: collection && profile.collections?.includes(collection) ? collection : facility,
      instrument: string('instrument_name'),
      identities: Object.fromEntries(keys.map(k => [k, row[k] ?? null])), rawTarget: row.target_name ?? null,
      target: fieldAssociation(associateTarget(row.target_name, row.target_class, target, catalogue), row.target_name, regionQueried(snapshot, profile, row), profile.spatialMatch), kind,productType,
      familyEvidence: productTypeFamilyEvidence(productType, { kind: 'archive-adapter', id: profile.authority, evidence: `${profile.service} ${profile.table}; ${profile.documentation}` }),
      calibration: { scheme: epn ? 'epn-tap:processing_level' : 'obscore:calib_level', token: row[epn ? 'processing_level' : 'calib_level'] ?? null },
      wavelengthsMicrometres: wavelengths, startIso: time(epn ? 'time_min' : 't_min'), endIso: time(epn ? 'time_max' : 't_max'),
      spatial: { frame: epn ? string('spatial_frame_type') : 'icrs', description: row[epn ? 'spatial_coordinate_description' : 's_region'] ?? null,
        coordinates: Object.fromEntries((epn ? ['c1min','c1max','c2min','c2max','c3min','c3max'] : ['s_ra','s_dec','s_fov','s_region']).map(k => [k, row[k] ?? null])) },
      access: { url: string('access_url'), mime, estimatedKilobytes: number('access_estsize') }, issues };
  });
}
const requestedWavelengths = (request: DiscoveryRequest): readonly [number, number] => {
  if (!request.wavelengthMicrometres) throw new TypeError('A spectral subset requires an explicit wavelength interval.');
  return request.continuumMicrometres
    ? [request.continuumMicrometres[0][0], request.continuumMicrometres[1][1]]
    : request.wavelengthMicrometres;
};
/** The ObsCore footprint clause for TAP services that support ADQL INTERSECTS. */
const regionClause = (region: IcrsCircle): string => {
  const values = [region.raDegrees, region.decDegrees, region.radiusDegrees];
  if (!values.every(Number.isFinite)) throw new TypeError('Region coordinates must be finite.');
  return `1=INTERSECTS(CIRCLE('ICRS',${values.join(',')}),s_region)`;
};
/** A row is spatially selected only when its saved query or pinned MAST position result includes it. */
function regionQueried(snapshot: DiscoverySnapshot, profile: ServiceProfile, row: Readonly<Record<string, Json>>): IcrsCircle | undefined {
  const request = snapshot.request;
  if (profile.model !== 'obscore-1.1' || request === null || typeof request !== 'object') return undefined;
  const raw: unknown = 'region' in request && request.region !== undefined ? request.region : 'footprint' in request ? request.footprint : undefined;
  if (raw === undefined || raw === null) return undefined;
  const region = parseRegion(raw);
  if (profile.spatialMatch === 'mast-api-cone') {
    const selected = snapshot.spatialSelection;
    return selected?.method === 'mast-filtered-position@1' && canonical(selected.region) === canonical(region) &&
      profile.collections?.includes(selected.collection) && typeof row.obs_id === 'string' && selected.ids.includes(row.obs_id) &&
      snapshot.query.includes('obs_id IN (') ? region : undefined;
  }
  // Older snapshots with a region in the request but no spatial clause selected only by name.
  return snapshot.query.includes(regionClause(region)) ? region : undefined;
}
/** A row a region query returned whose name does not identify the target is in the field, never confirmed. */
export function fieldAssociation(association: TargetAssociation, rawName: Json | undefined, region: IcrsCircle | undefined, spatialMatch?: ServiceProfile['spatialMatch']): TargetAssociation {
  if (!region || association.status !== 'unmatched') return association;
  const name = typeof rawName === 'string' && rawName.trim() ? `"${rawName}"` : 'no target';
  const selected = spatialMatch === 'mast-api-cone' ? 'MAST positional search selected this observation for' : 'its footprint intersects';
  const meaning = spatialMatch === 'mast-api-cone'
    ? 'The positional result does not establish a target identity or a detection.'
    : 'The target is in the field; field membership is not a target identity.';
  return { status: 'in-field', target: association.target, reason: `The archive names ${name}; ${selected} the ICRS circle (${region.raDegrees}, ${region.decDegrees}, radius ${region.radiusDegrees} deg). ${meaning}` };
}
/** The requested spatial circle: the explicit cutout if there is one, otherwise the discovery footprint. */
export const searchCircle = (request?: DiscoveryRequest): IcrsCircle | undefined => request?.region ?? request?.footprint;
/** MAST's indexed positional service supplies bounded ids; TAP still supplies the science metadata for those ids. */
export async function mastConeSelection(profile: ServiceProfile, region: IcrsCircle, sampleLimit: number,
  instrument?: string, client: (request: MastServiceRequest) => Promise<MastServiceResult> = mastService): Promise<NonNullable<DiscoverySnapshot['spatialSelection']>> {
  if (profile.spatialMatch !== 'mast-api-cone' || profile.collections?.length !== 1 || !Number.isSafeInteger(sampleLimit) || sampleLimit < 1 || sampleLimit > 1000)
    throw new TypeError('A MAST positional search needs one mission and a bounded sample.');
  const circle = parseRegion(region), collection = profile.collections[0]!;
  if (instrument !== undefined && (!instrument.trim() || /[\u0000-\u001f]/u.test(instrument))) throw new TypeError('Invalid MAST instrument filter.');
  const request: MastServiceRequest = { service: 'Mast.Caom.Filtered.Position', params: {
    columns: 'obs_id,obs_collection', filters: [{ paramName: 'obs_collection', values: [collection] },
      ...(instrument ? [{ paramName: 'instrument_name', values: [instrument] }] : [])],
    position: `${circle.raDegrees}, ${circle.decDegrees}, ${circle.radiusDegrees}`,
  }, pagesize: sampleLimit + 1, page: 1 };
  const answer = await client(request);
  if (!answer.responseRecord) throw new Error('MAST positional search has no saved response pin.');
  if (answer.rows.length > sampleLimit + 1) throw new Error('MAST positional search exceeded its requested page size.');
  const returnedIds = answer.rows.map(row => {
    if (row.obs_collection !== collection) throw new Error('MAST positional search returned another collection.');
    return requireString(row.obs_id, 'MAST positional observation id');
  });
  const ids = [...new Set(returnedIds.slice(0, sampleLimit))];
  const pin = { path: answer.responseRecord.path, ...await sha256File(answer.responseRecord.path) };
  if (pin.sha256 !== answer.responseRecord.sha256) throw new Error('MAST positional response changed after retrieval.');
  return { method: 'mast-filtered-position@1', region: circle, collection, ids: ids.sort(), complete: answer.rows.length <= sampleLimit, pin };
}
export function targetQuery(profile: ServiceProfile, names: readonly string[], sampleLimit = 50, request?: DiscoveryRequest, spatialIds: readonly string[] = []): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?$/u.test(profile.table)) throw new TypeError('Unvalidated TAP table identifier.');
  if (!Number.isSafeInteger(sampleLimit) || sampleLimit < 1 || sampleLimit > 1000 || !names.length) throw new TypeError('A bounded TAP target-name query is required.');
  const variants = profile.compactNameVariants ? names.flatMap(name => [name, name.replace(/\s+/gu, ''), name.replace(/\s+/gu, '-')]) : names;
  const literals = [...new Set(variants)].map(n => { if (!n.trim() || /[\u0000-\u001f]/u.test(n)) throw new TypeError('Invalid target name.'); return `'${n.replaceAll("'", "''")}'`; });
  const byName = `target_name IN (${literals.join(',')})`;
  const circle = searchCircle(request);
  if (spatialIds.length && (profile.spatialMatch !== 'mast-api-cone' || !circle || spatialIds.length > sampleLimit || new Set(spatialIds).size !== spatialIds.length))
    throw new TypeError('MAST spatial ids require one bounded positional result.');
  const ids = spatialIds.map(id => { if (!id.trim() || /[\u0000-\u001f]/u.test(id)) throw new TypeError('Invalid MAST observation id.'); return `'${id.replaceAll("'", "''")}'`; });
  const spatial = circle && profile.model === 'obscore-1.1'
    ? profile.spatialMatch === 'mast-api-cone' ? ids.length ? `obs_id IN (${ids.join(',')})` : undefined : regionClause(circle)
    : undefined;
  const filters = [spatial ? `(${byName} OR ${spatial})` : byName];
  if (profile.collections?.length) {
    const collections = profile.collections.map(name => {
      if (!/^[A-Za-z0-9_-]+$/u.test(name)) throw new TypeError('Invalid archive collection.');
      return `'${name}'`;
    });
    filters.push(`obs_collection IN (${collections.join(',')})`);
  }
  if (request?.instrument !== undefined) {
    if (!request.instrument.trim() || /[\u0000-\u001f]/u.test(request.instrument)) throw new TypeError('Invalid instrument name.');
    filters.push(`instrument_name='${request.instrument.replaceAll("'", "''")}'`);
  }
  if (request?.kind) {
    const token = profile.model === 'epn-tap-2.0' ? ({ image: 'im', cube: 'sc', spectrum: 'sp', table: 'ca', photometry: 'ts', events: 'ev', strips: 'im' } as const)[request.kind] : request.kind;
    filters.push(`(dataproduct_type IS NULL OR dataproduct_type='${token}')`);
  }
  if (request?.wavelengthMicrometres && profile.model === 'obscore-1.1') {
    const [lo, hi] = requestedWavelengths(request);
    filters.push(`(em_min IS NULL OR em_min<=${hi * 1e-6})`, `(em_max IS NULL OR em_max>=${lo * 1e-6})`);
  }
  if (request?.time && !('any' in request.time) && profile.model === 'obscore-1.1' && profile.timeScale === 'utc') {
    const mjd = (iso: string) => Date.parse(iso) / 86_400_000 + 40_587;
    filters.push(`(t_min IS NULL OR t_min<=${mjd(request.time.toIso)})`, `(t_max IS NULL OR t_max>=${mjd(request.time.fromIso)})`);
  }
  // A bounded sample is only reproducible in a stated order: TOP without ORDER BY lets a service return different rows.
  if (!profile.identityColumns.length || !profile.identityColumns.every(column => /^[A-Za-z_][A-Za-z0-9_]*$/u.test(column))) throw new TypeError('Unvalidated TAP identity columns.');
  return `SELECT TOP ${sampleLimit} * FROM ${profile.table} WHERE ${filters.join(' AND ')} ORDER BY ${profile.identityColumns.join(', ')}`;
}
export function parseSnapshot(value: unknown): DiscoverySnapshot {
  const r = requireRecord(value);
  if (r.schema !== 'cssearth-vo-discovery@1' || !['obscore-1.1','epn-tap-2.0'].includes(requireString(r.model))) throw new TypeError('Unsupported VO snapshot.');
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
  return { schema: 'cssearth-vo-discovery@1', service: requireString(r.service), table: requireString(r.table), model: r.model as DiscoverySnapshot['model'],
    request, query, scope: requireString(r.scope), sampleLimit, response,
    ...(spatialSelection ? { spatialSelection } : {}), completeness };
}
/** A failed refresh never replaces a successful immutable snapshot. */
export const INSTRUMENT_FACET_LIMIT = 8;
export const INSTRUMENT_SAMPLE_LIMIT = 5;
export function instrumentFacetQuery(profile: ServiceProfile, names: readonly string[], request: DiscoveryRequest): string {
  if (!profile.facetByInstrument || request.instrument) throw new TypeError('Instrument facets require an unfiltered faceted service.');
  const query = targetQuery(profile, names, 50, request);
  return query.replace('SELECT TOP 50 *', `SELECT DISTINCT TOP ${INSTRUMENT_FACET_LIMIT} instrument_name`)
    .replace(/ ORDER BY [A-Za-z_, ]+$/u, ' ORDER BY instrument_name');
}
export interface InstrumentFacets { readonly names: readonly string[]; readonly complete: boolean; readonly evidence: string; readonly issues: readonly string[] }
/** Enumerate archive modes before sampling rows, so a high-volume mode cannot hide every later one. */
export async function discoverInstrumentFacets(root: string, profile: ServiceProfile, request: DiscoveryRequest, names: readonly string[], limits: TransferLimits): Promise<InstrumentFacets> {
  const directory = resolve(root, 'output/telescopes/vo/metadata'), query = instrumentFacetQuery(profile, names, request);
  await mkdir(directory, { recursive: true });
  const response = (await astroquery({ operation: 'vo-tap', service: profile.service, query, maxrec: INSTRUMENT_FACET_LIMIT + 1,
    directory, byteLimit: limits.metadataBytes, timeFormat: 'mjd', ...(profile.timeScale ? { timeScale: profile.timeScale } : {}) })).vo!;
  if (response.queryStatus === 'ERROR') throw new Error(`Instrument search failed: ${response.issues.join('; ') || 'archive query error'}`);
  const instruments = [...new Set(response.rows.map(row => row.instrument_name).filter((value): value is string => typeof value === 'string' && Boolean(value.trim())))];
  if (instruments.length !== response.rows.length) throw new TypeError('Instrument facet response has missing or duplicate names.');
  const complete = response.queryStatus === 'OK' && instruments.length < INSTRUMENT_FACET_LIMIT;
  const result = { names: instruments, complete, evidence: response.raw.sha256, issues: response.issues };
  await writeFile(resolve(directory, `${digest({ query, result })}.facets.json`), canonical({ query, result }));
  return result;
}
export async function discover(root: string, profile: ServiceProfile, request: DiscoveryRequest, names: readonly string[], limits: TransferLimits, sampleLimit = 50): Promise<DiscoverySnapshot> {
  const circle = searchCircle(request);
  const spatialSelection = circle && profile.spatialMatch === 'mast-api-cone' ? await mastConeSelection(profile, circle, sampleLimit, request.instrument) : undefined;
  const directory = resolve(root, 'output/telescopes/vo/metadata'), query = targetQuery(profile, names, sampleLimit, request, spatialSelection?.ids);
  await mkdir(directory, { recursive: true });
  const response = (await astroquery({ operation: 'vo-tap', service: profile.service, query, maxrec: sampleLimit, directory, byteLimit: limits.metadataBytes,
    timeFormat: profile.model === 'obscore-1.1' ? 'mjd' : 'jd', ...(profile.timeScale ? { timeScale: profile.timeScale } : {}),
    ...(profile.model === 'epn-tap-2.0' ? { timeModel: profile.model } : {}) })).vo!;
  const spatialScope = spatialSelection
    ? `records selected by MAST's positional service for the requested ICRS circle (${spatialSelection.ids.length} ids; ${spatialSelection.complete ? 'bounded page' : 'more pages exist'}; positional membership is not target identity)`
    : 'records whose footprint intersects the requested ICRS circle (in the field, not identified as the target)';
  const snapshot = parseSnapshot({ schema: 'cssearth-vo-discovery@1', service: profile.service, table: profile.table, model: profile.model,
    request, query, sampleLimit, scope: `${circle && profile.model === 'obscore-1.1' ? `Exact target-name/alias search, plus ${spatialScope}` : 'Exact target-name/alias search'}; bounded sample; incidental targets are not covered.${circle && profile.model !== 'obscore-1.1' ? ' This provider has no ICRS footprint; the region was not applied.' : ''}${request.wavelengthMicrometres && profile.model !== 'obscore-1.1' ? ' This provider did not apply the wavelength filter.' : ''}${request.time && !('any' in request.time) && (profile.model !== 'obscore-1.1' || profile.timeScale !== 'utc') ? ' This provider did not apply the time filter.' : ''}`, response,
    ...(spatialSelection ? { spatialSelection } : {}),
    completeness: response.queryStatus === 'ERROR' ? 'failed' : response.queryStatus === 'OVERFLOW' || spatialSelection?.complete === false ? 'overflow' : 'bounded-sample' });
  await writeFile(resolve(directory, `${digest(snapshot)}.json`), canonical(snapshot));
  return snapshot;
}
export async function verifySnapshot(snapshot: DiscoverySnapshot): Promise<boolean> {
  const raw = await sha256File(snapshot.response.raw.path);
  if (raw.bytes !== snapshot.response.raw.bytes || raw.sha256 !== snapshot.response.raw.sha256) return false;
  if (!snapshot.spatialSelection) return true;
  const positional = await sha256File(snapshot.spatialSelection.pin.path);
  return positional.bytes === snapshot.spatialSelection.pin.bytes && positional.sha256 === snapshot.spatialSelection.pin.sha256;
}
