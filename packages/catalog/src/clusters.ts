import { validateSpatialPosition } from './spatial-relations.ts';
import type { PreparedGalaxyRecord, SpatialCatalogSource } from './spatial.js';
import type { PreparedNebulaRecord } from './nebulae.js';

/** A catalogue centre and overdensity aperture, never a member-galaxy or density model. */
export interface PreparedClusterRecord extends Pick<PreparedGalaxyRecord,
  'id' | 'name' | 'aliases' | 'positionM' | 'skyPosition' | 'distance' | 'status' | 'presentation'> {
  readonly kind: 'galaxy-cluster';
  readonly classification: { readonly name: string; readonly basis: string; readonly sourceRef: string };
  readonly redshift: { readonly value: number; readonly type: string; readonly sourceRef: string };
  readonly aperture: { readonly definition: 'R500'; readonly properRadiusM: number;
    readonly comovingRadiusM: number; readonly sourceRef: string };
}
export type PreparedCatalogObject = PreparedGalaxyRecord | PreparedClusterRecord | PreparedNebulaRecord;
export interface PreparedClusterCatalog {
  readonly schema: 'cssearth-cluster-catalog@1';
  readonly frame: { readonly referenceFrame: string; readonly epochJdTt: number };
  readonly sources: readonly SpatialCatalogSource[];
  readonly objects: readonly PreparedClusterRecord[];
  readonly cosmology: { readonly model: 'flat-lambda-cdm'; readonly hubbleKmPerSecPerMpc: number; readonly omegaMatter: number };
  readonly selection: { readonly description: string; readonly distanceCaveat: string };
}

export function isPreparedCluster(object: PreparedCatalogObject): object is PreparedClusterRecord {
  return 'kind' in object && object.kind === 'galaxy-cluster';
}

/** Validate once without allocating another scientific row bank. */
export function parsePreparedClusterCatalog(input: unknown): PreparedClusterCatalog {
  const data = record(input);
  if (data.schema !== 'cssearth-cluster-catalog@1') throw new TypeError('Unsupported cluster catalogue schema.');
  const frame = record(data.frame); text(frame.referenceFrame); finite(frame.epochJdTt);
  const cosmology = record(data.cosmology);
  if (cosmology.model !== 'flat-lambda-cdm' || finite(cosmology.omegaMatter) < 0 || Number(cosmology.omegaMatter) > 1) throw new TypeError('Invalid cluster cosmology.');
  positive(cosmology.hubbleKmPerSecPerMpc);
  const sourceIds = new Set<string>();
  for (const value of array(data.sources)) {
    const source = record(value), id = text(source.id);
    unique(sourceIds, id);
    if (!/^https:\/\//.test(text(source.url)) || !Number.isSafeInteger(positive(source.bytes))) throw new TypeError('Invalid cluster source.');
    text(source.citation);
    for (const value of source.references === undefined ? [] : array(source.references)) {
      const ref = record(value); unique(sourceIds, text(ref.id)); text(ref.citation);
      if (!/^https:\/\//.test(text(ref.url))) throw new TypeError('Invalid cluster bibliographic URL.');
    }
  }
  const ids = new Set<string>(), objects = array(data.objects);
  if (objects.length > 10000) throw new TypeError('Cluster catalogue exceeds its bounded annotation bank.');
  for (const value of objects) {
    const row = record(value), id = text(row.id); unique(ids, id);
    if (!/^[a-z0-9][a-z0-9_.+-]*$/.test(id) || row.kind !== 'galaxy-cluster' || row.status !== 'confirmed') throw new TypeError('Invalid cluster identity.');
    text(row.name); for (const alias of array(row.aliases)) text(alias);
    const position = array(row.positionM); if (position.length !== 3) throw new TypeError('Cluster position needs three metre coordinates.');
    position.forEach(finite);
    const sky = record(row.skyPosition), ra = finite(sky.raDeg), dec = finite(sky.decDeg);
    if (ra < 0 || ra >= 360 || dec < -90 || dec > 90) throw new TypeError('Invalid cluster sky position.');
    reference(sky.sourceRef, sourceIds);
    const distance = record(row.distance); positive(distance.valuePc); text(distance.method); reference(distance.sourceRef, sourceIds);
    const redshift = record(row.redshift); positive(redshift.value); text(redshift.type); reference(redshift.sourceRef, sourceIds);
    const aperture = record(row.aperture);
    if (aperture.definition !== 'R500') throw new TypeError('Unknown cluster aperture definition.');
    positive(aperture.properRadiusM); positive(aperture.comovingRadiusM); reference(aperture.sourceRef, sourceIds);
    const classification = record(row.classification); text(classification.name); text(classification.basis); reference(classification.sourceRef, sourceIds);
    if (row.presentation !== undefined) positive(record(row.presentation).focusRadiusM);
  }
  const selection = record(data.selection); text(selection.description); text(selection.distanceCaveat);
  const validated = input as PreparedClusterCatalog;
  for (const row of validated.objects) validateSpatialPosition(validated.frame, row);
  return validated;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected cluster metadata object.');
  return value as Record<string, unknown>;
}
function array(value: unknown): readonly unknown[] { if (!Array.isArray(value)) throw new TypeError('Expected cluster array.'); return value; }
function text(value: unknown): string { if (typeof value !== 'string' || !value.trim()) throw new TypeError('Expected cluster text.'); return value; }
function finite(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected finite cluster value.'); return value; }
function positive(value: unknown): number { const n = finite(value); if (!(n > 0)) throw new TypeError('Expected positive cluster value.'); return n; }
function unique(ids: Set<string>, id: string): void { if (ids.has(id)) throw new TypeError(`Duplicate cluster identifier: ${id}`); ids.add(id); }
function reference(value: unknown, ids: Set<string>): void {
  const ref = text(value); if (![...ids].some(id => ref === id || ref.startsWith(`${id}:`))) throw new TypeError('Cluster reference has no pinned source.');
}
