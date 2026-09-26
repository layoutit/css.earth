import { invertPreparedAffineMatrix4, transformPreparedPoint } from '@cssearth/core';
import { walkSilhouetteLevels } from './prepared-silhouette-steps.js';
import type { PhysicalProjection } from '../prepared-data/physical-projection.js';

type Vector3 = readonly [number, number, number];
/** Where the faces behind each texture write sit, measured on the prepared scene at rest, in scene coordinates. */
export interface PreparedTexturePlacements {
  body: { center: Vector3; radius: number };
  /** Keyed by the texture write's CSS name: the bounding sphere of its faces, their mean outward direction, and the
   * largest angle between that direction and any face corner's. */
  writes: Readonly<Record<string, { center: Vector3; radius: number; normal: Vector3; spread: number }>>;
}

/** Prepared addresses for one dataset; all levels share its retained geometry
 * and atlas coordinate system. Thresholds are CSS silhouette pixels, never DPR. */
export interface PreparedTextureLevels {
  hysteresis: number;
  fixedLevel?: number;
  /** `tiles`: at a small level every page of a bank is one tile of a shared sheet (paged-ellipsoid texture-levels.mts). */
  levels: readonly { minimumDiameter: number; resources: Readonly<Record<string, string>>; tiles?: Readonly<Record<string, PreparedTextureTile>> }[];
  /** A write whose faces are off screen or behind the body keeps the first level: sharper texels there are never seen,
   * and a browser decodes a whole image to draw any of it. */
  placements?: PreparedTexturePlacements;
}

/** Where a page sits in the sheet its level shares with the bank's other pages, in the page's own CSS atlas units: the
 * tile's offset, and the sheet's width over the page's. */
export interface PreparedTextureTile { x: number; y: number; scale: number }

/** The page textures some level draws from a sheet. Their writes carry the tile beside the image, at every level. */
export function tiledTextureKeys(levels: PreparedTextureLevels | undefined): Set<string> {
  return new Set(levels?.levels.flatMap(level => Object.keys(level.tiles ?? {})) ?? []);
}

/** The custom properties a tiled page's leaves read beside its image (paged-ellipsoid scene.mts): the tile's offset and
 * scale, or the page's own (no offset, scale 1) when the level draws the page itself. */
export function textureTileStyles(name: string, tile: PreparedTextureTile | undefined): readonly (readonly [string, string])[] {
  return [[`${name}-x`, `${-(tile?.x ?? 0)}px`], [`${name}-y`, `${-(tile?.y ?? 0)}px`], [`${name}-scale`, String(tile?.scale ?? 1)]];
}

/** Faces within this share of the larger viewport side beyond its edge, or this far past the horizon, count as seen,
 * so a page is sharp before it pans or turns into view. */
const SCREEN_MARGIN = 0.25, HORIZON_MARGIN_RADIANS = 0.1;

/** The texture writes whose faces the camera cannot see. */
export function unseenTextureWrites(placements: PreparedTexturePlacements, projection: PhysicalProjection,
  viewport: { width: number; height: number }): Set<string> {
  const unseen = new Set<string>();
  const sceneFromEye = invertPreparedAffineMatrix4(projection.eyeFromScene);
  const eye = [sceneFromEye[12]!, sceneFromEye[13]!, sceneFromEye[14]!];
  const toEye = eye.map((value, axis) => value - placements.body.center[axis]!), distance = Math.hypot(...toEye);
  // Inside the body every face may be seen.
  if (!(distance > placements.body.radius)) return unseen;
  const horizon = Math.acos(placements.body.radius / distance);
  const margin = SCREEN_MARGIN * Math.max(viewport.width, viewport.height), halfWidth = viewport.width / 2 + margin, halfHeight = viewport.height / 2 + margin;
  const [px, py] = projection.principalOffsetPixels;
  // The eye transform carries the scene's scale; placement radii are scene units.
  const scale = Math.hypot(projection.eyeFromScene[0], projection.eyeFromScene[1], projection.eyeFromScene[2]);
  for (const [name, write] of Object.entries(placements.writes)) {
    const facing = write.normal.reduce((sum, value, axis) => sum + value * toEye[axis]! / distance, 0);
    if (Math.acos(Math.max(-1, Math.min(1, facing))) > horizon + write.spread + HORIZON_MARGIN_RADIANS) { unseen.add(name); continue; }
    const centre = transformPreparedPoint(projection.eyeFromScene, write.center[0], write.center[1], write.center[2], 1);
    const depth = -centre.z, radius = write.radius * scale;
    // A sphere reaching the camera plane may cover any part of the screen.
    if (!(depth > radius)) continue;
    const x = px + projection.focalPixels * centre.x / depth, y = py + projection.focalPixels * centre.y / depth;
    const reach = projection.focalPixels * radius / (depth - radius);
    if (x + reach < -halfWidth || x - reach > halfWidth || y + reach < -halfHeight || y - reach > halfHeight) unseen.add(name);
  }
  return unseen;
}

export function selectPreparedTextureLevel(levels: PreparedTextureLevels, diameter: number | null | undefined,
  previous: number | undefined, initial = false): number {
  // The first pass matches the prepared bank the page already shows, so readiness never waits for refinement.
  if (initial) return 0;
  if (levels.fixedLevel !== undefined) return levels.fixedLevel;
  // An unavailable projection cannot justify substituting lower detail.
  if (diameter == null || !Number.isFinite(diameter)) return levels.levels.length - 1;
  return walkSilhouetteLevels(levels.levels, levels.hysteresis, diameter, previous);
}
