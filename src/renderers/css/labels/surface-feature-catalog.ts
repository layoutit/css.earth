import { surfaceFeatureBankIndex } from '../../../platform/surface-feature-banks.mts';
import type { PreparedSurfaceFeature, PreparedSurfaceFeatureCatalog, PreparedSurfaceFeaturePlan, SurfaceFeatureCatalogDescriptor, SurfaceFeatureKind, SurfaceFeatureOutline } from './surface-feature-types.js';

const KINDS: readonly SurfaceFeatureKind[] = ['point', 'linear', 'region'];
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Invalid prepared ${label}.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new TypeError(`Invalid prepared ${label}.`);
  return value;
}
function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`Invalid prepared ${label}.`);
  return value;
}
function vector(value: unknown, label: string): readonly [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError(`Invalid prepared ${label}.`);
  return [finite(value[0], label), finite(value[1], label), finite(value[2], label)];
}

/** Every prepared surface point lies on the reference sphere, or, for a shape model, inside its declared radius band,
 * or, for an ellipsoid, inside the declared normalised-radius band of its rendered surface. */
function onBody(point: readonly [number, number, number], plan: PreparedSurfaceFeaturePlan): boolean {
  const length = Math.hypot(...point), band = plan.surfaceRadiusUnits, ellipsoid = plan.surfaceEllipsoidUnits;
  if (ellipsoid) {
    const up = point[0] * ellipsoid.north[0] + point[1] * ellipsoid.north[1] + point[2] * ellipsoid.north[2];
    const share = Math.sqrt(Math.max(0, length * length - up * up) / (ellipsoid.equatorial * ellipsoid.equatorial) + (up * up) / (ellipsoid.polar * ellipsoid.polar));
    return share >= ellipsoid.minimumShare * (1 - 1e-3) && share <= ellipsoid.maximumShare * (1 + 1e-3);
  }
  return band ? length >= band.minimum * (1 - 1e-3) && length <= band.maximum * (1 + 1e-3) : Math.abs(length - plan.meshRadiusUnits) <= 1e-3 * plan.meshRadiusUnits;
}
/** The farthest any prepared point may sit from the centre: the sphere, the hit-mesh band's top, or the ellipsoid band's top on its long axis. */
function surfaceCeiling(plan: PreparedSurfaceFeaturePlan): number {
  return plan.surfaceEllipsoidUnits ? plan.surfaceEllipsoidUnits.equatorial * plan.surfaceEllipsoidUnits.maximumShare : plan.surfaceRadiusUnits?.maximum ?? plan.meshRadiusUnits;
}

function parseOutline(value: unknown, plan: PreparedSurfaceFeaturePlan): SurfaceFeatureOutline {
  const outline = object(value, 'feature outline');
  if (outline.kind === 'circle') {
    const center = vector(outline.center, 'feature rim centre'), east = vector(outline.east, 'feature rim east'), north = vector(outline.north, 'feature rim north');
    const ceiling = surfaceCeiling(plan) * (1 + 1e-3);
    if (Math.hypot(...center) > ceiling || Math.abs(Math.hypot(...east) - Math.hypot(...north)) > 1e-3 * plan.meshRadiusUnits) throw new TypeError('Surface feature rim is not on the prepared body.');
    return Object.freeze({ kind: 'circle', center, east, north });
  }
  if (outline.kind === 'box') {
    if (!Array.isArray(outline.points) || outline.points.length < 4 || outline.points.length > plan.outline.pieces) throw new TypeError('Surface feature extent polygon is out of range.');
    const points = outline.points.map(point => { const p = vector(point, 'feature extent point'); if (!onBody(p, plan)) throw new TypeError('Surface feature extent is not on the prepared body.'); return p; });
    return Object.freeze({ kind: 'box', points: Object.freeze(points) });
  }
  if (outline.kind === 'trace') {
    if (!Array.isArray(outline.paths) || !outline.paths.length) throw new TypeError('Surface feature trace has no paths.');
    let vertices = 0;
    const paths = outline.paths.map(path => {
      if (!Array.isArray(path) || path.length < 2) throw new TypeError('Surface feature trace path is too short.');
      vertices += path.length;
      return Object.freeze(path.map(point => { const p = vector(point, 'feature trace point'); if (!onBody(p, plan)) throw new TypeError('Surface feature trace is not on the prepared body.'); return p; }));
    });
    if (vertices > plan.outline.pieces) throw new TypeError('Surface feature trace exceeds the outline pool.');
    return Object.freeze({ kind: 'trace', paths: Object.freeze(paths) });
  }
  throw new TypeError('Surface feature outline kind is unknown.');
}

/** Validate the transported catalogue against its prepared plan before any label text is written. */
/** A prepared discovery tier in [0, 1]; absent in older catalogues, which then show at every zoom the policy admits. */
function zoomShare(value: unknown): number {
  if (value === undefined) return 0;
  const share = finite(value, 'feature zoom share');
  if (share < 0 || share > 1) throw new TypeError('Surface feature zoom share is out of range.');
  return share;
}

/** An optional caption note: short text with the article it summarises. */
function parseNote(value: unknown): PreparedSurfaceFeature['note'] {
  if (value === undefined) return null;
  const note = object(value, 'feature note');
  const noteText = text(note.text, 'feature note text'), title = text(note.title, 'feature note title'), url = text(note.url, 'feature note url'), credit = note.credit === '' ? '' : text(note.credit, 'feature note credit');
  if (!noteText.trim() || noteText.length > 400 || !/^https?:\/\//u.test(url)) throw new TypeError('Surface feature note is invalid.');
  return Object.freeze({ text: noteText, title, url, credit });
}

export function parsePreparedSurfaceFeatureCatalog(value: unknown, plan: PreparedSurfaceFeaturePlan, objectId: string,
  descriptor: SurfaceFeatureCatalogDescriptor = plan.catalog): PreparedSurfaceFeatureCatalog {
  const catalog = object(value, 'surface feature catalogue');
  if (catalog.schema !== 'cssearth-prepared-surface-features@1' || catalog.objectId !== objectId) throw new TypeError('Surface feature catalogue is incompatible.');
  if (!Array.isArray(catalog.features) || catalog.features.length !== descriptor.count) throw new TypeError('Surface feature catalogue count differs from its plan.');
  const ids = new Set<string>();
  const features: PreparedSurfaceFeature[] = catalog.features.map((input, index) => {
    const feature = object(input, `surface feature ${index}`);
    const id = text(feature.id, 'feature id'), kind = text(feature.kind, 'feature kind');
    if (!/^[0-9]+$/u.test(id) || ids.has(id) || !KINDS.includes(kind as SurfaceFeatureKind)) throw new TypeError('Surface feature identity or kind is invalid.');
    ids.add(id);
    const anchorUnits = vector(feature.anchorUnits, 'feature anchor'), normal = vector(feature.normal, 'feature normal');
    const radiusUnits = finite(feature.radiusUnits, 'feature radius'), diameterKm = finite(feature.diameterKm, 'feature diameter');
    // A diameter of zero is a name the Gazetteer has not sized: labelled, ranked last, no rim.
    if (!(radiusUnits >= 0) || !(diameterKm >= 0) || !onBody(anchorUnits, plan) ||
        Math.abs(Math.hypot(...normal) - 1) > 1e-3) throw new TypeError('Surface feature geometry is not on the prepared body.');
    const outline = parseOutline(feature.outline, plan);
    const name = text(feature.name, 'feature name'), link = text(feature.link, 'feature link');
    if (!Array.isArray(feature.searchNames) || !feature.searchNames.length || !feature.searchNames.every(value => typeof value === 'string' && value.length > 0)) throw new TypeError('Surface feature search names are invalid.');
    const searchNames = Object.freeze([...feature.searchNames as string[]]), searchContext = text(feature.searchContext, 'feature search context');
    if (!name.trim() || !/^https?:\/\//u.test(link)) throw new TypeError('Surface feature caption is invalid.');
    if (feature.searchOnly !== undefined && feature.searchOnly !== true) throw new TypeError('Surface feature searchOnly must be true when present.');
    return Object.freeze({ id, name, kind: kind as SurfaceFeatureKind, type: text(feature.type, 'feature type'), code: text(feature.code, 'feature code'),
      diameterKm, longitudeDeg: finite(feature.longitudeDeg, 'feature longitude'), latitudeDeg: finite(feature.latitudeDeg, 'feature latitude'),
      anchorUnits, normal, radiusUnits, outline, searchNames, searchContext, origin: text(feature.origin, 'feature origin'), approved: text(feature.approved, 'feature approval'),
      quad: text(feature.quad, 'feature quad'), link, credit: text(feature.credit, 'feature credit'), note: parseNote(feature.note), facilityId: feature.facilityId === undefined ? null : text(feature.facilityId, 'feature facility'), minimumZoomShare: zoomShare(feature.minimumZoomShare), searchOnly: feature.searchOnly === true });
  });
  return Object.freeze({ schema: 'cssearth-prepared-surface-features@1', objectId, source: text(catalog.source, 'catalogue source'),
    snapshotDate: text(catalog.snapshotDate, 'catalogue snapshot'), sourcePage: text(catalog.sourcePage, 'catalogue page'),
    license: text(catalog.license, 'catalogue license'), qualification: text(catalog.qualification, 'catalogue qualification'), features: Object.freeze(features) });
}

export type SurfaceFeatureTransport = (url: string, init: { signal: AbortSignal }) => Promise<Response>;

async function loadPinnedCatalog(plan: PreparedSurfaceFeaturePlan, objectId: string, descriptor: SurfaceFeatureCatalogDescriptor,
  signal: AbortSignal, transport: SurfaceFeatureTransport): Promise<PreparedSurfaceFeatureCatalog> {
  const response = await transport(descriptor.url, { signal });
  if (!response.ok) throw new Error(`Surface feature catalogue ${objectId} ${descriptor.url} failed: HTTP ${response.status}.`);
  return parsePreparedSurfaceFeatureCatalog(await response.json() as unknown, plan, objectId, descriptor);
}

/** Fetch the default label catalogue. */
export async function loadPreparedSurfaceFeatureCatalog(plan: PreparedSurfaceFeaturePlan, objectId: string, signal: AbortSignal,
  transport: SurfaceFeatureTransport = (url, init) => fetch(url, init)): Promise<PreparedSurfaceFeatureCatalog> {
  return loadPinnedCatalog(plan, objectId, plan.catalog, signal, transport);
}

/** Resolve and load only the bank that can contain a search-only feature. */
export async function loadPreparedSurfaceFeatureBank(plan: PreparedSurfaceFeaturePlan, objectId: string, id: string, signal: AbortSignal,
  transport: SurfaceFeatureTransport = (url, init) => fetch(url, init)): Promise<PreparedSurfaceFeatureCatalog | null> {
  if (!plan.selection) return null;
  const descriptor = plan.selection.banks[surfaceFeatureBankIndex(id, plan.selection.banks.length)];
  if (!descriptor) throw new TypeError('Surface feature selection bank is missing.');
  return loadPinnedCatalog(plan, objectId, descriptor, signal, transport);
}

/** Resolve one selected feature without admitting every search-only outline into memory. */
export async function loadPreparedSurfaceFeature(plan: PreparedSurfaceFeaturePlan, objectId: string, id: string, signal: AbortSignal,
  transport: SurfaceFeatureTransport = (url, init) => fetch(url, init), base?: PreparedSurfaceFeatureCatalog): Promise<PreparedSurfaceFeature | null> {
  const catalog = base ?? await loadPreparedSurfaceFeatureCatalog(plan, objectId, signal, transport);
  const resident = catalog.features.find(feature => feature.id === id);
  if (resident) return resident;
  const bank = await loadPreparedSurfaceFeatureBank(plan, objectId, id, signal, transport);
  return bank?.features.find(feature => feature.id === id) ?? null;
}
