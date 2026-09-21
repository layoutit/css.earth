import { projectVolumeSphere } from './projected-volume-visibility.js';
import type { PreparedCssVolume, PreparedVolumeImpostors, VolumeCameraPublication, VolumeVector } from './types.js';

type View = PreparedVolumeImpostors['views'][number];
export interface VolumeImpostorProjection {
  readonly x: number;
  readonly y: number;
  readonly diameterPixels: number;
  readonly volumeMix: number;
  readonly visible: boolean;
  readonly views: readonly { readonly id: string; readonly weight: number; readonly matrix: readonly [number, number, number, number] }[];
}

/** Project a prepared bounding sphere through the same physical camera as the full volume. */
export function projectVolumeImpostors(publication: VolumeCameraPublication, frame: PreparedCssVolume['frame'], bank: PreparedVolumeImpostors, includeFullViews = false): VolumeImpostorProjection {
  const { world, viewport } = publication;
  if (world.referenceFrame !== frame.referenceFrame || world.epochJdTt !== frame.epochJdTt) throw new TypeError('Volume impostor camera frame and epoch differ.');
  if (!(viewport.focalPixels > 0) || !Number.isFinite(viewport.focalPixels) || !viewport.principalOffsetPixels.every(Number.isFinite)) {
    throw new TypeError('Volume impostor camera viewport is invalid.');
  }
  const radius = bank.radiusUnits;
  const { local, right, down, back, depth, distance, x, y, inside, visible } = projectVolumeSphere(world, viewport, frame, radius);
  // In front of the sphere the projected size is unchanged; beside or behind it the tangent-cone size replaces the
  // old infinite answer, so an off-axis cloud never switches to its full volume. Inside it the full volume draws and
  // its physical leaf frustum does the culling.
  const diameterPixels = inside ? Number.POSITIVE_INFINITY
    : 2 * radius * viewport.focalPixels / (depth > radius ? depth : Math.sqrt(distance * distance - radius * radius));
  const volumeMix = smooth((diameterPixels - bank.fullBelowDiameterPixels) / (bank.volumeAboveDiameterPixels - bank.fullBelowDiameterPixels));
  // A baked view shows the volume from a direction, so the view follows where the camera is, not where it looks:
  // turning in place keeps the same views and only rotates their images.
  const toViewer: VolumeVector = distance > 0
    ? [local.positionUnits[0] / distance, local.positionUnits[1] / distance, local.positionUnits[2] / distance] : back;
  return { x, y, diameterPixels, volumeMix, visible,
    views: visible && (volumeMix < 1 || includeFullViews) ? selectImpostorViews(bank.views, toViewer).map(({ view, weight }) => {
      const imageRight = transport(view.right, view.back, toViewer), imageDown = transport(view.down, view.back, toViewer);
      return { id: view.id, weight, matrix: [dot(imageRight, right), dot(imageRight, down), dot(imageDown, right), dot(imageDown, down)] };
    }) : [] };
}

/** Compact nearest-view interpolation: the fourth neighbour has zero weight, so entering/leaving views do not pop. */
export function selectImpostorViews(views: readonly View[], back: VolumeVector): readonly { view: View; weight: number }[] {
  const nearest = views.map(view => ({ view, distance: Math.max(0, 1 - dot(view.back, back)) }))
    .sort((a, b) => a.distance - b.distance || a.view.id.localeCompare(b.view.id)).slice(0, 4);
  if (nearest[0]!.distance < 1e-10) return [{ view: nearest[0]!.view, weight: 1 }];
  const cutoff = nearest[3]!.distance;
  const weighted = nearest.slice(0, 3).map(({ view, distance }) => ({ view, weight: Math.max(0, 1 / Math.max(1e-10, distance) - 1 / Math.max(1e-10, cutoff)) ** 2 }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  // Exact equal-distance directions are rare with the prepared 26-view lattice.
  if (total < 1e-20) return [{ view: nearest[0]!.view, weight: 1 }];
  return weighted.filter(entry => entry.weight > 0).map(entry => ({ ...entry, weight: entry.weight / total }));
}

/** Shortest-arc transport preserves each baked view's roll, including at the polar views. */
function transport(vector: VolumeVector, from: VolumeVector, to: VolumeVector): VolumeVector {
  const axis = cross(from, to), first = cross(axis, vector), second = cross(axis, first);
  const divisor = 1 + dot(from, to);
  return [vector[0] + first[0] + second[0] / divisor,
    vector[1] + first[1] + second[1] / divisor, vector[2] + first[2] + second[2] / divisor];
}
function smooth(t: number): number { const value = Math.max(0, Math.min(1, t)); return value * value * (3 - 2 * value); }
function dot(a: VolumeVector, b: VolumeVector): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a: VolumeVector, b: VolumeVector): VolumeVector { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
