/** Where the faces behind each texture write sit, measured on the prepared scene at rest, in scene coordinates. */
/** Prepared addresses for one dataset; all levels share its retained geometry
 * and atlas coordinate system. Thresholds are CSS silhouette pixels, never DPR. */
/** Where a page sits in the sheet its level shares with the bank's other pages, in the page's own CSS atlas units: the
 * tile's offset, and the sheet's width over the page's. */
import type { PreparedTextureLevels, PreparedTextureTile, PreparedTextureTileLeaves } from '../presentation/runtime-presentation-types.js';




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
