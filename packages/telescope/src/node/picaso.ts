/** PICASO owns the radiative transfer of a substellar atmosphere (Batalha et al. 2019). cssEarth passes a published Sonora Bobcat
 * model atmosphere (Marley et al. 2021), by its structure file, and reads back the intensity PICASO emits at each Gauss angle through a
 * passband, and the quadratic law fitted to it. The environment and its data are separate from the other toolchains
 * (picaso-toolchain.json says what each is). Install: node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts picaso install */
import { createHash } from 'node:crypto';
import { runToolchainProcess } from './toolchain/process.js';
import { accessSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { TOOLCHAINS, WORKSPACE } from './paths.js';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

export const PICASO_ROOT = resolve(WORKSPACE, 'output/toolchains/picaso');
const PATHS = { env: resolve(PICASO_ROOT, 'env'), reference: resolve(PICASO_ROOT, 'reference'), profiles: resolve(PICASO_ROOT, 'bobcat-2021/structures'),
  opacities: resolve(PICASO_ROOT, 'opacities'), passband: resolve(PICASO_ROOT, 'passband/Generic_Bessell.V.dat') };

function descriptor() {
  const text = readFileSync(resolve(TOOLCHAINS, 'picaso-toolchain.json'), 'utf8');
  const entry = requireRecord(JSON.parse(text) as unknown, 'picaso-toolchain.json');
  const lock = readFileSync(resolve(TOOLCHAINS, requireString(entry.requirements, 'requirements')), 'utf8');
  return { entry, digest: createHash('sha256').update(text).update(lock).digest('hex') };
}
const exists = (path: string) => stat(path).then(() => true, () => false);
const dataUrl = (entry: Record<string, unknown>, key: string) => requireString(requireRecord(requireRecord(entry.data, 'data')[key], `data.${key}`).url, `data.${key}.url`);

/** The environment is rebuilt from the pins; the data (a 1.2 GB archive, of which one table is kept) are downloaded only while missing. */
export async function installPicaso() {
  const { entry, digest } = descriptor(), mamba = requireRecord(entry.micromamba, 'micromamba'), python = resolve(PATHS.env, 'bin/python');
  await rm(PATHS.env, { recursive: true, force: true });
  await mkdir(PICASO_ROOT, { recursive: true });
  runToolchainProcess('micromamba', ['create', '-y', '-q', '-p', PATHS.env, '-c', requireString(mamba.channel, 'micromamba channel'),
    ...requireArray(mamba.packages, 'micromamba packages').map(value => requireString(value, 'micromamba package'))], { env: { MAMBA_ROOT_PREFIX: resolve(PICASO_ROOT, 'mamba') }, maxBuffer: 256 * 1024 * 1024 });
  runToolchainProcess(python, ['-m', 'pip', 'install', '--require-hashes', '--no-deps', '-q', '-r', resolve(TOOLCHAINS, requireString(entry.requirements, 'requirements'))],
    { env: { PYTHONNOUSERSITE: '1' }, maxBuffer: 256 * 1024 * 1024 });
  await rm(resolve(PICASO_ROOT, 'mamba/pkgs'), { recursive: true, force: true });
  if (!await exists(resolve(PATHS.reference, 'config.json'))) {
    await mkdir(PATHS.reference, { recursive: true });
    runToolchainProcess(python, ['-c', 'import os, picaso.data as d; d.get_reference(os.environ["picaso_refdata"])'], { env: { PYTHONNOUSERSITE: '1', picaso_refdata: PATHS.reference }, maxBuffer: 256 * 1024 * 1024 });
  }
  if (!bobcatNodes().length) {
    await mkdir(PATHS.profiles, { recursive: true });
    const tar = resolve(PATHS.profiles, 'structures.tar.gz');
    runToolchainProcess('curl', ['-sSL', '--retry', '5', '-o', tar, dataUrl(entry, 'profiles')]);
    runToolchainProcess('tar', ['-xzf', tar, '-C', PATHS.profiles]);
    await rm(tar);
  }
  if (!await exists(resolve(PATHS.opacities, opacityName(entry)))) {
    await mkdir(PATHS.opacities, { recursive: true });
    const zip = resolve(PATHS.opacities, 'opacities.zip');
    runToolchainProcess('curl', ['-sSL', '--retry', '5', '-o', zip, dataUrl(entry, 'opacities')]);
    runToolchainProcess('unzip', ['-q', '-o', zip, opacityName(entry), '-d', PATHS.opacities]);
    await rm(zip);
  }
  if (!await exists(PATHS.passband)) {
    await mkdir(resolve(PATHS.passband, '..'), { recursive: true });
    runToolchainProcess('curl', ['-sSL', '--retry', '5', '-o', PATHS.passband, dataUrl(entry, 'passband')]);
  }
  await writeFile(resolve(PICASO_ROOT, 'installed.json'), `${JSON.stringify({ id: 'picaso', pinsSha256: digest }, null, 2)}\n`);
  verifyPicaso();
  return PICASO_ROOT;
}

function readdirOrEmpty(path: string): string[] { try { return readdirSync(path); } catch { return []; } }
/** The correlated-k table the descriptor names: solar metallicity and C/O, as the Bobcat profiles. */
const opacityName = (entry: Record<string, unknown>) => requireString(requireRecord(requireRecord(entry.data, 'data').opacities, 'data.opacities').table, 'data.opacities.table');

export interface PicasoToolchain { readonly python: string; readonly digest: string; readonly version: string; readonly env: NodeJS.ProcessEnv; readonly opacities: string }

export function picasoToolchainSync(): PicasoToolchain {
  const { entry, digest } = descriptor(), bin = resolve(PATHS.env, 'bin'), python = resolve(bin, 'python');
  let marker: Record<string, unknown>;
  try { marker = requireRecord(JSON.parse(readFileSync(resolve(PICASO_ROOT, 'installed.json'), 'utf8')) as unknown); }
  catch { throw new Error('The PICASO toolchain is not installed: node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts picaso install'); }
  if (marker.pinsSha256 !== digest) throw new Error('The PICASO toolchain was installed from other pins; reinstall it: node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts picaso install');
  try { accessSync(python); accessSync(PATHS.passband); } catch { throw new Error(`The PICASO toolchain at ${PICASO_ROOT} is incomplete; reinstall it: node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts picaso install`); }
  const opacities = resolve(PATHS.opacities, opacityName(entry));
  try { accessSync(opacities); } catch { throw new Error(`The PICASO toolchain has no correlated-k table ${opacities}; reinstall it.`); }
  // PICASO reads PYSYN_CDBS at import; its stellar spectra are for planets around stars, and an absent path only warns.
  return { python, digest, opacities, version: requireString(entry.picaso, 'picaso'),
    env: { PATH: `${bin}:${process.env.PATH ?? ''}`, PYTHONNOUSERSITE: '1', picaso_refdata: PATHS.reference, PYSYN_CDBS: resolve(PICASO_ROOT, 'no-stellar-data'), MPLBACKEND: 'Agg', HOME: PICASO_ROOT } };
}

/** The Sonora Bobcat nodes the solar-metallicity structures hold: temperature (K), gravity (m/s^2) and file, from the file names
 * (the release writes the metallicity as m0.0, and as m+0.0 for a few files). */
export function bobcatNodes(): { readonly teffK: number; readonly gravityMps2: number; readonly file: string }[] {
  return readdirOrEmpty(PATHS.profiles).flatMap(file => {
    const match = /^t(\d+)g(\d+)nc_m\+?0\.0\.dat$/u.exec(file);
    return match ? [{ teffK: Number(match[1]), gravityMps2: Number(match[2]), file }] : [];
  });
}

const PYTHON = String.raw`
import importlib.metadata, json, os, sys
out = sys.stdout
sys.stdout = sys.stderr
import numpy as np
import astropy.units as u
from picaso import justdoit as jdi
r = json.load(sys.stdin)
band = np.loadtxt(r['passband'])
opa = jdi.opannection(method='preweighted', ck_db=r['opacities'])
nodes = []
for node in r['nodes']:
    case = jdi.inputs(calculation='browndwarf')
    # One tangle uses the disc's symmetry: PICASO halves num_gangle, and its Gauss tables stop at 8 angles.
    case.phase_angle(0, num_gangle=2 * int(r['angles']), num_tangle=1)
    case.gravity(gravity=float(node['gravityMps2']), gravity_unit=u.Unit('m/s**2'))
    # The structure file's first line states its Teff and gravity (m/s^2); then level, pressure (bar), temperature (K), ...
    path = os.path.join(r['profiles'], node['file'])
    head = open(path).readline().split()
    if float(head[0]) != float(node['teffK']) or float(head[1]) != float(node['gravityMps2']): raise ValueError(f"{node['file']} states {head[0]} K, {head[1]} m/s^2")
    pressure, temperature = np.loadtxt(path, usecols=[1, 2], unpack=True, skiprows=1)
    case.add_pt(temperature, pressure)
    case.premix_atmosphere(opa, verbose=False)
    full = case.spectrum(opa, calculation='thermal', full_output=True)['full_output']
    intensity = np.asarray(full['thermal_3d'])[:, 0, :]
    # The emission cosine of each Gauss point on the disc at phase 0, as PICASO's thermal solver used it.
    mu = np.asarray(case.inputs['disco']['ubar1'])[:, 0]
    if intensity.shape[0] != mu.size or mu.size != int(r['angles']): raise ValueError('PICASO returned another number of angles')
    wl = 1e4 / np.asarray(full['wavenumber'])
    order = np.argsort(wl); wl = wl[order]; intensity = intensity[:, order]
    transmission = np.interp(wl * 1e4, band[:, 0], band[:, 1], left=0, right=0)
    edges = np.concatenate([[wl[0]], (wl[1:] + wl[:-1]) / 2, [wl[-1]]])
    # Energy-weighted, as the tables' ucE laws: the intensity per unit wavelength times the transmission, summed over PICASO's bins.
    band_intensity = (intensity * transmission * np.diff(edges)).sum(axis=1)
    x = 1 - mu
    (i0, a, b), *_ = np.linalg.lstsq(np.stack([np.ones_like(x), -x, -x ** 2], axis=1), band_intensity, rcond=None)
    rel = band_intensity / i0
    nodes.append({'teffK': int(node['teffK']), 'gravityMps2': float(node['gravityMps2']), 'binsInBand': int((transmission > 0).sum()),
      'mu': mu.tolist(), 'intensity': rel.tolist(), 'u1': float(a / i0), 'u2': float(b / i0),
      'rms': float(np.sqrt(np.mean((rel - (1 - a / i0 * x - b / i0 * x ** 2)) ** 2)))})
json.dump({'schema': 'cssearth-picaso@1', 'picaso': importlib.metadata.version('picaso'), 'nodes': nodes}, out)
`;

export interface PicasoLimbNode { readonly teffK: number; readonly gravityMps2: number; readonly binsInBand: number; readonly mu: readonly number[]; readonly intensity: readonly number[]; readonly u1: number; readonly u2: number; readonly rms: number }

/** The passband intensity each Bobcat node emits toward the observer at the emission cosines of PICASO's Gauss points (8, mu 0.19 to 1) (relative to the fitted disc centre), and the quadratic
 * law I(mu) = I0 [1 - u1 (1 - mu) - u2 (1 - mu)^2] fitted to it by least squares with I0 free. */
export function picasoLimbNodes(nodes: readonly { readonly teffK: number; readonly gravityMps2: number; readonly file: string }[], angles = 8, toolchain = picasoToolchainSync()) {
  const answer = requireRecord(JSON.parse(runToolchainProcess(toolchain.python, ['-c', PYTHON], { env: toolchain.env, maxBuffer: 256 * 1024 * 1024,
    input: JSON.stringify({ nodes, angles, opacities: toolchain.opacities, profiles: PATHS.profiles, passband: PATHS.passband }) })) as unknown, 'PICASO answer');
  if (answer.schema !== 'cssearth-picaso@1' || answer.picaso !== toolchain.version) throw new Error(`PICASO answered as ${String(answer.picaso)}, expected ${toolchain.version}.`);
  const numbers = (value: unknown, label: string) => requireArray(value, label).map(v => requireFiniteNumber(v, label));
  return { picaso: toolchain.version, opacities: toolchain.opacities.split('/').at(-1)!, nodes: requireArray(answer.nodes, 'PICASO nodes').map((raw): PicasoLimbNode => {
    const node = requireRecord(raw, 'PICASO node');
    return { teffK: requireFiniteNumber(node.teffK, 'teffK'), gravityMps2: requireFiniteNumber(node.gravityMps2, 'gravityMps2'), binsInBand: requireFiniteNumber(node.binsInBand, 'binsInBand'),
      mu: numbers(node.mu, 'mu'), intensity: numbers(node.intensity, 'intensity'), u1: requireFiniteNumber(node.u1, 'u1'), u2: requireFiniteNumber(node.u2, 'u2'), rms: requireFiniteNumber(node.rms, 'rms') };
  }) };
}

export function verifyPicaso() {
  const toolchain = picasoToolchainSync();
  const found = runToolchainProcess(toolchain.python, ['-c', "import importlib.metadata as m; print(m.version('picaso'))"], { env: toolchain.env }).trim();
  if (found !== toolchain.version) throw new Error(`Expected PICASO ${toolchain.version}, found ${found}.`);
  if (!bobcatNodes().length) throw new Error('The PICASO toolchain holds no Sonora Bobcat profiles.');
  return found;
}
