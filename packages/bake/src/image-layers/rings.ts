import type { ImageLayerRecipe, Vec3 } from './config.ts';
import { rad } from './disc.ts';

type Rings = NonNullable<ImageLayerRecipe['geometry']['rings']>;

/** A nebula's published rings (`geometry.rings`): flat structures through the star, each tilted its own way. `disc` is
 * a filled disc and `ring` the ring around it, circles of `radiusArcsec` in their own planes. A plane's axis is tipped
 * `tiltDeg` from the sight line, its far end leaning to position angle `farAxisPaDeg`, so the plane's edge on that side
 * of the star is the nearer one.
 *
 * A sight line meets each plane once, at some radius from the star in that plane. The disc holds the light it meets
 * inside its own radius and none beyond the ring's; the ring's plane holds none inside the disc's radius and all of it
 * from the ring's radius outward. Between the two published radii nothing says which structure a sight line's light
 * belongs to, so each plane's claim changes in proportion to the radius, and where both claim a sight line they share
 * it by their claims. No width is chosen here: the two radii are the paper's.
 *
 * With `lineOfSightThicknessArcsec` a structure is not a sheet: the smooth part of its light lies about its plane, in
 * front of it and behind, through that much depth along the sight line (./rings-volume.ts).
 *
 * The frame is the bake's: x east, y north, z along the sight line away from the Sun, in arcseconds from the star. */
export function imageLayerRingsModel(rings: Rings) {
  const plane = (tiltDeg: number, farAxisPaDeg: number) => {
    const tilt = rad(tiltDeg), pa = rad(farAxisPaDeg), normal: Vec3 = [Math.sin(tilt) * Math.sin(pa), Math.sin(tilt) * Math.cos(pa), Math.cos(tilt)];
    /** How far along the sight line, from the star, the plane is met at a sky offset: nearer on the side its axis's far end leans to. */
    const depth = (east: number, north: number) => -(east * normal[0] + north * normal[1]) / normal[2];
    return { normal, depth, radius: (east: number, north: number) => Math.hypot(east, north, depth(east, north)) };
  };

  const disc = plane(rings.disc.tiltDeg, rings.disc.farAxisPaDeg), ring = plane(rings.ring.tiltDeg, rings.ring.farAxisPaDeg);
  /** How far a radius is from the disc's toward the ring's: 0 at the disc's radius and inside it, 1 at the ring's and beyond. */
  const outward = (radius: number) => Math.max(0, Math.min(1, (radius - rings.disc.radiusArcsec) / (rings.ring.radiusArcsec - rings.disc.radiusArcsec)));
  /** The share of a sight line's light on the disc. */
  const onDisc = (east: number, north: number) => {
    const discClaim = 1 - outward(disc.radius(east, north)), ringClaim = outward(ring.radius(east, north));
    return discClaim + ringClaim > 0 ? discClaim / (discClaim + ringClaim) : 0;
  };
  return { rings, thickness: rings.lineOfSightThicknessArcsec ?? 0, planes: [
    { id: 'disc', normal: disc.normal, depth: disc.depth, radius: disc.radius, share: onDisc },
    { id: 'ring', normal: ring.normal, depth: ring.depth, radius: ring.radius, share: (east: number, north: number) => 1 - onDisc(east, north) },
  ] as const };
}

/** Over how many face pixels a ring sheet's opacity is evened out. A bank's opacity follows the picture's brightness
 * pixel by pixel, so the picture's grain is in the opacity, which WebP stores exactly: on a sheet as large as a
 * nebula's that is most of the file. Here the opacity is a smooth cover over the brightness and the color darkens to
 * make up the difference, so over black the picture is the same and its detail is in the color, which is lossy.
 *
 * Measured on the Helix bank's 4,096 px face, 2026-10-04, from the Sun against a bake of the picture at quality 100:
 * one sheet with its opacity from brightness is 4.9 MB at quality 70 and differs by 1.3 of 255 (root mean square); the
 * two ring sheets with this cover are 2.5 MB at quality 70 (2.0 of 255) and 3.1 MB at quality 80 (1.8). On a 1,024 px
 * crop a reach of 4, 8 and 16 px gave 51%, 45% and 36% of the bytes at the same difference. */
export const RINGS_OPACITY_REACH_PIXELS = 8;
/** A pixel more than this many times as opaque as its surroundings' mean is a point of light, a star or a knot's head:
 * the cover does not rise to it. A cover that did would darken a patch of sky around every star. */
const RINGS_POINT_FACTOR = 2;

/** A smooth cover over a picture's opacity (0 to 255, `RINGS_OPACITY_REACH_PIXELS`): what each pixel's opacity becomes,
 * never less than its own. Points of light keep their own. */
export function imageLayerRingsCover(own: Float32Array, width: number, height: number): Float32Array {
  const reach = RINGS_OPACITY_REACH_PIXELS, count = width * height, line = new Float32Array(Math.max(width, height));
  /** Over each pixel's square of `radius`, rows then columns: the largest value, or the mean. */
  const pass = (from: Float32Array, radius: number, most: boolean) => {
    const out = new Float32Array(count);
    for (const [length, lines, step, stride] of [[width, height, width, 1], [height, width, 1, width]] as const) {
      const source = stride === 1 ? from : out;
      for (let l = 0; l < lines; l++) {
        for (let i = 0; i < length; i++) line[i] = source[l * step + i * stride]!;
        if (most) for (let i = 0; i < length; i++) { let value = 0; for (let k = Math.max(0, i - radius), end = Math.min(length - 1, i + radius); k <= end; k++) if (line[k]! > value) value = line[k]!; out[l * step + i * stride] = value; }
        else { let sum = 0, lo = 0, hi = -1; for (let i = 0; i < length; i++) { const a = Math.max(0, i - radius), b = Math.min(length - 1, i + radius); while (hi < b) sum += line[++hi]!; while (lo < a) sum -= line[lo++]!; out[l * step + i * stride] = sum / (b - a + 1); } }
      }
    }
    return out;
  };
  // The glow without its points: each pixel held to a multiple of its surroundings' mean, twice, so a star does not lift
  // the mean it is measured against.
  let glow = own;
  for (let round = 0; round < 2; round++) { const mean = pass(glow, reach, false), held = new Float32Array(count); for (let p = 0; p < count; p++) held[p] = Math.min(own[p]!, RINGS_POINT_FACTOR * mean[p]!); glow = held; }
  // The cover: the most opaque glow within twice the reach, then two means over the reach.
  const cover = pass(pass(pass(glow, 2 * reach, true), reach, false), reach, false);
  for (let p = 0; p < count; p++) cover[p] = Math.max(own[p]!, Math.min(255, Math.ceil(cover[p]!)));
  return cover;
}

/** A picture's RGBA with its opacity evened out (`imageLayerRingsCover`): no pixel less opaque than before, and each
 * pixel's color times its opacity unchanged to rounding. */
export function imageLayerRingsSheet(rgba: Buffer, width: number, height: number): Buffer {
  const count = width * height, own = new Float32Array(count);
  for (let p = 0; p < count; p++) own[p] = rgba[4 * p + 3]!;
  const cover = imageLayerRingsCover(own, width, height), out = Buffer.alloc(rgba.length);
  for (let p = 0; p < count; p++) {
    const i = 4 * p, alpha = cover[p]!;
    out[i + 3] = alpha;
    for (let c = 0; c < 3; c++) out[i + c] = alpha ? Math.min(255, Math.round(rgba[i + c]! * own[p]! / alpha)) : 0;
  }
  return out;
}
