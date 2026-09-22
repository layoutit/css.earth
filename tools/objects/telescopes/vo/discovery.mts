import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { astroquery } from '../../astronomy-packages/client.mts';
import type { ProductKind } from '../query.mts';
import { requireFiniteNumber, requireRecord, requireString } from '../../../sources/source-values.mts';
import { canonical, digest, jsonValue, parseMetadata, recordKey, type DiscoverySnapshot, type Json, type TransferLimits } from './contracts.mts';
import { mapIvoaProductType, type ProductTypeMapping } from '../product-type.mts';
import type { FamilyId } from '../product-descriptor.mts';
import { productTypeFamilyEvidence, type ObservationFamilyEvidence } from '../observation-families.mts';

export interface ServiceProfile {
  readonly authority: string; readonly service: string; readonly table: string; readonly model: DiscoverySnapshot['model'];
  readonly identityColumns: readonly string[]; readonly timeScale?: 'utc' | 'tai' | 'tt' | 'tdb'; readonly documentation: string;
}
/** The archive boundary needs only explicit discovery/subset inputs. Scientific acceptance
 * criteria remain in CapabilityRequest and are never synthesized for target exploration. */
export interface DiscoveryRequest {
  readonly target: string;
  readonly wavelengthMicrometres?: readonly [number, number];
  readonly continuumMicrometres?: readonly [readonly [number, number], readonly [number, number]];
  readonly time?: { readonly any: true } | { readonly fromIso: string; readonly toIso: string };
  readonly kind?: ProductKind;
  readonly family?:FamilyId;
  readonly region?: import('./contracts.mts').IcrsCircle;
  readonly spectralFrame?: 'barycentric';
  readonly transferLimits?: TransferLimits;
}
/** A bounded service list, with no target-specific selection rules. */
export const SERVICES: readonly ServiceProfile[] = [
  { authority: 'ivo://eso.org', service: 'https://archive.eso.org/tap_obs', table: 'ivoa.ObsCore', model: 'obscore-1.1', identityColumns: ['obs_publisher_did', 'obs_id'], timeScale: 'utc', documentation: 'https://archive.eso.org/tap_obs' },
  { authority: 'ivo://alma', service: 'https://almascience.eso.org/tap', table: 'ivoa.obscore', model: 'obscore-1.1', identityColumns: ['obs_publisher_did', 'obs_id'], timeScale: 'utc', documentation: 'https://almascience.eso.org/alma-data/archive/archive-notebooks/nb9_ALMA_Download_data.html' },
  { authority: 'ivo://esa/psa', service: 'https://psa.esa.int/psa-tap/tap', table: 'psa.epn_core', model: 'epn-tap-2.0', identityColumns: ['granule_uid'], documentation: 'https://archives.esac.esa.int/psa/' },
];
export interface ArchiveTarget { readonly id: string; readonly names: readonly string[]; readonly classification?: string; readonly classificationSource?: string }
export interface TargetAssociation { readonly status: 'confirmed' | 'ambiguous' | 'unmatched'; readonly target: string; readonly reason: string }
const nameKey = (s: string) => s.trim().toLocaleLowerCase('en-US').replace(/\s+/gu, ' ');
export function associateTarget(rawName: Json | undefined, rawClass: Json | undefined, target: ArchiveTarget, catalogue: readonly ArchiveTarget[]): TargetAssociation {
  if (typeof rawName !== 'string' || !rawName.trim()) return { status: 'unmatched', target: target.id, reason: 'No archive target name.' };
  // EPN multi-target lists cannot be treated as a measurement of one named body.
  if (/[#;,]/u.test(rawName)) return { status: 'ambiguous', target: target.id, reason: 'Multiple archive target names; no per-target measurement association.' };
  // A numbered minor-planet name can collide with a satellite name. Its class is required to disambiguate that shortened spelling.
  const matches = catalogue.filter(t => t.names.some(n => nameKey(n) === nameKey(rawName) || t.classification === 'asteroid' && nameKey(n.replace(/^\(?\d+\)?\s+/u, '')) === nameKey(rawName)));
  const classified = typeof rawClass === 'string' && rawClass.trim() ? matches.filter(t => t.classificationSource && nameKey(t.classification ?? '') === nameKey(rawClass)) : matches;
  if (classified.length === 1 && classified[0]!.id === target.id) return { status: 'confirmed', target: target.id, reason: 'Exact catalogue name/alias and any supplied archive classification agree.' };
  return { status: matches.some(t => t.id === target.id) ? 'ambiguous' : 'unmatched', target: target.id,
    reason: 'Archive target name/class does not establish a unique catalogue identity; sky overlap is not target association.' };
}
export interface DiscoveredObservation {
  readonly key: string; readonly snapshot: string; readonly service: string; readonly table: string;
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
    const keys = epn ? ['granule_uid', 'granule_gid', 'obs_id'] : ['obs_publisher_did', 'obs_id'];
    const uniqueIdentity = profile.identityColumns.every(k => row[k] !== undefined && row[k] !== null && row[k] !== '') && snapshot.response.rows.filter(r => profile.identityColumns.every(k => canonical(r[k] ?? null) === canonical(row[k] ?? null))).length === 1;
    if (!uniqueIdentity) issues.push('Declared row identity is absent or repeated; this record key is bound to its snapshot and row position.');
    const kind=epn && row.dataproduct_type === 'im' ? 'image' : epn && row.dataproduct_type === 'sc' ? 'cube' : string('dataproduct_type'),productType=mapIvoaProductType(kind);
    return { key: recordKey(snapshot, row, profile.identityColumns, index), snapshot: snapshot.response.raw.sha256, service: snapshot.service, table: snapshot.table,
      identities: Object.fromEntries(keys.map(k => [k, row[k] ?? null])), rawTarget: row.target_name ?? null,
      target: associateTarget(row.target_name, row.target_class, target, catalogue), kind,productType,
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
export function targetQuery(profile: ServiceProfile, names: readonly string[], sampleLimit = 50, request?: DiscoveryRequest): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?$/u.test(profile.table)) throw new TypeError('Unvalidated TAP table identifier.');
  if (!Number.isSafeInteger(sampleLimit) || sampleLimit < 1 || sampleLimit > 1000 || !names.length) throw new TypeError('A bounded TAP target-name query is required.');
  const literals = [...new Set(names)].map(n => { if (!n.trim() || /[\u0000-\u001f]/u.test(n)) throw new TypeError('Invalid target name.'); return `'${n.replaceAll("'", "''")}'`; });
  const filters = [`target_name IN (${literals.join(',')})`];
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
  return `SELECT TOP ${sampleLimit} * FROM ${profile.table} WHERE ${filters.join(' AND ')}`;
}
export function parseSnapshot(value: unknown): DiscoverySnapshot {
  const r = requireRecord(value);
  if (r.schema !== 'cssearth-vo-discovery@1' || !['obscore-1.1','epn-tap-2.0'].includes(requireString(r.model))) throw new TypeError('Unsupported VO snapshot.');
  const response = parseMetadata(r.response), sampleLimit = requireFiniteNumber(r.sampleLimit);
  if (!Number.isSafeInteger(sampleLimit) || sampleLimit < 1) throw new TypeError('Invalid VO sample limit.');
  const completeness = response.queryStatus === 'ERROR' ? 'failed' : response.queryStatus === 'OVERFLOW' ? 'overflow' : 'bounded-sample';
  if (r.completeness !== completeness) throw new TypeError('VO completeness contradicts response status.');
  return { schema: 'cssearth-vo-discovery@1', service: requireString(r.service), table: requireString(r.table), model: r.model as DiscoverySnapshot['model'],
    request: jsonValue(r.request), query: requireString(r.query), scope: requireString(r.scope), sampleLimit, response, completeness };
}
/** A failed refresh never replaces a successful immutable snapshot. */
export async function discover(root: string, profile: ServiceProfile, request: DiscoveryRequest, names: readonly string[], limits: TransferLimits): Promise<DiscoverySnapshot> {
  const directory = resolve(root, 'output/telescopes/vo/metadata'), query = targetQuery(profile, names, 50, request), sampleLimit = 50;
  await mkdir(directory, { recursive: true });
  const response = (await astroquery({ operation: 'vo-tap', service: profile.service, query, maxrec: sampleLimit, directory, byteLimit: limits.metadataBytes,
    timeFormat: profile.model === 'obscore-1.1' ? 'mjd' : 'jd', ...(profile.timeScale ? { timeScale: profile.timeScale } : {}),
    ...(profile.model === 'epn-tap-2.0' ? { timeModel: profile.model } : {}) })).vo!;
  const snapshot = parseSnapshot({ schema: 'cssearth-vo-discovery@1', service: profile.service, table: profile.table, model: profile.model,
    request, query, sampleLimit, scope: `Exact target-name/alias search; bounded sample; incidental targets are not covered.${request.wavelengthMicrometres && profile.model !== 'obscore-1.1' ? ' This provider did not apply the wavelength filter.' : ''}${request.time && !('any' in request.time) && (profile.model !== 'obscore-1.1' || profile.timeScale !== 'utc') ? ' This provider did not apply the time filter.' : ''}`, response,
    completeness: response.queryStatus === 'ERROR' ? 'failed' : response.queryStatus === 'OVERFLOW' ? 'overflow' : 'bounded-sample' });
  await writeFile(resolve(directory, `${digest(snapshot)}.json`), canonical(snapshot));
  return snapshot;
}
export async function verifySnapshot(snapshot: DiscoverySnapshot): Promise<boolean> {
  const bytes = await readFile(snapshot.response.raw.path);
  const { createHash } = await import('node:crypto');
  return bytes.length === snapshot.response.raw.bytes && createHash('sha256').update(bytes).digest('hex') === snapshot.response.raw.sha256;
}
