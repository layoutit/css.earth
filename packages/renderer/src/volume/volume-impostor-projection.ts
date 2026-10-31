import { cross3 as cross, dot3 as dot } from '@cssearth/core';
import { projectVolumeSphere } from './projected-volume-visibility.js';
import type { VolumeCameraPublication } from './types.js';
import type { PreparedCssVolume, PreparedVolumeImpostors, VolumeVector } from '@cssearth/objects';

type View = PreparedVolumeImpostors['views'][number];
export interface VolumeImpostorProjection {
  readonly x: number;
  readonly y: number;
  readonly diameterPixels: number;
  readonly volumeMix: number;
  readonly distanceMix: number;
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
  const distanceMix=bank.distanceFade?smooth((bank.distanceFade.impostorAboveUnits-distance)/(bank.distanceFade.impostorAboveUnits-bank.distanceFade.detailBelowUnits)):1,volumeMix = distanceMix*smooth((diameterPixels - bank.fullBelowDiameterPixels) / (bank.volumeAboveDiameterPixels - bank.fullBelowDiameterPixels));
  // A baked view shows the volume from a direction, so the view follows where the camera is, not where it looks:
  // turning in place keeps the same views and only rotates their images.
  const toViewer: VolumeVector = distance > 0
    ? [local.positionUnits[0] / distance, local.positionUnits[1] / distance, local.positionUnits[2] / distance] : back;
  return { x, y, diameterPixels, volumeMix, distanceMix, visible,
    views: visible && (volumeMix < 1 || includeFullViews) ? (bank.discPlane ? discViews(bank, toViewer) : selectImpostorViews(bank.views, toViewer)).map(({ view, weight }) => {
      const onDisc = bank.discPlane && discMatrix(bank.discPlane, view, right, down);
      if (onDisc) return { id: view.id, weight, matrix: onDisc };
      const imageRight = transport(view.right, view.back, toViewer), imageDown = transport(view.down, view.back, toViewer);
      return { id: view.id, weight, matrix: [dot(imageRight, right), dot(imageRight, down), dot(imageDown, right), dot(imageDown, down)] };
    }) : [] };
}

/** How open a picture must be, as the sine of its elevation above the disc, before its disc can be laid on the camera's view. */
const OPEN_PICTURE = .3;
/** Pictures that see the disc edge-on hold nothing to lay on it: they carry only views along the disc, and fade out between these sines. */
const EDGE_VIEWS_LEAVE = [.22, .5] as const;
const discNormal = (plane: NonNullable<PreparedVolumeImpostors['discPlane']>) => cross(plane.right, plane.up);
function discViews(bank: PreparedVolumeImpostors, toViewer: VolumeVector) {
  const normal = discNormal(bank.discPlane!), edge = smooth((EDGE_VIEWS_LEAVE[1] - Math.abs(dot(normal, toViewer))) / (EDGE_VIEWS_LEAVE[1] - EDGE_VIEWS_LEAVE[0]));
  const open = (view: View) => Math.abs(dot(normal, view.back)) >= OPEN_PICTURE;
  const sides = selectImpostorViews(bank.views, toViewer).filter(entry => !open(entry.view)).map(entry => ({ ...entry, weight: entry.weight * edge }));
  const left = 1 - sides.reduce((sum, entry) => sum + entry.weight, 0);
  // What the edge-on pictures give up goes to the open pictures alone, so a weight follows the camera without a step.
  return [...sides, ...selectImpostorViews(bank.views.filter(open), toViewer).map(entry => ({ ...entry, weight: entry.weight * left }))].filter(entry => entry.weight > 0);
}
/** The picture's axes on screen such that every point of the disc plane lands where the camera sees it. Null for an edge-on picture. */
function discMatrix(plane: NonNullable<PreparedVolumeImpostors['discPlane']>, view: View, right: VolumeVector, down: VolumeVector): readonly [number, number, number, number] | null {
  if (Math.abs(dot(discNormal(plane), view.back)) < OPEN_PICTURE) return null;
  const a = dot(plane.right, view.right), b = dot(plane.up, view.right), c = dot(plane.right, view.down), d = dot(plane.up, view.down), det = a * d - b * c;
  const p = dot(plane.right, right), q = dot(plane.up, right), r = dot(plane.right, down), s = dot(plane.up, down);
  // Screen = [p q; r s] · disc, picture = [a b; c d] · disc, so screen = [p q; r s] · [a b; c d]⁻¹ · picture.
  return [(p * d - q * c) / det, (r * d - s * c) / det, (q * a - p * b) / det, (s * a - r * b) / det];
}

/** Compact nearest-view interpolation: the fourth neighbour has zero weight, so entering/leaving views do not pop. */
export function selectImpostorViews(views: readonly View[], back: VolumeVector): readonly { view: View; weight: number }[] {
  const nearest = views.map(view => ({ view, distance: Math.max(0, 1 - dot(view.back, back)) }))
    .sort((a, b) => a.distance - b.distance || a.view.id.localeCompare(b.view.id)).slice(0, 4);
  // A single view (a distant billboard) is the whole image from every direction.
  if (nearest.length === 1 || nearest[0]!.distance < 1e-10) return [{ view: nearest[0]!.view, weight: 1 }];
  const cutoff = nearest[3]?.distance ?? Number.POSITIVE_INFINITY;
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
