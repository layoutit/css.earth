/** starry owns spherical-harmonic brightness maps, their intensities and the star-planet light curves they make (Luger et al. 2019).
 * cssEarth passes a published fit's own parameters in starry's own names and reads back the intensities and light curves starry
 * evaluates. The environment is separate from the astroquery toolchain because starry 1.2.0 runs on Theano-PyMC and NumPy below 1.22
 * (starry-toolchain.json says why). Install: node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts starry install */
import { runToolchainProcess } from './toolchain/process.js';
import { accessSync, mkdirSync, readFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { TOOLCHAINS, WORKSPACE } from './paths.js';
import { assertInstalledMarker, readToolchainPins, writeInstalledMarker } from './toolchain/marker.js';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

export const STARRY_ROOT = resolve(WORKSPACE, 'output/toolchains/starry');

const INSTALL = 'node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts starry install';
const descriptor = () => readToolchainPins('starry', 'starry-toolchain.json');

export async function installStarry() {
  const pins = descriptor(), { entry } = pins, prefix = resolve(STARRY_ROOT, 'env');
  const mamba = requireRecord(entry.micromamba, 'micromamba');
  await rm(STARRY_ROOT, { recursive: true, force: true });
  await mkdir(STARRY_ROOT, { recursive: true });
  runToolchainProcess('micromamba', ['create', '-y', '-q', '-p', prefix, '-c', requireString(mamba.channel, 'micromamba channel'),
    ...requireArray(mamba.packages, 'micromamba packages').map(value => requireString(value, 'micromamba package'))], { env: { MAMBA_ROOT_PREFIX: resolve(STARRY_ROOT, 'mamba') }, maxBuffer: 256 * 1024 * 1024 });
  // The lock is version-pinned and complete; Theano-PyMC builds against the environment's NumPy. The packages built from their
  // source releases go in a second pass: their build needs (setuptools-scm) are in the lock too, and pip prepares every package
  // of one pass before it installs any.
  const sourceBuilds = new Set(requireArray(entry.sourceBuilds, 'sourceBuilds').map(value => requireString(value, 'source build')));
  const locked = readFileSync(resolve(TOOLCHAINS, requireString(entry.requirements, 'requirements')), 'utf8').split('\n').filter(line => line.trim() && !line.startsWith('#'));
  for (const pass of [locked.filter(line => !sourceBuilds.has(line.split('==')[0]!)), locked.filter(line => sourceBuilds.has(line.split('==')[0]!))])
    runToolchainProcess(resolve(prefix, 'bin/python'), ['-m', 'pip', 'install', '--no-deps', '--no-build-isolation', '-q', ...pass], { env: { PYTHONNOUSERSITE: '1' }, maxBuffer: 256 * 1024 * 1024 });
  await rm(resolve(STARRY_ROOT, 'mamba/pkgs'), { recursive: true, force: true });
  writeInstalledMarker(STARRY_ROOT, pins);
  verifyStarry();
  return STARRY_ROOT;
}

export interface StarryToolchain { readonly python: string; readonly version: string; readonly env: NodeJS.ProcessEnv }

export function starryToolchainSync(): StarryToolchain {
  const pins = descriptor(), { entry } = pins, bin = resolve(STARRY_ROOT, 'env/bin'), python = resolve(bin, 'python');
  assertInstalledMarker(STARRY_ROOT, pins, 'starry', INSTALL);
  try { accessSync(python); } catch { throw new Error(`The starry toolchain has no python at ${python}.`); }
  // Theano writes its compiled operators under the toolchain, and an empty home keeps a user's ~/.theanorc out of the result.
  const home = resolve(STARRY_ROOT, 'home'); mkdirSync(home, { recursive: true });
  return { python, version: requireString(entry.starry, 'starry'),
    env: { PATH: `${bin}:${process.env.PATH ?? ''}`, PYTHONNOUSERSITE: '1', HOME: home, MPLBACKEND: 'Agg', THEANO_FLAGS: `base_compiledir=${resolve(STARRY_ROOT, 'theano')}` } };
}

const PYTHON = String.raw`
import importlib.metadata, json, sys
out = sys.stdout
sys.stdout = sys.stderr
import numpy as np
import starry
import theano
# PyMC3 3.11.5, imported by starry, adds -fno-exceptions to Theano's C++ flags; starry's operators throw C++ exceptions.
theano.config.gcc__cxxflags = theano.config.gcc__cxxflags.replace('-fno-exceptions', '')
starry.config.lazy = False
starry.config.quiet = True
r = json.load(sys.stdin)
m = r['map']
def planet_map():
    p = starry.Map(ydeg=int(m['ydeg']), amp=float(m['amp']))
    k = 0
    for l in range(1, int(m['ydeg']) + 1):
        for mm in range(-l, l + 1):
            p[l, mm] = float(m['y'][k]); k += 1
    return p
answer = {'schema': 'cssearth-starry@1', 'starry': importlib.metadata.version('starry'), 'numpy': np.__version__}
if r['operation'] == 'map':
    p = planet_map()
    lat = np.asarray(r['latitudesDegrees'], dtype=float); lon = np.asarray(r['longitudesDegrees'], dtype=float)
    la, lo = np.meshgrid(lat, lon, indexing='ij')
    answer['values'] = np.asarray(p.intensity(lat=la.ravel(), lon=lo.ravel()), dtype=float).reshape(la.shape).tolist()
elif r['operation'] == 'system':
    s, o = r['star'], r['orbit']
    star = starry.Primary(starry.Map(udeg=2, amp=1.0), m=float(s['massSolar']), r=float(s['radiusSolar']))
    star.map[1] = float(s['u1']); star.map[2] = float(s['u2'])
    planet = starry.Secondary(planet_map(), m=float(o['planetMassSolar']), r=float(o['planetRadiusSolar']), porb=float(o['periodDays']),
        prot=float(o['periodDays']), t0=float(o['transitTime']), inc=float(o['inclinationDegrees']), theta0=float(o['theta0Degrees']))
    answer['flux'] = np.asarray(starry.System(star, planet).flux(np.asarray(r['times'], dtype=float)), dtype=float).tolist()
else: raise ValueError('Unknown starry operation')
json.dump(answer, out)
`;

/** A starry surface map with its own parameters: degree, amplitude (the map's luminosity; a uniform map of amplitude A has flux A)
 * and the coefficients above Y(0,0) in starry's order, (1,-1), (1,0), (1,1), (2,-2), ... */
export interface StarryMap { readonly ydeg: number; readonly amp: number; readonly y: readonly number[] }
export interface StarrySystem {
  readonly star: { readonly massSolar: number; readonly radiusSolar: number; readonly u1: number; readonly u2: number };
  readonly orbit: { readonly planetMassSolar: number; readonly planetRadiusSolar: number; readonly periodDays: number; readonly transitTime: number;
    readonly inclinationDegrees: number; readonly theta0Degrees: number };
}

function call(request: Record<string, unknown>, toolchain = starryToolchainSync()) {
  const answer = requireRecord(JSON.parse(runToolchainProcess(toolchain.python, ['-c', PYTHON], { env: toolchain.env, maxBuffer: 256 * 1024 * 1024, input: JSON.stringify(request) })) as unknown, 'starry answer');
  if (answer.schema !== 'cssearth-starry@1' || answer.starry !== toolchain.version) throw new Error(`starry answered as ${String(answer.starry)}, expected ${toolchain.version}.`);
  return answer;
}

function checkMap(map: StarryMap) {
  if (!Number.isSafeInteger(map.ydeg) || map.ydeg < 1) throw new TypeError('A starry map has a positive integer degree.');
  if (map.y.length !== (map.ydeg + 1) ** 2 - 1) throw new TypeError(`A degree-${map.ydeg} starry map has ${(map.ydeg + 1) ** 2 - 1} coefficients above Y(0,0), not ${map.y.length}.`);
  for (const value of [map.amp, ...map.y]) requireFiniteNumber(value, 'starry map parameter');
  return { ydeg: map.ydeg, amp: map.amp, y: [...map.y] };
}

/** starry's Map.intensity on a latitude-longitude grid in the map's own frame, in degrees: rows follow the latitudes. */
export function starryMapGrid(map: StarryMap, latitudesDegrees: readonly number[], longitudesDegrees: readonly number[]) {
  const answer = call({ operation: 'map', map: checkMap(map), latitudesDegrees, longitudesDegrees });
  const rows = requireArray(answer.values, 'starry map values').map(row => requireArray(row, 'starry map row').map(value => requireFiniteNumber(value, 'starry intensity')));
  if (rows.length !== latitudesDegrees.length || rows.some(row => row.length !== longitudesDegrees.length)) throw new Error('starry returned a map of another shape.');
  return { values: rows, starry: String(answer.starry), numpy: String(answer.numpy) };
}

/** starry's System.flux for a quadratically limb-darkened star and a synchronously rotating planet carrying `map`. */
export function starrySystemFlux(map: StarryMap, system: StarrySystem, times: readonly number[]) {
  const answer = call({ operation: 'system', map: checkMap(map), star: system.star, orbit: system.orbit, times });
  const flux = requireArray(answer.flux, 'starry system flux').map(value => requireFiniteNumber(value, 'starry flux'));
  if (flux.length !== times.length) throw new Error('starry returned another number of times.');
  return flux;
}

export function verifyStarry() {
  const toolchain = starryToolchainSync();
  const found = runToolchainProcess(toolchain.python, ['-c', "import importlib.metadata as m; print(m.version('starry'))"], { env: toolchain.env, maxBuffer: 256 * 1024 * 1024 }).trim();
  const { entry } = descriptor();
  if (found !== requireString(entry.starry)) throw new Error(`Expected starry ${String(entry.starry)}, found ${found}.`);
  return found;
}
