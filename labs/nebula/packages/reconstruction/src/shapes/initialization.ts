/** Source-pixel shape controls. Detection seeds the model; authored depth is never a measurement. */
import type { GeometryCandidate, GeometryMap } from '../evidence/geometry/contracts.ts';
import { ellipsePoint, radialError } from '@cssearth/nebula-reconstruction/evidence/geometry/ellipse';
import type { ShapeCloudComponent, ShapeCloudSettings } from '@cssearth/bake/volume';

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 120;
function bounded(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw new TypeError(`Shape cloud ${name} must be between ${min} and ${max}.`);
  return value;
}
function dimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 1_000_000)
    throw new TypeError('Shape cloud requires a complete working image up to one million pixels.');
}
export function readShapeCloudSettings(value: unknown, width: number, height: number): ShapeCloudSettings {
  dimensions(width, height);
  if (!record(value) || Object.keys(value).some(key => key !== 'components' && key !== 'exposure') ||
      !Array.isArray(value.components) || value.components.length > 32) throw new TypeError('Invalid bounded shape cloud settings.');
  const keys = ['id', 'label', 'memberIds', 'groupId', 'x', 'y', 'radiusX', 'radiusY', 'rotationDegrees', 'weight', 'thickness', 'softness', 'depth', 'enabled', 'shape', 'operation', 'arcCenterDegrees', 'arcSweepDegrees'];
  const maximum = Math.max(width, height);
  const components = value.components.map((item: unknown): ShapeCloudComponent => {
    if (!record(item) || Object.keys(item).some(key => !keys.includes(key)) || !text(item.id) || !text(item.label) || !text(item.groupId) ||
        !Array.isArray(item.memberIds) || !item.memberIds.length || item.memberIds.length > 32 || !item.memberIds.every(text) ||
        new Set(item.memberIds).size !== item.memberIds.length || typeof item.enabled !== 'boolean') throw new TypeError('Invalid shape cloud component.');
    const shape = item.shape === undefined ? 'shell' : item.shape, operation = item.operation === undefined ? 'add' : item.operation;
    if ((shape !== 'shell' && shape !== 'ring' && shape !== 'ellipsoid') ||
        (operation !== 'add' && operation !== 'subtract')) throw new TypeError('Unknown shape primitive or operation.');
    return { id: item.id, label: item.label, groupId: item.groupId, memberIds: [...item.memberIds], enabled: item.enabled, shape, operation,
      ...(item.arcCenterDegrees === undefined ? {} : { arcCenterDegrees: bounded(item.arcCenterDegrees, 'arc center', -360, 360) }),
      ...(item.arcSweepDegrees === undefined ? {} : { arcSweepDegrees: bounded(item.arcSweepDegrees, 'arc sweep', 1, 360) }),
      x: bounded(item.x, 'x', -width, 2 * width), y: bounded(item.y, 'y', -height, 2 * height),
      radiusX: bounded(item.radiusX, 'radius X', 2, maximum * 2), radiusY: bounded(item.radiusY, 'radius Y', 2, maximum * 2),
      rotationDegrees: bounded(item.rotationDegrees, 'rotation', -360, 360), weight: bounded(item.weight, 'weight', 0, 5),
      thickness: bounded(item.thickness, 'thickness', .01, .8), softness: bounded(item.softness, 'softness', .005, .5),
      depth: bounded(item.depth, 'depth', .05, 2) };
  });
  if (new Set(components.map(component => component.id)).size !== components.length ||
      new Set(components.flatMap(component => component.memberIds)).size !== components.reduce((sum, component) => sum + component.memberIds.length, 0))
    throw new TypeError('Shape cloud components and detected members must have unique ownership.');
  return { exposure: bounded(value.exposure, 'exposure', .05, 5), components };
}

/** Complete-link merging prevents a chain of adjacent contours from swallowing distinct concentric shells. */
function sameBoundary(a: GeometryCandidate, b: GeometryCandidate): boolean {
  const minor = Math.min(a.radii[1], b.radii[1]);
  if (Math.hypot(a.center[0] - b.center[0], a.center[1] - b.center[1]) > minor * .18 ||
      a.radii.some((radius, index) => Math.abs(radius - b.radii[index]!) > Math.min(radius, b.radii[index]!) * .22)) return false;
  let error = 0;
  for (let index = 0; index < 32; index++) {
    const angle = index * Math.PI / 16;
    error += radialError(a, ellipsePoint(b, angle)) + radialError(b, ellipsePoint(a, angle));
  }
  return error / 64 < Math.max(2, minor * .16);
}

export function initializeShapeCloud(geometry: GeometryMap): ShapeCloudSettings {
  dimensions(geometry.width, geometry.height);
  const groups: GeometryCandidate[][] = [];
  for (const candidate of [...geometry.candidates].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))) {
    const group = groups.find(members => members.every(member => sameBoundary(member, candidate)));
    if (group) group.push(candidate); else groups.push([candidate]);
  }
  const components = groups.slice(0, 32).map((members, index): ShapeCloudComponent => {
    const total = members.reduce((sum, member) => sum + Math.max(.001, member.score), 0);
    const mean = (sample: (member: GeometryCandidate) => number) => members.reduce((sum, member) => sum + sample(member) * Math.max(.001, member.score) / total, 0);
    const angle = Math.atan2(mean(member => Math.sin(2 * member.angleRadians)), mean(member => Math.cos(2 * member.angleRadians))) / 2;
    const groupId = members.find(member => member.groupId)?.groupId ?? `single-${index + 1}`;
    return { id: `shape-${index + 1}`, label: `Shape ${index + 1}`, memberIds: members.map(member => member.id), groupId, shape: 'shell', operation: 'add',
      x: mean(member => member.center[0]), y: mean(member => member.center[1]),
      radiusX: mean(member => member.radii[0]), radiusY: mean(member => member.radii[1]), rotationDegrees: angle * 180 / Math.PI,
      weight: 1, thickness: .12, softness: .08, depth: .65, enabled: true };
  });
  return readShapeCloudSettings({ exposure: .8, components }, geometry.width, geometry.height);
}
