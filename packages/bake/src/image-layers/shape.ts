import { cross3 as cross } from '@cssearth/core';
import type { ImageLayerRecipe, Vec3 } from './config.ts';
import { norm, rad } from './disc.ts';

type Shape = NonNullable<ImageLayerRecipe['geometry']['shape']>;
export type Span = (east: number, north: number) => [number, number] | null;

/** Where the sight line at a sky offset from the star (east, north) enters and leaves an ellipsoid centred on the star,
 * along z from the star; null where it misses. The pole is tipped `tiltDeg` from the sight line, its near end leaning to
 * position angle `leansToPaDeg`; `major` and `minor` are the semi-axes in the equatorial plane, `major` toward `majorPaDeg`. */
export function ellipsoid(polar: number, major: number, minor: number, tiltDeg: number, leansToPaDeg: number, majorPaDeg: number): { span: Span; height: number } {
  const tilt = rad(tiltDeg), lean = rad(leansToPaDeg), majorPa = rad(majorPaDeg);
  const pole: Vec3 = [Math.sin(tilt) * Math.sin(lean), Math.sin(tilt) * Math.cos(lean), -Math.cos(tilt)];
  const across = cross(pole, [Math.sin(majorPa), Math.cos(majorPa), 0]);
  if (Math.hypot(...across) < 1e-9) throw new RangeError(`The pole lies along the major axis (tilt ${tiltDeg}°, leaning to ${leansToPaDeg}°, major axis at ${majorPaDeg}°).`);
  const minorAxis = norm(across), axes: [Vec3, number][] = [[pole, polar], [cross(minorAxis, pole), major], [minorAxis, minor]];
  const span: Span = (east, north) => {
    let a = 0, b = 0, c = -1;
    for (const [axis, length] of axes) { const along = axis[2] / length, at = (east * axis[0] + north * axis[1]) / length; a += along * along; b += 2 * along * at; c += at * at; }
    const discriminant = b * b - 4 * a * c;
    if (!(discriminant > 0)) return null;
    const root = Math.sqrt(discriminant);
    return [(-b - root) / (2 * a), (-b + root) / (2 * a)];
  };
  return { span, height: Math.hypot(...axes.map(([axis, length]) => axis[2] * length)) };
}

/** A nebula's published walls (`geometry.shape`). Long-slit spectra show each emission line as a velocity ellipse: its
 * speed along the sight line against the place on the sky. Under the published expansion law, speed in proportion to
 * distance from the star, a speed is a depth, so each ellipse is an ellipsoidal wall of gas, in front of the star and
 * behind it. The main shell (`ring`) and the body through its opening (`lobe`) each have one wall per display channel,
 * from the speed of the lines that make that channel.
 *
 * The frame is the bake's: x east, y north, z along the sight line away from the Sun, in arcseconds from the star. */
/** Where, as a fraction of the lobe's radius, its wall starts to be led onto the main shell's. */
export const LOBE_JOINS_FROM = 0.7;
/** Where, as a fraction of the way from the star to the shell's outline, its wall starts to be led onto the picture's plane. */
export const RIM_JOINS_FROM = 0.9;

export function imageLayerShapeModel(shape: Shape) {
  const { ring, lobe } = shape, depth = (speed: number) => speed / shape.expansionKmSPerArcsec;
  const shell = (speeds: readonly number[], major: number, minor: number) => speeds.map(speed => ellipsoid(depth(speed), major, minor, ring.polarTiltDeg, ring.polarLeansToPaDeg, ring.majorPaDeg));
  const shellWalls = shell(ring.expansionKmS, ring.semiMajorArcsec, ring.semiMinorArcsec), lobeWalls = lobe ? shell(lobe.expansionKmS, lobe.radiusArcsec, lobe.radiusArcsec) : null;
  /** The walls a sight line's light lies on, near and far: the channels' walls weighted by how much of the light there is
   * each channel's. Inside the lobe's outline the light is the lobe's; elsewhere inside the shell's outline it is the
   * shell's; outside both there is no wall. Over the outer part of the lobe's outline (from `LOBE_JOINS_FROM` of its
   * radius) the lobe's wall is led onto the shell's, so the lobe opens from the shell's inner lip and the two walls
   * leave no gap between them. Both joins are presentation choices. */
  const walls = (east: number, north: number, mix: readonly [number, number, number]): { near: number; far: number } | null => {
    const total = mix[0] + mix[1] + mix[2], weights = total > 0 ? mix.map(light => light / total) : [1 / 3, 1 / 3, 1 / 3];
    const on = (part: readonly { span: Span }[]) => {
      const ends = part.map(wall => wall.span(east, north));
      return ends.some(end => end === null) ? null : { near: ends.reduce((sum, end, channel) => sum + weights[channel]! * end![0], 0), far: ends.reduce((sum, end, channel) => sum + weights[channel]! * end![1], 0) };
    };
    const shellEnds = on(shellWalls), inner = lobeWalls ? on(lobeWalls) : null;
    if (!shellEnds) return inner;
    // The shell's pole is tipped, so its rim does not lie in the picture's plane: over the outer part of its outline the
    // wall is led onto that plane, where the picture outside the outline lies.
    const first = shellWalls[0]!.span(east, north)!, chord = (first[1] - first[0]) / longest, fromCentre = Math.sqrt(Math.max(0, 1 - chord * chord));
    const r = Math.max(0, Math.min(1, (fromCentre - RIM_JOINS_FROM) / (1 - RIM_JOINS_FROM))), flat = 1 - r * r * (3 - 2 * r), outer = { near: shellEnds.near * flat, far: shellEnds.far * flat };
    if (!inner) return outer;
    const t = Math.max(0, Math.min(1, (Math.hypot(east, north) / lobe!.radiusArcsec - LOBE_JOINS_FROM) / (1 - LOBE_JOINS_FROM))), join = t * t * (3 - 2 * t);
    return { near: inner.near + (outer.near - inner.near) * join, far: inner.far + (outer.far - inner.far) * join };
  };
  const through = shellWalls[0]!.span(0, 0)!, longest = through[1] - through[0];
  /** How far any wall reaches along the sight line either side of the star. */
  const reach = Math.max(...[...shellWalls, ...(lobeWalls ?? [])].map(wall => wall.height));
  return { shape, walls, reach };
}

type Fold = (read: (offset: number) => number) => number;
/** One separable pass of a filter along the rows or the columns of a map, edges repeated. */
function pass(source: Float32Array, width: number, height: number, horizontal: boolean, fold: Fold): Float32Array {
  const output = new Float32Array(source.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const read = (offset: number) => horizontal ? source[y * width + Math.max(0, Math.min(width - 1, x + offset))]! : source[Math.max(0, Math.min(height - 1, y + offset)) * width + x]!;
    output[y * width + x] = fold(read);
  }
  return output;
}

/** A map blurred by a Gaussian that reaches no farther than `radius` pixels, edges repeated. */
export function smoothed(values: Float32Array, width: number, height: number, radius: number): Float32Array {
  const weights = Array.from({ length: radius + 1 }, (_, offset) => Math.exp(-2 * (offset / radius) ** 2));
  const blurred: Fold = read => { let sum = 0, total = 0; for (let offset = -radius; offset <= radius; offset++) { const weight = weights[Math.abs(offset)]!; sum += weight * read(offset); total += weight; } return sum / total; };
  return pass(pass(values, width, height, true, blurred), width, height, false, blurred);
}

/** The smooth lower envelope of a map: the smallest value within `radius` pixels (a square), then a Gaussian blur that
 * reaches no farther than that radius. Every value the blur averages is a minimum over a square holding the pixel, so
 * the envelope never rises above the map, at fine dark detail either, and never follows fine bright detail. */
export function lowerEnvelope(values: Float32Array, width: number, height: number, radius: number): Float32Array {
  if (values.length !== width * height) throw new TypeError(`The map is not ${width} x ${height}.`);
  if (!(Number.isInteger(radius) && radius >= 1)) throw new RangeError(`The envelope's radius is a whole number of pixels, at least 1; got ${radius}.`);
  const smallest: Fold = read => { let value = Infinity; for (let offset = -radius; offset <= radius; offset++) value = Math.min(value, read(offset)); return value; };
  return smoothed(pass(pass(values, width, height, true, smallest), width, height, false, smallest), width, height, radius);
}
