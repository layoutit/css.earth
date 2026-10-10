/** The Wenger, Lorenz & Magnor (2013) axial-symmetry fit as SURFACES, not a volume. The solver's emission is constant
 * on each of its cylindrical groups (axial position × radius about the axis), so the fit is a profile e(s, r). Two
 * surfaces of revolution are read off that profile:
 *
 * - the **envelope**: at each axial position, the largest radius whose emission still reaches `envelopeFraction` of the
 *   profile's peak — the closed outer surface the image-layer bake lays the photograph on (`geometry.surface`, a binary
 *   STL whose z axis is the pole);
 * - the **wall**: at each axial position, the radius of the brightest group — where the light lies for a hollow lobe.
 *
 * Coordinates are the solver grid's cells: x right, y down, z toward the observer, as `SymmetryPrior` states them. */
import type { InferenceGrid, SymmetryPrior } from './solver.ts';

export interface EmissionProfile {
  /** Axial bin index range and radius bins, in units of `binWidth` cells. */
  axialMin: number; axialMax: number; radii: number; binWidth: number;
  /** Mean emission per (axial, radius) bin, row-major by axial bin; NaN where no voxel falls. */
  values: Float32Array;
  /** The share of each bin's full annulus inside the grid: a group the box cuts (its corners) is under-observed. */
  coverage: Float32Array;
}
export interface ProfileSample { axialCells: number; envelopeCells: number; wallCells: number; peak: number }
/** `binWidthCells` is the axial step between neighbouring positions: a larger gap is a break in the surface. */
export interface RevolvedSurface { samples: ProfileSample[]; envelopeFraction: number; peak: number; binWidthCells: number }

const unitAxis = (prior: SymmetryPrior): [number, number, number] => {
  const norm = Math.hypot(...prior.axis);
  if (!(norm > 1e-10)) throw new TypeError('The symmetry axis needs a direction.');
  return prior.axis.map(value => value / norm) as [number, number, number];
};

/** The fit's profile: every voxel's emission (summed over channels) averaged in the solver's own groups. */
export function emissionProfile(volumes: readonly Float32Array[], grid: InferenceGrid, prior: SymmetryPrior): EmissionProfile {
  const size = grid.width * grid.height * grid.depth;
  if (!volumes.length || volumes.some(volume => volume.length !== size)) throw new TypeError('Each emission volume must match the grid.');
  const [ax, ay, az] = unitAxis(prior), bin = prior.binWidth;
  let axialMin = Infinity, axialMax = -Infinity, radiusMax = 0;
  const keys = new Int32Array(size * 2);
  for (let z = 0, index = 0; z < grid.depth; z++) for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++, index++) {
    const dx = x - prior.center[0], dy = y - prior.center[1], dz = z - prior.center[2], axial = dx * ax + dy * ay + dz * az;
    const radius = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - axial * axial));
    const a = Math.round(axial / bin), r = Math.round(radius / bin);
    keys[2 * index] = a; keys[2 * index + 1] = r;
    axialMin = Math.min(axialMin, a); axialMax = Math.max(axialMax, a); radiusMax = Math.max(radiusMax, r);
  }
  const radii = radiusMax + 1, rows = axialMax - axialMin + 1, sums = new Float64Array(rows * radii), counts = new Uint32Array(rows * radii);
  for (let index = 0; index < size; index++) {
    let value = 0; for (const volume of volumes) value += volume[index]!;
    const cell = (keys[2 * index]! - axialMin) * radii + keys[2 * index + 1]!;
    sums[cell]! += value; counts[cell]!++;
  }
  const values = new Float32Array(rows * radii), coverage = new Float32Array(rows * radii);
  // An annulus of radius r·bin, one bin wide and one bin long, holds 2π·r·bin³ voxel volumes; the axis bin a quarter-π·bin³.
  const full = (r: number) => r === 0 ? Math.PI / 4 * bin ** 3 : 2 * Math.PI * r * bin ** 3;
  for (let cell = 0; cell < values.length; cell++) {
    values[cell] = counts[cell] ? sums[cell]! / counts[cell]! : NaN;
    coverage[cell] = counts[cell]! / full(cell % radii);
  }
  return { axialMin, axialMax, radii, binWidth: bin, values, coverage };
}

/** The envelope and wall at each axial position whose light reaches `envelopeFraction` of the profile's peak. Only
 * groups the grid holds at least `leastCoverage` of are read: the box's corners cut the far groups, whose few voxels
 * the fit barely constrains. The envelope is the edge of the bright run that holds the wall, walked outward from it,
 * so a stray bright group beyond a dark gap is not surface. */
export function revolvedSurface(profile: EmissionProfile, envelopeFraction = .15, leastCoverage = .6): RevolvedSurface {
  if (!(envelopeFraction > 0 && envelopeFraction < 1)) throw new RangeError('The envelope fraction lies between 0 and 1.');
  const covered = (cell: number) => profile.coverage[cell]! >= leastCoverage;
  let peak = 0;
  profile.values.forEach((value, cell) => { if (covered(cell) && value > peak) peak = value; });
  if (!(peak > 0)) throw new TypeError('The fit holds no emission to read a surface from.');
  const threshold = envelopeFraction * peak, samples: ProfileSample[] = [];
  for (let row = 0; row <= profile.axialMax - profile.axialMin; row++) {
    let wall = -1, rowPeak = 0;
    for (let r = 0; r < profile.radii; r++) {
      const cell = row * profile.radii + r, value = profile.values[cell]!;
      if (covered(cell) && value >= threshold && value > rowPeak) { rowPeak = value; wall = r; }
    }
    if (wall < 0) continue;
    let envelope = wall;
    while (envelope + 1 < profile.radii && covered(row * profile.radii + envelope + 1) && profile.values[row * profile.radii + envelope + 1]! >= threshold) envelope++;
    samples.push({ axialCells: (row + profile.axialMin) * profile.binWidth, envelopeCells: (envelope + .5) * profile.binWidth,
      wallCells: wall * profile.binWidth, peak: rowPeak / peak });
  }
  if (samples.length < 2) throw new TypeError('The fit is brighter than the envelope threshold at fewer than two axial positions.');
  // One group's noise moves the edge by a bin from one axial position to the next: a median of three neighbours keeps
  // the edge and drops the single-bin teeth.
  const median = (values: number[]) => values.sort((a, b) => a - b)[values.length >> 1]!;
  const step = profile.binWidth + 1e-9, smoothed = samples.map((sample, index) => {
    const near = samples.slice(Math.max(0, index - 1), index + 2).filter(other => Math.abs(other.axialCells - sample.axialCells) <= step);
    return { ...sample, envelopeCells: median(near.map(other => other.envelopeCells)), wallCells: median(near.map(other => other.wallCells)) };
  });
  const surface = { samples: smoothed, envelopeFraction, peak, binWidthCells: profile.binWidth };
  if (!parts(surface).length) throw new TypeError('The fit is brighter than the envelope threshold at no two neighbouring axial positions: it holds no surface.');
  return surface;
}

/** Runs of consecutive axial samples: each is one closed part of the surface. */
function parts(surface: RevolvedSurface): ProfileSample[][] {
  const runs: ProfileSample[][] = [];
  for (const sample of surface.samples) {
    const run = runs.at(-1), last = run?.at(-1);
    if (run && last && sample.axialCells - last.axialCells <= surface.binWidthCells + 1e-9) run.push(sample);
    else runs.push([sample]);
  }
  return runs.filter(run => run.length >= 2);
}

/** The envelope as a binary STL: rings of `segments` about the file's z axis (the pole), each part closed by a fan at
 * both ends. Units are solver cells; the star (the prior's centre) is the origin. */
export function surfaceStl(surface: RevolvedSurface, segments = 48): Buffer {
  const triangles: number[][] = [];
  const ring = (sample: ProfileSample) => Array.from({ length: segments }, (_, k) => {
    const angle = 2 * Math.PI * k / segments;
    return [sample.envelopeCells * Math.cos(angle), sample.envelopeCells * Math.sin(angle), sample.axialCells];
  });
  for (const run of parts(surface)) {
    const rings = run.map(ring);
    for (let i = 0; i + 1 < rings.length; i++) for (let k = 0; k < segments; k++) {
      const a = rings[i]![k]!, b = rings[i]![(k + 1) % segments]!, c = rings[i + 1]![k]!, d = rings[i + 1]![(k + 1) % segments]!;
      triangles.push([...a, ...b, ...d], [...a, ...d, ...c]);
    }
    const first = run[0]!, last = run.at(-1)!;
    for (let k = 0; k < segments; k++) {
      const start = rings[0]!, end = rings.at(-1)!;
      triangles.push([0, 0, first.axialCells, ...start[(k + 1) % segments]!, ...start[k]!]);
      triangles.push([0, 0, last.axialCells, ...end[k]!, ...end[(k + 1) % segments]!]);
    }
  }
  const bytes = Buffer.alloc(84 + 50 * triangles.length);
  bytes.write('cssEarth lab: axial-symmetry envelope (Wenger et al. 2013 fit)', 0, 'ascii');
  bytes.writeUInt32LE(triangles.length, 80);
  triangles.forEach((corners, index) => {
    const offset = 84 + 50 * index, [x0, y0, z0, x1, y1, z1, x2, y2, z2] = corners as [number, number, number, number, number, number, number, number, number];
    const ux = x1 - x0, uy = y1 - y0, uz = z1 - z0, vx = x2 - x0, vy = y2 - y0, vz = z2 - z0;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, length = Math.hypot(nx, ny, nz) || 1;
    [nx / length, ny / length, nz / length, ...corners].forEach((value, slot) => bytes.writeFloatLE(value, offset + 4 * slot));
  });
  return bytes;
}

/** The surfaces seen from the observer, on the solver grid's image (x right, y down): the envelope's silhouette as
 * one closed outline per part and the wall's two edges as open lines. Exact for an axis in the plane of the sky; for a
 * tilted axis the axial positions are foreshortened by the axis's sky length. */
export function surfaceOutlines(surface: RevolvedSurface, prior: SymmetryPrior) {
  const [ax, ay] = unitAxis(prior), across = [-ay, ax] as const;
  const at = (axial: number, offset: number): [number, number] => [prior.center[0] + axial * ax + offset * across[0], prior.center[1] + axial * ay + offset * across[1]];
  return parts(surface).flatMap((run, part) => [
    { id: `envelope-${part}`, kind: 'envelope' as const, closed: true,
      points: [...run.map(sample => at(sample.axialCells, sample.envelopeCells)), ...run.slice().reverse().map(sample => at(sample.axialCells, -sample.envelopeCells))] },
    ...([1, -1] as const).map(side => ({ id: `wall-${part}-${side > 0 ? 'a' : 'b'}`, kind: 'wall' as const, closed: false,
      points: run.map(sample => at(sample.axialCells, side * sample.wallCells)) })),
  ]);
}

/** The pole on the sky for the image-layer bake: its angle from the sight line and the position angle of its +z end.
 * `northClockwiseDeg` is where north points in the image, clockwise from up; east is a quarter turn counter-clockwise
 * from north, as the sky is seen. The bake needs a receding end, so an axis in the plane of the sky is tipped to
 * `maxTiltDeg` and the record says so. */
export function surfacePole(prior: SymmetryPrior, northClockwiseDeg: number, maxTiltDeg = 89) {
  const [ax, ay, az] = unitAxis(prior);
  // z toward the observer: the +z end of the file recedes when the axis points away.
  const fromSightLine = Math.acos(Math.min(1, Math.abs(az))) * 180 / Math.PI;
  const clockwiseFromUp = Math.atan2(ax, -ay) * 180 / Math.PI;
  // The position angle of the receding end: the +z end's unless that end points toward the observer.
  const plusZ = northClockwiseDeg - clockwiseFromUp, receding = az > 0 ? '-z' as const : '+z' as const;
  const paDeg = ((plusZ + (receding === '-z' ? 180 : 0)) % 360 + 360) % 360;
  return { tiltDeg: Math.min(fromSightLine, maxTiltDeg), paDeg, rollDeg: 0, receding,
    tipped: fromSightLine > maxTiltDeg, measuredTiltDeg: fromSightLine };
}
