import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { parseDbf } from './dbf.js';

/** Prepared nomenclature catalogue: IAU/USGS Gazetteer centre points anchored to the body mesh.
 * Preparation resolves every surface anchor, priority, label kind and tooltip text; runtime
 * only projects the prepared anchors through the current camera. */
export const SURFACE_FEATURES_CONFIG_SCHEMA = 'cssearth-surface-features@1';
export const SURFACE_FEATURES_SOURCE_SCHEMA = 'cssearth-surface-features-source@1';
export const PREPARED_SURFACE_FEATURES_SCHEMA = 'cssearth-prepared-surface-features@1';

export type SurfaceFeatureKind = 'point' | 'linear' | 'region';
export type SurfaceFeatureOutline =
  | { readonly kind: 'circle'; readonly center: readonly [number, number, number]; readonly east: readonly [number, number, number]; readonly north: readonly [number, number, number] }
  | { readonly kind: 'box'; readonly points: readonly (readonly [number, number, number])[] };
export interface SurfaceFeatureAxes { readonly prime: readonly [number, number, number]; readonly east: readonly [number, number, number]; readonly north: readonly [number, number, number]; }
export interface SurfaceFeaturePolicy { readonly minimumZoomShare: number; readonly minimumDiameterPixels: number; readonly alwaysVisibleCount: number; readonly maximumVisible: number; readonly limbCosine: number; }
export interface SurfaceFeaturesConfig {
  readonly schema: typeof SURFACE_FEATURES_CONFIG_SCHEMA;
  readonly directory: string; readonly archive: string;
  readonly members: { readonly attributes: string; readonly projection: string; readonly metadata: string };
  readonly surfaceMap: string; readonly mapLeftEdgeLongitudeDeg: number;
  readonly output: string; readonly publicBase: string;
  readonly target: { readonly className: string };
  readonly lensIds: readonly string[];
  readonly kinds: Readonly<Record<SurfaceFeatureKind, readonly string[]>>;
  readonly excludedTypeCodes: Readonly<Record<string, string>>;
  readonly labelPolicy: SurfaceFeaturePolicy;
  /** Retained screen-space line pieces that trace the hovered feature's published diameter. */
  readonly outline: { readonly pieces: number };
}
export interface SurfaceFeaturesSourceManifest {
  readonly schema: typeof SURFACE_FEATURES_SOURCE_SCHEMA;
  readonly source: string; readonly snapshotDate: string; readonly sourcePage: string; readonly license: string; readonly licenseEvidence: string;
  readonly qualification: string;
  readonly inputs: readonly { readonly path: string; readonly origin: string; readonly bytes: number; readonly sha256: string }[];
}
export interface PreparedSurfaceFeature {
  readonly id: string; readonly name: string; readonly kind: SurfaceFeatureKind; readonly type: string; readonly code: string;
  readonly diameterKm: number; readonly longitudeDeg: number; readonly latitudeDeg: number;
  readonly anchorUnits: readonly [number, number, number]; readonly normal: readonly [number, number, number]; readonly radiusUnits: number;
  /** Circular features trace their published diameter as a small circle of the sphere, rim(φ) = center + east·cos φ + north·sin φ;
   * other features trace the Gazetteer's published latitude/longitude extent as a closed polygon on the sphere. Mesh units. */
  readonly outline: SurfaceFeatureOutline;
  readonly origin: string; readonly approved: string; readonly quad: string; readonly link: string;
}
export interface PreparedSurfaceFeatureCatalog {
  readonly schema: typeof PREPARED_SURFACE_FEATURES_SCHEMA; readonly objectId: string;
  readonly source: string; readonly snapshotDate: string; readonly sourcePage: string; readonly license: string; readonly qualification: string;
  readonly datum: { readonly name: string; readonly radiusM: number; readonly longitude: string };
  readonly excluded: Readonly<Record<string, { readonly count: number; readonly reason: string }>>;
  /** Rows the export repeats for one feature identity; the first row's centre is kept. */
  readonly duplicates: { readonly features: number; readonly rows: number; readonly maxSeparationDeg: number; readonly maxDiameterDifferenceKm: number };
  readonly features: readonly PreparedSurfaceFeature[];
}
export interface SurfaceFeatureCatalogDescriptor { readonly url: string; readonly bytes: number; readonly sha256: string; readonly count: number; }
export interface PreparedSurfaceFeaturePlan {
  readonly catalog: SurfaceFeatureCatalogDescriptor; readonly target: number; readonly lensIds: readonly string[];
  /** Mesh radius in raw prepared scene coordinates (before the camera's scene scale). */
  readonly meshRadiusUnits: number; readonly policy: SurfaceFeaturePolicy;
  readonly outline: { readonly pieces: number };
}

type Input = Record<string, unknown>;
function record(value: unknown, at: string): Input { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${at} must be an object.`); return value as Input; }
function text(value: unknown, at: string): string { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${at} must be non-empty text.`); return value; }
function finite(value: unknown, at: string): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${at} must be a finite number.`); return value; }
function integer(value: unknown, at: string, minimum = 0): number { const n = finite(value, at); if (!Number.isInteger(n) || n < minimum) throw new TypeError(`${at} must be an integer of at least ${minimum}.`); return n; }
function relativePath(value: unknown, at: string): string {
  const path = text(value, at);
  if (path.startsWith('/') || path.split('/').some(segment => segment === '..' || segment === '') || /[\\\u0000-\u0020]/u.test(path)) throw new TypeError(`${at} must be a relative path.`);
  return path;
}
function axis(value: unknown, at: string): readonly [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3 || value.some(n => typeof n !== 'number' || !Number.isFinite(n))) throw new TypeError(`${at} must be a three-component axis.`);
  const length = Math.hypot(value[0], value[1], value[2]);
  if (Math.abs(length - 1) > 1e-9) throw new TypeError(`${at} must be a unit axis.`);
  return [value[0], value[1], value[2]];
}
function codes(value: unknown, at: string): readonly string[] {
  if (!Array.isArray(value) || !value.length || value.some(code => typeof code !== 'string' || !/^[A-Z]{2}$/u.test(code))) throw new TypeError(`${at} must list two-letter Gazetteer type codes.`);
  return [...value];
}

export function parseSurfaceFeaturesConfig(value: unknown): SurfaceFeaturesConfig {
  const input = record(value, 'features recipe');
  if (input.schema !== SURFACE_FEATURES_CONFIG_SCHEMA) throw new TypeError('Unsupported surface features recipe schema.');
  const members = record(input.members, 'features recipe members'), target = record(input.target, 'features recipe target');
  const kindsInput = record(input.kinds, 'features recipe kinds'), policyInput = record(input.labelPolicy, 'features label policy');
  const kinds = { point: codes(kindsInput.point, 'kinds.point'), linear: codes(kindsInput.linear, 'kinds.linear'), region: codes(kindsInput.region, 'kinds.region') };
  const all = [...kinds.point, ...kinds.linear, ...kinds.region];
  if (new Set(all).size !== all.length) throw new TypeError('A Gazetteer type code maps to one label kind.');
  const excluded = record(input.excludedTypeCodes ?? {}, 'features recipe excludedTypeCodes');
  for (const [code, reason] of Object.entries(excluded)) { if (!/^[A-Z]{2}$/u.test(code) || all.includes(code)) throw new TypeError(`Excluded type ${code} must not also be labelled.`); text(reason, `excludedTypeCodes.${code}`); }
  const lensIds = input.lensIds;
  if (!Array.isArray(lensIds) || !lensIds.length || lensIds.some(id => typeof id !== 'string' || !id) || new Set(lensIds).size !== lensIds.length) throw new TypeError('features recipe lensIds must list distinct lens ids.');
  const policy: SurfaceFeaturePolicy = {
    minimumZoomShare: finite(policyInput.minimumZoomShare, 'labelPolicy.minimumZoomShare'),
    minimumDiameterPixels: finite(policyInput.minimumDiameterPixels, 'labelPolicy.minimumDiameterPixels'),
    alwaysVisibleCount: integer(policyInput.alwaysVisibleCount, 'labelPolicy.alwaysVisibleCount'),
    maximumVisible: integer(policyInput.maximumVisible, 'labelPolicy.maximumVisible', 1),
    limbCosine: finite(policyInput.limbCosine, 'labelPolicy.limbCosine'),
  };
  if (!(policy.minimumDiameterPixels > 0) || policy.minimumZoomShare < 0 || policy.minimumZoomShare > 1 || policy.limbCosine < 0 || policy.limbCosine >= 1) throw new TypeError('features label policy is out of range.');
  const outline = { pieces: integer(record(input.outline, 'features recipe outline').pieces, 'outline.pieces', 8) };
  if (outline.pieces > 512) throw new TypeError('features outline pool is too large.');
  const publicBase = text(input.publicBase, 'features recipe publicBase');
  if (!/^\/scenes\/[a-z][a-z0-9-]*\/$/u.test(publicBase)) throw new TypeError('features recipe publicBase must be a scene directory.');
  const output = text(input.output, 'features recipe output');
  if (!/^[a-z0-9][a-z0-9@._-]*\.json$/u.test(output)) throw new TypeError('features recipe output must be a safe JSON filename.');
  return Object.freeze({
    schema: SURFACE_FEATURES_CONFIG_SCHEMA,
    directory: relativePath(input.directory, 'features recipe directory'), archive: relativePath(input.archive, 'features recipe archive'),
    members: { attributes: relativePath(members.attributes, 'members.attributes'), projection: relativePath(members.projection, 'members.projection'), metadata: relativePath(members.metadata, 'members.metadata') },
    surfaceMap: relativePath(input.surfaceMap, 'features recipe surfaceMap'), mapLeftEdgeLongitudeDeg: finite(input.mapLeftEdgeLongitudeDeg, 'features recipe mapLeftEdgeLongitudeDeg'),
    output, publicBase, target: { className: text(target.className, 'target.className') },
    lensIds: Object.freeze([...lensIds as string[]]), kinds: Object.freeze(kinds), excludedTypeCodes: Object.freeze({ ...excluded as Record<string, string> }), labelPolicy: Object.freeze(policy),
    outline: Object.freeze(outline),
  });
}

export function parseSurfaceFeaturesSourceManifest(value: unknown): SurfaceFeaturesSourceManifest {
  const input = record(value, 'features source manifest');
  if (input.schema !== SURFACE_FEATURES_SOURCE_SCHEMA) throw new TypeError('Unsupported surface features source manifest schema.');
  if (!Array.isArray(input.inputs) || !input.inputs.length) throw new TypeError('features source manifest needs pinned inputs.');
  const inputs = input.inputs.map((item, index) => {
    const entry = record(item, `inputs[${index}]`);
    const sha256 = text(entry.sha256, `inputs[${index}].sha256`);
    if (!/^[a-f0-9]{64}$/u.test(sha256)) throw new TypeError(`inputs[${index}].sha256 must be a SHA-256 digest.`);
    return Object.freeze({ path: relativePath(entry.path, `inputs[${index}].path`), origin: text(entry.origin, `inputs[${index}].origin`), bytes: integer(entry.bytes, `inputs[${index}].bytes`, 1), sha256 });
  });
  const snapshotDate = text(input.snapshotDate, 'features source snapshotDate');
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(snapshotDate)) throw new TypeError('features source snapshotDate must be an ISO date.');
  return Object.freeze({ schema: SURFACE_FEATURES_SOURCE_SCHEMA, source: text(input.source, 'features source'), snapshotDate,
    sourcePage: text(input.sourcePage, 'features source sourcePage'), license: text(input.license, 'features source license'),
    licenseEvidence: text(input.licenseEvidence, 'features source licenseEvidence'), qualification: text(input.qualification, 'features source qualification'), inputs: Object.freeze(inputs) });
}

export function parseSurfaceAxes(value: unknown): SurfaceFeatureAxes {
  const input = record(value, 'surface map');
  const axes = { prime: axis(input.prime, 'surface map prime'), east: axis(input.east, 'surface map east'), north: axis(input.north, 'surface map north') };
  const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  if (Math.abs(dot(axes.prime, axes.east)) > 1e-9 || Math.abs(dot(axes.prime, axes.north)) > 1e-9 || Math.abs(dot(axes.east, axes.north)) > 1e-9) throw new TypeError('Surface map axes must be orthogonal.');
  return Object.freeze(axes);
}

/** Same map convention as the shell minimap: texture u wraps east from the map's left edge. */
export function surfaceDirection(longitudeDeg: number, latitudeDeg: number, axes: SurfaceFeatureAxes, mapLeftEdgeLongitudeDeg: number): readonly [number, number, number] {
  const u = (((longitudeDeg - mapLeftEdgeLongitudeDeg) % 360) + 360) % 360 / 360;
  const longitude = u * 2 * Math.PI, latitude = latitudeDeg * Math.PI / 180;
  const component = (i: number) => Math.cos(latitude) * (axes.prime[i]! * Math.cos(longitude) + axes.east[i]! * Math.sin(longitude)) + axes.north[i]! * Math.sin(latitude);
  return [component(0), component(1), component(2)];
}

const round = (value: number, digits = 6) => Number(value.toFixed(digits));
type Vector3 = readonly [number, number, number];
const cross = (a: Vector3, b: Vector3): Vector3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scaled = (v: Vector3, s: number, digits = 3): Vector3 => [round(v[0] * s, digits), round(v[1] * s, digits), round(v[2] * s, digits)];
/** Prepared boundary circle: centre pulled towards the body centre by cos θ, spanned by two tangents scaled to R·sin θ. */
export function rimVectors(direction: Vector3, north: Vector3, meshRadius: number, radiusUnits: number): Extract<SurfaceFeatureOutline, { kind: 'circle' }> {
  const theta = Math.min(Math.PI / 2, radiusUnits / meshRadius);
  let east = cross(north, direction);
  let length = Math.hypot(...east);
  if (length < 1e-6) { east = cross([1, 0, 0], direction); length = Math.hypot(...east); }
  east = [east[0] / length, east[1] / length, east[2] / length];
  const tangentNorth = cross(direction, east);
  const span = meshRadius * Math.sin(theta);
  return { kind: 'circle', center: scaled(direction, meshRadius * Math.cos(theta)), east: scaled(east, span), north: scaled(tangentNorth, span) };
}

/** The Gazetteer extent box as a closed polygon: pieces/4 samples along each latitude- or longitude-parallel edge. */
export function extentPolygon(box: { minLon: number; maxLon: number; minLat: number; maxLat: number }, axes: SurfaceFeatureAxes, mapLeftEdgeLongitudeDeg: number, meshRadius: number, pieces: number): Extract<SurfaceFeatureOutline, { kind: 'box' }> {
  const perEdge = Math.max(1, Math.floor(pieces / 4)), points: Vector3[] = [];
  const corners: readonly [number, number][] = [[box.minLon, box.minLat], [box.maxLon, box.minLat], [box.maxLon, box.maxLat], [box.minLon, box.maxLat]];
  for (let edge = 0; edge < 4; edge++) {
    const [lon0, lat0] = corners[edge]!, [lon1, lat1] = corners[(edge + 1) % 4]!;
    for (let step = 0; step < perEdge; step++) {
      const t = step / perEdge;
      points.push(scaled(surfaceDirection(lon0 + (lon1 - lon0) * t, lat0 + (lat1 - lat0) * t, axes, mapLeftEdgeLongitudeDeg), meshRadius));
    }
  }
  return { kind: 'box', points };
}

/** Gazetteer extents may wrap the meridian or use negative longitudes; keep the box centred near its feature. */
export function normalizeExtent(row: { minLon: number; maxLon: number; minLat: number; maxLat: number }, centerLon: number) {
  let { minLon, maxLon } = row;
  if (maxLon < minLon) maxLon += 360;
  const mid = (minLon + maxLon) / 2, shift = Math.round((centerLon - mid) / 360) * 360;
  minLon += shift; maxLon += shift;
  if (!(maxLon - minLon <= 360) || row.maxLat < row.minLat) throw new TypeError('Gazetteer extent is inconsistent.');
  return { minLon, maxLon, minLat: row.minLat, maxLat: row.maxLat };
}
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export interface SurfaceFeaturePreparationContext {
  readonly objectId: string; readonly sourceDirectory: string; readonly publicDirectory: string; readonly outputDirectory: string;
  readonly config: unknown; readonly maxEntries: number; readonly radiusKm: number; readonly meshRadiusUnits: number;
  readonly tree: { readonly nodes: readonly { readonly className: string | null; readonly parent: number }[]; readonly scene: number };
  readonly declaredLensIds: readonly string[];
}

function unzipMember(archive: string, member: string): Uint8Array {
  return execFileSync('unzip', ['-p', archive, member], { maxBuffer: 64 * 1024 * 1024 });
}

function nodeIndex(tree: SurfaceFeaturePreparationContext['tree'], className: string): number {
  const matches = tree.nodes.flatMap((node, index) => (node.className ?? '').split(/\s+/u).includes(className) ? [index] : []);
  if (matches.length !== 1) throw new TypeError(`Surface feature target ${className} must name exactly one prepared node.`);
  for (let index: number = matches[0]!; index !== -1; index = tree.nodes[index]!.parent) if (index === tree.scene) return matches[0]!;
  throw new TypeError('Surface feature target must belong to the prepared scene.');
}

/** Decode the pinned Gazetteer archive into the prepared catalogue and runtime plan. */
export async function prepareSurfaceFeatures(context: SurfaceFeaturePreparationContext): Promise<{ plan: PreparedSurfaceFeaturePlan; descriptor: Record<string, unknown>; catalog: PreparedSurfaceFeatureCatalog }> {
  const config = parseSurfaceFeaturesConfig(context.config);
  const directory = resolve(context.sourceDirectory, config.directory);
  if (relative(context.sourceDirectory, directory).startsWith('..')) throw new TypeError('Surface feature directory escapes the source tree.');
  const manifest = parseSurfaceFeaturesSourceManifest(JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8')));
  for (const entry of manifest.inputs) {
    const bytes = await readFile(resolve(directory, entry.path));
    if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) throw new Error(`Gazetteer source snapshot drifted: ${entry.path}`);
  }
  if (!manifest.inputs.some(entry => entry.path === config.archive)) throw new TypeError('Surface feature archive is not pinned by its source manifest.');
  for (const id of config.lensIds) if (!context.declaredLensIds.includes(id)) throw new TypeError(`Surface feature lens ${id} is not declared by the object.`);
  const axes = parseSurfaceAxes(JSON.parse(await readFile(resolve(context.sourceDirectory, config.surfaceMap), 'utf8')));
  const archive = resolve(directory, config.archive);
  const projection = new TextDecoder().decode(unzipMember(archive, config.members.projection));
  const spheroid = /SPHEROID\["([^"]+)",([0-9.]+),([0-9.]+)\]/u.exec(projection);
  const datumName = /GEOGCS\["([^"]+)"/u.exec(projection)?.[1];
  if (!spheroid || !datumName) throw new TypeError('Gazetteer projection file does not declare a spheroid.');
  const radiusM = Number(spheroid[2]);
  if (Math.abs(radiusM - context.radiusKm * 1000) > 1) throw new TypeError(`Gazetteer datum radius ${radiusM} m differs from the authored ${context.radiusKm} km body.`);
  const metadata = new TextDecoder().decode(unzipMember(archive, config.members.metadata));
  if (!/<useconst>\s*Public domain\.?\s*<\/useconst>/iu.test(metadata)) throw new TypeError('Gazetteer metadata no longer declares public-domain use constraints.');
  const table = parseDbf(unzipMember(archive, config.members.attributes));
  for (const name of ['name', 'clean_name', 'approvaldt', 'origin', 'diameter', 'center_lon', 'center_lat', 'type', 'code', 'approval', 'quad_code', 'link', 'min_lon', 'max_lon', 'min_lat', 'max_lat']) {
    if (!table.fields.some(field => field.name === name)) throw new TypeError(`Gazetteer table lacks the ${name} field.`);
  }
  const kindOf = new Map<string, SurfaceFeatureKind>();
  for (const kind of ['point', 'linear', 'region'] as const) for (const code of config.kinds[kind]) kindOf.set(code, kind);
  const excluded: Record<string, { count: number; reason: string }> = {};
  if (!(context.meshRadiusUnits > 0) || !Number.isFinite(context.meshRadiusUnits)) throw new TypeError('Surface features need the prepared mesh radius.');
  const scale = context.meshRadiusUnits / context.radiusKm;
  const features: PreparedSurfaceFeature[] = [];
  const ids = new Map<string, PreparedSurfaceFeature>();
  const duplicateIds = new Set<string>();
  let duplicateRows = 0, maxSeparationDeg = 0, maxDiameterDifferenceKm = 0;
  for (const row of table.rows) {
    if (row.approval !== 'Adopted by IAU') throw new TypeError(`Unexpected approval status for ${row.name}: ${row.approval}.`);
    const code = row.code!;
    if (Object.hasOwn(config.excludedTypeCodes, code)) {
      excluded[code] = { count: (excluded[code]?.count ?? 0) + 1, reason: config.excludedTypeCodes[code]! };
      continue;
    }
    const kind = kindOf.get(code);
    if (!kind) throw new TypeError(`Gazetteer type code ${code} (${row.type}) has no label kind.`);
    const longitudeDeg = Number(row.center_lon), latitudeDeg = Number(row.center_lat), diameterKm = Number(row.diameter);
    if (!Number.isFinite(longitudeDeg) || !Number.isFinite(latitudeDeg) || longitudeDeg < 0 || longitudeDeg >= 360 || Math.abs(latitudeDeg) > 90) throw new TypeError(`Gazetteer centre is out of range for ${row.name}.`);
    if (!(diameterKm > 0)) throw new TypeError(`Gazetteer diameter is missing for ${row.name}.`);
    const id = /\/Feature\/(\d+)$/u.exec(row.link!)?.[1];
    if (!id) throw new TypeError(`Gazetteer feature identity is missing for ${row.name}.`);
    const first = ids.get(id);
    if (first) {
      // The export repeats some features (one row per map quadrangle). Keep the
      // first row and record how far the repeated centres sit from it.
      if (first.name !== row.name || first.code !== code) throw new TypeError(`Gazetteer repeats ${row.name} with a different name or type.`);
      const separation = Math.hypot(((longitudeDeg - first.longitudeDeg + 540) % 360) - 180, latitudeDeg - first.latitudeDeg);
      duplicateRows++; duplicateIds.add(id); maxSeparationDeg = Math.max(maxSeparationDeg, separation);
      maxDiameterDifferenceKm = Math.max(maxDiameterDifferenceKm, Math.abs(diameterKm - first.diameterKm));
      continue;
    }
    const approved = /^(\d{4})\/(\d{2})\/(\d{2})/u.exec(row.approvaldt!);
    if (!approved) throw new TypeError(`Gazetteer approval date is missing for ${row.name}.`);
    const direction = surfaceDirection(longitudeDeg, latitudeDeg, axes, config.mapLeftEdgeLongitudeDeg);
    const radiusUnits = diameterKm / 2 * scale;
    const extentInput = { minLon: Number(row.min_lon), maxLon: Number(row.max_lon), minLat: Number(row.min_lat), maxLat: Number(row.max_lat) };
    if (Object.values(extentInput).some(value => !Number.isFinite(value))) throw new TypeError(`Gazetteer extent is missing for ${row.name}.`);
    const extent = normalizeExtent(extentInput, longitudeDeg);
    if (Math.abs(extent.maxLat) > 90 || Math.abs(extent.minLat) > 90) throw new TypeError(`Gazetteer extent latitude is out of range for ${row.name}.`);
    // Craters and faculae are circular: their diameter is the rim. Other features report a nominal size,
    // so their published extent box is the honest shape.
    const outline = kind === 'point' ? rimVectors(direction, axes.north, context.meshRadiusUnits, radiusUnits)
      : extentPolygon(extent, axes, config.mapLeftEdgeLongitudeDeg, context.meshRadiusUnits, config.outline.pieces);
    const feature: PreparedSurfaceFeature = {
      id, name: row.name!, kind, type: row.type!.split(',')[0]!.trim(), code, diameterKm, longitudeDeg, latitudeDeg,
      anchorUnits: [round(direction[0] * context.meshRadiusUnits, 3), round(direction[1] * context.meshRadiusUnits, 3), round(direction[2] * context.meshRadiusUnits, 3)],
      normal: [round(direction[0]), round(direction[1]), round(direction[2])],
      radiusUnits: round(radiusUnits, 4), outline,
      origin: row.origin!, approved: `${approved[1]}-${approved[2]}-${approved[3]}`, quad: row.quad_code!, link: row.link!.replace(/^http:\/\//u, 'https://'),
    };
    ids.set(id, feature);
    features.push(feature);
  }
  // Prepared priority: larger features label first; the runtime never re-ranks.
  features.sort((a, b) => b.diameterKm - a.diameterKm || a.name.localeCompare(b.name, 'en'));
  if (!features.length) throw new TypeError('Gazetteer archive produced no labelled features.');
  if (features.length > context.maxEntries) throw new TypeError('Prepared features exceed the authored capability.');
  const catalog: PreparedSurfaceFeatureCatalog = {
    schema: PREPARED_SURFACE_FEATURES_SCHEMA, objectId: context.objectId,
    source: manifest.source, snapshotDate: manifest.snapshotDate, sourcePage: manifest.sourcePage, license: manifest.license, qualification: manifest.qualification,
    datum: { name: datumName, radiusM, longitude: 'positive-east-0-360' },
    excluded, duplicates: { features: duplicateIds.size, rows: duplicateRows, maxSeparationDeg: round(maxSeparationDeg, 4), maxDiameterDifferenceKm: round(maxDiameterDifferenceKm, 4) }, features,
  };
  const bytes = Buffer.from(`${JSON.stringify(catalog)}\n`);
  await mkdir(context.publicDirectory, { recursive: true });
  await mkdir(context.outputDirectory, { recursive: true });
  await writeFile(resolve(context.publicDirectory, config.output), bytes);
  const plan: PreparedSurfaceFeaturePlan = {
    catalog: { url: `${config.publicBase}${config.output}`, bytes: bytes.length, sha256: sha256(bytes), count: features.length },
    target: nodeIndex(context.tree, config.target.className), lensIds: config.lensIds, meshRadiusUnits: context.meshRadiusUnits, policy: config.labelPolicy,
    outline: config.outline,
  };
  const descriptor = { schema: 'cssearth-prepared-features@1', objectId: context.objectId, ...plan.catalog, source: manifest.source, sourcePage: manifest.sourcePage,
    license: manifest.license, snapshotDate: manifest.snapshotDate, mapLeftEdgeLongitudeDeg: config.mapLeftEdgeLongitudeDeg, excluded, duplicates: catalog.duplicates };
  await writeFile(resolve(context.outputDirectory, 'features.json'), `${JSON.stringify(descriptor)}\n`);
  return { plan, descriptor, catalog };
}
