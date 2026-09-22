#!/usr/bin/env node
/** The published imaging of a resolved, bright Solar System body: fit a limb-darkened disc to its visibilities, self-calibrate
 * against that disc, and image the result.
 *
 *   node tools/objects/interferometry/alma-disc-selfcal.mts <continuum.ms> --body Europa --radius-km 1560.8 \
 *     --scratch <dir> --out <directory> [--flux-scale 0.907 --flux-scale-source "Trumbo et al. 2018"]
 *
 * Trumbo, Brown & Butler (2018, AJ 156, 161, doi:10.3847/1538-3881/aada87) took ALMA's own calibration of these data and went
 * on in AIPS: they self-calibrated in three rounds down to 8 second solutions, each round starting from a limb-darkened disc
 * whose diameter is known from the observing geometry and whose total flux density and limb-darkening parameter are fitted to
 * the visibilities with OMFIT, imaging more deeply each time; then they imaged with robust 0. This module does the equivalent
 * in CASA 6.7.
 *
 * Why a disc model rather than a blank start. Europa was about 0.77 arcseconds across, wider than the array's largest
 * recoverable scale of about 0.65 arcseconds, so the shortest baselines do not measure the whole disc and a CLEAN that starts
 * from nothing has no zero-spacing flux to anchor it. The fitted disc supplies it, which is why the paper fits the visibilities
 * at every step rather than once.
 *
 * What is owned where. The visibility model, the fit, the brightness-temperature conversion and every number in the receipt are
 * here, in TypeScript, and are tested. CASA reads the measurement set, grids the visibilities the fit is run on, makes the
 * model image on the imaging grid, solves and applies the gains and cleans. The fitted parameters cross the boundary as
 * numbers, and the disc profile is written into the generated script from the one statement of it in this file. */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { measureSource, readContinuumImage } from './alma-image.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { toolchainDescriptor, toolchainPath } from './toolchain.mts';
import { sha256 } from '../../../src/platform/sha256.mts';
import { pinFile, readProductRecord, runDigest, sameRun, writeProductRecord, type ProductInput, type ProductRun } from '../product-record.mts';

const RADIANS_PER_MAS = Math.PI / (180 * 3.6e6);
const ASTRONOMICAL_UNIT_KM = 149_597_870.7;
const LIGHT_SPEED = 299_792_458;
const PLANCK = 6.626_070_15e-34;
const BOLTZMANN = 1.380_649e-23;
/** The temperature of the cosmic microwave background (Fixsen 2009, ApJ 707, 916). */
export const CMB_KELVIN = 2.7255;

/** Bessel function of the first kind, order zero, from Abramowitz & Stegun 9.4.1 and 9.4.3: absolute error below 5e-8 for
 * arguments under 3 and below 1.6e-8 above it, which is far finer than the visibilities are measured. */
export function besselJ0(x: number) {
  const absolute = Math.abs(x);
  if (absolute < 3) {
    const y = (absolute / 3) ** 2;
    return 1 + y * (-2.2499997 + y * (1.2656208 + y * (-0.3163866 + y * (0.0444479 + y * (-0.0039444 + y * 0.0002100)))));
  }
  const y = 3 / absolute;
  const amplitude = 0.79788456 + y * (-0.00000077 + y * (-0.00552740 + y * (-0.00009512 + y * (0.00137237 + y * (-0.00072805 + y * 0.00014476)))));
  const phase = absolute - 0.78539816 + y * (-0.04166397 + y * (-0.00003954 + y * (0.00262573 + y * (-0.00054125 + y * (-0.00029333 + y * 0.00013558)))));
  return amplitude * Math.cos(phase) / Math.sqrt(absolute);
}

/** The visibility of a limb-darkened disc of unit total flux, at a baseline measured in wavelengths.
 *
 * The disc's surface brightness falls as the cosine of the emission angle raised to the limb-darkening parameter,
 * `I(mu) = mu^p`, which on the sky is `(1 - r^2/R^2)^(p/2)`; `p = 0` is a uniform disc and larger `p` a darker limb. This is
 * the form AIPS OMFIT fits and the one Butler & Bastian (1999) describe for Solar System discs.
 *
 * Its Hankel transform has a closed form in Bessel functions of order `p/2 + 1`, which would need a Bessel function of
 * arbitrary order; the transform is taken by quadrature instead, over the substitution `r/R = sin(t)`, which removes the edge
 * singularity of the profile and leaves a smooth integrand. At `p = 0` this reproduces `2 J1(x) / x` to seven digits, which the
 * tests check at the disc's nulls. */
export function limbDarkenedDiscVisibility(baselineWavelengths: number, diameterRadians: number, limbDarkening: number, steps = 800) {
  if (!(diameterRadians > 0)) throw new RangeError('A disc has a positive angular diameter.');
  if (!(limbDarkening >= 0)) throw new RangeError('A limb-darkening parameter is not negative.');
  const x = Math.PI * diameterRadians * baselineWavelengths;
  if (x === 0) return 1;
  const half = Math.PI / 2 / (2 * steps);
  let sum = 0;
  // Simpson over t in [0, pi/2] of cos(t)^p * J0(x sin t) * sin t cos t, normalised by its value at x = 0, which is 1/(p+2).
  for (let index = 0; index <= 2 * steps; index++) {
    const t = index * half;
    // The last sample lands on pi/2, where rounding can put the cosine a hair below zero and a fractional power of it at NaN.
    const value = Math.max(0, Math.cos(t)) ** (limbDarkening + 1) * besselJ0(x * Math.sin(t)) * Math.sin(t);
    sum += (index === 0 || index === 2 * steps ? 1 : index % 2 === 1 ? 4 : 2) * value;
  }
  return (limbDarkening + 2) * sum * half / 3;
}

/** One cell of the gridded visibilities the fit is run on: a weighted mean of every sample that fell in it. */
export interface GriddedVisibility {
  /** Baseline coordinates in wavelengths. */
  readonly u: number; readonly v: number;
  readonly real: number; readonly imaginary: number;
  readonly weight: number;
}

export interface DiscFit {
  readonly totalFluxJy: number;
  readonly limbDarkening: number;
  /** Where the disc's centre sits relative to the phase centre the ephemeris tracks. */
  readonly offsetRaMas: number; readonly offsetDecMas: number;
  readonly diameterMas: number;
  readonly reducedChiSquared: number;
  readonly cells: number;
  readonly shortestBaselineWavelengths: number;
  readonly longestBaselineWavelengths: number;
}

/** The disc's visibility sampled on an even grid of baseline length, so a fit over a hundred thousand cells evaluates the
 * quadrature once per sample instead of once per cell. The function is smooth in baseline — about fifteen oscillations over
 * ALMA's longest configuration at this frequency — so the table is read back by linear interpolation. */
function amplitudeTable(diameterRadians: number, limbDarkening: number, longestBaseline: number, samples = 4096) {
  const table = new Float64Array(samples + 1);
  for (let index = 0; index <= samples; index++) {
    table[index] = limbDarkenedDiscVisibility(longestBaseline * index / samples, diameterRadians, limbDarkening);
  }
  return table;
}

/** The total flux that best fits the cells at a given shape and position, and the weighted sum of squared residuals it leaves.
 * The flux is linear in the model, so it is solved rather than searched. */
function scaleAndResidual(cells: readonly GriddedVisibility[], table: Float64Array, longestBaseline: number, offsetRa: number, offsetDec: number) {
  const last = table.length - 1;
  const amplitude = (baseline: number) => {
    const position = Math.min(last, baseline / longestBaseline * last);
    const floor = Math.floor(position);
    return table[floor]! + (position - floor) * ((table[Math.min(last, floor + 1)] ?? table[floor]!) - table[floor]!);
  };
  let cross = 0, square = 0;
  const real = new Float64Array(cells.length), imaginary = new Float64Array(cells.length);
  for (const [index, cell] of cells.entries()) {
    const value = amplitude(Math.hypot(cell.u, cell.v));
    // CASA's baseline coordinates go with the transform that carries a `+` here, so an offset east of the phase centre is a
    // positive `offsetRa`. The sign is not taken on trust: `discSelfCalibrate` checks the fitted offset against the centroid
    // of the image the same visibilities make, which the first run showed at 75.2 mas where the fit gave 76.8.
    const phase = 2 * Math.PI * (cell.u * offsetRa + cell.v * offsetDec);
    real[index] = value * Math.cos(phase); imaginary[index] = value * Math.sin(phase);
    cross += cell.weight * (cell.real * real[index]! + cell.imaginary * imaginary[index]!);
    square += cell.weight * (real[index]! * real[index]! + imaginary[index]! * imaginary[index]!);
  }
  if (!(square > 0)) throw new RangeError('The disc model is zero on every gridded cell.');
  const flux = cross / square;
  let residual = 0;
  for (const [index, cell] of cells.entries()) {
    residual += cell.weight * ((cell.real - flux * real[index]!) ** 2 + (cell.imaginary - flux * imaginary[index]!) ** 2);
  }
  return { flux, residual };
}

/** Nelder–Mead on the three parameters that are not linear in the model: the limb darkening and the two offsets. */
function search(start: readonly number[], cost: (point: readonly number[]) => number, steps: readonly number[]) {
  const dimension = start.length;
  let simplex = [start, ...steps.map((step, index) => start.map((value, other) => (other === index ? value + step : value)))]
    .map(point => ({ point, value: cost(point) }));
  for (let iteration = 0; iteration < 400; iteration++) {
    simplex.sort((a, b) => a.value - b.value);
    const best = simplex[0]!, worst = simplex.at(-1)!;
    if (Math.abs(worst.value - best.value) <= 1e-10 * (Math.abs(best.value) + 1e-12)) break;
    const centroid = Array.from({ length: dimension }, (_, index) =>
      simplex.slice(0, -1).reduce((sum, entry) => sum + entry.point[index]!, 0) / (simplex.length - 1));
    const at = (factor: number) => centroid.map((value, index) => value + factor * (value - worst.point[index]!));
    const reflected = { point: at(1), value: cost(at(1)) };
    if (reflected.value < best.value) {
      const expanded = { point: at(2), value: cost(at(2)) };
      simplex[simplex.length - 1] = expanded.value < reflected.value ? expanded : reflected;
    } else if (reflected.value < simplex.at(-2)!.value) simplex[simplex.length - 1] = reflected;
    else {
      const contracted = { point: at(-0.5), value: cost(at(-0.5)) };
      if (contracted.value < worst.value) simplex[simplex.length - 1] = contracted;
      else simplex = simplex.map(entry => ({ point: entry.point.map((value, index) => (best.point[index]! + value) / 2), value: 0 }))
        .map(entry => ({ point: entry.point, value: cost(entry.point) }));
    }
  }
  simplex.sort((a, b) => a.value - b.value);
  return simplex[0]!.point;
}

/** The limb-darkened disc that best fits the gridded visibilities, at a diameter the observing geometry fixes.
 *
 * The diameter is not fitted: the paper takes it as known, because a body's radius and its distance are known far better than
 * a millimetre interferometer can measure them. What is fitted is the total flux density, the limb darkening and the position
 * of the disc relative to the phase centre the ephemeris tracks. */
export function fitLimbDarkenedDisc(cells: readonly GriddedVisibility[], diameterRadians: number, limbDarkeningStep = 0.05): DiscFit {
  if (cells.length < 16) throw new Error('A disc fit needs at least sixteen gridded visibility cells.');
  const baselines = cells.map(cell => Math.hypot(cell.u, cell.v));
  const longest = Math.max(...baselines);
  // The limb darkening is scanned and then refined, as the uniform-disc fit scans diameter: it enters only through the
  // amplitude table, so one table serves a whole search over where the disc sits. The offsets start from the best so far.
  let start: [number, number] = [0, 0];
  const at = (limbDarkening: number) => {
    const table = amplitudeTable(diameterRadians, limbDarkening, longest);
    const offsets = search(start, point => scaleAndResidual(cells, table, longest, point[0]! * RADIANS_PER_MAS, point[1]! * RADIANS_PER_MAS).residual, [5, 5]) as [number, number];
    return { limbDarkening, offsets, ...scaleAndResidual(cells, table, longest, offsets[0] * RADIANS_PER_MAS, offsets[1] * RADIANS_PER_MAS) };
  };
  let best = at(0);
  for (let value = limbDarkeningStep; value <= 2 + 1e-9; value += limbDarkeningStep) {
    const candidate = at(value);
    if (candidate.residual < best.residual) { best = candidate; start = candidate.offsets; }
  }
  // Golden-section refinement inside the best step of the scan.
  let low = Math.max(0, best.limbDarkening - limbDarkeningStep), high = best.limbDarkening + limbDarkeningStep;
  const cache = new Map<number, ReturnType<typeof at>>();
  const value = (point: number) => { const found = cache.get(point) ?? at(point); cache.set(point, found); return found; };
  for (let iteration = 0; iteration < 20; iteration++) {
    const a = high - (high - low) / 1.618034, b = low + (high - low) / 1.618034;
    if (value(a).residual < value(b).residual) high = b; else low = a;
  }
  const refined = at((low + high) / 2);
  if (refined.residual < best.residual) best = refined;
  const { limbDarkening, offsets: [offsetRaMas, offsetDecMas], flux, residual } = best;
  return { totalFluxJy: flux, limbDarkening, offsetRaMas, offsetDecMas, diameterMas: diameterRadians / RADIANS_PER_MAS,
    // Two numbers are fitted per cell, the real and the imaginary part, against four parameters.
    reducedChiSquared: residual / (2 * cells.length - 4), cells: cells.length,
    shortestBaselineWavelengths: Math.min(...baselines), longestBaselineWavelengths: longest };
}

/** The angular diameter of a body of known radius at a known distance. */
export const angularDiameterRadians = (radiusKm: number, distanceAu: number) => 2 * radiusKm / (distanceAu * ASTRONOMICAL_UNIT_KM);

/** The solid angle of an elliptical Gaussian restoring beam, from its half-power axes. */
export const beamSolidAngle = (majorRadians: number, minorRadians: number) => Math.PI * majorRadians * minorRadians / (4 * Math.LN2);

/** The brightness temperature of a specific intensity, by inverting the Planck function rather than its Rayleigh–Jeans limit.
 *
 * At 233 GHz and about 100 kelvin the two differ by 5.5 kelvin, close to h nu / 2k, which is a large fraction of the thermal
 * structure the image is made to show. The paper states the frequency it works at and no conversion, so the Planck form is
 * used and said so. */
export function brightnessTemperatureKelvin(intensity: number, frequencyHz: number) {
  if (!(intensity > 0)) return Number.NaN;
  const factor = 2 * PLANCK * frequencyHz ** 3 / LIGHT_SPEED ** 2;
  return PLANCK * frequencyHz / BOLTZMANN / Math.log1p(factor / intensity);
}

/** The Planck brightness of a temperature, used for the background term. */
export function planckIntensity(temperatureKelvin: number, frequencyHz: number) {
  return 2 * PLANCK * frequencyHz ** 3 / LIGHT_SPEED ** 2 / Math.expm1(PLANCK * frequencyHz / (BOLTZMANN * temperatureKelvin));
}

/** One round of self-calibration: how deeply to clean before solving, and over how long to solve.
 *
 * The paper states three rounds and that the last solves over 8 seconds. It does not state the first two intervals or how deep
 * each clean went, so those are this route's and are marked as such in the receipt. */
export interface SelfCalibrationRound {
  readonly solutionInterval: string;
  readonly iterations: number;
  readonly fromPaper: boolean;
}
export const PUBLISHED_ROUNDS: readonly SelfCalibrationRound[] = [
  { solutionInterval: 'inf', iterations: 1000, fromPaper: false },
  { solutionInterval: '30s', iterations: 3000, fromPaper: false },
  { solutionInterval: '8s', iterations: 10_000, fromPaper: true },
];

const python = (value: unknown): string => {
  if (typeof value === 'string') return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : (() => { throw new RangeError('A non-finite number cannot be written to the script.'); })();
  if (Array.isArray(value)) return `[${value.map(entry => python(entry)).join(', ')}]`;
  throw new TypeError('A value the script cannot be written with.');
};

/** The disc profile as a numpy expression over a grid of radii in units of the disc radius. One statement of the profile, the
 * same one `limbDarkenedDiscVisibility` transforms, written into the script that makes the model image. */
export const discProfileExpression = (limbDarkening: number) =>
  `numpy.where(rho <= 1.0, numpy.clip(1.0 - rho * rho, 0.0, None) ** ${python(limbDarkening / 2)}, 0.0)`;

export interface DiscSelfCalibrationOptions {
  /** The continuum measurement set the restore produced, with the body as its only field. */
  readonly visibilities: string;
  readonly body: string;
  readonly radiusKm: number;
  readonly referenceAntenna: string;
  readonly cell: string;
  readonly imageSize: readonly [number, number];
  readonly robust: number;
  readonly rounds: readonly SelfCalibrationRound[];
  /** The correction the paper made to ALMA's flux-density scale for this date, and where it comes from. */
  readonly fluxScale: number;
  readonly fluxScaleSource: string;
  readonly scratch: string;
  readonly out: string;
  /** Baseline grid cell for the fit, in wavelengths. */
  readonly gridCellWavelengths: number;
}

/** The CASA script for one stage of the route. Each stage is a separate run so the fit between them is this module's. */
export function discSelfCalibrationScript(stage: 'grid' | 'round' | 'final', options: DiscSelfCalibrationOptions, state: {
  readonly round: number; readonly visibilities: string; readonly fit?: DiscFit; readonly frequencyHz?: number;
}) {
  const at = (name: string) => `${options.scratch}/${name}`;
  const preamble = [
    'import os, sys, json, shutil, glob',
    'import numpy',
    'from casatools import table, ms, image, quanta',
    'from casatasks import tclean, gaincal, applycal, split, gencal, exportfits, importfits, casalog',
    `casalog.setlogfile(${python(`${options.out}/${options.body}.selfcal.casa.log`)})`,
  ];
  if (stage === 'grid') {
    // The visibilities are read in row chunks and gridded as they come: the continuum set is small, but nothing here needs the
    // whole data column resident, and the same code then serves a set that is not.
    return [...preamble,
      `vis = ${python(state.visibilities)}`,
      "tb = table(); tb.open(vis + '/SPECTRAL_WINDOW')",
      "frequencies = [tb.getcell('CHAN_FREQ', row) for row in range(tb.nrows())]",
      'tb.close()',
      "tb.open(vis + '/DATA_DESCRIPTION'); windows = tb.getcol('SPECTRAL_WINDOW_ID'); tb.close()",
      `tb.open(vis)`,
      'rows = tb.nrows()',
      `cell = ${python(options.gridCellWavelengths)}`,
      'grid = {}',
      'weighted_frequency = 0.0; total_weight = 0.0',
      'chunk = 20000',
      'for start in range(0, rows, chunk):',
      '    count = min(chunk, rows - start)',
      "    uvw = tb.getcol('UVW', start, count)",
      "    data = tb.getcol('DATA', start, count)",
      "    flag = tb.getcol('FLAG', start, count)",
      "    weight = tb.getcol('WEIGHT', start, count)",
      "    descriptions = tb.getcol('DATA_DESC_ID', start, count)",
      "    rowflag = tb.getcol('FLAG_ROW', start, count)",
      // Stokes I from the two linear feeds, which is what the paper measures; the cross terms were not recorded. Each
      // spectral window in the chunk is gridded in one pass, because its channels share one frequency axis.
      '    stokes = 0.5 * (data[0] + data[-1])',
      '    good = (~(flag[0] | flag[-1])) & (~rowflag)[None, :]',
      '    rowweight = weight[0] + weight[-1]',
      '    good &= (rowweight > 0)[None, :]',
      '    for description in numpy.unique(descriptions):',
      '        selected = descriptions == description',
      '        channels = frequencies[windows[description]]',
      `        scale = channels / ${python(LIGHT_SPEED)}`,
      '        u = uvw[0, selected][None, :] * scale[:, None]',
      '        v = uvw[1, selected][None, :] * scale[:, None]',
      '        keep = good[:, selected]',
      '        if not keep.any(): continue',
      '        w = numpy.broadcast_to(rowweight[selected][None, :], keep.shape)[keep]',
      '        values = stokes[:, selected][keep]',
      '        iu = numpy.round(u[keep] / cell).astype(numpy.int64)',
      '        iv = numpy.round(v[keep] / cell).astype(numpy.int64)',
      '        keys = (iu + 1_000_000) * 4_000_000 + (iv + 1_000_000)',
      '        unique, inverse = numpy.unique(keys, return_inverse=True)',
      '        length = unique.size',
      '        sums = numpy.stack([numpy.bincount(inverse, weights=column, minlength=length) for column in',
      '                            (w * u[keep], w * v[keep], w * values.real, w * values.imag, w)])',
      '        for entry in range(length):',
      '            current = grid.get(int(unique[entry]))',
      '            if current is None: current = [0.0, 0.0, 0.0, 0.0, 0.0]; grid[int(unique[entry])] = current',
      '            for column in range(5): current[column] += float(sums[column, entry])',
      '        weighted_frequency += float((w * numpy.broadcast_to(channels[:, None], keep.shape)[keep]).sum())',
      '        total_weight += float(w.sum())',
      'tb.close()',
      'cells = [dict(u=entry[0] / entry[4], v=entry[1] / entry[4], real=entry[2] / entry[4], imaginary=entry[3] / entry[4], weight=entry[4])',
      '         for entry in grid.values() if entry[4] > 0]',
      `open(${python(`${options.out}/${options.body}.round${state.round}.uv.json`)}, 'w').write(json.dumps(dict(`,
      '    frequencyHz=weighted_frequency / total_weight, cells=cells)))',
      `print('gridded', len(cells), 'cells')`,
    ].join('\n') + '\n';
  }
  const fit = state.fit;
  if (!fit) throw new TypeError('A self-calibration round needs the disc fit it starts from.');
  const pixelMas = Number(options.cell.replace(/mas$/u, ''));
  if (!(pixelMas > 0)) throw new TypeError(`This route images on a grid stated in milliarcseconds; the cell is ${options.cell}.`);
  const image = at(`${options.body}.round${state.round}`);
  // The model sits under its own prefix: clearing `<image>.*` before a clean would otherwise take the model with it.
  const model = at(`${options.body}.disc${state.round}`);
  const tcleanArguments = [
    `vis=${python(state.visibilities)}`, `imagename=${python(image)}`, `field=${python(options.body)}`,
    "phasecenter='TRACKFIELD'", "specmode='mfs'", "deconvolver='multiscale'", 'scales=[0, 5, 15, 30, 60, 120]',
    "gridder='standard'", `imsize=${python([...options.imageSize])}`, `cell=${python(options.cell)}`,
    "weighting='briggs'", `robust=${python(options.robust)}`, "interactive=False", 'pbcor=True',
  ];
  const discImage = [
    // The model is made on the imaging grid, so that tclean takes it as a start model without regridding it: an empty image is
    // made first with exactly the arguments the clean will use, then its pixels are replaced by the fitted disc.
    `shutil.rmtree(${python(model)}, ignore_errors=True)`,
    `for product in glob.glob(${python(`${image}.*`)}):`,
    '    if os.path.isdir(product): shutil.rmtree(product)',
    // An empty clean writes `.model`, which is already the imaging grid in janskys per pixel: the right template.
    `tclean(${[...tcleanArguments, 'niter=0'].join(', ')})`,
    `shutil.copytree(${python(`${image}.model`)}, ${python(model)})`,
    `ia = image(); ia.open(${python(model)})`,
    'shape = ia.shape()',
    `radius = ${python(fit.diameterMas / 2 / pixelMas)}`,
    // Right ascension decreases as the first pixel axis increases, so a disc east of the phase centre sits at a lower index.
    `x = numpy.arange(shape[0]) - (shape[0] / 2 - ${python(fit.offsetRaMas / pixelMas)})`,
    `y = numpy.arange(shape[1]) - (shape[1] / 2 + ${python(fit.offsetDecMas / pixelMas)})`,
    "gx, gy = numpy.meshgrid(x, y, indexing='ij')",
    'rho = numpy.sqrt(gx * gx + gy * gy) / radius',
    `profile = ${discProfileExpression(fit.limbDarkening)}`,
    // The last clean runs on the flux-scaled visibilities, so the disc it starts from carries the same correction.
    `profile = profile * (${python(fit.totalFluxJy * (stage === 'final' ? options.fluxScale : 1))} / profile.sum())`,
    'pixels = numpy.zeros(shape, dtype=numpy.float32)',
    'pixels[:, :, 0, 0] = profile.astype(numpy.float32)',
    'ia.putchunk(pixels); ia.close()',
    `print('disc model total', float(profile.sum()), 'Jy')`,
    // The reducer of an AIPS run draws a CLEAN box round the body. Without one, multiscale CLEAN at three thousand iterations
    // wandered over the empty field, stopped on "peak residual increased by more than 3 times from the minimum reached", and
    // left a model whose gains made the data worse: the residual noise went from 1.19e-4 to 4.38e-4 Jy per beam between the
    // first two rounds. The box here is the fitted disc grown by one beam, so it comes from the fit rather than from taste.
    `ia = image(); ia.open(${python(`${image}.image`)})`,
    'qa = quanta()',
    "beam = qa.convert(ia.restoringbeam()['major'], 'arcsec')['value'] * 1000.0",
    'ia.close()',
    `box = "circle[[%.2fpix, %.2fpix], %.2fpix]" % (shape[0] / 2 - ${python(fit.offsetRaMas / pixelMas)}, ` +
      `shape[1] / 2 + ${python(fit.offsetDecMas / pixelMas)}, ${python(fit.diameterMas / 2 / pixelMas)} + beam / ${python(pixelMas)})`,
    "print('clean box', box)",
  ];
  if (stage === 'round') {
    const round = options.rounds[state.round - 1]!;
    const table = at(`${options.body}.round${state.round}.phase`);
    const next = at(`${options.body}.round${state.round}.selfcal.ms`);
    return [...preamble, ...discImage,
      `for product in glob.glob(${python(`${image}.*`)}):`,
      '    if os.path.isdir(product): shutil.rmtree(product)',
      // The clean starts from the fitted disc, which carries the flux the shortest baselines do not measure, and stays inside
      // the box that disc defines.
      `tclean(${[...tcleanArguments, `niter=${python(round.iterations)}`, `startmodel=${python(model)}`, "savemodel='modelcolumn'", "threshold='0mJy'", 'mask=box'].join(', ')})`,
      `exportfits(imagename=${python(`${image}.image.pbcor`)}, fitsimage=${python(`${options.out}/${options.body}.round${state.round}.fits`)}, overwrite=True, dropdeg=False)`,
      `exportfits(imagename=${python(`${image}.residual`)}, fitsimage=${python(`${options.out}/${options.body}.round${state.round}.residual.fits`)}, overwrite=True, dropdeg=False)`,
      // Phase only, as the paper self-calibrates: an amplitude solution against a model of the source would let the model set
      // the flux scale, which the flux-scale correction below is there to set.
      //
      // One solution across the whole band, not one per spectral window. The paper reaches 8 second solutions "because Europa
      // is such a bright target", and that is only true of the four windows together: solved per window at 30 seconds, a fifth
      // of the solutions fell below signal-to-noise 3 here, and at 8 seconds most would. Combining them multiplies the
      // signal-to-noise by two, and the map that spreads the one solution back over the windows is built from the set itself.
      `tb = table(); tb.open(${python(`${state.visibilities}/SPECTRAL_WINDOW`)}); windows = tb.nrows(); tb.close()`,
      `shutil.rmtree(${python(table)}, ignore_errors=True)`,
      `gaincal(vis=${python(state.visibilities)}, caltable=${python(table)}, field=${python(options.body)}, ` +
        `solint=${python(round.solutionInterval)}, refant=${python(options.referenceAntenna)}, calmode='p', gaintype='T', combine='spw', minsnr=3.0)`,
      `applycal(vis=${python(state.visibilities)}, field=${python(options.body)}, gaintable=${python([table])}, interp=['linear'], ` +
        'spwmap=[[0] * windows], calwt=False, applymode=\'calonly\', flagbackup=False)',
      `shutil.rmtree(${python(next)}, ignore_errors=True); shutil.rmtree(${python(`${next}.flagversions`)}, ignore_errors=True)`,
      // The corrected data become the next round's input, so each round's gains are carried without re-applying a growing list.
      `split(vis=${python(state.visibilities)}, outputvis=${python(next)}, datacolumn='corrected', keepflags=True)`,
      `tb = table(); tb.open(${python(table)}); solutions = tb.nrows(); flagged = int(tb.getcol('FLAG').sum()); total = int(tb.getcol('FLAG').size); tb.close()`,
      `open(${python(`${options.out}/${options.body}.round${state.round}.gains.json`)}, 'w').write(json.dumps(dict(`,
      `    solutionInterval=${python(round.solutionInterval)}, solutions=solutions, flaggedSolutions=flagged, totalSolutions=total)))`,
      `print('round ${state.round} solved', solutions, 'solutions,', flagged, 'of', total, 'flagged')`,
    ].join('\n') + '\n';
  }
  const scaled = at(`${options.body}.fluxscaled.ms`);
  const scaleTable = at(`${options.body}.fluxscale`);
  const final = at(`${options.body}.final`);
  return [...preamble,
    // The paper corrected ALMA's flux-density scale on the visibilities. applycal divides by the gains, so the gain that
    // multiplies the data by the factor is one over its square root, and the run checks the amplitude ratio it actually
    // produced rather than trusting that reasoning.
    `shutil.rmtree(${python(scaled)}, ignore_errors=True); shutil.rmtree(${python(`${scaled}.flagversions`)}, ignore_errors=True)`,
    `split(vis=${python(state.visibilities)}, outputvis=${python(scaled)}, datacolumn='data', keepflags=True)`,
    `shutil.rmtree(${python(scaleTable)}, ignore_errors=True)`,
    `gencal(vis=${python(scaled)}, caltable=${python(scaleTable)}, caltype='amp', parameter=[${python(1 / Math.sqrt(options.fluxScale))}])`,
    `applycal(vis=${python(scaled)}, gaintable=${python([scaleTable])}, calwt=False, flagbackup=False)`,
    `tb = table(); tb.open(${python(scaled)})`,
    "sample = min(tb.nrows(), 50000)",
    "before = numpy.abs(tb.getcol('DATA', 0, sample)); after = numpy.abs(tb.getcol('CORRECTED_DATA', 0, sample))",
    "keep = ~tb.getcol('FLAG', 0, sample)",
    'tb.close()',
    'ratio = float(after[keep].mean() / before[keep].mean())',
    `if abs(ratio - ${python(options.fluxScale)}) > 0.002: sys.exit(f'The flux-scale correction multiplied the visibilities by {ratio:.4f}, not ${options.fluxScale}.')`,
    `print('flux scale applied:', ratio)`,
    ...discImage.map(line => line.replaceAll(state.visibilities, scaled)),
    `for product in glob.glob(${python(`${final}.*`)}):`,
    '    if os.path.isdir(product): shutil.rmtree(product)',
    `tclean(${[...tcleanArguments.map(argument => argument.replace(`vis=${python(state.visibilities)}`, `vis=${python(scaled)}`).replace(`imagename=${python(image)}`, `imagename=${python(final)}`)),
      `niter=${python(options.rounds.at(-1)!.iterations)}`, `startmodel=${python(model)}`, "threshold='0mJy'", 'mask=box'].join(', ')})`,
    `exportfits(imagename=${python(`${final}.image.pbcor`)}, fitsimage=${python(`${options.out}/${options.body}.final.fits`)}, overwrite=True, dropdeg=False)`,
    `exportfits(imagename=${python(`${final}.residual`)}, fitsimage=${python(`${options.out}/${options.body}.final.residual.fits`)}, overwrite=True, dropdeg=False)`,
    // The brightness-temperature map is made from the same pixels, converted with the image's own beam and frequency.
    `ia = image(); ia.open(${python(`${final}.image.pbcor`)})`,
    'beam = ia.restoringbeam(); summary = ia.summary(list=False)',
    'qa = quanta()',
    "major = qa.convert(beam['major'], 'rad')['value']; minor = qa.convert(beam['minor'], 'rad')['value']",
    'pixels = ia.getchunk()',
    `frequency = ${python(state.frequencyHz ?? 0)}`,
    `solid = numpy.pi * major * minor / (4 * numpy.log(2))`,
    'intensity = pixels / solid * 1e-26',
    `factor = 2 * ${python(PLANCK)} * frequency ** 3 / ${python(LIGHT_SPEED)} ** 2`,
    'with numpy.errstate(divide=\'ignore\', invalid=\'ignore\'):',
    `    temperature = ${python(PLANCK)} * frequency / ${python(BOLTZMANN)} / numpy.log1p(factor / numpy.where(intensity > 0, intensity, numpy.nan))`,
    'temperature = numpy.nan_to_num(temperature, nan=0.0, posinf=0.0, neginf=0.0).astype(numpy.float32)',
    `out = ia.subimage(outfile=${python(`${final}.tb`)}, overwrite=True)`,
    'out.putchunk(temperature)',
    "out.setbrightnessunit('K')",
    'out.close(); ia.close()',
    `exportfits(imagename=${python(`${final}.tb`)}, fitsimage=${python(`${options.out}/${options.body}.final.brightness-temperature.fits`)}, overwrite=True, dropdeg=False)`,
    `open(${python(`${options.out}/${options.body}.final.beam.json`)}, 'w').write(json.dumps(dict(`,
    "    majorRadians=major, minorRadians=minor, beamSolidAngle=float(solid), fluxScaleRatio=ratio, frequencyHz=frequency)))",
    `print('final image and brightness temperature written')`,
  ].join('\n') + '\n';
}

const readGrid = async (path: string) => {
  const record = requireRecord(JSON.parse(await readFile(path, 'utf8')) as unknown, 'gridded visibilities');
  return {
    frequencyHz: requireFiniteNumber(record.frequencyHz, 'frequencyHz'),
    cells: requireArray(record.cells, 'cells').map(entry => {
      const cell = requireRecord(entry, 'cell');
      return { u: requireFiniteNumber(cell.u, 'u'), v: requireFiniteNumber(cell.v, 'v'),
        real: requireFiniteNumber(cell.real, 'real'), imaginary: requireFiniteNumber(cell.imaginary, 'imaginary'),
        weight: requireFiniteNumber(cell.weight, 'weight') } satisfies GriddedVisibility;
    }),
  };
};

/** The geocentric distance the measurement set's own ephemeris gives for the middle of the observation, in astronomical units.
 * This is the observing geometry the diameter is taken from: the observatory attached it to the data, and no other source has
 * to agree with it. */
export async function ephemerisDistanceAu(visibilities: string, scratch: string, casaPython: string) {
  const script = [
    'import json, sys, glob, os',
    'import numpy',
    'from casatools import table',
    `sets = glob.glob(os.path.join(${python(visibilities)}, 'FIELD/EPHEM*.tab'))`,
    "if len(sets) != 1: sys.exit(f'The measurement set carries {len(sets)} ephemeris tables; one was expected.')",
    'tb = table(); tb.open(sets[0])',
    "names = [name for name in tb.colnames() if name.lower() in ('rho', 'geodist')]",
    "if not names: sys.exit('The ephemeris table states no distance column.')",
    "distance = tb.getcol(names[0]); times = tb.getcol('MJD')",
    'tb.close()',
    // The ephemeris spans the whole day; the distance wanted is the one at the middle of the observation, which the
    // measurement set's own time column gives. Over this execution it moves by far less than a milliarcsecond of diameter.
    `tb.open(${python(visibilities)}); seconds = tb.getcol('TIME'); tb.close()`,
    'middle = float((seconds.min() + seconds.max()) / 2 / 86400.0)',
    'if not (times[0] <= middle <= times[-1]): sys.exit(f\'The observation at MJD {middle} is outside the ephemeris the data carry.\')',
    'value = float(numpy.interp(middle, times, distance))',
    `print(json.dumps(dict(column=names[0], distanceAu=value, rows=int(len(distance)),` +
      ` spanAu=[float(distance.min()), float(distance.max())], mjd=middle)))`,
  ].join('\n') + '\n';
  const path = resolve(scratch, 'ephemeris.py');
  await writeFile(path, script);
  const result = spawnSync(casaPython, [path], { encoding: 'utf8', cwd: scratch });
  if (result.status !== 0) throw new Error(`Reading the ephemeris failed: ${result.stderr}`);
  const line = result.stdout.trim().split('\n').at(-1)!;
  const record = requireRecord(JSON.parse(line) as unknown, 'ephemeris distance');
  return { column: requireString(record.column, 'column'), distanceAu: requireFiniteNumber(record.distanceAu, 'distanceAu'),
    rows: requireFiniteNumber(record.rows, 'rows'), mjd: requireFiniteNumber(record.mjd, 'mjd') };
}

/** What identifies a measurement set as an input. CASA rewrites a set's data columns in place while it calibrates, so the
 * bytes of the whole directory change under a run that reads it; the tables that say what was observed (which antennas,
 * fields, windows and execution) do not. Their bytes are the identity: another observation, or another split of this one,
 * has other tables. */
export async function measurementSetIdentity(path: string): Promise<ProductInput> {
  const hashes: string[] = []; let bytes = 0;
  for (const table of ['OBSERVATION/table.f0', 'FIELD/table.f0', 'SPECTRAL_WINDOW/table.f0', 'ANTENNA/table.f0']) { const pin = await pinFile(resolve(path, table)); hashes.push(`${table}:${pin.sha256}`); bytes += pin.bytes; }
  return { role: 'visibilities (observation, field, window and antenna tables)', identity: path, bytes, sha256: sha256(hashes.join('\n')) };
}

export async function discSelfCalibrate(options: DiscSelfCalibrationOptions) {
  await mkdir(options.out, { recursive: true });
  await mkdir(options.scratch, { recursive: true });
  const casa = resolve(await toolchainPath('casa'), 'venv/bin/python');
  /** Each stage is written where it can be read and rerun, then run. A stage is reused only when the product record beside its
   * product says this same run made it: the same stage script (which carries every parameter, the paths and the fit handed
   * down from the stage before), the same visibilities and the same pinned CASA, and the product on disk is still the file
   * that run wrote. Anything else runs the stage again, so a receipt never describes processing that did not make the file
   * it sits beside. Gridding a hundred thousand cells and cleaning a 2048-pixel image take minutes each; an unchanged rerun
   * repeats none of it. */
  const toolchain = await toolchainDescriptor('casa'), software = requireArray(toolchain.entry.requirements, 'casa requirements').map(requirement => { const [name, version] = requireString(requirement, 'requirement').split('=='); return { name: name!, version: version ?? 'unpinned' }; });
  const source = await measurementSetIdentity(options.visibilities);
  const stages: { stage: string; product: string; record: string; reused: boolean; runDigest: string }[] = [];
  const stage = async (script: string, name: string, products: readonly string[]) => {
    const product = products[0]!, path = resolve(options.out, name), recordPath = resolve(options.out, `${product}.product.json`);
    const run: ProductRun = { telescope: 'ALMA', stage: `disc-selfcal/${name.replace(/\.py$/u, '')}`, inputs: [source], parameters: { script: sha256(script) }, software, toolchainDigest: toolchain.digest };
    const reused = await sameRun(await readProductRecord(recordPath), run, recorded => resolve(options.out, recorded));
    await writeFile(path, script);
    if (!reused) {
      await rm(recordPath, { force: true });
      // casatools opens a log where the process starts, before any script can redirect it; the stage runs in the output
      // directory so those land beside the run instead of in the repository.
      const result = spawnSync(casa, [path], { stdio: 'inherit', cwd: options.out });
      if (result.status !== 0) throw new Error(`${name} failed (status ${result.status}).`);
      await writeProductRecord(recordPath, run, products.map(made => ({ path: made, file: resolve(options.out, made) })));
    }
    stages.push({ stage: run.stage, product, record: `${product}.product.json`, reused, runDigest: runDigest(run) });
  };

  const geometry = await ephemerisDistanceAu(options.visibilities, options.scratch, casa);
  const diameterRadians = angularDiameterRadians(options.radiusKm, geometry.distanceAu);
  const receipt: Record<string, unknown> = {
    body: options.body, visibilities: options.visibilities,
    geometry: { ...geometry, radiusKm: options.radiusKm, diameterMas: diameterRadians / RADIANS_PER_MAS },
    imaging: { cell: options.cell, imageSize: options.imageSize, robust: options.robust, referenceAntenna: options.referenceAntenna },
    fluxScale: { factor: options.fluxScale, source: options.fluxScaleSource },
    rounds: [] as unknown[],
    // Which run made each product this receipt reads: the record beside it, and whether this invocation ran it or found it made.
    stages,
  };

  let visibilities = options.visibilities;
  for (const [index, round] of options.rounds.entries()) {
    const number = index + 1;
    await stage(discSelfCalibrationScript('grid', options, { round: number, visibilities }), `grid-${number}.py`, [`${options.body}.round${number}.uv.json`]);
    const grid = await readGrid(resolve(options.out, `${options.body}.round${number}.uv.json`));
    const fit = fitLimbDarkenedDisc(grid.cells, diameterRadians);
    await stage(discSelfCalibrationScript('round', options, { round: number, visibilities, fit }), `round-${number}.py`, [`${options.body}.round${number}.gains.json`, `${options.body}.round${number}.fits`, `${options.body}.round${number}.residual.fits`]);
    const image = readContinuumImage(await readFile(resolve(options.out, `${options.body}.round${number}.fits`)));
    const measurement = measureSource(image, 700, 600);
    // Where the fit puts the disc and where the image puts it must be the same place. A sign taken the wrong way round in the
    // visibility phase would put the start model a disc's width from the source and quietly spoil every gain solution after
    // it, so the two are compared against the beam before the next round runs on them.
    const imagedRaMas = -(measurement.centreX - image.width / 2) * image.pixelMas;
    const imagedDecMas = (measurement.centreY - image.height / 2) * image.pixelMas;
    const apart = Math.hypot(fit.offsetRaMas - imagedRaMas, fit.offsetDecMas - imagedDecMas);
    if (apart > image.beamMajorMas) {
      throw new Error(`The fitted disc sits ${apart.toFixed(1)} mas from the imaged one (fit ${fit.offsetRaMas.toFixed(1)}, ${fit.offsetDecMas.toFixed(1)}; ` +
        `image ${imagedRaMas.toFixed(1)}, ${imagedDecMas.toFixed(1)}), more than the ${image.beamMajorMas.toFixed(1)} mas beam.`);
    }
    // The residual carries no beam of its own; the restored image's is the one that applies to it.
    const residual = measureSource(readContinuumImage(await readFile(resolve(options.out, `${options.body}.round${number}.residual.fits`)), image), 700, 600);
    const gains = requireRecord(JSON.parse(await readFile(resolve(options.out, `${options.body}.round${number}.gains.json`), 'utf8')) as unknown, 'gains');
    (receipt.rounds as unknown[]).push({
      round: number, solutionInterval: round.solutionInterval, iterations: round.iterations, intervalFromPaper: round.fromPaper,
      fit, gains, frequencyHz: grid.frequencyHz,
      imagedOffsetRaMas: imagedRaMas, imagedOffsetDecMas: imagedDecMas, fitToImageMas: apart,
      image: { peakJyPerBeam: measurement.peak, rmsJyPerBeam: residual.noise,
        dynamicRange: measurement.peak / residual.noise,
        beamMajorMas: image.beamMajorMas, beamMinorMas: image.beamMinorMas, beamAngleDegrees: image.beamAngleDegrees,
        halfPowerDiameterMas: measurement.halfPowerDiameterMas },
    });
    visibilities = `${options.scratch}/${options.body}.round${number}.selfcal.ms`;
  }

  await stage(discSelfCalibrationScript('grid', options, { round: 0, visibilities }), 'grid-final.py', [`${options.body}.round0.uv.json`]);
  const grid = await readGrid(resolve(options.out, `${options.body}.round0.uv.json`));
  const fit = fitLimbDarkenedDisc(grid.cells, diameterRadians);
  await stage(discSelfCalibrationScript('final', options, { round: 0, visibilities, fit, frequencyHz: grid.frequencyHz }), 'final.py', [`${options.body}.final.beam.json`, `${options.body}.final.fits`, `${options.body}.final.residual.fits`, `${options.body}.final.brightness-temperature.fits`]);

  const image = readContinuumImage(await readFile(resolve(options.out, `${options.body}.final.fits`)));
  const measurement = measureSource(image, 700, 600);
  const residual = measureSource(readContinuumImage(await readFile(resolve(options.out, `${options.body}.final.residual.fits`)), image), 700, 600);
  const temperature = readContinuumImage(await readFile(resolve(options.out, `${options.body}.final.brightness-temperature.fits`)));
  const beam = requireRecord(JSON.parse(await readFile(resolve(options.out, `${options.body}.final.beam.json`), 'utf8')) as unknown, 'beam');
  const solid = beamSolidAngle(image.beamMajorMas * RADIANS_PER_MAS, image.beamMinorMas * RADIANS_PER_MAS);
  // Every pixel inside the fitted disc, so the range quoted is the range over the body and not over the noise around it.
  const radiusPixels = fit.diameterMas / 2 / image.pixelMas;
  const centre = measurement;
  const inside: number[] = [];
  for (let y = Math.floor(centre.centreY - radiusPixels); y <= Math.ceil(centre.centreY + radiusPixels); y++) {
    for (let x = Math.floor(centre.centreX - radiusPixels); x <= Math.ceil(centre.centreX + radiusPixels); x++) {
      if (Math.hypot(x - centre.centreX, y - centre.centreY) <= radiusPixels * 0.9) inside.push(temperature.at(x, y));
    }
  }
  inside.sort((a, b) => a - b);
  const background = planckIntensity(CMB_KELVIN, grid.frequencyHz);
  receipt.final = {
    fit, frequencyHz: grid.frequencyHz, fluxScaleRatioMeasured: requireFiniteNumber(beam.fluxScaleRatio, 'fluxScaleRatio'),
    beam: { majorMas: image.beamMajorMas, minorMas: image.beamMinorMas, angleDegrees: image.beamAngleDegrees, solidAngleSteradians: solid },
    image: { peakJyPerBeam: measurement.peak, rmsJyPerBeam: residual.noise, dynamicRange: measurement.peak / residual.noise,
      halfPowerDiameterMas: measurement.halfPowerDiameterMas },
    brightnessTemperature: {
      convention: 'Planck, no background term added; the paper states neither',
      peakKelvin: brightnessTemperatureKelvin(measurement.peak / solid * 1e-26, grid.frequencyHz),
      insideDiscMinimumKelvin: inside[0] ?? Number.NaN,
      insideDiscMedianKelvin: inside[Math.floor(inside.length / 2)] ?? Number.NaN,
      insideDiscMaximumKelvin: inside.at(-1) ?? Number.NaN,
      pixelsInsideDisc: inside.length,
      peakKelvinWithCmbAdded: brightnessTemperatureKelvin(measurement.peak / solid * 1e-26 + background, grid.frequencyHz),
      cmbKelvin: CMB_KELVIN,
    },
  };
  const receiptPath = resolve(options.out, `${options.body}.selfcal.receipt.json`);
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  return { receipt, receiptPath, image: resolve(options.out, `${options.body}.final.fits`),
    temperature: resolve(options.out, `${options.body}.final.brightness-temperature.fits`) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const given = process.argv.slice(2);
  const visibilities = given[0]?.startsWith('--') ? undefined : given[0];
  if (!visibilities) throw new TypeError('Usage: alma-disc-selfcal.mts <continuum.ms> --body <name> --radius-km <km> --out <dir> --scratch <dir>');
  const argument = (name: string, fallback?: string) => {
    const index = given.indexOf(`--${name}`);
    const value = index >= 0 ? given[index + 1] : fallback;
    if (value === undefined) throw new TypeError(`--${name} is required.`);
    return value;
  };
  const result = await discSelfCalibrate({
    visibilities: resolve(visibilities), body: argument('body'), radiusKm: Number(argument('radius-km')),
    referenceAntenna: argument('refant', 'DV19'), cell: argument('cell', '6.25mas'),
    imageSize: [Number(argument('imsize', '2048')), Number(argument('imsize', '2048'))],
    robust: Number(argument('robust', '0')), rounds: PUBLISHED_ROUNDS,
    fluxScale: Number(argument('flux-scale')), fluxScaleSource: argument('flux-scale-source'),
    scratch: resolve(argument('scratch')), out: resolve(argument('out')),
    gridCellWavelengths: Number(argument('grid-cell', '8000')),
  });
  console.log(`Receipt at ${result.receiptPath}`);
  console.log(`Image at ${result.image}`);
  console.log(`Brightness temperature at ${result.temperature}`);
}
