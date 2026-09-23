import { sha256 } from '../../../src/platform/sha256.mts';
import { surfaceFeatureBankIndex } from '../../../src/platform/surface-feature-banks.mts';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { parseDbf } from './dbf.js';
import { parseFeatureNotes, type FeatureNotes } from './notes-schema.js';
import { loadNaturalEarthRows, parseNaturalEarthConfig, type NaturalEarthConfig } from './natural-earth.js';
import { loadSiteRows, parseSurfaceSites, type SiteRow } from './sites.js';
import { prepareLandmarks } from './landmarks.js';
/** Spacecraft sites are discovered past the whole-body view (which sits near 0.43 of the zoom range), once the camera closes in. */
const SITE_ZOOM_SHARE = 0.6;
import { parseShpPolylines } from './shp.js';

/** Prepared nomenclature catalogue: IAU/USGS Gazetteer centre points anchored to the body mesh.
 * Preparation resolves every surface anchor, priority, label kind and tooltip text; runtime
 * only projects the prepared anchors through the current camera. */
export const SURFACE_FEATURES_CONFIG_SCHEMA = 'cssearth-surface-features@1';
export const SURFACE_FEATURES_SOURCE_SCHEMA = 'cssearth-surface-features-source@1';
export const PREPARED_SURFACE_FEATURES_SCHEMA = 'cssearth-prepared-surface-features@1';

/** Sparse catalogues must not spread a handful of names across the entire zoom range.
 * A floor of 200 keeps roughly ten unnoted names eligible at whole-body framing
 * (share 0.43). Denser catalogues retain their existing progression. Actual label
 * admission still checks projected feature size, facing, overlap and the label cap. */
export function featureDiscoveryZoomShare(rank: number, count: number, noted = false): number {
  return Math.min(1, Math.log10(1 + (noted ? rank / 4 : rank)) / Math.log10(Math.max(200, count)));
}

export type SurfaceFeatureKind = 'point' | 'linear' | 'region';
/** Gazetteer descriptor-term codes and the label kind their geometry suggests: compact landforms get a point
 * marker and rim circle, elongated ones a linear label, extended terrains a region label. Recipes may override. */
export const DEFAULT_TYPE_KINDS: Readonly<Record<string, SurfaceFeatureKind>> = Object.freeze({
  AA: 'point', AS: 'point', CB: 'point', ER: 'point', FA: 'point', FR: 'point', LF: 'point', MA: 'point', PE: 'point', PU: 'point', SF: 'point', SA: 'point', ST: 'point', TH: 'point',
  LS: 'point', IM: 'point', SS: 'point', RT: 'linear',
  MN: 'region', CH: 'region', LU: 'region', AR: 'linear', CA: 'linear', CM: 'linear', DO: 'linear', FE: 'linear', FM: 'linear', FO: 'linear', FT: 'linear', LI: 'linear', RI: 'linear', RU: 'linear', SC: 'linear', SE: 'linear', SU: 'linear', VA: 'linear', VI: 'linear',
  CO: 'region', CL: 'region', LO: 'region', CR: 'region', FL: 'region', IN: 'region', LA: 'region', LB: 'region', LG: 'region', LC: 'region', LN: 'region', MR: 'region', ME: 'region', MO: 'region', OC: 'region', PA: 'region', PL: 'region', PM: 'region', PR: 'region', RE: 'region', SI: 'region', TA: 'region', TE: 'region', UN: 'region', VS: 'region',
});
export type SurfaceFeatureOutline =
  | { readonly kind: 'circle'; readonly center: readonly [number, number, number]; readonly east: readonly [number, number, number]; readonly north: readonly [number, number, number] }
  | { readonly kind: 'box'; readonly points: readonly (readonly [number, number, number])[] }
  /** Mapped structural traces associated with the feature: open polylines on the sphere, in mesh units. */
  | { readonly kind: 'trace'; readonly paths: readonly (readonly (readonly [number, number, number])[])[] };
export interface SurfaceFeatureTracesConfig {
  readonly directory: string; readonly archive: string;
  readonly members: { readonly shapes: string; readonly attributes: string; readonly projection: string };
  readonly radiusM: number; readonly classField: string; readonly classes: Readonly<Record<string, string>>;
  readonly paddingDeg: number; readonly insideFraction: number; readonly maximumTraces: number; readonly minimumLengthShare: number; readonly maximumVertices: number;
}
/** Where a surface map places latitude and longitude on its mesh node: the prime, east and north axes, with longitude counted
 * east from the map's left edge (texture u = 0). The surface map is the only owner of both. */
export interface SurfaceFeatureAxes { readonly prime: readonly [number, number, number]; readonly east: readonly [number, number, number]; readonly north: readonly [number, number, number]; readonly mapLeftEdgeLongitudeDeg: number; }
export interface SurfaceFeaturePolicy { readonly minimumZoomShare: number; readonly minimumDiameterPixels: number; readonly alwaysVisibleCount: number; readonly maximumVisible: number; readonly limbCosine: number; }
export interface SurfaceFeaturesConfig {
  readonly schema: typeof SURFACE_FEATURES_CONFIG_SCHEMA;
  /** The Gazetteer archive; absent for a body without nomenclature that labels only spacecraft sites. */
  readonly directory: string; readonly archive: string | null;
  /** Some small-body exports ship no .prj; their datum then comes from the FGDC metadata (`semiaxis`, `horizdn`). The newest
   * asteroid exports ship neither: the datum is then the authored radius and the pin manifest carries the licence evidence. */
  readonly members: { readonly attributes: string; readonly projection: string | null; readonly metadata: string | null } | null;
  readonly surfaceMap: string;
  readonly output: string; readonly publicBase: string;
  readonly target: { readonly className: string; readonly withoutClassName: string | null };
  readonly lensIds: readonly string[];
  readonly kinds: Readonly<Record<SurfaceFeatureKind, readonly string[]>>;
  readonly excludedTypeCodes: Readonly<Record<string, string>>;
  readonly labelPolicy: SurfaceFeaturePolicy;
  /** Optional demand-loaded banks for names that search can select but the default map never labels. */
  readonly selectionBankCount?: number;
  /** Retained screen-space line pieces that trace the hovered feature's published diameter. */
  readonly outline: { readonly pieces: number };
  /** Optional mapped-structure archive whose traces replace extent boxes for the listed type codes. */
  readonly traces?: SurfaceFeatureTracesConfig;
  /** Optional pinned notes document (inside `directory`): Wikipedia lead summaries keyed by Gazetteer feature id. */
  readonly notes?: string;
  /** Natural Earth layers as the row source instead of a Gazetteer archive (Earth). */
  readonly naturalEarth?: NaturalEarthConfig;
  /** Optional landing, impact and sample sites and traverses (inside `directory`): the document and its pinned path files. */
  readonly sites?: { readonly document: string; readonly inputs: readonly string[] };
  /** Mission-defined regions or source-backed model anatomy, independent of IAU naming. */
  readonly landmarks?: { readonly document: string; readonly inputs: readonly string[]; readonly priority?: number };
}
export interface SurfaceFeaturesSourceManifest {
  readonly schema: typeof SURFACE_FEATURES_SOURCE_SCHEMA;
  readonly source: string; readonly snapshotDate: string; readonly sourcePage: string; readonly license: string; readonly licenseEvidence: string;
  readonly qualification: string;
  readonly inputs: readonly { readonly path: string; readonly origin: string; readonly bytes: number }[];
}
export interface PreparedSurfaceFeature {
  readonly id: string; readonly name: string; readonly kind: SurfaceFeatureKind; readonly type: string; readonly code: string;
  readonly diameterKm: number; readonly longitudeDeg: number; readonly latitudeDeg: number;
  readonly anchorUnits: readonly [number, number, number]; readonly normal: readonly [number, number, number]; readonly radiusUnits: number;
  /** Circular features trace their published diameter as a small circle of the sphere, rim(φ) = center + east·cos φ + north·sin φ;
   * other features trace the Gazetteer's published latitude/longitude extent as a closed polygon on the sphere. Mesh units. */
  readonly outline: SurfaceFeatureOutline;
  readonly searchNames: readonly string[]; readonly searchContext: string;
  readonly origin: string; readonly approved: string; readonly quad: string; readonly link: string;
  /** Who published the name or site and when, for the caption's credit line. */
  readonly credit: string;
  /** A source-backed note for the caption (a Wikipedia lead summary, or the quoted source sentence of a site) with its page and credit. */
  readonly note?: { readonly text: string; readonly title: string; readonly url: string; readonly credit: string };
  /** The facilities-catalogue id of the spacecraft at a site, when catalogued. */
  readonly facilityId?: string;
  /** Discovery tier: the share of the zoom range (0 whole body, 1 closest) from which this name competes for a label. */
  readonly minimumZoomShare: number;
  /** Found by search and labelled when selected, never by default. */
  readonly searchOnly?: true;
}
export interface PreparedSurfaceFeatureCatalog {
  readonly schema: typeof PREPARED_SURFACE_FEATURES_SCHEMA; readonly objectId: string;
  readonly source: string; readonly snapshotDate: string; readonly sourcePage: string; readonly license: string; readonly qualification: string;
  readonly datum: { readonly name: string; readonly radiusM: number; readonly authoredRadiusM: number; readonly longitude: string };
  readonly excluded: Readonly<Record<string, { readonly count: number; readonly reason: string }>>;
  /** Rows left out for a reason other than an excluded type: not adopted, no label kind, or no diameter. */
  readonly skipped: Readonly<Record<string, { readonly count: number; readonly reason: string }>>;
  /** Type codes outside the kind table, labelled as regions, and features whose empty extent fell back to a circle. */
  /** `unsized` counts labelled names the Gazetteer publishes without a diameter, by type code. */
  readonly assumed: { readonly regionTypes: Readonly<Record<string, number>>; readonly extentFallbacks: number; readonly meshMisses: number; readonly unsized: Readonly<Record<string, number>> };
  /** Mapped-structure traces associated with named features, when a trace archive is declared. */
  readonly traces?: TraceSummary;
  /** Rows the export repeats for one feature identity; the first row's centre is kept. */
  readonly duplicates: { readonly features: number; readonly rows: number; readonly maxSeparationDeg: number; readonly maxDiameterDifferenceKm: number };
  /** Present when the recipe pins a notes document: its provenance and how many features carry a note. */
  readonly notes?: { readonly source: string; readonly retrievedAt: string; readonly license: string; readonly licenseUrl: string; readonly count: number };
  /** Present when the recipe pins a sites document: its provenance and how many sites and traverses were placed. */
  readonly sites?: { readonly source: string; readonly retrievedAt: string; readonly count: number };
  readonly landmarks?: { readonly source: string; readonly frame: string; readonly evidence: Awaited<ReturnType<typeof prepareLandmarks>>['evidence'] };
  readonly features: readonly PreparedSurfaceFeature[];
}
export interface SurfaceFeatureCatalogDescriptor { readonly url: string; readonly bytes: number; readonly sha256: string; readonly count: number; }
export interface SurfaceFeatureSelectionPlan { readonly count: number; readonly banks: readonly SurfaceFeatureCatalogDescriptor[]; }
export interface PreparedSurfaceFeaturePlan {
  readonly catalog: SurfaceFeatureCatalogDescriptor; readonly selection?: SurfaceFeatureSelectionPlan; readonly target: number; readonly lensIds: readonly string[];
  /** Mesh radius in raw prepared scene coordinates (before the camera's scene scale). */
  readonly meshRadiusUnits: number; readonly policy: SurfaceFeaturePolicy;
  /** Shape-model bodies: the radius band of the picking mesh, inside which every anchor and outline point lies. */
  readonly surfaceRadiusUnits?: { readonly minimum: number; readonly maximum: number };
  /** Ellipsoidal bodies: reference semi-axes and polar axis in mesh units, and the normalised-radius band (1 = on the ellipsoid) every prepared point lies within. */
  readonly surfaceEllipsoidUnits?: { readonly equatorial: number; readonly polar: number; readonly north: Vector3; readonly minimumShare: number; readonly maximumShare: number };
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
  const members = input.archive === null ? null : record(input.members, 'features recipe members'), target = record(input.target, 'features recipe target');
  if (input.archive === null && input.sites === undefined && input.naturalEarth === undefined && input.landmarks === undefined) throw new TypeError('A features recipe without an archive must list sites, landmarks or Natural Earth layers.');
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
  const traces = input.traces === undefined ? undefined : parseTracesConfig(input.traces, outline.pieces, all);
  const publicBase = text(input.publicBase, 'features recipe publicBase');
  if (!/^\/scenes\/[a-z][a-z0-9-]*\/$/u.test(publicBase)) throw new TypeError('features recipe publicBase must be a scene directory.');
  const output = text(input.output, 'features recipe output');
  if (!/^[a-z0-9][a-z0-9@._-]*\.json$/u.test(output)) throw new TypeError('features recipe output must be a safe JSON filename.');
  const selectionBankCount = input.selectionBankCount === undefined ? undefined : integer(input.selectionBankCount, 'selectionBankCount', 2);
  if (selectionBankCount !== undefined && selectionBankCount > 256) throw new TypeError('selectionBankCount exceeds the prepared bank limit.');
  return Object.freeze({
    schema: SURFACE_FEATURES_CONFIG_SCHEMA,
    directory: relativePath(input.directory, 'features recipe directory'), archive: input.archive === null ? null : relativePath(input.archive, 'features recipe archive'),
    members: members === null ? null : { attributes: relativePath(members.attributes, 'members.attributes'), projection: members.projection === null ? null : relativePath(members.projection, 'members.projection'), metadata: members.metadata === null ? null : relativePath(members.metadata, 'members.metadata') },
    surfaceMap: relativePath(input.surfaceMap, 'features recipe surfaceMap'),
    output, publicBase, target: { className: text(target.className, 'target.className'), withoutClassName: target.withoutClassName === undefined ? null : text(target.withoutClassName, 'target.withoutClassName') },
    lensIds: Object.freeze([...lensIds as string[]]), kinds: Object.freeze(kinds), excludedTypeCodes: Object.freeze({ ...excluded as Record<string, string> }), labelPolicy: Object.freeze(policy),
    ...(selectionBankCount === undefined ? {} : { selectionBankCount }),
    outline: Object.freeze(outline), ...(traces ? { traces } : {}), ...(input.notes === undefined ? {} : { notes: relativePath(input.notes, 'features recipe notes') }), ...(input.naturalEarth === undefined ? {} : { naturalEarth: parseNaturalEarthConfig(input.naturalEarth) }), ...(input.sites === undefined ? {} : { sites: parseSitesRecipe(input.sites) }), ...(input.landmarks === undefined ? {} : { landmarks: parseLandmarksRecipe(input.landmarks) }),
  });
}

function parseTracesConfig(value: unknown, pieces: number, labelledCodes: readonly string[]): SurfaceFeatureTracesConfig {
  const input = record(value, 'features recipe traces'), members = record(input.members, 'traces.members'), classes = record(input.classes, 'traces.classes');
  for (const [code, className] of Object.entries(classes)) { if (!labelledCodes.includes(code)) throw new TypeError(`traces.classes.${code} is not a labelled type code.`); text(className, `traces.classes.${code}`); }
  const config: SurfaceFeatureTracesConfig = {
    directory: relativePath(input.directory, 'traces.directory'), archive: relativePath(input.archive, 'traces.archive'),
    members: { shapes: relativePath(members.shapes, 'traces.members.shapes'), attributes: relativePath(members.attributes, 'traces.members.attributes'), projection: relativePath(members.projection, 'traces.members.projection') },
    radiusM: finite(input.radiusM, 'traces.radiusM'), classField: text(input.classField, 'traces.classField'), classes: Object.freeze({ ...classes as Record<string, string> }),
    paddingDeg: finite(input.paddingDeg, 'traces.paddingDeg'), insideFraction: finite(input.insideFraction, 'traces.insideFraction'),
    maximumTraces: integer(input.maximumTraces, 'traces.maximumTraces', 1), minimumLengthShare: finite(input.minimumLengthShare, 'traces.minimumLengthShare'), maximumVertices: integer(input.maximumVertices, 'traces.maximumVertices', 4),
  };
  if (!(config.radiusM > 0) || config.paddingDeg < 0 || config.insideFraction <= 0 || config.insideFraction > 1 || config.minimumLengthShare < 0 || config.minimumLengthShare > 1 || config.maximumVertices > pieces) throw new TypeError('features recipe traces are out of range.');
  return Object.freeze(config);
}

function parseSitesRecipe(value: unknown): { document: string; inputs: string[] } {
  const input = record(value, 'features recipe sites');
  if (!Array.isArray(input.inputs)) throw new TypeError('features recipe sites.inputs must be an array.');
  return { document: relativePath(input.document, 'sites.document'), inputs: input.inputs.map((item, index) => relativePath(item, `sites.inputs[${index}]`)) };
}
/** Landmarks share the sites document shape; a recipe may rank them among its other names (default 10). */
function parseLandmarksRecipe(value: unknown): { document: string; inputs: string[]; priority?: number } {
  const recipe = parseSitesRecipe(value), priority = record(value, 'features recipe landmarks').priority;
  if (priority === undefined) return recipe;
  if (typeof priority !== 'number' || !Number.isFinite(priority) || priority < 0) throw new TypeError('landmarks.priority must be a non-negative number.');
  return { ...recipe, priority };
}

export function parseSurfaceFeaturesSourceManifest(value: unknown): SurfaceFeaturesSourceManifest {
  const input = record(value, 'features source manifest');
  if (input.schema !== SURFACE_FEATURES_SOURCE_SCHEMA) throw new TypeError('Unsupported surface features source manifest schema.');
  if (!Array.isArray(input.inputs) || !input.inputs.length) throw new TypeError('features source manifest needs pinned inputs.');
  const inputs = input.inputs.map((item, index) => {
    const entry = record(item, `inputs[${index}]`);
    return Object.freeze({ path: relativePath(entry.path, `inputs[${index}].path`), origin: text(entry.origin, `inputs[${index}].origin`), bytes: integer(entry.bytes, `inputs[${index}].bytes`, 1) });
  });
  const snapshotDate = text(input.snapshotDate, 'features source snapshotDate');
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(snapshotDate)) throw new TypeError('features source snapshotDate must be an ISO date.');
  return Object.freeze({ schema: SURFACE_FEATURES_SOURCE_SCHEMA, source: text(input.source, 'features source'), snapshotDate,
    sourcePage: text(input.sourcePage, 'features source sourcePage'), license: text(input.license, 'features source license'),
    licenseEvidence: text(input.licenseEvidence, 'features source licenseEvidence'), qualification: text(input.qualification, 'features source qualification'), inputs: Object.freeze(inputs) });
}

export function parseSurfaceAxes(value: unknown): SurfaceFeatureAxes {
  const input = record(value, 'surface map');
  const axes = { prime: axis(input.prime, 'surface map prime'), east: axis(input.east, 'surface map east'), north: axis(input.north, 'surface map north'),
    mapLeftEdgeLongitudeDeg: finite(input.mapLeftEdgeLongitudeDeg, 'surface map mapLeftEdgeLongitudeDeg') };
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
/** Same folding as the shell's destination search: lower case, no diacritics, single spaces. */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
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

export interface SurfaceFeaturePreparationContext {
  readonly objectId: string; readonly sourceDirectory: string; readonly publicDirectory: string; readonly outputDirectory: string;
  readonly config: unknown; readonly maxEntries: number; readonly radiusKm: number; readonly meshRadiusUnits: number;
  readonly tree: { readonly nodes: readonly { readonly className: string | null; readonly parent: number; readonly style?: string }[]; readonly scene: number };
  readonly declaredLensIds: readonly string[];
  /** Explicit authored sphere; permits coordinate-only mission landmarks without a triangle hit mesh. */
  readonly referenceSphere?: true;
  /** The prepared picking mesh of a shape-model body: anchors and outline points are cast onto it instead of a reference sphere. */
  readonly hitMesh?: { readonly target: number; readonly triangles: readonly (readonly (readonly number[])[])[] };
  /** An ellipsoidal body: map directions are cast onto its rendered surface instead of the reference sphere (ellipsoid.ts). */
  readonly surface?: { readonly onSurface: (direction: Vector3) => Vector3; readonly plan: () => NonNullable<PreparedSurfaceFeaturePlan['surfaceEllipsoidUnits']> };
}

/** Farthest intersection of the ray from the mesh origin along `direction` with the triangle list (Möller–Trumbore), or null when it misses. */
export function projectRadial(triangles: readonly (readonly (readonly number[])[])[], direction: Vector3): number | null {
  let best: number | null = null;
  for (const [a, b, c] of triangles) {
    const e1 = [b![0]! - a![0]!, b![1]! - a![1]!, b![2]! - a![2]!], e2 = [c![0]! - a![0]!, c![1]! - a![1]!, c![2]! - a![2]!];
    const p = [direction[1] * e2[2]! - direction[2] * e2[1]!, direction[2] * e2[0]! - direction[0] * e2[2]!, direction[0] * e2[1]! - direction[1] * e2[0]!];
    const det = e1[0]! * p[0]! + e1[1]! * p[1]! + e1[2]! * p[2]!;
    if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det, t = [-a![0]!, -a![1]!, -a![2]!];
    const u = (t[0]! * p[0]! + t[1]! * p[1]! + t[2]! * p[2]!) * inv;
    if (u < 0 || u > 1) continue;
    const q = [t[1]! * e1[2]! - t[2]! * e1[1]!, t[2]! * e1[0]! - t[0]! * e1[2]!, t[0]! * e1[1]! - t[1]! * e1[0]!];
    const v = (direction[0] * q[0]! + direction[1] * q[1]! + direction[2] * q[2]!) * inv;
    if (v < 0 || u + v > 1) continue;
    const distance = (e2[0]! * q[0]! + e2[1]! * q[1]! + e2[2]! * q[2]!) * inv;
    if (distance > 0 && (best === null || distance > best)) best = distance;
  }
  return best;
}

export function unzipMember(archive: string, member: string): Uint8Array {
  return execFileSync('unzip', ['-p', archive, member], { maxBuffer: 64 * 1024 * 1024 });
}

/** The radius band every cast point can occupy: the farthest vertex and the nearest point of any face (a flat face sags below its vertices). */
export function meshRadiusBand(triangles: readonly (readonly (readonly number[])[])[]): { minimum: number; maximum: number } {
  let minimum = Number.POSITIVE_INFINITY, maximum = 0;
  for (const [a, b, c] of triangles) {
    for (const point of [a!, b!, c!]) maximum = Math.max(maximum, Math.hypot(point[0]!, point[1]!, point[2]!));
    minimum = Math.min(minimum, originToTriangle(a!, b!, c!));
  }
  if (!(minimum > 0) || !(maximum >= minimum)) throw new TypeError('Surface hit mesh has no positive radius band.');
  return { minimum: round(minimum, 3), maximum: round(maximum, 3) };
}
/** Distance from the origin to the closest point of triangle abc (Ericson, Real-Time Collision Detection 5.1.5). */
function originToTriangle(a: readonly number[], b: readonly number[], c: readonly number[]): number {
  const sub = (p: readonly number[], q: readonly number[]) => [p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!];
  const dot = (p: readonly number[], q: readonly number[]) => p[0]! * q[0]! + p[1]! * q[1]! + p[2]! * q[2]!;
  const ab = sub(b, a), ac = sub(c, a), ap = [-a[0]!, -a[1]!, -a[2]!];
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return Math.hypot(...a);
  const bp = [-b[0]!, -b[1]!, -b[2]!], d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return Math.hypot(...b);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return Math.hypot(a[0]! + v * ab[0]!, a[1]! + v * ab[1]!, a[2]! + v * ab[2]!); }
  const cp = [-c[0]!, -c[1]!, -c[2]!], d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return Math.hypot(...c);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return Math.hypot(a[0]! + w * ac[0]!, a[1]! + w * ac[1]!, a[2]! + w * ac[2]!); }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return Math.hypot(b[0]! + w * (c[0]! - b[0]!), b[1]! + w * (c[1]! - b[1]!), b[2]! + w * (c[2]! - b[2]!)); }
  const denominator = 1 / (va + vb + vc), v = vb * denominator, w = vc * denominator;
  return Math.hypot(a[0]! + ab[0]! * v + ac[0]! * w, a[1]! + ab[1]! * v + ac[1]! * w, a[2]! + ab[2]! * v + ac[2]! * w);
}
/** A shape-model body anchors on the node its picking mesh names; that node must still carry the configured class. */
function hitTarget(context: SurfaceFeaturePreparationContext, target: SurfaceFeaturesConfig['target']): number {
  if (!context.hitMesh) return nodeIndex(context.tree, target);
  const node = context.tree.nodes[context.hitMesh.target];
  if (!node || !(node.className ?? '').split(/\s+/u).includes(target.className)) throw new TypeError(`Surface hit target ${context.hitMesh.target} does not carry ${target.className}.`);
  return context.hitMesh.target;
}
export function nodeIndex(tree: SurfaceFeaturePreparationContext['tree'], { className, withoutClassName }: SurfaceFeaturesConfig['target']): number {
  const matches = tree.nodes.flatMap((node, index) => { const classes = (node.className ?? '').split(/\s+/u); return classes.includes(className) && !(withoutClassName !== null && classes.includes(withoutClassName)) ? [index] : []; });
  const label = `${className}${withoutClassName === null ? '' : ` without ${withoutClassName}`}`;
  if (matches.length === 0) throw new TypeError(`Surface feature target ${label} must name a prepared node.`);
  // A banded sphere splits one surface across sibling meshes that share a parent and an inline
  // frame (the static lane's latitude bands); their common frame is read from the first band.
  const first = tree.nodes[matches[0]!]!;
  for (const index of matches.slice(1)) {
    const node = tree.nodes[index]!;
    if (node.parent !== first.parent || (node.style ?? '') !== (first.style ?? '')) throw new TypeError(`Surface feature target ${label} names ${matches.length} prepared nodes that do not share one frame.`);
  }
  for (let index: number = matches[0]!; index !== -1; index = tree.nodes[index]!.parent) if (index === tree.scene) return matches[0]!;
  throw new TypeError('Surface feature target must belong to the prepared scene.');
}

interface LoadedTrace { readonly className: string; readonly lengthM: number; readonly parts: readonly (readonly (readonly [number, number])[])[]; }
interface TraceSummary { readonly source: string; readonly sourcePage: string; readonly license: string; readonly snapshotDate: string; readonly traces: number; readonly matched: number; readonly byCode: Readonly<Record<string, number>>; readonly unmatched: readonly string[]; readonly maximumVertices: number; }

/** Read the pinned tectonic archive: Plate Carrée metres on the declared sphere become east longitude and latitude. */
async function loadTraces(sourceDirectory: string, config: SurfaceFeatureTracesConfig): Promise<{ manifest: SurfaceFeaturesSourceManifest; traces: readonly LoadedTrace[] }> {
  const directory = resolve(sourceDirectory, config.directory);
  if (relative(sourceDirectory, directory).startsWith('..')) throw new TypeError('Trace directory escapes the source tree.');
  const manifest = parseSurfaceFeaturesSourceManifest(JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8')));
  for (const entry of manifest.inputs) {
    const bytes = await readFile(resolve(directory, entry.path));
    if (bytes.length !== entry.bytes) throw new Error(`Trace source snapshot drifted: ${entry.path}`);
  }
  if (!manifest.inputs.some(entry => entry.path === config.archive)) throw new TypeError('Trace archive is not pinned by its source manifest.');
  const archive = resolve(directory, config.archive);
  const projection = new TextDecoder().decode(unzipMember(archive, config.members.projection));
  const spheroid = /SPHEROID\["([^"]+)",([0-9.]+),([0-9.]+)\]/u.exec(projection);
  if (!/PROJECTION\["Plate_Carree"\]/u.test(projection) || !/UNIT\["Meter",1\.0\]/u.test(projection) || !spheroid || Math.abs(Number(spheroid[2]) - config.radiusM) > 1) throw new TypeError('Trace projection is not the declared Plate Carrée metre grid.');
  const central = /PARAMETER\["central_meridian",([0-9.-]+)\]/u.exec(projection);
  if (!central || Number(central[1]) !== 0) throw new TypeError('Trace projection must use a zero central meridian.');
  const table = parseDbf(unzipMember(archive, config.members.attributes));
  const shapes = parseShpPolylines(unzipMember(archive, config.members.shapes));
  if (shapes.records.length !== table.rows.length) throw new TypeError('Trace shapes and attributes disagree in count.');
  const metresPerDegree = config.radiusM * Math.PI / 180;
  const traces: LoadedTrace[] = [];
  shapes.records.forEach((shape, index) => {
    if (!shape) return;
    const row = table.rows[index]!, className = row[config.classField];
    if (typeof className !== 'string') throw new TypeError(`Trace attribute ${config.classField} is missing.`);
    const parts = shape.parts.map(part => part.map(([x, y]) => [x / metresPerDegree, y / metresPerDegree] as const));
    let lengthM = 0;
    for (const part of shape.parts) for (let i = 1; i < part.length; i++) lengthM += Math.hypot(part[i]![0] - part[i - 1]![0], part[i]![1] - part[i - 1]![1]);
    traces.push({ className, lengthM, parts });
  });
  return { manifest, traces };
}

/** Traces whose vertices lie inside the padded published extent, longest first, trimmed to the recipe's budget. */
export function selectTraces(traces: readonly LoadedTrace[], className: string, extent: { minLon: number; maxLon: number; minLat: number; maxLat: number }, config: Pick<SurfaceFeatureTracesConfig, 'paddingDeg' | 'insideFraction' | 'maximumTraces' | 'minimumLengthShare'>): LoadedTrace[] {
  const pad = config.paddingDeg;
  const inside = ([lon, lat]: readonly [number, number]) => lat >= extent.minLat - pad && lat <= extent.maxLat + pad &&
    [-360, 0, 360, 720].some(shift => lon + shift >= extent.minLon - pad && lon + shift <= extent.maxLon + pad);
  const candidates = traces.filter(trace => {
    if (trace.className !== className) return false;
    const points = trace.parts.flat();
    return points.filter(inside).length >= config.insideFraction * points.length;
  }).sort((a, b) => b.lengthM - a.lengthM);
  const leader = candidates[0]?.lengthM ?? 0;
  return candidates.filter(trace => trace.lengthM >= config.minimumLengthShare * leader).slice(0, config.maximumTraces);
}

/** Keep endpoints and evenly spaced interior vertices so every selected trace fits the retained chord pool. */
export function budgetTracePaths(paths: readonly (readonly (readonly [number, number])[])[], maximumVertices: number): (readonly [number, number])[][] {
  // Too many short parts for the pool: keep the longest parts by vertex count first.
  const kept = 2 * paths.length > maximumVertices ? [...paths].sort((a, b) => b.length - a.length).slice(0, Math.floor(maximumVertices / 2)) : paths;
  const total = kept.reduce((sum, path) => sum + path.length, 0);
  if (total <= maximumVertices) return kept.map(path => [...path]);
  const spare = maximumVertices - 2 * kept.length;
  return kept.map(path => {
    const interior = Math.max(0, Math.floor(spare * (path.length - 2) / Math.max(1, total - 2 * kept.length)));
    const keep: (readonly [number, number])[] = [path[0]!];
    for (let step = 1; step <= interior; step++) keep.push(path[Math.round(step * (path.length - 1) / (interior + 1))]!);
    keep.push(path[path.length - 1]!);
    return keep;
  });
}

/** Decode the pinned Gazetteer archive into the prepared catalogue and runtime plan. */
export async function prepareSurfaceFeatures(context: SurfaceFeaturePreparationContext): Promise<{ plan: PreparedSurfaceFeaturePlan; descriptor: Record<string, unknown>; catalog: PreparedSurfaceFeatureCatalog }> {
  const config = parseSurfaceFeaturesConfig(context.config);
  const directory = resolve(context.sourceDirectory, config.directory);
  if (relative(context.sourceDirectory, directory).startsWith('..')) throw new TypeError('Surface feature directory escapes the source tree.');
  const manifest = parseSurfaceFeaturesSourceManifest(JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8')));
  // A downloaded snapshot (an origin URL) must still be the bytes it was fetched as; a file authored here is tracked by git,
  // which already records its bytes, so its size is not checked.
  for (const entry of manifest.inputs) {
    if (!/^https?:\/\//u.test(entry.origin)) continue;
    const bytes = await readFile(resolve(directory, entry.path));
    if (bytes.length !== entry.bytes) throw new Error(`Gazetteer source snapshot drifted: ${directory}/${entry.path} is ${bytes.length} bytes; its manifest records ${entry.bytes}.`);
  }
  if (config.naturalEarth) { for (const layer of config.naturalEarth.layers) if (!manifest.inputs.some(entry => entry.path === layer.archive)) throw new TypeError(`Natural Earth layer ${layer.id} is not pinned by its source manifest.`); }
  else if (config.archive !== null && !manifest.inputs.some(entry => entry.path === config.archive)) throw new TypeError('Surface feature archive is not pinned by its source manifest.');
  if (config.landmarks && !manifest.inputs.some(entry => entry.path === config.landmarks!.document)) throw new TypeError('Landmark document is not pinned by its source manifest.');
  for (const id of config.lensIds) if (!context.declaredLensIds.includes(id)) throw new TypeError(`Surface feature lens ${id} is not declared by the object.`);
  const axes = parseSurfaceAxes(JSON.parse(await readFile(resolve(context.sourceDirectory, config.surfaceMap), 'utf8')));
  const loadedTraces = config.traces ? await loadTraces(context.sourceDirectory, config.traces) : null;
  const traceStats = { matched: 0, byCode: {} as Record<string, number>, unmatched: [] as string[] };
  const archive = config.archive === null ? null : resolve(directory, config.archive);
  const metadata = config.naturalEarth || archive === null || config.members === null || config.members.metadata === null ? null : new TextDecoder().decode(unzipMember(archive, config.members.metadata));
  let datumName: string, radiusM: number;
  if (config.naturalEarth) {
    // Natural Earth is WGS84 geographic; anchors use the authored body and outline sizes come from the published extents.
    datumName = 'WGS84 geographic (Natural Earth); authored body radius used'; radiusM = context.radiusKm * 1000;
  } else if (archive === null || config.members === null) {
    // Sites only: the coordinates come from the cited pages in the body's own frame; anchors are cast onto the hit mesh.
    if (!context.hitMesh) throw new TypeError('A sites-only catalogue can only anchor on a prepared hit mesh.');
    datumName = 'none (sites cite their own frames); authored radius used'; radiusM = context.radiusKm * 1000;
  } else if (metadata === null) {
    // The newest asteroid exports ship neither a projection file nor an FGDC record: anchors are cast onto the shape model and
    // the authored radius scales outline sizes; the pin manifest names the public-domain evidence outside the archive.
    if (config.members!.projection !== null) throw new TypeError('An export without metadata is expected to ship without a projection file too.');
    if (!context.hitMesh) throw new TypeError('An export without a datum can only anchor on a prepared hit mesh.');
    if (!/https?:\/\//u.test(manifest.licenseEvidence)) throw new TypeError('An export without metadata must name its licence evidence by URL in the pin manifest.');
    datumName = 'none in export (no projection file or metadata; authored radius used)'; radiusM = context.radiusKm * 1000;
  } else if (config.members.projection !== null) {
    const projection = new TextDecoder().decode(unzipMember(archive!, config.members.projection));
    const spheroid = /SPHEROID\["([^"]+)",\s*([\d.]+)/u.exec(projection), name = /GEOGCS\["([^"]+)"/u.exec(projection)?.[1];
    if (!spheroid || !name) throw new TypeError('Gazetteer projection file does not declare a spheroid.');
    datumName = name; radiusM = Number(spheroid[2]);
  } else {
    // Small-body metadata quotes a semi-axis in mixed units rather than a reference sphere, so it is recorded, not checked;
    // anchors are cast onto the shape model and outline sizes scale by the authored radius.
    const semiaxis = /<semiaxis>\s*([\d.]+)\s*<\/semiaxis>/u.exec(metadata), horizontal = /<horizdn>\s*([^<]+?)\s*<\/horizdn>/u.exec(metadata);
    if (!semiaxis || !horizontal) throw new TypeError('Gazetteer metadata does not declare a horizontal datum for an export without a projection file.');
    datumName = `${horizontal[1]!} (metadata semiaxis ${semiaxis[1]!}, no projection file; authored radius used)`; radiusM = context.radiusKm * 1000;
  }
  // Gazetteer spheres and authored mean radii differ by up to a few kilometres between bodies; anchors are directions, so the
  // difference only rescales nothing. Anything beyond one percent would mean a different body or datum.
  // Irregular bodies carry a conventional Gazetteer reference sphere that can sit well off the authored mean radius;
  // their anchors are cast onto the shape model, so the datum only scales outline sizes and is recorded, not enforced.
  const datumTolerance = context.hitMesh ? 0.15 : 0.01;
  if (Math.abs(radiusM - context.radiusKm * 1000) > datumTolerance * context.radiusKm * 1000) throw new TypeError(`Gazetteer datum radius ${radiusM} m differs from the authored ${context.radiusKm} km body.`);
  const notes: FeatureNotes | null = config.notes === undefined ? null : parseFeatureNotes(JSON.parse(await readFile(resolve(directory, config.notes), 'utf8')));
  const noteById = new Map((notes?.entries ?? []).map(entry => [entry.id, entry]));
  if (metadata !== null && !/<useconst>\s*Public domain\.?\s*<\/useconst>/iu.test(metadata)) throw new TypeError('Gazetteer metadata no longer declares public-domain use constraints.');
  const naturalEarth = config.naturalEarth ? loadNaturalEarthRows(context.sourceDirectory, config.directory, config.naturalEarth) : null;
  const zoomShareById = new Map<string, number>();
  const priorityById = new Map<string, number>(), pathsById = new Map<string, readonly (readonly (readonly [number, number])[])[]>();
  const searchOnlyIds = new Set<string>();
  const approvalLabel = naturalEarth ? 'Natural Earth' : 'Adopted by IAU';
  const table = naturalEarth ? { fields: [], rows: naturalEarth.map(row => {
    priorityById.set(row.id, row.priority); zoomShareById.set(row.id, row.zoomShare); if (row.paths) pathsById.set(row.id, row.paths); if (row.searchOnly) searchOnlyIds.add(row.id);
    return { name: row.name, clean_name: row.cleanName, approvaldt: `${manifest.snapshotDate.replaceAll('-', '/')} 00:00:00`, origin: row.origin, diameter: '0',
      center_lon: String(row.centerLon), center_lat: String(row.centerLat), type: row.type, code: row.code, approval: approvalLabel,
      min_lon: row.extent ? String(row.extent.minLon) : '', max_lon: row.extent ? String(row.extent.maxLon) : '', min_lat: row.extent ? String(row.extent.minLat) : '', max_lat: row.extent ? String(row.extent.maxLat) : '',
      quad_code: row.layer, link: `${row.link}#feature-${row.id}` } as Readonly<Record<string, string>>;
  }) } : archive === null || config.members === null ? { fields: [], rows: [] as Readonly<Record<string, string | undefined>>[] } : parseDbf(unzipMember(archive, config.members.attributes));
  const creditById = new Map<string, string>(), siteNoteById = new Map<string, NonNullable<PreparedSurfaceFeature['note']>>(), facilityById = new Map<string, string>();
  const siteDocument = config.sites ? parseSurfaceSites(JSON.parse(await readFile(resolve(directory, config.sites.document), 'utf8'))) : null;
  const siteRows: SiteRow[] = siteDocument ? loadSiteRows(context.sourceDirectory, config.directory, siteDocument) : [];
  const rows: Readonly<Record<string, string | undefined>>[] = [...table.rows, ...siteRows.map(row => {
    priorityById.set(row.id, row.priority); zoomShareById.set(row.id, SITE_ZOOM_SHARE); creditById.set(row.id, row.credit); if (row.paths) pathsById.set(row.id, row.paths); if (row.note) siteNoteById.set(row.id, row.note); if (row.facilityId) facilityById.set(row.id, row.facilityId);
    return { name: row.name, clean_name: row.name, approvaldt: `${row.approved.replaceAll('-', '/')} 00:00:00`, origin: row.origin, diameter: '0', center_lon: String(row.centerLon), center_lat: String(row.centerLat),
      type: row.type, code: row.code, approval: approvalLabel, min_lon: row.extent ? String(row.extent.minLon) : '', max_lon: row.extent ? String(row.extent.maxLon) : '', min_lat: row.extent ? String(row.extent.minLat) : '', max_lat: row.extent ? String(row.extent.maxLat) : '',
      quad_code: 'sites', link: `${row.link}#feature-${row.id}` };
  })];
  // Synthesised rows (Natural Earth, sites only) carry every field by construction; a Gazetteer table is checked for them.
  if (table.fields.length) for (const name of ['name', 'clean_name', 'approvaldt', 'origin', 'diameter', 'center_lon', 'center_lat', 'type', 'code', 'approval', 'quad_code', 'link', 'min_lon', 'max_lon', 'min_lat', 'max_lat']) {
    if (!table.fields.some(field => field.name === name)) throw new TypeError(`Gazetteer table lacks the ${name} field.`);
  }
  const kindOf = new Map<string, SurfaceFeatureKind>(Object.entries(DEFAULT_TYPE_KINDS));
  for (const kind of ['point', 'linear', 'region'] as const) for (const code of config.kinds[kind]) kindOf.set(code, kind);
  const skipped: Record<string, { count: number; reason: string }> = {}, assumed: Record<string, number> = {}, unsized: Record<string, number> = {};
  let extentFallbacks = 0, meshMisses = 0;
  // On a shape model every surface point is cast through the hit mesh; a miss (a hole in the coarse mesh) keeps the reference radius.
  const onSurface = (direction: Vector3): Vector3 => {
    if (context.surface) return context.surface.onSurface(direction);
    if (!context.hitMesh) return scaled(direction, context.meshRadiusUnits);
    const distance = projectRadial(context.hitMesh.triangles, direction);
    if (distance === null) { meshMisses++; return scaled(direction, context.meshRadiusUnits); }
    return scaled(direction, distance);
  };
  const cast = context.hitMesh !== undefined || context.surface !== undefined;
  const skip = (key: string, reason: string) => { skipped[key] = { count: (skipped[key]?.count ?? 0) + 1, reason }; };
  const excluded: Record<string, { count: number; reason: string }> = {};
  if (!(context.meshRadiusUnits > 0) || !Number.isFinite(context.meshRadiusUnits)) throw new TypeError('Surface features need the prepared mesh radius.');
  const scale = context.meshRadiusUnits / context.radiusKm;
  const features: PreparedSurfaceFeature[] = [];
  const landmarks = config.landmarks ? await prepareLandmarks(JSON.parse(await readFile(resolve(directory, config.landmarks.document), 'utf8')), context, axes, axes.mapLeftEdgeLongitudeDeg) : null;
  if (landmarks) for (const feature of landmarks.features) {
    features.push(feature); zoomShareById.set(feature.id, feature.minimumZoomShare); priorityById.set(feature.id, config.landmarks!.priority ?? 10);
  }
  const ids = new Map<string, PreparedSurfaceFeature>();
  const landmarkIds = new Set(features.map(feature => feature.id));
  const duplicateIds = new Set<string>();
  let duplicateRows = 0, maxSeparationDeg = 0, maxDiameterDifferenceKm = 0;
  for (const row of rows) {
    const code = row.code!;
    if (row.approval !== approvalLabel) { skip(`approval:${row.approval}`, 'Only names adopted by the IAU are labelled.'); continue; }
    if (Object.hasOwn(config.excludedTypeCodes, code)) {
      excluded[code] = { count: (excluded[code]?.count ?? 0) + 1, reason: config.excludedTypeCodes[code]! };
      continue;
    }
    let kind = kindOf.get(code);
    if (!kind) { kind = 'region'; assumed[code] = (assumed[code] ?? 0) + 1; }
    const rawLongitude = Number(row.center_lon), latitudeDeg = Number(row.center_lat), diameterKm = Number(row.diameter);
    if (!Number.isFinite(rawLongitude) || !Number.isFinite(latitudeDeg) || Math.abs(latitudeDeg) > 90) throw new TypeError(`Gazetteer centre is out of range for ${row.name}.`);
    // Some exports write centres just below 0° or at 360° and beyond; the catalogue keeps positive-east 0–360°.
    const longitudeDeg = ((rawLongitude % 360) + 360) % 360;
    const extentInput = { minLon: Number(row.min_lon), maxLon: Number(row.max_lon), minLat: Number(row.min_lat), maxLat: Number(row.max_lat) };
    // Some exports carry names the Gazetteer has not positioned: centre 0° or 360°, 0° with a degenerate extent at the same point.
    const degenerateExtent = [row.min_lon, row.max_lon, row.min_lat, row.max_lat].some(value => value === '') || (extentInput.minLon === extentInput.maxLon && extentInput.minLat === extentInput.maxLat);
    if (longitudeDeg === 0 && latitudeDeg === 0 && degenerateExtent) { skip(`position:${code}`, 'Features without a published centre cannot be placed.'); continue; }
    if (!(diameterKm >= 0)) throw new TypeError(`Gazetteer diameter is not a number for ${row.name}.`);
    // A feature without a published diameter is still labelled and searchable; it ranks after every sized feature and draws no rim.
    if (diameterKm === 0) unsized[code] = (unsized[code] ?? 0) + 1;
    const id = /#feature-(\d+)$/u.exec(row.link!)?.[1] ?? /\/Feature\/(\d+)$/u.exec(row.link!)?.[1];
    if (!id) throw new TypeError(`Gazetteer feature identity is missing for ${row.name}.`);
    if (landmarkIds.has(id)) throw new TypeError(`Landmark identity conflicts with another feature: ${id}.`);
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
    const direction = surfaceDirection(longitudeDeg, latitudeDeg, axes, axes.mapLeftEdgeLongitudeDeg);
    const radiusUnits = diameterKm / 2 * scale;
    // Some exports leave the extent empty or degenerate: those features fall back to their diameter circle.
    const hasExtent = [row.min_lon, row.max_lon, row.min_lat, row.max_lat].every(value => value !== '') && Object.values(extentInput).every(Number.isFinite) && extentInput.maxLat >= extentInput.minLat && (extentInput.maxLon !== extentInput.minLon || extentInput.maxLat !== extentInput.minLat);
    const extent = hasExtent ? normalizeExtent(extentInput, longitudeDeg) : null;
    if (extent && (Math.abs(extent.maxLat) > 90 || Math.abs(extent.minLat) > 90)) throw new TypeError(`Gazetteer extent latitude is out of range for ${row.name}.`);
    if (!extent) extentFallbacks++;
    // Craters and faculae are circular: their diameter is the rim. Other features report a nominal size,
    // so their published extent box is the honest shape.
    const anchor = onSurface(direction), anchorRadius = Math.hypot(anchor[0], anchor[1], anchor[2]);
    let outline: SurfaceFeatureOutline;
    if (diameterKm === 0 && !extent) {
      // No published size and no extent: the anchor alone, with a rim of zero radius that draws nothing.
      outline = { kind: 'circle', center: [round(anchor[0], 3), round(anchor[1], 3), round(anchor[2], 3)], east: [0, 0, 0], north: [0, 0, 0] };
    } else if (kind === 'point' || !extent) {
      const rim = rimVectors(direction, axes.north, context.meshRadiusUnits, radiusUnits), lift = anchorRadius / context.meshRadiusUnits;
      outline = cast ? { kind: 'circle', center: scaled(rim.center, lift), east: scaled(rim.east, lift), north: scaled(rim.north, lift) } : rim;
    } else {
      const box = extentPolygon(extent, axes, axes.mapLeftEdgeLongitudeDeg, context.meshRadiusUnits, config.outline.pieces);
      outline = cast ? { kind: 'box', points: box.points.map(point => onSurface(scaled(point, 1 / context.meshRadiusUnits))) } : box;
    }
    const riverPaths = pathsById.get(id);
    if (riverPaths) {
      // The runtime draws a trace with one chord per retained piece, so a path budget of one vertex per piece fills the pool exactly.
      const paths = budgetTracePaths(riverPaths, config.outline.pieces).map(path => path.map(([lon, lat]) => onSurface(surfaceDirection(lon, lat, axes, axes.mapLeftEdgeLongitudeDeg))));
      outline = { kind: 'trace', paths };
    }
    if (extent && loadedTraces && config.traces && Object.hasOwn(config.traces.classes, code)) {
      const selected = selectTraces(loadedTraces.traces, config.traces.classes[code]!, extent, config.traces);
      if (selected.length) {
        const paths = budgetTracePaths(selected.flatMap(trace => trace.parts), config.traces.maximumVertices)
          .map(path => path.map(([lon, lat]) => onSurface(surfaceDirection(lon, lat, axes, axes.mapLeftEdgeLongitudeDeg))));
        outline = { kind: 'trace', paths };
        traceStats.matched++; traceStats.byCode[code] = (traceStats.byCode[code] ?? 0) + 1;
      } else traceStats.unmatched.push(row.name!);
    }
    const feature: PreparedSurfaceFeature = {
      id, name: row.name!, kind, type: row.type!.split(',')[0]!.trim(), code, diameterKm, longitudeDeg, latitudeDeg,
      anchorUnits: [round(anchor[0], 3), round(anchor[1], 3), round(anchor[2], 3)],
      normal: [round(direction[0]), round(direction[1]), round(direction[2])],
      radiusUnits: round(radiusUnits, 4), outline,
      searchNames: [...new Set([row.name!, row.clean_name!].map(normalizeSearchText).filter(Boolean))], searchContext: normalizeSearchText(row.type!.split(',')[0]!),
      origin: row.origin!, approved: `${approved[1]}-${approved[2]}-${approved[3]}`, quad: row.quad_code!, link: row.link!.replace(/^http:\/\//u, 'https://').replace(/#feature-\d+$/u, ''),
      credit: creditById.get(id) ?? (naturalEarth ? 'Natural Earth' : `IAU name, ${approved[1]}`),
      ...(siteNoteById.has(id) ? { note: siteNoteById.get(id)! } : noteById.has(id) ? { note: { text: noteById.get(id)!.extract, title: noteById.get(id)!.title, url: noteById.get(id)!.url, credit: 'Wikipedia, CC BY-SA 4.0' } } : {}),
      ...(facilityById.has(id) ? { facilityId: facilityById.get(id)! } : {}),
      minimumZoomShare: 0,
      ...(searchOnlyIds.has(id) ? { searchOnly: true as const } : {}),
    };
    ids.set(id, feature);
    features.push(feature);
  }
  // Prepared priority: larger features label first; the runtime never re-ranks.
  const priority = (feature: PreparedSurfaceFeature) => priorityById.get(feature.id) ?? feature.diameterKm;
  features.sort((a, b) => priority(b) - priority(a) || b.diameterKm - a.diameterKm || a.name.localeCompare(b.name, 'en'));
  // Names with an encyclopedia article rank four times higher. Natural Earth
  // names, spacecraft sites and mission landmarks retain their authored tiers.
  features.forEach((feature, rank) => {
    const share = zoomShareById.get(feature.id) ?? featureDiscoveryZoomShare(rank, features.length, feature.note !== undefined && feature.note.credit.startsWith('Wikipedia'));
    (feature as { minimumZoomShare: number }).minimumZoomShare = round(share, 3);
  });
  if (!features.length) throw new TypeError('Gazetteer archive produced no labelled features.');
  if (features.length > context.maxEntries) throw new TypeError('Prepared features exceed the authored capability.');
  const catalog: PreparedSurfaceFeatureCatalog = {
    schema: PREPARED_SURFACE_FEATURES_SCHEMA, objectId: context.objectId,
    source: manifest.source, snapshotDate: manifest.snapshotDate, sourcePage: manifest.sourcePage, license: manifest.license, qualification: manifest.qualification,
    datum: { name: datumName, radiusM, authoredRadiusM: context.radiusKm * 1000, longitude: 'positive-east-0-360' },
    excluded, skipped, assumed: { regionTypes: assumed, extentFallbacks, meshMisses, unsized }, duplicates: { features: duplicateIds.size, rows: duplicateRows, maxSeparationDeg: round(maxSeparationDeg, 4), maxDiameterDifferenceKm: round(maxDiameterDifferenceKm, 4) },
    ...(loadedTraces && config.traces ? { traces: { source: loadedTraces.manifest.source, sourcePage: loadedTraces.manifest.sourcePage, license: loadedTraces.manifest.license, snapshotDate: loadedTraces.manifest.snapshotDate,
      traces: loadedTraces.traces.length, matched: traceStats.matched, byCode: traceStats.byCode, unmatched: traceStats.unmatched, maximumVertices: config.traces.maximumVertices } } : {}),
    ...(notes ? { notes: { source: notes.source, retrievedAt: notes.retrievedAt, license: notes.license, licenseUrl: notes.licenseUrl, count: features.filter(feature => feature.note && feature.note.credit.startsWith('Wikipedia')).length } } : {}),
    ...(siteDocument ? { sites: { source: siteDocument.source, retrievedAt: siteDocument.retrievedAt, count: siteRows.length } } : {}),
    ...(landmarks ? { landmarks: { source: landmarks.source, frame: landmarks.frame, evidence: landmarks.evidence } } : {}),
    features,
  };
  await mkdir(context.publicDirectory, { recursive: true });
  await mkdir(context.outputDirectory, { recursive: true });
  const transported = config.selectionBankCount === undefined ? features : features.map((feature, preparedIndex) => ({ ...feature, preparedIndex }));
  const searchable = config.selectionBankCount === undefined ? [] : transported.filter(feature => feature.searchOnly);
  const labels = config.selectionBankCount === undefined ? transported : transported.filter(feature => !feature.searchOnly);
  if (config.selectionBankCount !== undefined && (!labels.length || !searchable.length)) {
    throw new TypeError('Prepared feature banks require both default labels and search-only names.');
  }
  const publicCatalog = { ...catalog, features: labels };
  const bytes = Buffer.from(`${JSON.stringify(publicCatalog)}\n`);
  await writeFile(resolve(context.publicDirectory, config.output), bytes);
  const catalogDescriptor: SurfaceFeatureCatalogDescriptor = {
    url: `${config.publicBase}${config.output}`, bytes: bytes.length, sha256: sha256(bytes), count: labels.length,
  };
  const stem = config.output.slice(0, -extname(config.output).length);
  let selection: SurfaceFeatureSelectionPlan | undefined;
  if (config.selectionBankCount !== undefined) {
    const buckets: PreparedSurfaceFeature[][] = Array.from({ length: config.selectionBankCount }, () => []);
    for (const feature of searchable) buckets[surfaceFeatureBankIndex(feature.id, buckets.length)]!.push(feature);
    if (buckets.some(bucket => bucket.length === 0)) throw new TypeError('Prepared feature bank count leaves an empty selection bank.');
    const width = String(buckets.length - 1).length;
    const expected = new Set<string>();
    const banks: SurfaceFeatureCatalogDescriptor[] = [];
    for (const [index, bankFeatures] of buckets.entries()) {
      const filename = `${stem}-selection-${String(index).padStart(width, '0')}.json`;
      expected.add(filename);
      const bank = { schema: PREPARED_SURFACE_FEATURES_SCHEMA, objectId: context.objectId,
        source: manifest.source, snapshotDate: manifest.snapshotDate, sourcePage: manifest.sourcePage,
        license: manifest.license, qualification: manifest.qualification, features: bankFeatures };
      const bankBytes = Buffer.from(`${JSON.stringify(bank)}\n`);
      await writeFile(resolve(context.publicDirectory, filename), bankBytes);
      banks.push({ url: `${config.publicBase}${filename}`, bytes: bankBytes.length, sha256: sha256(bankBytes), count: bankFeatures.length });
    }
    for (const filename of await readdir(context.publicDirectory)) {
      if (filename.startsWith(`${stem}-selection-`) && filename.endsWith('.json') && !expected.has(filename)) {
        await unlink(resolve(context.publicDirectory, filename));
      }
    }
    selection = Object.freeze({ count: searchable.length, banks: Object.freeze(banks) });
  } else {
    for (const filename of await readdir(context.publicDirectory)) {
      if (filename.startsWith(`${stem}-selection-`) && filename.endsWith('.json')) await unlink(resolve(context.publicDirectory, filename));
    }
  }
  const plan: PreparedSurfaceFeaturePlan = {
    catalog: catalogDescriptor, ...(selection ? { selection } : {}),
    target: hitTarget(context, config.target), lensIds: config.lensIds, meshRadiusUnits: context.meshRadiusUnits, policy: config.labelPolicy,
    ...(context.hitMesh ? { surfaceRadiusUnits: meshRadiusBand(context.hitMesh.triangles) } : {}), ...(context.surface ? { surfaceEllipsoidUnits: context.surface.plan() } : {}),
    outline: config.outline,
  };
  const descriptor = { schema: 'cssearth-prepared-features@1', objectId: context.objectId, ...plan.catalog,
    ...(selection ? { selection, totalCount: features.length } : {}), source: manifest.source, sourcePage: manifest.sourcePage,
    license: manifest.license, snapshotDate: manifest.snapshotDate, mapLeftEdgeLongitudeDeg: axes.mapLeftEdgeLongitudeDeg, excluded, skipped, assumed: catalog.assumed, duplicates: catalog.duplicates, ...(catalog.traces ? { traces: catalog.traces } : {}) };
  await writeFile(resolve(context.outputDirectory, 'features.json'), `${JSON.stringify(descriptor)}\n`);
  return { plan, descriptor, catalog };
}
