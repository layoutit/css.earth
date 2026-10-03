import { BANDED_ELLIPSOID_SCHEMA, LAYERED_OBLATE_SCHEMA, SHAPE_MODEL_SCHEMA } from './recipe-identifiers.ts';
import { buildPolyMeshTransform } from '@layoutit/polycss';
import { multiply, reflection, rotation, type Matrix3 } from './world-navigation.ts';

/** An authored source or prepared runtime record, read as JSON. The reads below keep JavaScript's own property semantics, so
 * an ill-formed record fails, or is accepted, exactly where an untyped read would. */
type Value = unknown;
/** `value?.[key]`: undefined for null or undefined, else the property as JavaScript reads it (a primitive's included). */
const optional = (value: Value, key: Value): Value =>
  value === null || value === undefined ? undefined : (Object(value) as Readonly<Record<string, Value>>)[String(key)];
/** `value[key]`: a required read, failing on null or undefined with JavaScript's own TypeError. */
function required(value: Value, key: string): Value {
  if (value === null || value === undefined) throw new TypeError(`Cannot read properties of ${String(value)} (reading '${key}')`);
  return optional(value, key);
}
/** Unary minus as JavaScript applies it to a JSON value. */
const negated = (value: Value): number => -Number(value);
const IDENTITY: Matrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export interface AuthoredPresentationBasis { readonly bodyToPresentation: Matrix3; readonly sourceRadiusUnits: number; readonly tilePixels: number; }

/** Read each capability's existing authored axes; object identities never select a backend. */
/** `systemMatrix` is the solved system node transform of a lane whose frame is the ecliptic presentation frame. */
export function authoredPresentationBasis(sources: ReadonlyMap<string, Value>, systemMatrix: Matrix3): AuthoredPresentationBasis {
  const model = sources.get('shape-model');
  if (optional(model, 'schema') === SHAPE_MODEL_SCHEMA) return checked(systemMatrix, required(model, 'displayRadius'), 50);
  const solar = sources.get('solar-system'), terrestrial = sources.get('terrestrial');
  const geometry = sources.get('geometry'), presentation = sources.get('presentation'), paged = sources.get('paged-ellipsoid');
  if (optional(solar, 'schema') === 'cssearth-solar-system-preparation@1') {
    return checked(systemMatrix, required(solar, 'bodyRadiusUnits'), 50);
  }
  if (optional(terrestrial, 'schema') === 'cssearth-terrestrial-preparation@2') {
    if (required(terrestrial, 'kind') === 'solid-observation-body') return checked(systemMatrix, required(required(terrestrial, 'geometry'), 'radius'), 50);
  }
  if (optional(geometry, 'schema') === LAYERED_OBLATE_SCHEMA) {
    const p = required(geometry, 'parameters');
    return checked(chain(mesh([0, 0, required(p, 'objectPresentationNodeDegrees')]), mesh([required(p, 'objectObliquityDegrees'), 0, 0]), mesh([0, 0, required(p, 'meshRotationZ')])),
      required(p, 'equatorialRadius'), required(p, 'tileSize'));
  }
  if (optional(geometry, 'schema') === BANDED_ELLIPSOID_SCHEMA) {
    const radius = () => required(required(geometry, 'shape'), 'equatorialRadius'), tile = () => required(required(geometry, 'planOptions'), 'tileSize');
    if (optional(presentation, 'schema') === 'cssearth-normalized-disc-presentation@2') {
      return checked(chain(mesh(required(presentation, 'systemRotation')), mesh([0, 0, negated(required(presentation, 'bodyRotationZDegrees'))])), radius(), tile());
    }
    if (optional(presentation, 'schema') === 'cssearth-layered-surface-presentation@1') {
      return checked(chain(authoredTransform(required(presentation, 'systemTransform')), authoredTransform(required(presentation, 'meshTransform'))), radius(), tile());
    }
  }
  if (optional(paged, 'schema') === 'cssearth-paged-ellipsoid@1') {
    const p = required(paged, 'geometry');
    return checked(multiply(systemMatrix, chain(mesh([0, 0, required(p, 'MESH_ROTATION_Z')]))), required(p, 'EQUATORIAL_RADIUS'), required(p, 'TILE_SIZE'));
  }
  throw new TypeError('Authored capability has no physical presentation basis. Supply numerical frame preparation for this capability.');
}

function authoredTransform(value: Value): string {
  const literal = optional(value, 'value'), rotations = optional(value, 'rotations');
  if (optional(value, 'kind') === 'literal' && typeof literal === 'string') return literal;
  if (optional(value, 'kind') === 'mesh-sequence' && Array.isArray(rotations)) return rotations.map((rotation: Value) => mesh(rotation)).join(' ');
  throw new TypeError('Unsupported authored presentation transform.');
}
const finiteTriple = (value: Value): value is readonly [number, number, number] =>
  Array.isArray(value) && value.length === 3 && !value.some((entry: Value) => !Number.isFinite(entry));
function mesh(rotation: Value): string {
  if (!finiteTriple(rotation)) throw new TypeError('Authored mesh rotation must be finite.');
  return buildPolyMeshTransform({ rotation: [...rotation] as [number, number, number] }) ?? '';
}
const positive = (value: Value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
function checked(bodyToPresentation: Matrix3, sourceRadiusUnits: Value, tilePixels: Value): AuthoredPresentationBasis {
  rotation(bodyToPresentation);
  if (!positive(sourceRadiusUnits) || !positive(tilePixels)) throw new TypeError('Authored scene dimensions must be positive.');
  return { bodyToPresentation, sourceRadiusUnits, tilePixels };
}

export interface SurfaceMapPlacement { readonly prime: readonly number[]; readonly east: readonly number[]; readonly north: readonly number[]; readonly mapLeftEdgeLongitudeDeg: number }
/** Where PolyCSS puts a body's surface when no surface map says otherwise: it writes world X/Y as CSS Y/X, so the prime
 * meridian runs along CSS +y and east along CSS +x, with longitudes counted from 0. */
export const POLYCSS_SURFACE_PLACEMENT: SurfaceMapPlacement = Object.freeze({ prime: [0, 1, 0], east: [1, 0, 0], north: [0, 0, 1], mapLeftEdgeLongitudeDeg: 0 });

/** Body-fixed directions to presentation directions as the body is drawn. The node chain runs from the scene's child to the
 * surface node (the feature labels' target, or the \`<id>-body\` or shape-model body node), each spin at its first keyframe, which is the
 * prepared epoch. On that node a latitude and longitude sit where the surface map places them, exactly as the feature labels
 * are drawn: along the prime, east and north axes, with longitudes counted from the map's left edge. CSS 3D space is
 * left-handed (x right, y down, z toward the viewer), so this map is a reflection. */
export function renderedBodyToPresentation(definition: Value, id: string, placement: SurfaceMapPlacement): Matrix3 {
  const drawn = multiply(chain(...drawnChain(definition, id).transforms), surfacePlacementMatrix(id, placement));
  reflection(drawn);
  return drawn;
}

/** The retained nodes from the scene's child down to the surface node, with each node's transform (a spin at its first keyframe). */
/** Its nodes are the indices the tree's `parent` links name, and its transforms the node texts `chain` reads as CSS. */
function drawnChain(definition: Value, id: string): { readonly nodes: readonly Value[]; readonly transforms: readonly Value[] } {
  const nodes = optional(required(definition, 'tree'), 'nodes');
  if (!Array.isArray(nodes)) throw new TypeError(`${id}: the prepared runtime has no retained tree.`);
  const node = (index: Value): Value => optional(nodes, index);
  const classes = (entry: Value) => String(optional(entry, 'className') ?? '').split(/\s+/u);
  const featureTarget = optional(optional(definition, 'features'), 'target');
  const target: Value = Number.isSafeInteger(featureTarget) ? featureTarget
    : nodes.findIndex((entry: Value) => classes(entry).some(name => [`${id}-body`, `${id}-body-polar`, 'shape-model-body'].includes(name)));
  if (!node(target)) throw new TypeError(`${id}: the prepared tree has no surface node.`);
  const spins = new Map<Value, string>(), motions = optional(definition, 'motion');
  for (const motion of Array.isArray(motions) ? motions as Value[] : []) {
    const keyframes = optional(motion, 'keyframes');
    const first = Array.isArray(keyframes) ? keyframes.find((frame: Value) => optional(frame, 'offset') === 0) as Value : undefined;
    const transform = optional(first, 'transform'), motionTarget = optional(motion, 'target');
    if (Number.isSafeInteger(motionTarget) && typeof transform === 'string') spins.set(motionTarget, transform);
  }
  const path: Value[] = [], transforms: Value[] = [];
  for (let cursor = target; !classes(node(cursor)).includes('polycss-scene'); cursor = required(node(cursor), 'parent')) {
    if (!node(cursor) || path.length > nodes.length) throw new TypeError(`${id}: the surface node is not inside the prepared scene.`);
    path.unshift(cursor);
    transforms.unshift(spins.get(cursor) ?? nodeTransform(definition, cursor) ?? '');
  }
  return { nodes: path, transforms };
}
function nodeTransform(definition: Value, index: Value): Value {
  const tree = required(definition, 'tree'), node = optional(required(tree, 'nodes'), index), entries = required(node, 'properties');
  const property = Array.isArray(entries) ? optional(entries.map((entry: Value) => optional(optional(tree, 'properties'), entry))
    .find((entry: Value) => optional(entry, 'name') === 'transform') as Value, 'value') : undefined;
  return property ?? /(?:^|;)\s*transform:([^;]*)/u.exec(String(optional(node, 'style') ?? ''))?.[1];
}
function surfacePlacementMatrix(id: string, placement: SurfaceMapPlacement): Matrix3 {
  const { prime, east, north, mapLeftEdgeLongitudeDeg } = placement, edge = mapLeftEdgeLongitudeDeg * Math.PI / 180;
  if (![...prime, ...east, ...north, mapLeftEdgeLongitudeDeg].every(Number.isFinite)) throw new TypeError(`${id}: the surface map placement is not finite.`);
  const c = Math.cos(edge), s = Math.sin(edge);
  // Columns: body +x (longitude 0) at map angle -edge, body +y (longitude 90) at 90 - edge, body +z along north.
  const x = [0, 1, 2].map(axis => c * prime[axis]! - s * east[axis]!), y = [0, 1, 2].map(axis => s * prime[axis]! + c * east[axis]!);
  return [x[0]!, y[0]!, north[0]!, x[1]!, y[1]!, north[1]!, x[2]!, y[2]!, north[2]!];
}

/** The system node rotation (row-major, CSS coordinates) that draws a body in `intended` when the chain below that node is
 * `innerTransforms` (outermost first, spins at their first keyframe) over the surface map's placement. A lane that bakes
 * images through its node angles calls this before it builds its tree; the world-navigation stage re-solves the drawn tree
 * and refuses any difference. */
export function solveSystemMatrix(id: string, intended: Matrix3, innerTransforms: readonly Value[], placement: SurfaceMapPlacement): Matrix3 {
  reflection(intended);
  const matrix = multiply(intended, transposeMatrix(multiply(chain(...innerTransforms), surfacePlacementMatrix(id, placement))));
  rotation(matrix);
  return matrix;
}

/** A row-major rotation as the CSS `matrix3d` a node carries. */
export function matrix3dText(matrix: Matrix3): string {
  const text = (value: number) => Math.abs(value) < 1e-15 ? '0' : String(value);
  return `matrix3d(${[matrix[0], matrix[3], matrix[6], 0, matrix[1], matrix[4], matrix[7], 0, matrix[2], matrix[5], matrix[8], 0, 0, 0, 0, 1].map(text).join(',')})`;
}

export interface SolvedSystemTransform { readonly from: string; readonly to: string; readonly matrix: Matrix3 }
/** The transform of the body's outermost mesh node (the scene's child on the drawn chain) that draws the body in `intended`, a
 * body-fixed to presentation reflection. Everything below that node (spin phase, polar carriers, the surface map's placement and
 * left edge) stays as prepared and is solved through, so no lane restates it. */
export function solveSystemTransform(definition: Value, id: string, placement: SurfaceMapPlacement, intended: Matrix3): SolvedSystemTransform {
  reflection(intended);
  const { transforms } = drawnChain(definition, id);
  const from = transforms[0];
  if (!from || transforms.length < 2) throw new TypeError(`${id}: the drawn chain has no system node above its surface.`);
  const text = cssText(from), system = chain(text);
  const matrix = solveSystemMatrix(id, intended, transforms.slice(1), placement), to = matrix3dText(matrix);
  // An unchanged node keeps its exact prepared text, so a body already drawn in its frame republishes byte for byte.
  const same = system.every((value, index) => Math.abs(value - matrix[index]!) < 1e-12);
  return { from: text, to: same ? text : to, matrix: same ? system : matrix };
}
const transposeMatrix = (m: Matrix3): Matrix3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

/** CSS is interpreted only during preparation; retained runtime consumes the numeric result. Each transform is read as CSS
 * text, and anything else fails as it reaches its turn. */
export function chain(...transforms: readonly Value[]): Matrix3 {
  return transforms.reduce<Matrix3>((left, value) => multiply(left, cssRotation(value)), IDENTITY);
}
/** A transform read as CSS text; any other value fails with the TypeError calling `value.replace` on it would raise. */
function cssText(value: Value): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) throw new TypeError(`Cannot read properties of ${String(value)} (reading 'replace')`);
  throw new TypeError('value.replace is not a function');
}
function cssRotation(transform: Value): Matrix3 {
  const value = cssText(transform);
  let remaining = value.replace(/^transform:/u, '').trim(), result = IDENTITY;
  if (!remaining || remaining === 'none') return result;
  for (const match of remaining.matchAll(/matrix3d\(([^)]+)\)|rotate([XYZ])\((-?[\d.e+]+)deg\)/gu)) {
    let next: Matrix3;
    if (match[1]) {
      const m = match[1].split(',').map(Number);
      if (m.length !== 16 || m.some(number => !Number.isFinite(number)) || m[3] || m[7] || m[11] || m[12] || m[13] || m[14] || m[15] !== 1) throw new TypeError('Physical presentation needs a pure rotation.');
      next = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
    } else {
      const angle = Number(match[3]) * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
      next = match[2] === 'X' ? [1, 0, 0, 0, c, -s, 0, s, c]
        : match[2] === 'Y' ? [c, 0, s, 0, 1, 0, -s, 0, c] : [c, -s, 0, s, c, 0, 0, 0, 1];
    }
    rotation(next); result = multiply(result, next); remaining = remaining.replace(match[0], '');
  }
  if (remaining.trim()) throw new TypeError(`Unsupported physical presentation transform: ${value}`);
  return result;
}
