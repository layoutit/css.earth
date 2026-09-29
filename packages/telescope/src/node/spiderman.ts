/** SPIDERMAN owns spherical-harmonic brightness maps and the phase curves they make (Louden & Kreidberg 2018). cssEarth passes a
 * published fit's own parameters in SPIDERMAN's own names and reads back the map it evaluates and the light curve it integrates.
 * The environment is separate from the astroquery toolchain because spiderman-package 1.0.3 builds only against NumPy 1.x
 * (spiderman-toolchain.json says why). Install: node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts spiderman install */
import { runToolchainProcess } from './toolchain-process.js';
import { accessSync, mkdirSync, readFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { TOOLCHAINS, WORKSPACE } from './paths.js';
import { assertInstalledMarker, readToolchainPins, writeInstalledMarker } from './toolchain-marker.js';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

export const SPIDERMAN_ROOT = resolve(WORKSPACE, 'output/toolchains/spiderman');

const INSTALL = 'node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts spiderman install';
const descriptor = () => readToolchainPins('spiderman', 'spiderman-toolchain.json');

export async function installSpiderman() {
  const pins = descriptor(), { entry } = pins, prefix = resolve(SPIDERMAN_ROOT, 'env');
  const mamba = requireRecord(entry.micromamba, 'micromamba');
  await rm(SPIDERMAN_ROOT, { recursive: true, force: true });
  await mkdir(SPIDERMAN_ROOT, { recursive: true });
  runToolchainProcess('micromamba', ['create', '-y', '-q', '-p', prefix, '-c', requireString(mamba.channel, 'micromamba channel'),
    ...requireArray(mamba.packages, 'micromamba packages').map(value => requireString(value, 'micromamba package'))], { env: { MAMBA_ROOT_PREFIX: resolve(SPIDERMAN_ROOT, 'mamba') }, maxBuffer: 256 * 1024 * 1024 });
  // The lock is version-pinned; both packages build or install against the environment's NumPy.
  runToolchainProcess(resolve(prefix, 'bin/python'), ['-m', 'pip', 'install', '--no-deps', '--no-build-isolation', '-q', '-r',
    resolve(TOOLCHAINS, requireString(entry.requirements, 'requirements'))], { env: { PYTHONNOUSERSITE: '1' }, maxBuffer: 256 * 1024 * 1024 });
  await rm(resolve(SPIDERMAN_ROOT, 'mamba/pkgs'), { recursive: true, force: true });
  writeInstalledMarker(SPIDERMAN_ROOT, pins);
  verifySpiderman();
  return SPIDERMAN_ROOT;
}

export interface SpidermanToolchain { readonly python: string; readonly version: string; readonly env: NodeJS.ProcessEnv }

export function spidermanToolchainSync(): SpidermanToolchain {
  const pins = descriptor(), { entry } = pins, bin = resolve(SPIDERMAN_ROOT, 'env/bin'), python = resolve(bin, 'python');
  assertInstalledMarker(SPIDERMAN_ROOT, pins, 'SPIDERMAN', INSTALL);
  try { accessSync(python); } catch { throw new Error(`The SPIDERMAN toolchain has no python at ${python}.`); }
  // SPIDERMAN reads ~/.spidermanrc when present; an empty home keeps a user's file out of the result.
  const home = resolve(SPIDERMAN_ROOT, 'home'); mkdirSync(home, { recursive: true });
  return { python, version: requireString(entry.spiderman, 'spiderman'), env: { PATH: `${bin}:${process.env.PATH ?? ''}`, PYTHONNOUSERSITE: '1', HOME: home, MPLBACKEND: 'Agg' } };
}

const PYTHON = String.raw`
import importlib.metadata, json, sys, types
# SPIDERMAN prints progress to stdout (its rc-file lookup at import); only the answer goes there.
out = sys.stdout
sys.stdout = sys.stderr
# spiderman/plot.py imports matplotlib._png (removed in Matplotlib 3.3) for its logo art; nothing here plots.
png = types.ModuleType('matplotlib._png')
def read_png(*args, **kwargs): raise NotImplementedError('SPIDERMAN plotting is not used by cssEarth')
png.read_png = read_png
sys.modules['matplotlib._png'] = png
import numpy as np
import spiderman as sp
r = json.load(sys.stdin)
m = r['map']
p = sp.ModelParams(brightness_model='spherical')
p.degree = int(m['degree']); p.la0 = float(m['la0']); p.lo0 = float(m['lo0']); p.sph = [float(v) for v in m['sph']]
answer = {'schema': 'cssearth-spiderman@1', 'spiderman': importlib.metadata.version('spiderman-package'), 'numpy': np.__version__}
if r['operation'] == 'map':
    la = np.radians(np.asarray(r['latitudesDegrees'], dtype=float)); lo = np.radians(np.asarray(r['longitudesDegrees'], dtype=float))
    answer['values'] = [[float(sp.call_map_model(p, float(a), float(o))[0]) for o in lo] for a in la]
elif r['operation'] == 'phase-curve':
    o = r['orbit']
    p.n_layers = int(r['layers']); p.t0 = 0.; p.per = float(o['periodDays']); p.a_abs = float(o['semiMajorAxisAu'])
    p.inc = float(o['inclinationDegrees']); p.ecc = 0.; p.w = 90.; p.rp = float(o['radiusRatio']); p.a = float(o['semiMajorAxisStellarRadii'])
    p.p_u1 = 0.; p.p_u2 = 0.
    t = np.asarray(r['phases'], dtype=float) * p.per
    answer['planetFlux'] = (np.asarray(p.lightcurve(t), dtype=float) - 1.0).tolist()
else: raise ValueError('Unknown SPIDERMAN operation')
json.dump(answer, out)
`;

/** SPIDERMAN's spherical brightness model with its own parameter names. In spiderman-package 1.0.3 the Python layer packs
 * [degree, la0, lo0, sph...] and the C model (brightness_maps.c, spherical) adds the second slot, la0, to longitude and the
 * third, lo0, to latitude, both in radians; the map is evaluated as SPIDERMAN evaluates it, and the caller records which way
 * each parameter moved. */
export interface SpidermanSphericalMap { readonly degree: number; readonly la0: number; readonly lo0: number; readonly sph: readonly number[] }
export interface SpidermanOrbit { readonly periodDays: number; readonly semiMajorAxisAu: number; readonly semiMajorAxisStellarRadii: number; readonly inclinationDegrees: number; readonly radiusRatio: number }

function call(request: Record<string, unknown>, toolchain = spidermanToolchainSync()) {
  const answer = requireRecord(JSON.parse(runToolchainProcess(toolchain.python, ['-c', PYTHON], { env: toolchain.env, maxBuffer: 256 * 1024 * 1024, input: JSON.stringify(request) })) as unknown, 'SPIDERMAN answer');
  if (answer.schema !== 'cssearth-spiderman@1' || answer.spiderman !== toolchain.version) throw new Error(`SPIDERMAN answered as ${String(answer.spiderman)}, expected ${toolchain.version}.`);
  return answer;
}

function checkMap(map: SpidermanSphericalMap) {
  if (!Number.isSafeInteger(map.degree) || map.degree < 1) throw new TypeError('A SPIDERMAN spherical map has a positive integer degree.');
  if (map.sph.length !== map.degree ** 2) throw new TypeError(`A degree-${map.degree} SPIDERMAN map has ${map.degree ** 2} coefficients, not ${map.sph.length}.`);
  for (const value of [map.la0, map.lo0, ...map.sph]) requireFiniteNumber(value, 'SPIDERMAN map parameter');
  return { degree: map.degree, la0: map.la0, lo0: map.lo0, sph: [...map.sph] };
}

/** SPIDERMAN's call_map_model on a latitude-longitude grid in degrees (longitude 0 at the substellar point, east positive). */
export function spidermanMapGrid(map: SpidermanSphericalMap, latitudesDegrees: readonly number[], longitudesDegrees: readonly number[]) {
  const answer = call({ operation: 'map', map: checkMap(map), latitudesDegrees, longitudesDegrees });
  const rows = requireArray(answer.values, 'SPIDERMAN map values').map(row => requireArray(row, 'SPIDERMAN map row').map(value => requireFiniteNumber(value, 'SPIDERMAN map value')));
  if (rows.length !== latitudesDegrees.length || rows.some(row => row.length !== longitudesDegrees.length)) throw new Error('SPIDERMAN returned a map of another shape.');
  return { values: rows, spiderman: String(answer.spiderman), numpy: String(answer.numpy) };
}

/** The planet's flux relative to the star at each orbital phase (0 = mid-transit), from SPIDERMAN's lightcurve with the planet
 * unlimb-darkened, as a phase-curve fit uses it. */
export function spidermanPhaseCurve(map: SpidermanSphericalMap, orbit: SpidermanOrbit, phases: readonly number[], layers = 20) {
  const answer = call({ operation: 'phase-curve', map: checkMap(map), orbit, phases, layers });
  const flux = requireArray(answer.planetFlux, 'SPIDERMAN planet flux').map(value => requireFiniteNumber(value, 'SPIDERMAN flux'));
  if (flux.length !== phases.length) throw new Error('SPIDERMAN returned another number of phases.');
  return flux;
}

export function verifySpiderman() {
  const toolchain = spidermanToolchainSync();
  const found = runToolchainProcess(toolchain.python, ['-c', "import importlib.metadata as m; print(m.version('spiderman-package'), m.version('batman-package'))"], { env: toolchain.env, maxBuffer: 256 * 1024 * 1024 }).trim();
  const { entry } = descriptor();
  if (found !== `${requireString(entry.spiderman)} ${requireString(entry.batman)}`) throw new Error(`Expected SPIDERMAN ${String(entry.spiderman)} and batman ${String(entry.batman)}, found ${found}.`);
  return found;
}
