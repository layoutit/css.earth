import { validatePhysicalHosts, validateSpatialPosition } from './spatial-relations.ts';
import type { DistanceSubject, UnpositionedHost } from './spatial-relations.ts';
/** Prepared scientific positions and their evidence. This does not alter GXCT. */
export interface SpatialCitation {
  readonly id: string;
  readonly url: string;
  readonly citation: string;
  readonly catalogueId?: string;
}
/** Stable crosswalk from an upstream bibliography key to the existing Sources namespace. */
export function spatialPublicationId(reference: string): string {
  const id = reference.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/-$/u, '');
  if (!id || !/^[a-z0-9]/u.test(id)) throw new TypeError('Invalid bibliography identity.');
  return `publication-${id}`;
}

export interface SpatialCatalogSource extends SpatialCitation {
  /** The pinned file's size; a citation-only source (a paper cited, not kept) has none and names its references. */
  readonly bytes?: number;
  /** Bibliographic entries transcribed from this pinned source; their URLs are not byte pins. */
  readonly references?: readonly SpatialCitation[];
}

export function resolveSpatialCitation(reference: string, sources: readonly SpatialCatalogSource[]): SpatialCitation | undefined {
  for (const source of sources) {
    const entry = source.references?.find(entry => entry.id === reference);
    if (entry) return entry;
  }
  // Prefer the longest source id when a reference includes a row/field locator.
  return sources.filter(source => reference === source.id || reference.startsWith(`${source.id}:`))
    .sort((a, b) => b.id.length - a.id.length)[0];
}

export interface SpatialMeasurement {
  readonly valuePc: number;
  readonly minusPc?: number;
  readonly plusPc?: number;
  readonly sourceRef: string;
}

export interface PreparedGalaxyRecord {
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly positionM: readonly [number, number, number];
  readonly skyPosition: { readonly raDeg: number; readonly decDeg: number; readonly sourceRef: string };
  readonly distance: SpatialMeasurement & {
    readonly method: string;
    /** Omitted when the measurement describes this object itself. */
    readonly subject?: DistanceSubject;
    readonly uncertainty?: { readonly statisticalPc: number; readonly systematicPc: number };
  };
  readonly halfLightRadius?: SpatialMeasurement;
  readonly hostId?: string;
  readonly membership: {
    readonly group: 'local-group' | 'local-volume' | 'uncertain';
    readonly subgroup: 'milky-way' | 'andromeda' | 'field' | 'unknown';
    readonly basis: string;
    readonly sourceRef?: string;
  };
  readonly status: 'confirmed' | 'candidate';
  readonly detailedObjectId?: string;
  /** Navigation framing, explicitly distinct from a measured galaxy radius. */
  readonly presentation?: { readonly focusRadiusM: number };
}

export interface PreparedGalaxyCatalog {
  readonly schema: 'cssearth-galaxy-catalog@1';
  readonly frame: { readonly referenceFrame: string; readonly epochJdTt: number };
  readonly sources: readonly SpatialCatalogSource[];
  readonly objects: readonly PreparedGalaxyRecord[];
  readonly unpositionedHosts?: readonly UnpositionedHost[];
  readonly exclusions: readonly { readonly id: string; readonly reason: string }[];
  readonly selection: { readonly description: string };
}

/** Validate the decoded document in place: do not materialize a second row bank. */
export function parsePreparedGalaxyCatalog(input: unknown): PreparedGalaxyCatalog {
  const data = record(input, 'catalogue');
  if (data.schema !== 'cssearth-galaxy-catalog@1') throw new TypeError('Unsupported galaxy catalogue schema.');
  const frame = record(data.frame, 'catalogue frame');
  text(frame.referenceFrame, 'reference frame'); finite(frame.epochJdTt, 'epoch');
  const sources = array(data.sources, 'sources'), sourceIds = new Set<string>(), referenceIds = new Set<string>();
  for (const item of sources) {
    const source = record(item, 'source'), id = text(source.id, 'source id');
    unique(sourceIds, id, 'source');
    if (!/^https?:\/\//.test(text(source.url, 'source URL'))) throw new TypeError('Invalid catalogue source URL.');
    // A citation-only source names its references and has no bytes.
    if (source.bytes !== undefined && !Number.isSafeInteger(positive(source.bytes, 'source byte count'))) throw new TypeError('Invalid source byte count.');
    if (source.bytes === undefined && !(Array.isArray(source.references) && source.references.length)) throw new TypeError('A catalogue source without bytes must name its references.');
    text(source.citation, 'source citation');
    for (const value of source.references === undefined ? [] : array(source.references, 'source references')) {
      const reference = record(value, 'bibliographic reference');
      unique(referenceIds, text(reference.id, 'reference id'), 'bibliographic reference');
      if (!/^https?:\/\//u.test(text(reference.url, 'reference URL'))) throw new TypeError('Invalid bibliographic URL.');
      text(reference.citation, 'reference citation');
      if (reference.catalogueId !== undefined && !/^[a-z][a-z0-9-]*$/u.test(text(reference.catalogueId, 'canonical citation id'))) throw new TypeError('Invalid canonical citation id.');
    }
  }
  if ([...sourceIds].some(id => referenceIds.has(id))) throw new TypeError('Ambiguous source and bibliographic identity.');
  const boundReference = (value: unknown, label: string) => {
    const reference = text(value, label);
    if (!referenceIds.has(reference) && ![...sourceIds].some(id => reference === id || reference.startsWith(`${id}:`))) {
      throw new TypeError(`Unresolved ${label}: ${reference}`);
    }
  };
  const ids = new Set<string>(), detailIds = new Set<string>();
  for (const item of array(data.objects, 'objects')) {
    const row = record(item, 'galaxy'), id = text(row.id, 'galaxy id');
    unique(ids, id, 'galaxy');
    text(row.name, 'galaxy name');
    for (const alias of array(row.aliases, 'aliases')) text(alias, 'alias');
    const position = array(row.positionM, 'position');
    if (position.length !== 3) throw new TypeError('Galaxy positions require three metre coordinates.');
    for (const value of position) finite(value, 'position coordinate');
    const sky = record(row.skyPosition, 'sky position');
    const ra = finite(sky.raDeg, 'right ascension'), dec = finite(sky.decDeg, 'declination');
    if (ra < 0 || ra >= 360 || dec < -90 || dec > 90) throw new TypeError('Galaxy sky coordinates are outside their domain.');
    boundReference(sky.sourceRef, 'sky position reference');
    const distance = measurement(row.distance, 'distance');
    boundReference(distance.sourceRef, 'distance reference');
    text(distance.method, 'distance method');
    if (distance.uncertainty !== undefined) {
      const uncertainty = record(distance.uncertainty, 'distance uncertainty');
      nonnegative(uncertainty.statisticalPc, 'statistical distance error');
      nonnegative(uncertainty.systematicPc, 'systematic distance error');
    }
    if (row.halfLightRadius !== undefined) boundReference(measurement(row.halfLightRadius, 'half-light radius').sourceRef, 'half-light radius reference');
    if (row.hostId !== undefined) text(row.hostId, 'host id');
    const membership = record(row.membership, 'membership');
    if (!['local-group', 'local-volume', 'uncertain'].includes(String(membership.group)) ||
        !['milky-way', 'andromeda', 'field', 'unknown'].includes(String(membership.subgroup))) {
      throw new TypeError('Unknown catalogue membership classification.');
    }
    text(membership.basis, 'membership evidence');
    if (membership.sourceRef !== undefined) boundReference(membership.sourceRef, 'membership reference');
    if (row.status !== 'confirmed' && row.status !== 'candidate') throw new TypeError('Unknown galaxy confirmation status.');
    if (row.detailedObjectId !== undefined) unique(detailIds, text(row.detailedObjectId, 'detailed object id'), 'detailed object');
    if (row.presentation !== undefined) positive(record(row.presentation, 'presentation').focusRadiusM, 'navigation framing radius');
  }
  const hosts = data.unpositionedHosts === undefined ? [] : array(data.unpositionedHosts, 'unpositioned hosts');
  for (const item of hosts) {
    const host = record(item, 'unpositioned host');
    text(host.id, 'host id'); text(host.name, 'host name'); text(host.reason, 'missing position reason');
    boundReference(host.sourceRef, 'host reference');
    if (host.hostId !== undefined) text(host.hostId, 'physical host id');
  }
  const validated = input as PreparedGalaxyCatalog;
  validatePhysicalHosts(validated.objects, validated.unpositionedHosts ?? []);
  for (const row of validated.objects) validateSpatialPosition(validated.frame, row);
  for (const item of array(data.exclusions, 'exclusions')) {
    const exclusion = record(item, 'exclusion');
    text(exclusion.id, 'excluded id'); text(exclusion.reason, 'exclusion reason');
  }
  text(record(data.selection, 'selection').description, 'selection description');
  return input as PreparedGalaxyCatalog;
}

function measurement(input: unknown, label: string): Record<string, unknown> {
  const value = record(input, label);
  positive(value.valuePc, label); text(value.sourceRef, `${label} reference`);
  if (value.minusPc !== undefined) nonnegative(value.minusPc, `${label} lower error`);
  if (value.plusPc !== undefined) nonnegative(value.plusPc, `${label} upper error`);
  return value;
}
function record(input: unknown, label: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError(`${label} must be an object.`);
  return input as Record<string, unknown>;
}
function array(input: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(input)) throw new TypeError(`${label} must be an array.`);
  return input;
}
function text(input: unknown, label: string): string {
  if (typeof input !== 'string' || !input.trim()) throw new TypeError(`${label} must be nonempty text.`);
  return input;
}
function finite(input: unknown, label: string): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) throw new TypeError(`${label} must be finite.`);
  return input;
}
function positive(input: unknown, label: string): number {
  const value = finite(input, label); if (value <= 0) throw new TypeError(`${label} must be positive.`); return value;
}
function nonnegative(input: unknown, label: string): number {
  const value = finite(input, label); if (value < 0) throw new TypeError(`${label} must be nonnegative.`); return value;
}
function unique(ids: Set<string>, id: string, label: string): void {
  if (ids.has(id)) throw new TypeError(`Duplicate ${label} id: ${id}`); ids.add(id);
}
