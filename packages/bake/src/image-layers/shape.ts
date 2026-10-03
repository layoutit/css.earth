import { cross3 as cross, dot3 as dot } from '@cssearth/core';
import type { ImageLayerRecipe, Vec3 } from './config.ts';
import { norm, rad } from './disc.ts';

/** A nebula's published shape as an evenly filled ellipsoid (`geometry.shape`): the ellipsoid has one emissivity and one
 * color, the light the smooth part of the photograph can give in each channel on nearly every sight line through it, so
 * a sight line gives it that emissivity times its chord and the flat picture keeps the rest, with every fine detail:
 * the view from the Sun stays as sharp as the picture.
 *
 * The local frame is the bake's: x east, y north, z along the sight line away from the Sun, lengths in the recipe's unit. */
export function imageLayerShapeModel(recipe: Pick<ImageLayerRecipe, 'geometry'>) {
  const shape = recipe.geometry.shape;
  if (!shape) throw new TypeError('The recipe has no geometry.shape.');
  const tilt = rad(shape.polarTiltDeg), lean = rad(shape.polarLeansToPaDeg), majorPa = rad(shape.majorPaDeg);
  // The pole's near end: tipped from the sight line toward the position angle it leans to.
  const pole: Vec3 = [Math.sin(tilt) * Math.sin(lean), Math.sin(tilt) * Math.cos(lean), -Math.cos(tilt)];
  const across = cross(pole, [Math.sin(majorPa), Math.cos(majorPa), 0]);
  if (Math.hypot(...across) < 1e-9) throw new RangeError(`${JSON.stringify(shape.source)}: the pole lies along the major axis (tilt ${shape.polarTiltDeg}°, leaning to ${shape.polarLeansToPaDeg}°, major axis at ${shape.majorPaDeg}°).`);
  const minor = norm(across), major = cross(minor, pole), axes: [Vec3, number][] = [[pole, shape.semiAxesKpc.polar], [major, shape.semiAxesKpc.major], [minor, shape.semiAxesKpc.minor]];
  /** One inside the ellipsoid, nothing outside: the fill is even. */
  const density = (point: Vec3): number => Math.hypot(...axes.map(([axis, length]) => dot(point, axis) / length)) < 1 ? 1 : 0;
  /** Where the sight line at a sky offset from the centre (east, north) enters and leaves the ellipsoid, along z from the centre; null where it misses. */
  const span = (east: number, north: number): [number, number] | null => {
    let a = 0, b = 0, c = -1;
    for (const [axis, length] of axes) { const along = axis[2] / length, at = (east * axis[0] + north * axis[1]) / length; a += along * along; b += 2 * along * at; c += at * at; }
    const discriminant = b * b - 4 * a * c;
    if (!(discriminant > 0)) return null;
    const root = Math.sqrt(discriminant);
    return [(-b - root) / (2 * a), (-b + root) / (2 * a)];
  };
  /** The length of that chord. */
  const chord = (east: number, north: number): number => { const ends = span(east, north); return ends ? ends[1] - ends[0] : 0; };
  /** How far the ellipsoid reaches along the sight line either side of the centre, and across the sky. */
  const height = Math.hypot(...axes.map(([axis, length]) => axis[2] * length)), radius = Math.max(...axes.map(([, length]) => length));
  return { shape, density, span, chord, height, radius, pole, major, minor };
}

/** The smooth lower envelope of a map: the smallest value within `radius` pixels (a square), then a Gaussian blur that
 * reaches no farther than that radius. Every value the blur averages is a minimum over a square holding the pixel, so
 * the envelope never rises above the map, at fine dark detail either, and never follows fine bright detail. */
export function lowerEnvelope(values: Float32Array, width: number, height: number, radius: number): Float32Array {
  if (values.length !== width * height) throw new TypeError(`The map is not ${width} x ${height}.`);
  if (!(Number.isInteger(radius) && radius >= 1)) throw new RangeError(`The envelope's radius is a whole number of pixels, at least 1; got ${radius}.`);
  const weights = Array.from({ length: radius + 1 }, (_, offset) => Math.exp(-2 * (offset / radius) ** 2));
  const pass = (source: Float32Array, horizontal: boolean, fold: (read: (offset: number) => number) => number) => {
    const output = new Float32Array(source.length);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const read = (offset: number) => horizontal ? source[y * width + Math.max(0, Math.min(width - 1, x + offset))]! : source[Math.max(0, Math.min(height - 1, y + offset)) * width + x]!;
      output[y * width + x] = fold(read);
    }
    return output;
  };
  const smallest = (read: (offset: number) => number) => { let value = Infinity; for (let offset = -radius; offset <= radius; offset++) value = Math.min(value, read(offset)); return value; };
  const blurred = (read: (offset: number) => number) => { let sum = 0, total = 0; for (let offset = -radius; offset <= radius; offset++) { const weight = weights[Math.abs(offset)]!; sum += weight * read(offset); total += weight; } return sum / total; };
  return pass(pass(pass(pass(values, true, smallest), false, smallest), true, blurred), false, blurred);
}
