/** A run's magnetic map, by ZDIpy (Folsom et al. 2018, MNRAS 474, 4956, after Donati et al. 2006, MNRAS 370, 629), which
 * toolchain.json pins.
 *
 * ZDIpy finds the surface field, as spherical harmonics of a radial, a tangential poloidal and a toroidal part, whose
 * Stokes V profiles match a run's mean lines to a target reduced chi-square with the most entropy (the least field). This
 * module writes its three input files, runs its three programs in the run's directory and reads what they print and write:
 *
 *   renormLSD.py   each mean line over its own continuum
 *   zdipy.py       the fit; outMagCoeff.dat holds the map's coefficients
 *   comp-ana.py    the map's mean and peak strength and how its energy is shared
 *
 * It computes nothing of its own. The target is the one choice ZDIpy leaves to its user: reduce.mts fits a ladder of
 * targets and keeps every step. */
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import type { MaskMeans } from './lsd.mts';
import type { MappedStar } from './program.mts';
import { runPython, toolchainPaths } from './toolchain.mts';

/** What ZDIpy's own example input sets and its author's papers use: 60 rings of surface cells, the convergence test, the
 * slope of the field's entropy, and the local line fitted to the Sun's observed mean line (a Voigt profile: Gaussian width
 * in km/s, Lorentzian width as a share of it). The line's strength is matched to each star's observed mean line by ZDIpy. */
export const ZDIPY_DEFAULTS = Object.freeze({ rings: 60, testAim: 1e-4, entropySlope: 100, gaussKmS: 2.41, lorentz: 0.89, limbDarkening: 0.66 });
/** The line strengths ZDIpy's search is started from, in turn: it looks between a hundredth and a hundred times its start
 * and stops with an error when the match is not well inside, as for the shallow mean line of a fast-turning red dwarf. The
 * first is the one in ZDIpy's own example. */
export const STRENGTHS = [0.6306, 0.06306, 0.006306] as const;
/** ESPaDOnS in its polarimetric mode (Donati et al. 2006 give 65,000). */
export const RESOLVING_POWER = 65000;
const jd = (mjd: number) => mjd + 2400000.5;

export interface MapRun { readonly star: MappedStar; readonly means: MaskMeans; /** Mean lines, as LSDpy wrote them, with their mid-exposure times. */ readonly profiles: readonly { readonly file: string; readonly mjd: number }[];
  readonly velocityKmS: number; /** How far the line and its Stokes V reach either side of the star's velocity. */ readonly lineHalfWidthKmS: number; readonly directory: string }
const names = (run: MapRun) => run.profiles.map(profile => relative(run.directory, profile.file));
/** The map's own time: the middle of the run, when longitude 0 faces the observer. */
export const middleMjd = (run: Pick<MapRun, 'profiles'>) => (run.profiles[0]!.mjd + run.profiles.at(-1)!.mjd) / 2;

/** renormLSD.py's input: a straight continuum fitted outside the line, each profile divided by it, equivalent widths left alone. */
export const renormInput = (run: MapRun) => [`1`, `${-run.lineHalfWidthKmS} ${run.lineHalfWidthKmS}`, '0.0 0.0', '1', '0', '0', '0', `${-run.lineHalfWidthKmS} ${run.lineHalfWidthKmS}`, ...names(run).map(name => `${name} ${run.velocityKmS.toFixed(2)}`)].join('\n') + '\n';
/** model-voigt-line.dat: wavelength (nm), a first strength (ZDIpy replaces it with the one that matches the observed line), the two widths, the Landé factor, linear limb darkening, no gravity darkening. */
export const lineInput = (run: MapRun, strength: number = STRENGTHS[0]) => `${run.means.wavelengthNm.toFixed(2)} ${strength} ${ZDIPY_DEFAULTS.gaussKmS} ${ZDIPY_DEFAULTS.lorentz} ${run.means.lande.toFixed(3)} ${run.star.limbDarkening?.value ?? ZDIPY_DEFAULTS.limbDarkening} 0.0\n`;
/** inzdi.dat, in the order ZDIpy reads it: a spherical star, the magnetic field alone fitted to `target`, no brightness map. */
export function zdiInput(run: MapRun, fit: { readonly target: number; readonly iterations: number; readonly startFrom?: string }) { const { star } = run;
  return [`${star.inclinationDegrees.value} ${star.vsiniKmS.value} ${star.periodDays.value} ${star.shearRadPerDay?.value ?? 0}`, '0.0 0.0', String(ZDIPY_DEFAULTS.rings), `C ${fit.target} ${fit.iterations}`, String(ZDIPY_DEFAULTS.testAim),
    `1 ${star.maximumDegree.value} ${ZDIPY_DEFAULTS.entropySlope} Full`, fit.startFrom ? `1 ${fit.startFrom}` : '0 none.dat', '0 1. 1.', '1 1.0 1.01', '0 none.dat', '1', `${RESOLVING_POWER}.`, `${-run.lineHalfWidthKmS} ${run.lineHalfWidthKmS}`, jd(middleMjd(run)).toFixed(5),
    ...names(run).map((name, i) => `${name}.norm ${jd(run.profiles[i]!.mjd).toFixed(5)} ${run.velocityKmS.toFixed(2)}`)].join('\n') + '\n'; }

export interface Fit { readonly target: number; readonly iterations: number; /** ZDIpy stopped by itself, at the target with its test met, before the iterations ran out. */ readonly converged: boolean;
  readonly chiSquare: number; readonly chiSquareNoField: number; readonly entropy: number; readonly test: number; readonly lineStrength: number | null }
/** What zdipy.py printed: one line for each iteration, the first with no field yet. */
export function parseFit(printed: string, target: number, allowed: number): Fit {
  const steps = [...printed.matchAll(/^it\s+(\d+)\s+entropy\s+(\S+)\s+chi2\s+(\S+)\s+Test\s+(\S+)/gmu)].map(match => ({ iteration: Number(match[1]), entropy: Number(match[2]), chiSquare: Number(match[3]), test: Number(match[4]) }));
  const last = steps.at(-1); if (!last || !steps.every(step => Number.isFinite(step.chiSquare))) throw new Error(`ZDIpy printed no usable iteration: ${printed.trim().split('\n').slice(-4).join(' | ')}`);
  const strength = /best match line strength is\s+(\S+)/u.exec(printed);
  return { target, iterations: last.iteration, converged: last.iteration < allowed, chiSquare: last.chiSquare, chiSquareNoField: steps[0]!.chiSquare, entropy: last.entropy, test: last.test, lineStrength: strength ? Number(strength[1]) : null }; }

export interface Geometry { readonly meanGauss: number; readonly maxGauss: number; /** Shares of the magnetic energy, percent of the total. */ readonly poloidalPercent: number; readonly toroidalPercent: number; readonly axisymmetricPercent: number;
  /** Shares of the poloidal energy, percent. */ readonly dipolePercent: number | null; readonly quadrupolePercent: number | null; readonly octupolePercent: number | null }
/** What comp-ana.py printed. */
export function parseGeometry(printed: string): Geometry {
  const read = (pattern: RegExp) => { const match = pattern.exec(printed); return match ? Number(match[1]) : null; }, need = (pattern: RegExp, name: string) => { const value = read(pattern); if (value === null || !Number.isFinite(value)) throw new Error(`comp-ana.py printed no ${name}.`); return value; };
  return { meanGauss: need(/^Bmean =\s*(\S+) G/mu, 'mean field'), maxGauss: need(/^Bmax =\s*(\S+) G/mu, 'peak field'), poloidalPercent: need(/^poloidal:\s*(\S+)%/mu, 'poloidal share'), toroidalPercent: need(/^toroidal:\s*(\S+)%/mu, 'toroidal share'), axisymmetricPercent: need(/^axisymmetric:\s*(\S+)%/mu, 'axisymmetric share'),
    dipolePercent: read(/^dipole:\s*(\S+)%/mu), quadrupolePercent: read(/^quadrupole:\s*(\S+)%/mu), octupolePercent: read(/^octopole:\s*(\S+)%/mu) }; }

/** Write the run's inputs, bring each mean line over its own continuum, and learn the fit with no field at all (ZDIpy's
 * first iteration). Once for a run, before its fits. */
export async function prepareRun(run: MapRun): Promise<{ readonly chiSquareNoField: number }> { const { python, zdipy } = await toolchainPaths();
  await mkdir(run.directory, { recursive: true });
  await writeFile(resolve(run.directory, 'inrenorm.dat'), renormInput(run));
  runPython(python, [resolve(zdipy, 'renormLSD.py')], { cwd: run.directory, path: zdipy });
  await writeFile(resolve(run.directory, 'inzdi.dat'), zdiInput(run, { target: 1e9, iterations: 1 }));
  let failure: unknown;
  for (const strength of STRENGTHS) { await writeFile(resolve(run.directory, 'model-voigt-line.dat'), lineInput(run, strength));
    try { return { chiSquareNoField: parseFit(runPython(python, [resolve(zdipy, 'zdipy.py')], { cwd: run.directory, path: zdipy }), 1e9, 1).chiSquareNoField }; }
    catch (error) { if (!(error instanceof Error) || !error.message.includes('Bracketing values')) throw error; failure = error; } }
  throw failure; }

export type MapFit = Fit & Geometry & { /** The fit's coefficients, kept beside the run. */ readonly coefficients: string };
/** One fit of a prepared run to one target. `startFrom` is an earlier fit's coefficients to begin from. */
export async function fitMap(run: MapRun, fit: { readonly target: number; readonly iterations: number; readonly startFrom?: string }): Promise<MapFit> { const { python, zdipy } = await toolchainPaths();
  await writeFile(resolve(run.directory, 'inzdi.dat'), zdiInput(run, { ...fit, ...(fit.startFrom ? { startFrom: relative(run.directory, fit.startFrom) } : {}) }));
  const printed = runPython(python, [resolve(zdipy, 'zdipy.py')], { cwd: run.directory, path: zdipy }), parsed = parseFit(printed, fit.target, fit.iterations);
  const geometry = parseGeometry(runPython(python, [resolve(zdipy, 'comp-ana.py')], { cwd: run.directory, path: zdipy })), coefficients = resolve(run.directory, `coefficients-${fit.target}.dat`);
  await copyFile(resolve(run.directory, 'outMagCoeff.dat'), coefficients);
  return { ...parsed, ...geometry, coefficients }; }

export interface FieldGrid { readonly longitudes: readonly number[]; readonly latitudes: readonly number[]; readonly maximumDegree: number; /** Gauss, latitude by latitude from the south: outward, toward growing colatitude (south), toward growing longitude (east). */ readonly radial: readonly number[]; readonly colatitude: readonly number[]; readonly longitude: readonly number[] }
/** A fit's field on a grid of longitude and latitude, evaluated by ZDIpy's own harmonics. Longitude grows the way the star
 * turns, and 0 faces the observer at the map's time (ZDIpy's geometryStellar.py). */
export async function fieldGrid(coefficients: string, stepDegrees = 5): Promise<FieldGrid> { const { python, zdipy } = await toolchainPaths();
  return JSON.parse(runPython(python, [resolve(import.meta.dirname, 'tools.py'), 'map', zdipy, coefficients, String(stepDegrees)])) as FieldGrid; }

/** The grid as the table layout the star packages read (`tecplot-lonlat-map`): longitude and latitude in degrees, then the
 * radial, azimuthal (east) and meridional (north) field in gauss. */
export function mapTable(title: string, grid: FieldGrid) { const columns = grid.longitudes.length, rows = grid.latitudes.length;
  const lines = [`TITLE     = ${JSON.stringify(title)}`, 'VARIABLES = "Longitude [Deg]" "Latitude [Deg]" "B<sub>R</sub> [G]" "B<sub>A</sub> [G]" "B<sub>M</sub> [G]"', `ZONE I=${columns}, J=${rows}, K=1, ZONETYPE=Ordered`, 'DATAPACKING=POINT', 'DT=(SINGLE SINGLE SINGLE SINGLE SINGLE)'];
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) { const n = j * columns + i; lines.push([grid.longitudes[i]!, grid.latitudes[j]!, grid.radial[n]!, grid.longitude[n]!, -grid.colatitude[n]!].map(value => value.toFixed(5).padStart(13)).join('')); }
  return `${lines.join('\n')}\n`; }
