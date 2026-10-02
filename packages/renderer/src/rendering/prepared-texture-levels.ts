import { type PreparedTexturePlacements, type PreparedTextureLevels, type PreparedTextureTile, type PreparedTextureTileLeaves } from '@cssearth/objects';

import { invertPreparedAffineMatrix4, transformPreparedPoint } from '@cssearth/core';
import { walkSilhouetteLevels } from './prepared-silhouette-steps.js';
import type { PhysicalProjection } from '../prepared-data/physical-projection.js';

type Vector3 = readonly [number, number, number];
/** Where the faces behind each texture write sit, measured on the prepared scene at rest, in scene coordinates. */

/** Prepared addresses for one dataset; all levels share its retained geometry
 * and atlas coordinate system. Thresholds are CSS silhouette pixels, never DPR. */

/** Where a page sits in the sheet its level shares with the bank's other pages, in the page's own CSS atlas units: the
 * tile's offset, and the sheet's width over the page's. */

/** The page textures some level draws from a sheet. Their writes carry the tile beside the image, at every level. */
export function tiledTextureKeys(levels: PreparedTextureLevels | undefined): Set<string> {
  return new Set(levels?.levels.flatMap(level => Object.keys(level.tiles ?? {})) ?? []);
}

/** The leaves of one texture write that draw its page from wherever the level puts it: the page itself, or a tile of a
 * sheet. Each leaf's background is `unit × tile offset − its own offset` and `width × tile scale` wide, so a level switch
 * writes every leaf's final values; no custom property or `calc()` reaches the page. */

const format = (value: number) => String(Math.round(value * 1e6) / 1e6);

/** A tiled page leaf's final background position and size for a tile, or for the page itself when the level draws it. */
export function textureTileLeafStyles(group: Pick<PreparedTextureTileLeaves, 'unit' | 'width'>, x: number, y: number,
  tile: PreparedTextureTile | undefined): [[ 'backgroundPosition', string ], [ 'backgroundSize', string ]] {
  const { x: tileX = 0, y: tileY = 0, scale = 1 } = tile ?? {};
  return [['backgroundPosition', `${format(group.unit * tileX - x)}px ${format(group.unit * tileY - y)}px`],
    ['backgroundSize', `${format(group.width * scale)}px auto`]];
}

/** The tile leaf groups by texture write (`target:name`). */
export function textureTileGroups(levels: PreparedTextureLevels | undefined) {
  return new Map((levels?.tileLeaves ?? []).map(group => [`${group.target}:${group.name}`, group] as const));
}

/** Owns the background placement of every tiled page leaf of one mounted tree. A texture write publishes its tile on its
 * leaves; each leaf keeps what it last wrote, so an unchanged value is never written again. The first write compares
 * with the leaf's inline style, which the prepared tree or server markup already set. */
export function createTextureTileWriter(levels: PreparedTextureLevels | undefined, nodes: readonly HTMLElement[],
  write: (element: HTMLElement, name: string, value: string) => void) {
  const groups = textureTileGroups(levels);
  const written = new Map<HTMLElement, Map<string, string>>();
  const cssName = (name: string) => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
  return {
    has: (target: number, name: string) => groups.has(`${target}:${name}`),
    /** Writes the write's tile on its leaves; returns the number of style writes. */
    publish(target: number, name: string, tile: PreparedTextureTile | undefined) {
      const group = groups.get(`${target}:${name}`);
      if (!group) return 0;
      let writes = 0;
      for (const [node, x, y] of group.leaves) {
        const element = nodes[node];
        if (!element) throw new TypeError(`Prepared texture tile leaf ${node} of ${name} on node ${target} is not in the tree.`);
        let own = written.get(element);
        if (!own) written.set(element, own = new Map());
        for (const [property, value] of textureTileLeafStyles(group, x, y, tile)) {
          if ((own.get(property) ?? element.style.getPropertyValue(cssName(property))) === value) { own.set(property, value); continue; }
          write(element, property, value); own.set(property, value); writes++;
        }
      }
      return writes;
    },
  };
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
  previous: number | undefined): number {
  if (levels.fixedLevel !== undefined) return levels.fixedLevel;
  // An unavailable projection cannot justify substituting lower detail.
  if (diameter == null || !Number.isFinite(diameter)) return levels.levels.length - 1;
  return walkSilhouetteLevels(levels.levels, levels.hysteresis, diameter, previous);
}
