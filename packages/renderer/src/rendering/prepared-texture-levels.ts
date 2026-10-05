import { textureTileLeafStyles, type PreparedPresentationDefinition, type PreparedTexturePlacements, type PreparedTextureLevels, type PreparedTextureTile, type PreparedTextureTileLeaves } from '@cssearth/objects';
import { walkSilhouetteLevels } from '@cssearth/engine';

import { invertPreparedAffineMatrix4, transformPreparedPoint } from '@cssearth/core';
import type { PhysicalProjection } from '../prepared-data/physical-projection.js';

type Vector3 = readonly [number, number, number];

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
    /** Writes the write's tile on its leaves, or on those of them in `only`; returns the number of style writes. */
    publish(target: number, name: string, tile: PreparedTextureTile | undefined, only?: ReadonlySet<HTMLElement>) {
      const group = groups.get(`${target}:${name}`);
      if (!group) return 0;
      let writes = 0;
      for (const [node, x, y] of group.leaves) {
        const element = nodes[node];
        if (!element) throw new TypeError(`Prepared texture tile leaf ${node} of ${name} on node ${target} is not in the tree.`);
        if (only && !only.has(element)) continue;
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

/**
 * The width and height of each image a texture write shows, as its prepared entry states them. A leaf's box takes the
 * size its image fills (prepared-leaf-box-direct.ts). An entry that states none has none, and neither has a sheet: its
 * size is the sheet's, not its page's.
 */
export function preparedTextureSizes(definition: Pick<PreparedPresentationDefinition, 'textureLevels' | 'assets'>) {
  // A dataset's tables are adopted into the mounted definition after the first load (prepared-data/dataset-tables.ts):
  // the sizes are read again whenever the entries or the levels are replaced.
  let read: { entries: unknown; levels: unknown; sizes: Map<string, readonly [number, number]> } | null = null;
  return (shown: string): readonly [number, number] | undefined => {
    const { textureLevels } = definition, entries = definition.assets?.entries;
    if (!read || read.entries !== entries || read.levels !== textureLevels) {
      const sheets = new Set((textureLevels?.levels ?? []).flatMap(level => Object.keys(level.tiles ?? {}).map(key => level.resources[key]!)));
      read = { entries, levels: textureLevels,
        sizes: new Map((entries ?? []).flatMap(entry => entry.width && entry.height && !sheets.has(entry.key) ? [[entry.key, [entry.width, entry.height] as const] as const] : [])) };
    }
    return read.sizes.get(shown);
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
