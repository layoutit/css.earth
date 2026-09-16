import type { Point } from './model';
import type { StructureImage } from './structures-model';

import type {GeometryCandidate,GeometryMap} from '@cssearth/nebula-reconstruction/evidence/geometry/contracts';
export type {GeometryCandidate,GeometryMap} from '@cssearth/nebula-reconstruction/evidence/geometry/contracts';
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const unit = (value: unknown): value is number => finite(value) && value >= 0 && value <= 1;
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const point = (value: unknown): value is Point => Array.isArray(value) && value.length === 2 && value.every(finite);

/** Independent file identity is checked before this source/map association boundary. */
export function readGeometryMap(value: unknown, image: StructureImage): GeometryMap {
  if (!record(value) || value.schema !== 'cssearth-observation-geometry@1' || value.imageId !== image.id ||
      value.sourceSha256 !== image.sourceSha256 || value.mapSha256 !== image.mapSha256 || value.width !== image.width || value.height !== image.height)
    throw new Error('Prepared shapes do not match their registered source and structure map.');
  if (!Array.isArray(value.candidates) || !Array.isArray(value.groups)) throw new Error('Invalid prepared shape lists.');
  const candidates = value.candidates.map((item: unknown): GeometryCandidate => {
    if (!record(item) || !text(item.id) || !point(item.center) || !point(item.radii) || item.radii[0] < item.radii[1] || item.radii[1] <= 0 ||
        !finite(item.angleRadians) || !unit(item.score) || !unit(item.coverage) || !Array.isArray(item.supportedArcs) ||
        (item.groupId !== undefined && !text(item.groupId))) throw new Error('Invalid prepared ellipse.');
    const supportedArcs = item.supportedArcs.map((arc: unknown) => {
      if (!record(arc) || !finite(arc.startRadians) || !finite(arc.endRadians) || arc.startRadians < 0 || arc.endRadians > 2 * Math.PI + 1e-10 ||
          arc.startRadians >= arc.endRadians) throw new Error('Invalid supported ellipse arc.');
      return { startRadians: arc.startRadians, endRadians: arc.endRadians };
    });
    for (let index = 1; index < supportedArcs.length; index++)
      if (supportedArcs[index]!.startRadians < supportedArcs[index - 1]!.endRadians) throw new Error('Overlapping or unordered ellipse arcs.');
    return { id: item.id, center: item.center, radii: item.radii, angleRadians: item.angleRadians, score: item.score, coverage: item.coverage,
      supportedArcs, ...(item.groupId === undefined ? {} : { groupId: item.groupId }) };
  });
  const groups = value.groups.map((item: unknown) => {
    if (!record(item) || !text(item.id) || !point(item.center) || !Array.isArray(item.members) || !item.members.every(text) ||
        item.members.length < 2 || new Set(item.members).size !== item.members.length) throw new Error('Invalid ellipse symmetry group.');
    return { id: item.id, center: item.center, members: item.members };
  });
  const ids = new Set(candidates.map(item => item.id)), groupIds = new Set(groups.map(item => item.id));
  if (ids.size !== candidates.length || groupIds.size !== groups.length ||
      candidates.some(item => item.groupId !== undefined && !groups.some(group => group.id === item.groupId && group.members.includes(item.id))) ||
      groups.some(group => group.members.some(id => !candidates.some(item => item.id === id && item.groupId === group.id))))
    throw new Error('Invalid shape identity or symmetry membership.');
  return { width: image.width, height: image.height, candidates, groups };
}

/** SVG decoding of prepared ellipse parameters; this does not fit or extract geometry. */
export function ellipseArcPath(radii: Point, start: number, end: number): string {
  const [rx, ry] = radii, middle = (start + end) / 2;
  const at = (angle: number) => `${rx * Math.cos(angle)} ${ry * Math.sin(angle)}`;
  // Two arcs also represent complete circles (a single SVG arc cannot close on itself).
  return `M ${at(start)} A ${rx} ${ry} 0 0 1 ${at(middle)} A ${rx} ${ry} 0 0 1 ${at(end)}`;
}
