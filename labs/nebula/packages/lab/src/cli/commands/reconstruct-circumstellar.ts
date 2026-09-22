/** Research command: reconstruct the emission of an edge-on circumstellar disc in three dimensions from its images, with the
 * axially symmetric method of Wenger, Lorenz & Magnor (2013) (methods/symmetry/solver). The symmetry axis is the disc's normal,
 * so the voxels grouped together are those at one height above the midplane and one radius from the star.
 *
 *   node --experimental-strip-types labs/nebula/run.mts reconstruct-circumstellar <object id>
 *
 * The inputs are exactly what the circumstellar author displays for each edge-on lens (tools/objects/circumstellar/author.mts
 * edgeOnSolveInputs): the stretched, tapered channels on the recipe's grid and the measured midplane. Pixels with no data (the
 * coronagraph's inner edge, beyond an image's footprint) are given no weight, and a voxel only they see takes its symmetry
 * group's emission. The command writes, into the object's source/, the density grid `density-<lens>.ktx2` in the encoding the
 * baker reads and the receipt `reconstruction-<lens>.json`: the channel digest it was solved from, the method settings, the
 * projection error per channel and a depth check against extrusion. The author then uses that grid only while the digest
 * still matches the channels it displays. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inferEmission, type InferenceGrid } from '@cssearth/nebula-reconstruction/methods/symmetry/solver';
import type { EdgeOnReconstruction, EdgeOnSolveInputs } from '../../../../../../../tools/objects/circumstellar/author.mts';

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const id = process.argv[2];
if (!id || !/^[a-z][a-z0-9-]*$/u.test(id) || process.argv.length !== 3) throw new TypeError('Usage: reconstruct-circumstellar <object id>');
const root = process.cwd(), sourceDirectory = resolve(root, 'src/objects', id, 'source');
// The lab runner bundles this command; the author and the encoder are loaded from the checkout at run time, unbundled, so the
// paths they resolve from their own location stay the repository's.
const { edgeOnSolveInputs, exposureAndOpacity, reconstructionPath } = await import(pathToFileURL(resolve(root, 'tools/objects/circumstellar/author.mts')).href) as typeof import('../../../../../../../tools/objects/circumstellar/author.mts');
const { encodeDensityKtx2 } = await import(pathToFileURL(resolve(root, 'src/preparation/volume/acquisition.ts')).href) as typeof import('../../../../../../../src/preparation/volume/acquisition.ts');
const raw = JSON.parse(await readFile(resolve(sourceDirectory, 'circumstellar.json'), 'utf8')) as { lenses: { id: string; reconstruction?: { tau?: unknown; iterations?: unknown } }[] };
const { recipe, lenses } = await edgeOnSolveInputs(id);
if (!lenses.length) throw new Error(`${id} has no edge-on lens to reconstruct.`);

/** How much of a midplane column's emission lies where the disc radius is within `width` of the column's projected distance,
 * the tangent point an edge-on disc concentrates light at, against the share a column spread evenly along the grid (an
 * extrusion) would put there. */
function tangentShare(volume: Float32Array, inputs: EdgeOnSolveInputs, size: number, step: number, projectedUnits: number, width: number) {
  const pa = inputs.geometry.positionAngleDeg * Math.PI / 180, half = size * step / 2;
  const [ax, ay, az] = inputs.axis, results: number[] = [], uniform: number[] = [];
  for (const sign of [1, -1]) {
    // The sky point on the midplane at this projected distance: along the position angle (x west, y north).
    const x = sign * -Math.sin(pa) * projectedUnits, y = sign * Math.cos(pa) * projectedUnits;
    const i = Math.round((x + half) / step - 0.5), j = Math.round((y + half) / step - 0.5);
    if (i < 0 || j < 0 || i >= size || j >= size) continue;
    let total = 0, near = 0, path = 0, nearPath = 0;
    for (let k = 0; k < size; k++) {
      const z = -half + (k + 0.5) * step, axial = x * ax + y * ay + z * az;
      const radius = Math.sqrt(Math.max(0, x * x + y * y + z * z - axial * axial)), v = volume[(k * size + j) * size + i]!;
      const inside = radius >= projectedUnits - step && radius <= projectedUnits + width;
      total += v; path++; if (inside) { near += v; nearPath++; }
    }
    if (total > 0) { results.push(near / total); uniform.push(nearPath / path); }
  }
  const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  return { projectedUnits, widthUnits: width, reconstructed: mean(results), extrusion: mean(uniform) };
}

for (const inputs of lenses) {
  const { lens, shown, sky } = inputs, size = recipe.grid.size, step = 2 * recipe.grid.halfUnits / size, pixels = size * size;
  if (sky.size !== size) throw new Error(`${lens.id}: the sky plane is ${sky.size} samples, the grid ${size}.`);
  const settings = raw.lenses.find(entry => entry.id === lens.id)?.reconstruction ?? {};
  const tau = typeof settings.tau === 'number' ? settings.tau : 0.001, iterations = typeof settings.iterations === 'number' ? settings.iterations : 200;
  const grid: InferenceGrid = { width: size, height: size, depth: size };
  // The star is the grid's centre; the axis is the disc normal in the grid's own axes (x column, y row, z toward the observer).
  const prior = { axis: inputs.axis, center: [(size - 1) / 2, (size - 1) / 2, (size - 1) / 2] as const, binWidth: 1 };
  const weights = Float32Array.from(shown[0]!, (_, p) => shown.every(channel => Number.isFinite(channel[p]!)) ? 1 : 0);
  // Only the blank inside the inner edge is filled by symmetry: there the disc's near and far sides cross the line of sight and
  // the rest of the ring constrains them. Beyond an image's footprint nothing was observed and nothing is extrapolated.
  const fillable = Uint8Array.from(shown[0]!, (_, p) => {
    if (weights[p]! > 0) return 0;
    const i = p % size, j = Math.floor(p / size), x = -recipe.grid.halfUnits + (i + 0.5) * step, y = -recipe.grid.halfUnits + (j + 0.5) * step;
    return Math.hypot(x, y) < inputs.innerMaskUnits ? 1 : 0;
  });
  const volumes: Float32Array[] = [], reports: { relativeProjectionError: number; iteration: number }[] = [], fills: { filledVoxels: number; unobservedGroups: number }[] = [];
  const solved = new Map<string, number>();
  for (const [c, channel] of shown.entries()) {
    const image = Float32Array.from(channel, (v, p) => weights[p]! > 0 ? Math.max(0, v) : 0), key = sha256(new Uint8Array(image.buffer));
    // A lens that feeds one band to every channel is solved once.
    const again = solved.get(key);
    if (again !== undefined) { volumes.push(volumes[again]!); reports.push(reports[again]!); fills.push(fills[again]!); continue; }
    const started = Date.now();
    const result = inferEmission({ grid, image, weights, fillable, prior, tau, iterations,
      onIteration: report => { if (report.iteration % 25 === 0) console.log(`${lens.id} channel ${c}: iteration ${report.iteration}, projection error ${report.relativeProjectionError.toFixed(4)}`); } });
    console.log(`${lens.id} channel ${c}: ${((Date.now() - started) / 1000).toFixed(0)} s, projection error ${result.report.relativeProjectionError.toFixed(4)}, ${result.fill.filledVoxels} voxels filled from their groups`);
    solved.set(key, volumes.length); volumes.push(result.volume); reports.push(result.report); fills.push(result.fill);
  }
  // Solver units reproject as the column sum over the square root of the depth; per unit length that is v / (sqrt(depth) step),
  // so a column's integral is the displayed value it reprojects to, the scale the author's exposure assumes.
  const perLength = 1 / (Math.sqrt(size) * step);
  let peak = 0;
  for (const volume of volumes) for (const v of volume) peak = Math.max(peak, v * perLength);
  if (!(peak > 0)) throw new Error(`${lens.id}: the reconstruction is empty.`);
  const rgba = new Uint8Array(pixels * size * 4), integral = volumes.map(() => new Float64Array(pixels));
  let filledVoxels = 0;
  for (let voxel = 0; voxel < pixels * size; voxel++) {
    let any = false;
    for (const [c, volume] of volumes.entries()) {
      const byte = Math.round(255 * Math.sqrt(Math.min(1, volume[voxel]! * perLength / peak)));
      if (!byte) continue;
      rgba[4 * voxel + c] = byte; any = true;
      integral[c]![voxel % pixels]! += (byte / 255) ** 2 * peak * step;
    }
    if (any) filledVoxels++;
  }
  const ktx2 = encodeDensityKtx2({ width: size, height: size, depth: size, encodedRgba: rgba }, 9), file = `density-${lens.id}.ktx2`;
  const { exposureGain, opacity } = exposureAndOpacity(lens.topAlpha, peak, integral);
  const mean = volumes[0]!.map((_, i) => volumes.reduce((total, volume) => total + volume[i]!, 0) / volumes.length);
  const record: EdgeOnReconstruction = {
    schema: 'cssearth-circumstellar-reconstruction@1', objectId: id, lensId: lens.id, shownSha256: inputs.shownSha256,
    grid: { size, halfUnits: recipe.grid.halfUnits },
    method: { name: 'axial-symmetry emission inference', paper: 'Wenger, Lorenz & Magnor (2013), Computer Graphics Forum 32, 93; doi:10.1111/cgf.12216',
      implementation: 'labs/nebula/packages/reconstruction/src/methods/symmetry/solver.ts', command: `node --experimental-strip-types labs/nebula/run.mts reconstruct-circumstellar ${id}`,
      axis: inputs.axis, center: prior.center, binWidthVoxels: prior.binWidth, tau, iterations,
      weights: 'one for pixels with displayed data, zero under the inner edge and beyond the footprint; a voxel seen only through the blank inside the inner edge takes its group mean, and one seen only beyond the footprint stays empty' },
    ktx2: { path: file, sha256: sha256(ktx2), bytes: ktx2.length }, decodedSha256: sha256(rgba), peak, filledVoxels, exposureGain, opacity,
    checks: {
      relativeProjectionError: reports.map(report => +report.relativeProjectionError.toFixed(4)),
      voxelsFilledFromGroups: fills.map(fill => fill.filledVoxels), groupsWithNoObservedVoxel: fills.map(fill => fill.unobservedGroups),
      weightedPixels: weights.reduce((total, w) => total + w, 0), pixels,
      tangentShare: [0.3, 0.5, 0.7].map(fraction => tangentShare(mean, inputs, size, step, Math.max(inputs.innerMaskUnits * 1.1, fraction * inputs.taperFromUnits), 20)),
    },
  };
  await writeFile(resolve(sourceDirectory, file), ktx2);
  await writeFile(resolve(sourceDirectory, reconstructionPath(lens)), `${JSON.stringify(record, null, 2)}\n`);
  console.log(`RECONSTRUCTED ${id}/${lens.id}: ${JSON.stringify(record.checks)}`);
}
