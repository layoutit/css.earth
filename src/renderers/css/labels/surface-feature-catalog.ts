import type { PreparedSurfaceFeature, PreparedSurfaceFeatureCatalog, PreparedSurfaceFeaturePlan, SurfaceFeatureKind, SurfaceFeatureOutline } from './surface-feature-types.js';

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

function parseOutline(value: unknown, plan: PreparedSurfaceFeaturePlan): SurfaceFeatureOutline {
  const outline = object(value, 'feature outline');
  if (outline.kind === 'circle') {
    const center = vector(outline.center, 'feature rim centre'), east = vector(outline.east, 'feature rim east'), north = vector(outline.north, 'feature rim north');
    if (Math.hypot(...center) > plan.meshRadiusUnits * (1 + 1e-3) || Math.abs(Math.hypot(...east) - Math.hypot(...north)) > 1e-3 * plan.meshRadiusUnits) throw new TypeError('Surface feature rim is not on the prepared body.');
    return Object.freeze({ kind: 'circle', center, east, north });
  }
  if (outline.kind === 'box') {
    if (!Array.isArray(outline.points) || outline.points.length < 4 || outline.points.length > plan.outline.pieces) throw new TypeError('Surface feature extent polygon is out of range.');
    const points = outline.points.map(point => { const p = vector(point, 'feature extent point'); if (Math.abs(Math.hypot(...p) - plan.meshRadiusUnits) > 1e-3 * plan.meshRadiusUnits) throw new TypeError('Surface feature extent is not on the prepared body.'); return p; });
    return Object.freeze({ kind: 'box', points: Object.freeze(points) });
  }
  if (outline.kind === 'trace') {
    if (!Array.isArray(outline.paths) || !outline.paths.length) throw new TypeError('Surface feature trace has no paths.');
    let vertices = 0;
    const paths = outline.paths.map(path => {
      if (!Array.isArray(path) || path.length < 2) throw new TypeError('Surface feature trace path is too short.');
      vertices += path.length;
      return Object.freeze(path.map(point => { const p = vector(point, 'feature trace point'); if (Math.abs(Math.hypot(...p) - plan.meshRadiusUnits) > 1e-3 * plan.meshRadiusUnits) throw new TypeError('Surface feature trace is not on the prepared body.'); return p; }));
    });
    if (vertices > plan.outline.pieces) throw new TypeError('Surface feature trace exceeds the outline pool.');
    return Object.freeze({ kind: 'trace', paths: Object.freeze(paths) });
  }
  throw new TypeError('Surface feature outline kind is unknown.');
}

/** Validate the transported catalogue against its prepared plan before any label text is written. */
export function parsePreparedSurfaceFeatureCatalog(value: unknown, plan: PreparedSurfaceFeaturePlan, objectId: string): PreparedSurfaceFeatureCatalog {
  const catalog = object(value, 'surface feature catalogue');
  if (catalog.schema !== 'cssearth-prepared-surface-features@1' || catalog.objectId !== objectId) throw new TypeError('Surface feature catalogue is incompatible.');
  if (!Array.isArray(catalog.features) || catalog.features.length !== plan.catalog.count) throw new TypeError('Surface feature catalogue count differs from its plan.');
  const ids = new Set<string>();
  const features: PreparedSurfaceFeature[] = catalog.features.map((input, index) => {
    const feature = object(input, `surface feature ${index}`);
    const id = text(feature.id, 'feature id'), kind = text(feature.kind, 'feature kind');
    if (!/^[0-9]+$/u.test(id) || ids.has(id) || !KINDS.includes(kind as SurfaceFeatureKind)) throw new TypeError('Surface feature identity or kind is invalid.');
    ids.add(id);
    const anchorUnits = vector(feature.anchorUnits, 'feature anchor'), normal = vector(feature.normal, 'feature normal');
    const radiusUnits = finite(feature.radiusUnits, 'feature radius'), diameterKm = finite(feature.diameterKm, 'feature diameter');
    if (!(radiusUnits >= 0) || !(diameterKm > 0) || Math.abs(Math.hypot(...anchorUnits) - plan.meshRadiusUnits) > 1e-3 * plan.meshRadiusUnits ||
        Math.abs(Math.hypot(...normal) - 1) > 1e-3) throw new TypeError('Surface feature geometry is not on the prepared body.');
    const outline = parseOutline(feature.outline, plan);
    const name = text(feature.name, 'feature name'), link = text(feature.link, 'feature link');
    if (!Array.isArray(feature.searchNames) || !feature.searchNames.length || !feature.searchNames.every(value => typeof value === 'string' && value.length > 0)) throw new TypeError('Surface feature search names are invalid.');
    const searchNames = Object.freeze([...feature.searchNames as string[]]), searchContext = text(feature.searchContext, 'feature search context');
    if (!name.trim() || !link.startsWith('https://')) throw new TypeError('Surface feature caption is invalid.');
    return Object.freeze({ id, name, kind: kind as SurfaceFeatureKind, type: text(feature.type, 'feature type'), code: text(feature.code, 'feature code'),
      diameterKm, longitudeDeg: finite(feature.longitudeDeg, 'feature longitude'), latitudeDeg: finite(feature.latitudeDeg, 'feature latitude'),
      anchorUnits, normal, radiusUnits, outline, searchNames, searchContext, origin: text(feature.origin, 'feature origin'), approved: text(feature.approved, 'feature approval'),
      quad: text(feature.quad, 'feature quad'), link });
  });
  return Object.freeze({ schema: 'cssearth-prepared-surface-features@1', objectId, source: text(catalog.source, 'catalogue source'),
    snapshotDate: text(catalog.snapshotDate, 'catalogue snapshot'), sourcePage: text(catalog.sourcePage, 'catalogue page'),
    license: text(catalog.license, 'catalogue license'), qualification: text(catalog.qualification, 'catalogue qualification'), features: Object.freeze(features) });
}

/** Fetch and byte-verify the prepared catalogue; the plan pins its identity. */
export async function loadPreparedSurfaceFeatureCatalog(plan: PreparedSurfaceFeaturePlan, objectId: string, signal: AbortSignal,
  transport: (url: string, init: { signal: AbortSignal }) => Promise<Response> = (url, init) => fetch(url, init)): Promise<PreparedSurfaceFeatureCatalog> {
  const response = await transport(plan.catalog.url, { signal });
  if (!response.ok) throw new Error('Surface feature catalogue request failed.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== plan.catalog.bytes) throw new Error('Surface feature catalogue size drifted.');
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
  if (digest !== plan.catalog.sha256) throw new Error('Surface feature catalogue identity drifted.');
  return parsePreparedSurfaceFeatureCatalog(JSON.parse(new TextDecoder().decode(bytes)), plan, objectId);
}
