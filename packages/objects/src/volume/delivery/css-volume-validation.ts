import { PREPARED_CSS_VOLUME_SCHEMA } from './volume-schemas.js';
import type { VolumeVector } from '../../density-volume.js';
import { validatePreparedLeafBounds } from '../../prepared-data/presentation/prepared-leaf-bounds.js';
import { parseDensityVolumeFrame } from '../../density-volume.js';
import { validatePreparedCssSky } from '../../prepared-data/sky/css-sky-validation.js';
import type { PreparedCssVolume, VolumeAxis } from './css-volume-types.js';
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
  exactKeys(value, ['schema', 'id', 'frame', 'anchors', 'stacks', 'resources', ...['provenance', 'approximation', 'stackCompositing', 'pointOverlays', 'thinHandoverCosines'].filter(key => Object.hasOwn(value, key)), ...(Object.hasOwn(value, 'sky') ? ['sky'] : []), ...(Object.hasOwn(value, 'impostors') ? ['impostors'] : []), ...(Object.hasOwn(value, 'farPlanes') ? ['farPlanes'] : []), ...(Object.hasOwn(value, 'mergedOpticalCopies') ? ['mergedOpticalCopies'] : []), ...(Object.hasOwn(value, 'fixedImages') ? ['fixedImages'] : [])], 'prepared CSS volume');
  if (Object.hasOwn(value, 'fixedImages') && value.fixedImages !== true) throw new TypeError('Prepared CSS volume fixedImages must be true when declared.');
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
  if (value.fixedImages === true && (stacks.filter(stack => stack.leaves.length > 0).length !== 1 ||
      Object.hasOwn(value, 'mergedOpticalCopies') || Object.hasOwn(value, 'impostors') || Object.hasOwn(value, 'farPlanes')))
    throw new TypeError('Fixed images need exactly one populated stack and no optical copies or alternative views.');
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
  const impostors = Object.hasOwn(value, 'impostors') ? validateVolumeImpostors(value.impostors, resources) : undefined;
  const farPlanes = Object.hasOwn(value, 'farPlanes') ? validateFarPlanes(value.farPlanes, resources, leafIds, frame, stacks, resourcesInput as PreparedCssVolume['resources']) : undefined;
  if (farPlanes && impostors) throw new TypeError('Volume far planes and impostors are alternative distant presentations.');
  const sky = Object.hasOwn(value, 'sky') ? validatePreparedCssSky(value.sky, resourcesInput as PreparedCssVolume['resources']) : undefined;
  if (sky && (sky.referenceFrame !== frame.referenceFrame || sky.epochJdTt !== frame.epochJdTt)) throw new TypeError('Prepared sky and volume must share their reference frame and epoch.');
  const volume = Object.freeze({ schema: value.schema, id: value.id, frame,
    ...(value.anchors === undefined ? {} : { anchors: value.anchors as PreparedCssVolume['anchors'] }),
    stacks: stacks as PreparedCssVolume['stacks'], resources: resourcesInput as PreparedCssVolume['resources'],
    ...(value.stackCompositing ? { stackCompositing: 'transparent-normalized' as const } : {}), ...(value.thinHandoverCosines ? { thinHandoverCosines: Object.freeze([...value.thinHandoverCosines as [number, number]]) as unknown as readonly [number, number] } : {}), ...(value.pointOverlays ? { pointOverlays: Object.freeze([...value.pointOverlays as string[]]) } : {}),
    ...(Object.hasOwn(value, 'provenance') ? { provenance: value.provenance } : {}), ...(Object.hasOwn(value, 'approximation') ? { approximation: value.approximation } : {}),
    ...(farPlanes ? { farPlanes } : {}), ...(sky ? { sky } : {}), ...(impostors ? { impostors } : {}), ...(value.mergedOpticalCopies === 3 ? { mergedOpticalCopies: 3 as const } : {}),
    ...(value.fixedImages === true ? { fixedImages: true as const } : {}) }) as PreparedCssVolume;
  validated.add(volume);
  return volume;
}

function validateFarPlanes(input: unknown, resources: Set<string>, leafIds: Set<string>, frame: PreparedCssVolume['frame'], stacks: PreparedCssVolume['stacks'], resourceRecords: PreparedCssVolume['resources']): NonNullable<PreparedCssVolume['farPlanes']> {
  const bank = record(input, 'volume far planes');
  exactKeys(bank, ['gainBlend', 'radiusUnits', 'belowDiameterPixels', 'stacks', 'side'], 'volume far planes');
  if (!Array.isArray(bank.gainBlend) || bank.gainBlend.length !== 1) throw new TypeError('Far pictures need one top gain table.');
  const fittedAxes = new Set<string>();
  for (const input of bank.gainBlend) {
    const fit = record(input, 'far gain fit');
    exactKeys(fit, ['axis', 'samples'], 'far gain fit');
    if (fit.axis !== 'z' || fittedAxes.has(String(fit.axis)) || !Array.isArray(fit.samples) || fit.samples.length < 2 || fit.samples.length > 256)
      throw new TypeError('Far gain tables need unique axes and 2 to 256 samples.');
    fittedAxes.add(String(fit.axis));
    let previous = 0;
    for (const sample of fit.samples) {
      if (!Array.isArray(sample) || sample.length !== 2 || !sample.every(value => typeof value === 'number' && Number.isFinite(value)) ||
          sample[0] < 1 || sample[0] > 256 || sample[0] <= previous || sample[1] < .001 || sample[1] > .999)
        throw new TypeError('Far gain samples must increase from 1, with gain at most 256, with bounded opacity.');
      previous = sample[0];
    }
    if (fit.samples[0][0] !== 1 || fit.samples.at(-1)[0] < 3) throw new TypeError('Far gain tables must span at least 1 to 3.');
  }
  if (typeof bank.radiusUnits !== 'number' || !Number.isFinite(bank.radiusUnits) || bank.radiusUnits <= 0 ||
      typeof bank.belowDiameterPixels !== 'number' || !Number.isFinite(bank.belowDiameterPixels) || bank.belowDiameterPixels <= 0 ||
      !Array.isArray(bank.stacks) || bank.stacks.length !== 1 || new Set(bank.stacks.map(stack => record(stack, 'far stack').axis)).size !== 1)
    throw new TypeError('Volume far planes need one top axis and positive finite screen thresholds.');
  for (const input of bank.stacks) {
    const stack = record(input, 'far stack');
    if (stack.axis !== 'z') throw new TypeError('Only the fixed top pair belongs in far stacks.');
    validateStack(stack, resources, leafIds);
    const prepared = stack as unknown as PreparedCssVolume['stacks'][number];
    const original = stacks.find(candidate => candidate.axis === prepared.axis)!;
    const normal = original.normalUnits ?? AXES.map(axis => axis === prepared.axis ? 1 : 0);
    const actual = prepared.normalUnits ?? AXES.map(axis => axis === prepared.axis ? 1 : 0);
    const leaf = prepared.leaves[0], high = prepared.leaves[1];
    if (prepared.leaves.length !== 2 || !leaf || !high || high.style.transform !== leaf.style.transform || high.style.width !== leaf.style.width ||
        high.style.height !== leaf.style.height || high.widthPx !== leaf.widthPx || high.heightPx !== leaf.heightPx ||
        high.style.backgroundSize !== leaf.style.backgroundSize || high.style.backgroundPosition !== leaf.style.backgroundPosition ||
        !high.centerUnits.every((value, index) => value === leaf.centerUnits[index]) || !normal.every((value, index) => value === actual[index]) ||
        Math.abs(normal.reduce((sum, value, index) => sum + value * (leaf.centerUnits[index]! - (frame.boundsUnits.min[index]! + frame.boundsUnits.max[index]!) / 2), 0)) > 1e-6 ||
        leaf.style.backgroundSize !== `${leaf.style.width} ${leaf.style.height}` || leaf.style.backgroundPosition !== '0px 0px')
      throw new TypeError('Each volume far axis needs two coincident central, uncropped pictures parallel to its stack.');
    const matrix = leaf.style.transform.slice(9, -1).split(',').map(Number);
    const u = [matrix[1]!, matrix[0]!, matrix[2]!], v = [matrix[5]!, matrix[4]!, matrix[6]!];
    const translation = [matrix[13]!, matrix[12]!, matrix[14]!];
    const dot = (vector: readonly number[]) => normal.reduce((sum, value, index) => sum + value * vector[index]!, 0);
    const centre = normal.reduce((sum, value, index) => sum + value * (frame.boundsUnits.min[index]! + frame.boundsUnits.max[index]!) / 2, 0);
    if (matrix[3] !== 0 || matrix[7] !== 0 || matrix[11] !== 0 || matrix[15] !== 1 ||
        !(Math.hypot(...u) > 0) || !(Math.hypot(...v) > 0) || Math.abs(dot(u)) > 1e-6 || Math.abs(dot(v)) > 1e-6 ||
        Math.abs(dot(translation) / 50 - centre) > 1e-6)
      throw new TypeError('Volume far picture matrix must place its plane through the frame centre, perpendicular to its axis.');
  }
  const side = record(bank.side, 'cylindrical side');
  exactKeys(side, ['leaf', 'highTexturePath', 'views', 'coefficients'], 'cylindrical side');
  validateStack({ axis: 'x', leaves: [side.leaf] }, resources, leafIds);
  const leaf = side.leaf as PreparedCssVolume['stacks'][number]['leaves'][number];
  if (side.views !== 16 || typeof side.highTexturePath !== 'string' || !resources.has(side.highTexturePath) ||
      leaf.style.backgroundSize !== `${leaf.style.width} ${leaf.style.height}` || leaf.style.backgroundPosition !== '0px 0px' ||
      !Array.isArray(side.coefficients) || side.coefficients.length !== 16)
    throw new TypeError('Cylindrical side needs 16 uncropped atlas views and declared normal/bright textures.');
  for (const path of [leaf.texturePath, side.highTexturePath]) {
    const resource = resourceRecords.find(resource => resource.path === path);
    if (resource?.width !== 16 * leaf.widthPx || resource.height !== leaf.heightPx)
      throw new TypeError('Side atlas dimensions must contain exactly 16 frames in one row.');
  }
  const m = leaf.style.transform.slice(9, -1).split(',').map(Number);
  if (m[0] !== 1 || m[1] !== 0 || m[2] !== 0 || m[4] !== 0 || m[5] !== 0 || m[6] !== -1 ||
      m[3] !== 0 || m[7] !== 0 || m[11] !== 0 || m[15] !== 1 ||
      Math.abs((m[12]! + Number.parseFloat(leaf.style.width) / 2) / 50 - leaf.centerUnits[1]) > 1e-6 ||
      Math.abs((m[14]! - Number.parseFloat(leaf.style.height) / 2) / 50 - leaf.centerUnits[2]) > 1e-6 ||
      Math.abs(m[13]! / 50 - (frame.boundsUnits.min[0] + frame.boundsUnits.max[0]) / 2) > 1e-6 ||
      !leaf.centerUnits.every((value, i) => Math.abs(value - (frame.boundsUnits.min[i]! + frame.boundsUnits.max[i]!) / 2) < 1e-6))
    throw new TypeError('Cylindrical side must contain the central vertical axis with a horizontal first column.');
  for (const samples of side.coefficients) {
    if (!Array.isArray(samples) || samples.length < 2 || samples.length > 181) throw new TypeError('Missing side elevation coefficients.');
    let previous = -1;
    for (const sample of samples) {
      if (!Array.isArray(sample) || sample.length !== 3 || !sample.every(value => typeof value === 'number' && Number.isFinite(value)) ||
          sample[0] <= previous || sample[0] < 0 || sample[0] > 90 || sample.slice(1).some(value => value < 0 || value > 1))
        throw new TypeError('Side coefficients need increasing elevations and bounded opacities.');
      previous = sample[0];
    }
    if (samples[0][0] !== 0 || samples.at(-1)[0] !== 90) throw new TypeError('Side coefficients must span 0 to 90 degrees.');
  }
  return bank as unknown as NonNullable<PreparedCssVolume['farPlanes']>;
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
  exactKeys(style, ['width', 'height', 'transform', 'backgroundSize', 'backgroundPosition',
    ...(Object.hasOwn(style, 'backfaceVisibility') ? ['backfaceVisibility'] : [])], 'volume leaf style');
  if (Object.hasOwn(style, 'backfaceVisibility') && style.backfaceVisibility !== 'hidden')
    throw new TypeError('A directional volume face must hide its backface.');
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
