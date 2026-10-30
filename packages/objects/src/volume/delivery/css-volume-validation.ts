import { PREPARED_CSS_VOLUME_SCHEMA } from './volume-schemas.js';
import type { VolumeVector } from '../../density-volume.js';
import { validatePreparedLeafBounds } from '../../prepared-data/presentation/prepared-leaf-bounds.js';
import { parseDensityVolumeFrame } from '../../density-volume.js';
import { validatePreparedCssSky } from '../../prepared-data/sky/css-sky-validation.js';
import type { PreparedCssVolume, PreparedVolumeComponent, VolumeAxis } from './css-volume-types.js';
import { validateVolumeImpostors } from './volume-impostor-validation.js';

const AXES: readonly VolumeAxis[] = ['x', 'y', 'z'];

/** The volumes this validator has returned. A volume is read once and then handed to each of its owners (its dataset
 * bank, the bank's topology check, its levels of detail, its runtime), and each validates what it is given: a returned
 * volume is answered as it is, not read again. The five datasets of the Small Magellanic Cloud were validated some 25
 * times in the frame they arrived in, 57 ms of a zoom on the iPad (2026-10-03). */
const validated = new WeakSet<object>();

/** A volume the data worker validated and sent to the page: the copy that arrives is answered as validated, not read
 * again on the page's thread. Only the reader that received it from the worker calls this. */
export function trustPreparedCssVolume(volume: PreparedCssVolume): PreparedCssVolume { validated.add(volume); return volume; }

export function validatePreparedCssVolume(input: unknown): PreparedCssVolume {
  if (typeof input === 'object' && input !== null && validated.has(input)) return input as PreparedCssVolume;
  const value = record(input, 'prepared CSS volume');
  exactKeys(value, ['schema', 'id', 'frame', 'anchors', 'stacks', 'resources', ...['provenance', 'approximation', 'components', 'stackCompositing', 'pointOverlays', 'thinHandoverCosines'].filter(key => Object.hasOwn(value, key)), ...(Object.hasOwn(value, 'sky') ? ['sky'] : []), ...(Object.hasOwn(value, 'impostors') ? ['impostors'] : []), ...(Object.hasOwn(value, 'mergedOpticalCopies') ? ['mergedOpticalCopies'] : [])], 'prepared CSS volume');
  if (value.thinHandoverCosines !== undefined && !(Array.isArray(value.thinHandoverCosines) && value.thinHandoverCosines.length === 2 && value.thinHandoverCosines[0] > 0 && value.thinHandoverCosines[0] < value.thinHandoverCosines[1] && value.thinHandoverCosines[1] <= 1)) throw new TypeError('A thin handover is two increasing cosines.');
  if (value.pointOverlays !== undefined && (!Array.isArray(value.pointOverlays) || !value.pointOverlays.length || !value.pointOverlays.every(path => typeof path === 'string' && /^[a-z0-9][a-z0-9.-]*\.bin$/u.test(path)))) throw new TypeError('Volume point overlays are prepared bank files.');
  if (value.stackCompositing !== undefined && value.stackCompositing !== 'transparent-normalized') throw new TypeError('Unknown volume stack compositing.');
  if (Object.hasOwn(value, 'mergedOpticalCopies') && value.mergedOpticalCopies !== 3) throw new TypeError('Prepared CSS volume merges exactly three optical copies.');
  if (value.schema !== PREPARED_CSS_VOLUME_SCHEMA || typeof value.id !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(value.id)) {
    throw new TypeError('Prepared CSS volume identity is invalid.');
  }
  const stacks = value.stacks;
  if (!Array.isArray(stacks) || stacks.length !== 3 || new Set(stacks.map(stack => record(stack, 'volume stack').axis)).size !== 3) {
    throw new TypeError('Prepared CSS volume needs exactly one stack per axis.');
  }
  const resourcesInput = value.resources;
  if (!Array.isArray(resourcesInput)) throw new TypeError('Prepared CSS volume resources are invalid.');
  const resources = new Set<string>();
  for (const resourceInput of resourcesInput) {
    const resource = record(resourceInput, 'volume resource');
    exactKeys(resource, ['path', 'bytes', 'width', 'height'], 'volume resource');
    if (!relativePath(resource.path) || resources.has(resource.path) || !positiveInteger(resource.bytes) ||
        !positiveInteger(resource.width) || !positiveInteger(resource.height)) {
      throw new TypeError('Prepared CSS volume resource metadata is invalid.');
    }
    resources.add(resource.path);
  }
  const leafIds = new Set<string>();
  for (const stackInput of stacks) validateStack(record(stackInput, 'volume stack'), resources, leafIds);
  validateOpticalSlabs(stacks, value.mergedOpticalCopies);
  const normals = stacks.map((stack, index) => stack.normalUnits ?? AXES.map(axis => axis === stack.axis ? 1 : 0));
  for (let i = 0; i < normals.length; i++) for (let j = 0; j < i; j++)
    if (Math.abs(normals[i].reduce((sum: number, value: number, k: number) => sum + value * normals[j][k], 0)) > 1e-8)
      throw new TypeError('Volume stack normals must be orthogonal.');
  if (value.anchors !== undefined) {
    if (!Array.isArray(value.anchors)) throw new TypeError('Prepared CSS volume anchors are invalid.');
    for (const anchorInput of value.anchors) {
      const anchor = record(anchorInput, 'volume anchor');
      exactKeys(anchor, ['id', 'positionUnits'], 'volume anchor');
      if (typeof anchor.id !== 'string' || !anchor.id || !finiteVector(anchor.positionUnits)) {
        throw new TypeError('Prepared CSS volume anchor is invalid.');
      }
    }
  }
  const frame = parseDensityVolumeFrame(value.frame);
  const components: PreparedVolumeComponent[] | undefined = value.components === undefined ? undefined : (() => {
    if (value.stackCompositing !== 'transparent-normalized' || !Array.isArray(value.components) || !value.components.length || value.components.length > 1024) throw new TypeError('Finite components require transparent normalized compositing and a bounded nonempty array.');
    const ids = new Set<string>();
    return value.components.map(input => {
      const component = record(input, 'finite volume component');
      exactKeys(component, ['id', 'boundsUnits', 'stacks', ...(Object.hasOwn(component, 'mergedOpticalCopies') ? ['mergedOpticalCopies'] : [])], 'finite volume component');
      if (typeof component.id !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(component.id) || ids.has(component.id)) throw new TypeError('Invalid or duplicate finite component identity.');
      ids.add(component.id);
      const child = validatePreparedCssVolume({ schema: value.schema, id: value.id, frame: { ...frame, boundsUnits: component.boundsUnits }, anchors: [], stacks: component.stacks, resources: resourcesInput,
        ...(component.mergedOpticalCopies === undefined ? {} : { mergedOpticalCopies: component.mergedOpticalCopies }) });
      for (const stack of child.stacks) for (const leaf of stack.leaves) { if (leafIds.has(leaf.id)) throw new TypeError('Finite components must own distinct leaf ids.'); leafIds.add(leaf.id); }
      return { id: component.id, boundsUnits: child.frame.boundsUnits, stacks: child.stacks, ...(child.mergedOpticalCopies ? { mergedOpticalCopies: child.mergedOpticalCopies } : {}) };
    });
  })();
  const impostors = Object.hasOwn(value, 'impostors') ? validateVolumeImpostors(value.impostors, resources) : undefined;
  const sky = Object.hasOwn(value, 'sky') ? validatePreparedCssSky(value.sky, resourcesInput as PreparedCssVolume['resources']) : undefined;
  if (sky && (sky.referenceFrame !== frame.referenceFrame || sky.epochJdTt !== frame.epochJdTt)) throw new TypeError('Prepared sky and volume must share their reference frame and epoch.');
  const volume = Object.freeze({ schema: value.schema, id: value.id, frame,
    ...(value.anchors === undefined ? {} : { anchors: value.anchors as PreparedCssVolume['anchors'] }),
    stacks: stacks as PreparedCssVolume['stacks'], resources: resourcesInput as PreparedCssVolume['resources'],
    ...(components ? { components } : {}), ...(value.stackCompositing ? { stackCompositing: 'transparent-normalized' as const } : {}), ...(value.thinHandoverCosines ? { thinHandoverCosines: Object.freeze([...value.thinHandoverCosines as [number, number]]) as unknown as readonly [number, number] } : {}), ...(value.pointOverlays ? { pointOverlays: Object.freeze([...value.pointOverlays as string[]]) } : {}),
    ...(Object.hasOwn(value, 'provenance') ? { provenance: value.provenance } : {}), ...(Object.hasOwn(value, 'approximation') ? { approximation: value.approximation } : {}),
    ...(sky ? { sky } : {}), ...(impostors ? { impostors } : {}), ...(value.mergedOpticalCopies === 3 ? { mergedOpticalCopies: 3 as const } : {}) }) as PreparedCssVolume;
  validated.add(volume);
  return volume;
}

function validateStack(stack: Record<string, unknown>, resources: Set<string>, leafIds: Set<string>): void {
  exactKeys(stack, ['axis', 'leaves', ...(Object.hasOwn(stack, 'normalUnits') ? ['normalUnits'] : [])], 'volume stack');
  // An empty stack is a volume that draws no slices; its frame, anchors and sky still serve the scene.
  if (!isAxis(stack.axis) || !Array.isArray(stack.leaves)) {
    throw new TypeError('Prepared CSS volume stack is invalid.');
  }
  if (stack.normalUnits !== undefined && (!finiteVector(stack.normalUnits) || Math.abs(Math.hypot(...stack.normalUnits) - 1) > 1e-8))
    throw new TypeError('Volume stack normal must be a finite unit vector.');
  for (const leafInput of stack.leaves) {
    const leaf = record(leafInput, 'volume leaf');
    exactKeys(leaf, ['id', 'centerUnits', 'texturePath', 'widthPx', 'heightPx', 'style', ...(Object.hasOwn(leaf, 'boundsCssPixels') ? ['boundsCssPixels'] : []), ...(Object.hasOwn(leaf, 'opticalSlab') ? ['opticalSlab'] : [])], 'volume leaf');
    if (Object.hasOwn(leaf, 'opticalSlab')) {
      const optical = record(leaf.opticalSlab, 'optical slab'); exactKeys(optical, ['id', 'role'], 'optical slab');
      if (typeof optical.id !== 'string' || !optical.id || typeof optical.role !== 'string' || !['merged-three', 'single', 'merged-two'].includes(optical.role)) throw new TypeError('Invalid optical slab identity or role.');
    }
    if (leaf.boundsCssPixels !== undefined) validatePreparedLeafBounds(leaf.boundsCssPixels);
    if (typeof leaf.id !== 'string' || !leaf.id || leafIds.has(leaf.id) || typeof leaf.texturePath !== 'string' ||
        !resources.has(leaf.texturePath) || !positiveInteger(leaf.widthPx) || !positiveInteger(leaf.heightPx) ||
        !finiteVector(leaf.centerUnits)) throw new TypeError('Prepared CSS volume leaf metadata is invalid.');
    validateStyle(record(leaf.style, 'volume leaf style'));
    leafIds.add(leaf.id);
  }
}

function validateOpticalSlabs(stacks: readonly unknown[], merged: unknown): void {
  const leaves = stacks.flatMap(value => { const stack = record(value, 'stack'); return (stack.leaves as unknown[]).map(value => ({ axis: stack.axis, leaf: record(value, 'leaf') })); });
  if (!leaves.some(({ leaf }) => Object.hasOwn(leaf, 'opticalSlab'))) return;
  if (merged !== 3 || leaves.length > 33 || leaves.some(({ leaf }) => !Object.hasOwn(leaf, 'opticalSlab'))) throw new TypeError('Hybrid optical slabs require explicit roles, three-copy encoding and at most 33 layers.');
  const groups = new Map<string, typeof leaves>();
  for (const entry of leaves) { const optical = record(entry.leaf.opticalSlab, 'optical slab'), id = String(optical.id), group = groups.get(id) ?? []; group.push(entry); groups.set(id, group); }
  for (const group of groups.values()) {
    const roles = group.map(({ leaf }) => String(record(leaf.opticalSlab, 'optical slab').role)).sort();
    if (roles.length === 1 && roles[0] === 'merged-three') continue;
    if (roles.join(',') !== 'merged-two,single') throw new TypeError('A dense optical slab requires exactly an original and a merged pair.');
    const [a, b] = group;
    if (a!.axis !== b!.axis || JSON.stringify(a!.leaf.centerUnits) !== JSON.stringify(b!.leaf.centerUnits) ||
        a!.leaf.widthPx !== b!.leaf.widthPx || a!.leaf.heightPx !== b!.leaf.heightPx ||
        JSON.stringify(a!.leaf.style) !== JSON.stringify(b!.leaf.style) || JSON.stringify(a!.leaf.boundsCssPixels) !== JSON.stringify(b!.leaf.boundsCssPixels)) throw new TypeError('Optical slab images must be coincident with identical geometry.');
  }
}

function validateStyle(style: Record<string, unknown>): void {
  exactKeys(style, ['width', 'height', 'transform', 'backgroundSize', 'backgroundPosition'], 'volume leaf style');
  if (typeof style.width !== 'string' || typeof style.height !== 'string' || typeof style.transform !== 'string' ||
      typeof style.backgroundSize !== 'string' || typeof style.backgroundPosition !== 'string' ||
      !dimensions(style.width, 1) || !dimensions(style.height, 1) || !matrix(style.transform) ||
      !dimensions(style.backgroundSize, 2) || !dimensions(style.backgroundPosition, 2)) {
    throw new TypeError('Prepared CSS volume leaf style must be URL-free compiled CSS.');
  }
}

function finiteVector(value: unknown): value is VolumeVector {
  return Array.isArray(value) && value.length === 3 && value.every(component => typeof component === 'number' && Number.isFinite(component));
}
function relativePath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !value.startsWith('/') && !value.split('/').includes('..') && !/[\\\u0000-\u0020]/u.test(value);
}
function positiveInteger(value: unknown): value is number { return typeof value === 'number' && Number.isInteger(value) && value > 0; }
function isAxis(value: unknown): value is VolumeAxis { return typeof value === 'string' && AXES.includes(value as VolumeAxis); }
function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object.`);
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, expected: readonly string[], name: string): void {
  const actual = Object.keys(value).sort(), keys = [...expected].sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) throw new TypeError(`${name} has unsupported or missing fields.`);
}
function dimensions(value: string, count: number): boolean {
  const parts = value.trim().split(/\s+/u);
  return parts.length === count && parts.every(part => /^-?(?:\d+(?:\.\d+)?|\.\d+)px$/u.test(part) && Number.isFinite(Number.parseFloat(part)));
}
function matrix(value: string): boolean {
  const match = /^matrix3d\(([^)]+)\)$/u.exec(value.trim());
  if (!match) return false;
  const values = match[1]!.split(',').map(part => Number(part.trim()));
  return values.length === 16 && values.every(Number.isFinite);
}
