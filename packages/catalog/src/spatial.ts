/** Prepared scientific positions and their evidence. This does not alter GXCT. */
export interface SpatialCatalogSource {
  readonly id: string;
  readonly url: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly citation: string;
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
  readonly exclusions: readonly { readonly id: string; readonly reason: string }[];
  readonly selection: { readonly description: string };
}

/** Validate the decoded document in place: do not materialize a second row bank. */
export function parsePreparedGalaxyCatalog(input: unknown): PreparedGalaxyCatalog {
  const data = record(input, 'catalogue');
  if (data.schema !== 'cssearth-galaxy-catalog@1') throw new TypeError('Unsupported galaxy catalogue schema.');
  const frame = record(data.frame, 'catalogue frame');
  text(frame.referenceFrame, 'reference frame'); finite(frame.epochJdTt, 'epoch');
  const sources = array(data.sources, 'sources'), sourceIds = new Set<string>();
  for (const item of sources) {
    const source = record(item, 'source'), id = text(source.id, 'source id');
    unique(sourceIds, id, 'source');
    if (!/^https?:\/\//.test(text(source.url, 'source URL'))) throw new TypeError('Invalid catalogue source URL.');
    if (!/^[a-f0-9]{64}$/.test(text(source.sha256, 'source digest'))) throw new TypeError('Invalid catalogue source digest.');
    if (!Number.isSafeInteger(positive(source.bytes, 'source byte count'))) throw new TypeError('Invalid source byte count.');
    text(source.citation, 'source citation');
  }
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
    text(sky.sourceRef, 'sky position reference');
    const distance = measurement(row.distance, 'distance');
    text(distance.method, 'distance method');
    if (distance.uncertainty !== undefined) {
      const uncertainty = record(distance.uncertainty, 'distance uncertainty');
      nonnegative(uncertainty.statisticalPc, 'statistical distance error');
      nonnegative(uncertainty.systematicPc, 'systematic distance error');
    }
    if (row.halfLightRadius !== undefined) measurement(row.halfLightRadius, 'half-light radius');
    if (row.hostId !== undefined) text(row.hostId, 'host id');
    const membership = record(row.membership, 'membership');
    if (!['local-group', 'local-volume', 'uncertain'].includes(String(membership.group)) ||
        !['milky-way', 'andromeda', 'field', 'unknown'].includes(String(membership.subgroup))) {
      throw new TypeError('Unknown catalogue membership classification.');
    }
    text(membership.basis, 'membership evidence');
    if (membership.sourceRef !== undefined) text(membership.sourceRef, 'membership reference');
    if (row.status !== 'confirmed' && row.status !== 'candidate') throw new TypeError('Unknown galaxy confirmation status.');
    if (row.detailedObjectId !== undefined) unique(detailIds, text(row.detailedObjectId, 'detailed object id'), 'detailed object');
    if (row.presentation !== undefined) positive(record(row.presentation, 'presentation').focusRadiusM, 'navigation framing radius');
  }
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
