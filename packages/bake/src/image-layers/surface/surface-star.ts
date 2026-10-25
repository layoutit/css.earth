import type { ImageLayerRecipe } from '../config.ts';
import { surfaceOnPicture } from './surface.ts';
import type { SurfaceTriangle } from './surface-mesh.ts';

type Surface = NonNullable<ImageLayerRecipe['geometry']['surface']>;

/** The star's glow: texels a side of each of its three squares, its color, and its halo's share of the core's light at
 * the halo's own radius. */
export const STAR_TEXELS = 160, STAR_COLOR = [236, 242, 255] as const, STAR_HALO = 0.35;

/**
 * The central star inside the shell (`geometry.surface.star`): a glow drawn on three squares crossed at the star, along
 * the surface file's axes, so it is round from every side and sorts among the lobes' triangles. Its light is a core,
 * a Gaussian of `coreArcsec`, and a halo falling as 1 / (1 + (r / haloArcsec)^2), STAR_HALO of the core's at the halo
 * radius, faded out at `glowArcsec`. Where the squares cross their light adds; each holds a third of the optical depth.
 * Presentation: the picture's star is saturated and its glare is not the star's size.
 */
export function imageLayerSurfaceStar(surface: Surface, star: { coreArcsec: number; haloArcsec: number; glowArcsec: number }, width: number, height: number, sky: (px: number, py: number) => readonly [number, number]): SurfaceTriangle[] {
  const { place } = surfaceOnPicture(surface, width, height, sky), [ox, oy, oz] = surface.originUnits, reach = star.glowArcsec / surface.arcsecPerUnit;
  const rgba = Buffer.alloc(4 * STAR_TEXELS * STAR_TEXELS);
  for (let row = 0; row < STAR_TEXELS; row++) for (let column = 0; column < STAR_TEXELS; column++) {
    const u = ((column + .5) / STAR_TEXELS * 2 - 1) * star.glowArcsec, v = ((row + .5) / STAR_TEXELS * 2 - 1) * star.glowArcsec, r = Math.hypot(u, v);
    const fade = Math.max(0, Math.min(1, (star.glowArcsec - r) / (.25 * star.glowArcsec))), light = Math.min(1, Math.exp(-((r / star.coreArcsec) ** 2)) + STAR_HALO * 2 / (1 + (r / star.haloArcsec) ** 2) * fade);
    const o = 4 * (row * STAR_TEXELS + column); for (let c = 0; c < 3; c++) rgba[o + c] = STAR_COLOR[c]!; rgba[o + 3] = Math.round(255 * (1 - (1 - Math.min(.999, light)) ** (1 / 3)));
  }
  const at = (dx: number, dy: number, dz: number) => place(ox + dx, oy + dy, oz + dz);
  return ([[[1, 0, 0], [0, 1, 0]], [[1, 0, 0], [0, 0, 1]], [[0, 1, 0], [0, 0, 1]]] as const).map(([a, b]) => ({
    corners: [at(-reach * (a[0] + b[0]), -reach * (a[1] + b[1]), -reach * (a[2] + b[2])), at(reach * (a[0] - b[0]), reach * (a[1] - b[1]), reach * (a[2] - b[2])), at(reach * (b[0] - a[0]), reach * (b[1] - a[1]), reach * (b[2] - a[2]))],
    texture: [STAR_TEXELS, STAR_TEXELS], rgba: Buffer.from(rgba) }));
}
