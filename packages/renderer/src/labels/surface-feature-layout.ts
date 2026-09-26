import { labelRectsOverlap } from './screen-label-layout.js';
import type { LabelScreenRect } from './screen-label-layout.js';
import type { SurfaceFeatureKind, SurfaceFeaturePolicy, SurfaceFeatureOutline } from './surface-feature-types.js';

/** Screen offset of a point label's text from its anchor dot, in CSS pixels. */
export const POINT_LABEL_GAP_PX = 8;
export const POINT_DOT_RADIUS_PX = 3;
const VIEWPORT_MARGIN_PX = 4;
const LIMB_FADE_WIDTH = 0.2;

export interface SurfaceFeatureAnchor {
  readonly anchorUnits: readonly [number, number, number]; readonly normal: readonly [number, number, number]; readonly radiusUnits: number;
}
export interface ProjectedSurfaceFeature { readonly x: number; readonly y: number; readonly facing: number; readonly diameterPx: number; }

/** Project one prepared anchor through the composed eye matrix (column-major, mesh units → CSS eye
 * space with +Z toward the eye). Facing is the cosine between the surface normal and the eye ray. */
export function projectSurfaceFeature(feature: SurfaceFeatureAnchor, m: ArrayLike<number>, focalPixels: number, principal: readonly number[]): ProjectedSurfaceFeature | null {
  const [ax, ay, az] = feature.anchorUnits, [nx, ny, nz] = feature.normal;
  const px = m[0]! * ax + m[4]! * ay + m[8]! * az + m[12]!;
  const py = m[1]! * ax + m[5]! * ay + m[9]! * az + m[13]!;
  const pz = m[2]! * ax + m[6]! * ay + m[10]! * az + m[14]!;
  if (!(pz < 0)) return null;
  const ex = m[0]! * nx + m[4]! * ny + m[8]! * nz;
  const ey = m[1]! * nx + m[5]! * ny + m[9]! * nz;
  const ez = m[2]! * nx + m[6]! * ny + m[10]! * nz;
  const normalLength = Math.hypot(ex, ey, ez), eyeDistance = Math.hypot(px, py, pz);
  if (!(normalLength > 0) || !(eyeDistance > 0)) return null;
  const facing = -(ex * px + ey * py + ez * pz) / (normalLength * eyeDistance);
  const scale = Math.hypot(m[0]!, m[1]!, m[2]!);
  const depth = -pz;
  return { x: principal[0]! + focalPixels * px / depth, y: principal[1]! + focalPixels * py / depth,
    facing, diameterPx: 2 * feature.radiusUnits * scale * focalPixels / depth };
}

/** Where the camera sits in its logarithmic zoom range; the policy gates labels on this share. */
export function zoomShare(zoom: number, minimumZoom: number, maximumZoom: number): number {
  if (!(maximumZoom > minimumZoom) || !(minimumZoom > 0) || !(zoom > 0)) return 0;
  return Math.max(0, Math.min(1, Math.log(zoom / minimumZoom) / Math.log(maximumZoom / minimumZoom)));
}
export function passesZoomGate(zoom: number | undefined, minimumZoom: number, maximumZoom: number, policy: SurfaceFeaturePolicy): boolean {
  if (policy.minimumZoomShare <= 0) return true;
  if (zoom === undefined) return false;
  return zoomShare(zoom, minimumZoom, maximumZoom) >= policy.minimumZoomShare - 1e-6;
}

/** Project the prepared outline as screen chords. Only chords whose both ends face the eye
 * are kept, so the outline stops at the limb instead of wrapping behind the body. */
export function projectSurfaceOutline(outline: SurfaceFeatureOutline, m: ArrayLike<number>, focalPixels: number, principal: readonly number[], pieces: number): (readonly [number, number, number, number])[] {
  if (outline.kind === 'trace') {
    const chords: (readonly [number, number, number, number])[] = [];
    for (const path of outline.paths) {
      let previous: readonly [number, number] | null = null;
      for (const vertex of path) {
        const projected = projectSurfaceFeature({ anchorUnits: vertex, normal: vertex, radiusUnits: 0 }, m, focalPixels, principal);
        const point = projected && projected.facing > 0 ? [projected.x, projected.y] as const : null;
        if (previous && point && chords.length < pieces) chords.push([previous[0], previous[1], point[0], point[1]]);
        previous = point;
      }
    }
    return chords;
  }
  const vertices: (readonly [number, number, number])[] = [];
  if (outline.kind === 'circle') {
    for (let index = 0; index < pieces; index++) {
      const phi = index / pieces * 2 * Math.PI, c = Math.cos(phi), s = Math.sin(phi);
      vertices.push([outline.center[0] + outline.east[0] * c + outline.north[0] * s, outline.center[1] + outline.east[1] * c + outline.north[1] * s, outline.center[2] + outline.east[2] * c + outline.north[2] * s]);
    }
  } else for (const point of outline.points.slice(0, pieces)) vertices.push(point);
  const points = vertices.map(vertex => {
    const projected = projectSurfaceFeature({ anchorUnits: vertex, normal: vertex, radiusUnits: 0 }, m, focalPixels, principal);
    return projected && projected.facing > 0 ? [projected.x, projected.y] as const : null;
  });
  const chords: (readonly [number, number, number, number])[] = [];
  for (let index = 0; index < points.length; index++) {
    const start = points[index], end = points[(index + 1) % points.length];
    if (start && end) chords.push([start[0], start[1], end[0], end[1]]);
  }
  return chords;
}

export function surfaceLabelRect(kind: SurfaceFeatureKind, projected: ProjectedSurfaceFeature, width: number, height: number): LabelScreenRect {
  if (kind === 'point') {
    return { left: projected.x - POINT_DOT_RADIUS_PX, top: projected.y - height / 2, right: projected.x + POINT_LABEL_GAP_PX + width, bottom: projected.y + height / 2 };
  }
  return { left: projected.x - width / 2, top: projected.y - height / 2, right: projected.x + width / 2, bottom: projected.y + height / 2 };
}

/** Opacity from the limb geometry: labels fade out before the surface turns away. */
export function surfaceLabelOpacity(facing: number, policy: SurfaceFeaturePolicy): number {
  const t = Math.max(0, Math.min(1, (facing - policy.limbCosine) / LIMB_FADE_WIDTH));
  return t * t * (3 - 2 * t);
}

export interface SurfaceLabelCandidate {
  readonly index: number; readonly kind: SurfaceFeatureKind; readonly projected: ProjectedSurfaceFeature; readonly width: number; readonly height: number;
}
export interface AdmittedSurfaceLabel { readonly index: number; readonly rect: LabelScreenRect; readonly opacity: number; }

/** Admit labels in prepared priority order, keeping last frame's labels ahead of newcomers
 * so a spinning body does not flicker at overlap boundaries. */
export function admitSurfaceFeatureLabels(candidates: readonly SurfaceLabelCandidate[], policy: SurfaceFeaturePolicy,
  viewport: { readonly width: number; readonly height: number }, previous: ReadonlySet<number>, blockers: readonly LabelScreenRect[] = [], pinned: number | null = null): { readonly accepted: readonly AdmittedSurfaceLabel[]; readonly eligible: number } {
  const halfWidth = viewport.width / 2, halfHeight = viewport.height / 2;
  const eligible: (SurfaceLabelCandidate & { rect: LabelScreenRect; rank: number })[] = [];
  candidates.forEach((candidate, rank) => {
    const { projected } = candidate;
    if (!(projected.facing > policy.limbCosine)) return;
    // A name without a published size (diameter 0) has no pixel size to gate on: it competes for the remaining slots in
    // its prepared rank, after every sized feature, whenever the zoom gate is open.
    const unsized = projected.diameterPx === 0;
    if (!unsized && !(projected.diameterPx >= policy.minimumDiameterPixels) && rank >= policy.alwaysVisibleCount && candidate.index !== pinned) return;
    if (!(candidate.width > 0) || !(candidate.height > 0)) return;
    const rect = surfaceLabelRect(candidate.kind, projected, candidate.width, candidate.height);
    if (rect.left < -halfWidth + VIEWPORT_MARGIN_PX || rect.right > halfWidth - VIEWPORT_MARGIN_PX ||
        rect.top < -halfHeight + VIEWPORT_MARGIN_PX || rect.bottom > halfHeight - VIEWPORT_MARGIN_PX) return;
    eligible.push({ ...candidate, rect, rank });
  });
  const ordered = [...eligible.filter(item => item.index === pinned), ...eligible.filter(item => item.index !== pinned && previous.has(item.index)), ...eligible.filter(item => item.index !== pinned && !previous.has(item.index))];
  const accepted: AdmittedSurfaceLabel[] = [], occupied: LabelScreenRect[] = [...blockers];
  for (const item of ordered) {
    if (accepted.length >= policy.maximumVisible) break;
    if (occupied.some(rect => labelRectsOverlap(item.rect, rect))) continue;
    occupied.push(item.rect);
    accepted.push({ index: item.index, rect: item.rect, opacity: surfaceLabelOpacity(item.projected.facing, policy) });
  }
  return { accepted, eligible: eligible.length };
}
