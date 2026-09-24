import { validatePreparedLeafBounds } from '../rendering/prepared-leaf-frustum.js';
import { parseDensityVolumeFrame } from '@cssearth/objects';
import type { PreparedCssVolume, VolumeAxis, VolumeVector } from './types.js';
import { validatePreparedCssSky } from '../sky/validation.js';
import { validateVolumeImpostors } from './volume-impostor-validation.js';

const AXES: readonly VolumeAxis[] = ['x', 'y', 'z'];

export function validatePreparedCssVolume(input: unknown): PreparedCssVolume {
  const value = record(input, 'prepared CSS volume');
  exactKeys(value, ['schema', 'id', 'frame', 'anchors', 'stacks', 'resources', 'provenance', 'approximation', ...(Object.hasOwn(value, 'sky') ? ['sky'] : []), ...(Object.hasOwn(value, 'impostors') ? ['impostors'] : []), ...(Object.hasOwn(value, 'detailPlanes') ? ['detailPlanes'] : [])], 'prepared CSS volume');
  if (value.schema !== 'cssearth-css-volume@1' || typeof value.id !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(value.id)) {
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
    exactKeys(resource, ['path', 'sha256', 'bytes', 'width', 'height'], 'volume resource');
    if (!relativePath(resource.path) || resources.has(resource.path) || typeof resource.sha256 !== 'string' ||
        !/^[a-f0-9]{64}$/u.test(resource.sha256) || !positiveInteger(resource.bytes) ||
        !positiveInteger(resource.width) || !positiveInteger(resource.height)) {
      throw new TypeError('Prepared CSS volume resource metadata is invalid.');
    }
    resources.add(resource.path);
  }
  const leafIds = new Set<string>();
  for (const stackInput of stacks) validateStack(record(stackInput, 'volume stack'), resources, leafIds);
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
  if (value.detailPlanes !== undefined) validateStack({ axis: 'z', leaves: value.detailPlanes }, resources, leafIds);
  const frame = parseDensityVolumeFrame(value.frame);
  const impostors = Object.hasOwn(value, 'impostors') ? validateVolumeImpostors(value.impostors, resources) : undefined;
  if (value.detailPlanes !== undefined && !impostors) throw new TypeError('Fixed detail planes require a distant impostor bank.');
  const sky = Object.hasOwn(value, 'sky') ? validatePreparedCssSky(value.sky, resourcesInput as PreparedCssVolume['resources']) : undefined;
  if (sky && (sky.referenceFrame !== frame.referenceFrame || sky.epochJdTt !== frame.epochJdTt)) throw new TypeError('Prepared sky and volume must share their reference frame and epoch.');
  return { schema: value.schema, id: value.id, frame,
    ...(value.anchors === undefined ? {} : { anchors: value.anchors as PreparedCssVolume['anchors'] }),
    stacks: stacks as PreparedCssVolume['stacks'], resources: resourcesInput as PreparedCssVolume['resources'],
    provenance: value.provenance, approximation: value.approximation, ...(sky ? { sky } : {}), ...(impostors ? { impostors } : {}), ...(value.detailPlanes ? { detailPlanes: value.detailPlanes as PreparedCssVolume['detailPlanes'] } : {}) };
}

function validateStack(stack: Record<string, unknown>, resources: Set<string>, leafIds: Set<string>): void {
  exactKeys(stack, ['axis', 'leaves', ...(Object.hasOwn(stack, 'normalUnits') ? ['normalUnits'] : [])], 'volume stack');
  if (!isAxis(stack.axis) || !Array.isArray(stack.leaves) || stack.leaves.length === 0) {
    throw new TypeError('Prepared CSS volume stack is invalid.');
  }
  if (stack.normalUnits !== undefined && (!finiteVector(stack.normalUnits) || Math.abs(Math.hypot(...stack.normalUnits) - 1) > 1e-8))
    throw new TypeError('Volume stack normal must be a finite unit vector.');
  for (const leafInput of stack.leaves) {
    const leaf = record(leafInput, 'volume leaf');
    exactKeys(leaf, ['id', 'centerUnits', 'texturePath', 'widthPx', 'heightPx', 'style', ...(Object.hasOwn(leaf, 'boundsCssPixels') ? ['boundsCssPixels'] : [])], 'volume leaf');
    if (leaf.boundsCssPixels !== undefined) validatePreparedLeafBounds(leaf.boundsCssPixels);
    if (typeof leaf.id !== 'string' || !leaf.id || leafIds.has(leaf.id) || typeof leaf.texturePath !== 'string' ||
        !resources.has(leaf.texturePath) || !positiveInteger(leaf.widthPx) || !positiveInteger(leaf.heightPx) ||
        !finiteVector(leaf.centerUnits)) throw new TypeError('Prepared CSS volume leaf metadata is invalid.');
    validateStyle(record(leaf.style, 'volume leaf style'));
    leafIds.add(leaf.id);
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
