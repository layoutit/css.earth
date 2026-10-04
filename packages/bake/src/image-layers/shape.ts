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
 * from the speed of the lines that make that channel. A closed inner shell (`inner`) has its own law and its own walls,
 * which meet at its outline.
 *
 * One picture cannot tell the wall in front of the star from the wall behind it; a measured speed can. With `speeds`
 * (the recipe's table, as east, north in arcseconds from the star and km/s away from the Sun) `detail` says where a
 * sight line's fine detail lies: on the far wall where the features around it recede, on the near wall where they
 * approach, and, outside the inner shell, on one surface between the walls that the speeds bend.
 *
 * The frame is the bake's: x east, y north, z along the sight line away from the Sun, in arcseconds from the star. */
/** Where, as a fraction of the lobe's radius, its wall starts to be led onto the main shell's. */
export const LOBE_JOINS_FROM = 0.7;
/** Over how much of the inner shell's own size, outward from its outline, the main shell's walls take up the smooth light.
 * The main shell's walls begin at that outline; with their full light there, the two walls' edges show as two outlines
 * around the inner shell from any camera but the Sun. */
export const INNER_GLOW_JOINS_OVER = 0.35;
/** The surface between the walls follows the measured speeds over this many times their reach. Structures at rest and
 * structures at the walls' speed lie side by side on the sky; a surface that followed each would be a cliff between
 * every two, and a cliff comes apart from any camera but the Sun. */
export const SURFACE_REACH = 3;
/** Where, as a fraction of the way from the star to the shell's outline, its wall starts to be led onto the picture's plane. */
export const RIM_JOINS_FROM = 0.9;

export function imageLayerShapeModel(shape: Shape, speeds: readonly (readonly [number, number, number])[] = []) {
  const { ring, lobe, inner } = shape, depth = (speed: number) => speed / shape.expansionKmSPerArcsec;
  const shell = (speeds: readonly number[], major: number, minor: number) => speeds.map(speed => ellipsoid(depth(speed), major, minor, ring.polarTiltDeg, ring.polarLeansToPaDeg, ring.majorPaDeg));
  const shellWalls = shell(ring.expansionKmS, ring.semiMajorArcsec, ring.semiMinorArcsec), lobeWalls = lobe ? shell(lobe.expansionKmS, lobe.radiusArcsec, lobe.radiusArcsec) : null;
  const innerWalls = inner ? inner.expansionKmS.map(speed => ellipsoid(speed / inner.expansionKmSPerArcsec, inner.semiMajorArcsec, inner.semiMinorArcsec, ring.polarTiltDeg, ring.polarLeansToPaDeg, inner.majorPaDeg)) : null;
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
    // A closed inner shell holds the light inside its own outline: its two walls meet there, and the main shell's begin.
    // Over the outer part of the outline they are led onto the shells' equatorial plane, where the surface outside it
    // begins: a tipped shell's own rim is a little off that plane, and a step there shows as a line around the shell.
    const closed = innerWalls ? on(innerWalls) : null;
    if (closed) { const first = innerWalls![0]!.span(east, north)!, chord = (first[1] - first[0]) / innerLongest, fromCentre = Math.sqrt(Math.max(0, 1 - chord * chord)), r = Math.max(0, Math.min(1, (fromCentre - RIM_JOINS_FROM) / (1 - RIM_JOINS_FROM))), flat = 1 - r * r * (3 - 2 * r), plane = flatDepth(east, north);
      return { near: plane + (closed.near - plane) * flat, far: plane + (closed.far - plane) * flat }; }
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
  const through = shellWalls[0]!.span(0, 0)!, longest = through[1] - through[0], innerThrough = innerWalls ? innerWalls[0]!.span(0, 0)! : null, innerLongest = innerThrough ? innerThrough[1] - innerThrough[0] : 1;
  /** How far any wall reaches along the sight line either side of the star. */
  const reach = Math.max(...[...shellWalls, ...(lobeWalls ?? []), ...(innerWalls ?? [])].map(wall => wall.height));
  const tilt = rad(ring.polarTiltDeg), lean = rad(ring.polarLeansToPaDeg);
  /** How far along the sight line, from the star, the shells' equatorial plane is met at a sky offset. */
  const flatDepth = (east: number, north: number) => Math.tan(tilt) * (east * Math.sin(lean) + north * Math.cos(lean));
  // The measurements by place, in squares as wide as a bell reaches: a table may hold thousands of them.
  const cell = shape.speeds ? 3 * shape.speeds.reachArcsec : 1, cellKey = (i: number, j: number) => (i + 32768) * 65536 + j + 32768, cells = new Map<number, (readonly [number, number, number])[]>();
  for (const row of speeds) { const at = cellKey(Math.floor(row[0] / cell), Math.floor(row[1] / cell)), held = cells.get(at); if (held) held.push(row); else cells.set(at, [row]); }
  /** The mean of the measured speeds around a place, each weighted by a bell of `reachArcsec`, and how well the place
   * is known: farther than twice that reach from every measurement nothing is. With it, the mean of the approaching
   * speeds alone and of the receding ones alone (null where there is none), and the receding ones' share of the weight. */
  type Measured = { speed: number; known: number; toward: number | null; away: number | null; back: number };
  const nothing: Measured = { speed: 0, known: 0, toward: null, away: null, back: 0 }; let last: { east: number; north: number; reaches: number; found: Measured } | null = null;
  const measuredAt = (east: number, north: number, reaches = 1): Measured => {
    const measured = shape.speeds; if (!measured || !speeds.length) return nothing;
    if (last && last.east === east && last.north === north && last.reaches === reaches) return last.found;
    const reach2 = (reaches * measured.reachArcsec) ** 2, i = Math.floor(east / cell), j = Math.floor(north / cell); let sum = 0, weight = 0, behind = 0, behindWeight = 0;
    for (let dj = -reaches; dj <= reaches; dj++) for (let di = -reaches; di <= reaches; di++) for (const [e, n, speed] of cells.get(cellKey(i + di, j + dj)) ?? []) { const apart = (e - east) * (e - east) + (n - north) * (n - north); if (apart > 9 * reach2) continue; const bell = Math.exp(-apart / (2 * reach2)); sum += bell * speed; weight += bell; if (speed >= 0) { behind += bell * speed; behindWeight += bell; } }
    const found: Measured = weight > 0 ? { speed: sum / weight, known: Math.min(1, weight / Math.exp(-2)), toward: weight > behindWeight ? (sum - behind) / (weight - behindWeight) : null, away: behindWeight > 0 ? behind / behindWeight : null, back: behindWeight / weight } : nothing;
    last = { east, north, reaches, found }; return found;
  };
  /** Whether the walls need a place for detail between them: measured speeds or a star say where it is. */
  const between = Boolean(shape.speeds && speeds.length) || shape.starRadiusArcsec !== undefined;
  /** Where a sight line's fine detail lies, between its walls `near` and `far`: the shares of it on the near wall, on
   * the far wall, and on a surface between them at depth `at`.
   *
   * Inside the inner shell a feature is on a wall: the far one where the structures around it recede (`restKmS` away
   * from the Sun is all behind, `restKmS` toward it all in front), the near one where nothing is measured, as without
   * a table. Outside it the detail is on one surface: the shells' equatorial plane where the structures are at rest or
   * unmeasured, bent toward the wall their mean speed points to (`SURFACE_REACH`), and on that wall where it reaches
   * `wallKmS`; beside the inner shell it stays on the plane, as that shell's rim does (`INNER_GLOW_JOINS_OVER`). One
   * surface, because neighbouring patches on different surfaces come apart as soon as the camera is not the Sun. The central
   * star's own light (`starRadiusArcsec`) is at the star, where the plane is. `walls` is the share of the smooth light
   * the walls take: all of it, but for the main shell's walls beside the inner shell (`INNER_GLOW_JOINS_OVER`), where
   * the surface between the walls keeps the rest. */
  const innerTurn = inner ? rad(inner.majorPaDeg) : 0;
  /** How far a sky offset is from the star against the inner shell's outline: 1 on it. */
  const innerRadii = (east: number, north: number) => inner ? Math.hypot((east * Math.sin(innerTurn) + north * Math.cos(innerTurn)) / inner.semiMajorArcsec, (east * Math.cos(innerTurn) - north * Math.sin(innerTurn)) / inner.semiMinorArcsec) : Infinity;
  const detail = (east: number, north: number, near: number, far: number): { near: number; far: number; mid: number; at: number; walls: number; lifted?: { near: number; far: number } } => {
    const plane = Math.max(near, Math.min(far, flatDepth(east, north)));
    // The star's light is all its own out to its radius, and less and less so out to twice that.
    const from = shape.starRadiusArcsec ? Math.hypot(east, north) / shape.starRadiusArcsec : Infinity, t = Math.max(0, Math.min(1, 2 - from)), star = t * t * (3 - 2 * t);
    const measured = shape.speeds;
    // A speed that is its own depth: what is measured at a place lies on two surfaces of its own (`lifted`), in front of
    // the star's plane at the depth of the approaching speeds there and behind it at the depth of the receding ones, in
    // the shares of the two. What no speed places is the shell's: its smooth light on the walls, its detail on the plane.
    if (measured?.depth === 'speed') { const found = measuredAt(east, north); return { near: found.known * (1 - found.back), far: found.known * found.back, mid: 1 - found.known, at: plane, walls: 1, lifted: { near: found.toward === null ? 0 : depth(found.toward), far: found.away === null ? 0 : depth(found.away) } }; }
    const inside = !measured || Boolean(innerWalls && innerWalls[0]!.span(east, north)), { speed, known } = measuredAt(east, north, inside ? 1 : SURFACE_REACH);
    if (!measured || inside) {
      const behind = measured ? known * Math.max(0, Math.min(1, (speed + measured.restKmS) / (2 * measured.restKmS))) : 0;
      return { near: (1 - behind) * (1 - star), far: behind * (1 - star), mid: star, at: plane, walls: 1 };
    }
    const toward = Math.max(-1, Math.min(1, known * speed / measured.wallKmS)), out = Math.max(0, Math.min(1, (innerRadii(east, north) - 1) / INNER_GLOW_JOINS_OVER));
    const joined = out * out * (3 - 2 * out);
    return { near: 0, far: 0, mid: 1, at: plane + (toward < 0 ? -toward * (near - plane) : toward * (far - plane)) * joined * (1 - star), walls: joined };
  };
  return { shape, walls, reach, between, detail };
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

/** A map blurred `BROAD_TIMES` times farther than `radius` pixels: the means of squares `BROAD_TIMES` pixels across, blurred over
 * `radius` of them, read back between the squares' middles. */
export const BROAD_TIMES = 8;
export function broadLight(values: Float32Array, width: number, height: number, radius: number): Float32Array {
  const columns = Math.ceil(width / BROAD_TIMES), rows = Math.ceil(height / BROAD_TIMES), small = new Float32Array(columns * rows);
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) { let sum = 0, count = 0;
    for (let y = row * BROAD_TIMES; y < Math.min(height, (row + 1) * BROAD_TIMES); y++) for (let x = column * BROAD_TIMES; x < Math.min(width, (column + 1) * BROAD_TIMES); x++) { sum += values[y * width + x]!; count++; }
    small[row * columns + column] = sum / count; }
  const blurred = smoothed(small, columns, rows, radius), output = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const u = Math.max(0, Math.min(columns - 1, (x + .5) / BROAD_TIMES - .5)), v = Math.max(0, Math.min(rows - 1, (y + .5) / BROAD_TIMES - .5)), i = Math.min(columns - 2, Math.floor(u)), j = Math.min(rows - 2, Math.floor(v)), a = u - i, b = v - j;
    output[y * width + x] = (1 - b) * ((1 - a) * blurred[j * columns + i]! + a * blurred[j * columns + i + 1]!) + b * ((1 - a) * blurred[(j + 1) * columns + i]! + a * blurred[(j + 1) * columns + i + 1]!); }
  return output;
}
