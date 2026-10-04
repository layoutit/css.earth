/** PICASO owns the radiative transfer of a substellar atmosphere (Batalha et al. 2019). cssEarth passes a published Sonora Bobcat
 * model atmosphere (Marley et al. 2021), by its structure file, and reads back the intensity PICASO emits at each Gauss angle through a
 * passband, and the quadratic law fitted to it. The environment and its data are separate from the other toolchains
 * (picaso-toolchain.json says what each is). Install: node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts picaso install */
import { runToolchainProcess } from './toolchain/process.js';
import { accessSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { TOOLCHAINS, WORKSPACE } from './paths.js';
import { assertInstalledMarker, installedMarkerIssue, readToolchainPins, writeInstalledMarker } from './toolchain/marker.js';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

export const PICASO_ROOT = resolve(WORKSPACE, 'output/toolchains/picaso');
const PATHS = { env: resolve(PICASO_ROOT, 'env'), reference: resolve(PICASO_ROOT, 'reference'), profiles: resolve(PICASO_ROOT, 'bobcat-2021/structures'),
  opacities: resolve(PICASO_ROOT, 'opacities'), passband: resolve(PICASO_ROOT, 'passband/Generic_Bessell.V.dat'),
  cloudyProfiles: resolve(PICASO_ROOT, 'diamondback-2024/pressure-temperature_profiles'), cloudProperties: resolve(PICASO_ROOT, 'diamondback-2024/cloud_optical_properties'),
  cloudArchive: resolve(PICASO_ROOT, 'diamondback-2024/cloud_optical_properties.zip'),
  database: resolve(PICASO_ROOT, 'opacities/opacities.db'), elfOwl: resolve(PICASO_ROOT, 'elf-owl-2024'), exoRem: resolve(PICASO_ROOT, 'exo-rem-2021') };

const INSTALL = 'node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts picaso install';
const descriptor = () => readToolchainPins('picaso', 'picaso-toolchain.json');
const exists = (path: string) => stat(path).then(() => true, () => false);
const dataUrl = (entry: Record<string, unknown>, key: string) => requireString(requireRecord(requireRecord(entry.data, 'data')[key], `data.${key}`).url, `data.${key}.url`);

/** The environment is rebuilt from the pins; the data (a 1.2 GB archive, of which one table is kept) are downloaded only while missing. */
export async function installPicaso() {
  const pins = descriptor(), { entry } = pins, mamba = requireRecord(entry.micromamba, 'micromamba'), python = resolve(PATHS.env, 'bin/python');
  await rm(PATHS.env, { recursive: true, force: true });
  await mkdir(PICASO_ROOT, { recursive: true });
  runToolchainProcess('micromamba', ['create', '-y', '-q', '-p', PATHS.env, '-c', requireString(mamba.channel, 'micromamba channel'),
    ...requireArray(mamba.packages, 'micromamba packages').map(value => requireString(value, 'micromamba package'))], { env: { MAMBA_ROOT_PREFIX: resolve(PICASO_ROOT, 'mamba') }, maxBuffer: 256 * 1024 * 1024 });
  runToolchainProcess(python, ['-m', 'pip', 'install', '--no-deps', '-q', '-r', resolve(TOOLCHAINS, requireString(entry.requirements, 'requirements'))],
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
  const tables = [opacityName(entry), ...Object.values(metalRichTables(entry))];
  if (!(await Promise.all(tables.map(table => exists(resolve(PATHS.opacities, table))))).every(Boolean)) {
    await mkdir(PATHS.opacities, { recursive: true });
    const zip = resolve(PATHS.opacities, 'opacities.zip');
    runToolchainProcess('curl', ['-sSL', '--retry', '5', '-o', zip, dataUrl(entry, 'opacities')]);
    runToolchainProcess('unzip', ['-q', '-o', zip, ...tables, '-d', PATHS.opacities]);
    await rm(zip);
  }
  if (!readdirOrEmpty(PATHS.cloudyProfiles).length) {
    await mkdir(resolve(PATHS.cloudyProfiles, '..'), { recursive: true });
    const zip = resolve(PATHS.cloudyProfiles, '../profiles.zip');
    runToolchainProcess('curl', ['-sSL', '--retry', '5', '-o', zip, dataUrl(entry, 'cloudyProfiles')]);
    runToolchainProcess('unzip', ['-q', '-o', zip, 'pressure-temperature_profiles/*', '-d', resolve(PATHS.cloudyProfiles, '..')]);
    await rm(zip);
  }
  if (!await exists(PATHS.cloudArchive)) runToolchainProcess('curl', ['-sSL', '--retry', '5', '-o', PATHS.cloudArchive, dataUrl(entry, 'cloudProperties')]);
  if (!await exists(PATHS.passband)) {
    await mkdir(resolve(PATHS.passband, '..'), { recursive: true });
    runToolchainProcess('curl', ['-sSL', '--retry', '5', '-o', PATHS.passband, dataUrl(entry, 'passband')]);
  }
  writeInstalledMarker(PICASO_ROOT, pins);
  verifyPicaso();
  return PICASO_ROOT;
}

function readdirOrEmpty(path: string): string[] { try { return readdirSync(path); } catch { return []; } }
/** The correlated-k table the descriptor names: solar metallicity and C/O, as the Bobcat profiles. */
const opacityName = (entry: Record<string, unknown>) => requireString(requireRecord(requireRecord(entry.data, 'data').opacities, 'data.opacities').table, 'data.opacities.table');
/** The tables of the other metallicities a model is read at, by [M/H] as the descriptor writes it. */
const metalRichTables = (entry: Record<string, unknown>) => Object.fromEntries(Object.entries(requireRecord(requireRecord(requireRecord(entry.data, 'data').opacities, 'data.opacities').tables, 'data.opacities.tables'))
  .map(([metallicity, table]) => [metallicity, requireString(table, `data.opacities.tables.${metallicity}`)]));

export interface PicasoToolchain { readonly python: string; readonly version: string; readonly env: NodeJS.ProcessEnv; readonly opacities: string }

export function picasoToolchainSync(): PicasoToolchain {
  const pins = descriptor(), { entry } = pins, bin = resolve(PATHS.env, 'bin'), python = resolve(bin, 'python');
  assertInstalledMarker(PICASO_ROOT, pins, 'PICASO', INSTALL);
  try { accessSync(python); accessSync(PATHS.passband); } catch { throw new Error(`The PICASO toolchain at ${PICASO_ROOT} is incomplete; reinstall it: node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts picaso install`); }
  const opacities = resolve(PATHS.opacities, opacityName(entry));
  try { accessSync(opacities); } catch { throw new Error(`The PICASO toolchain has no correlated-k table ${opacities}; reinstall it.`); }
  // PICASO reads PYSYN_CDBS at import; its stellar spectra are for planets around stars, and an absent path only warns.
  return { python, opacities, version: requireString(entry.picaso, 'picaso'),
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

/** A model grid PICASO reads: where its structures are, the correlated-k table of its composition, and how many header lines a
 * structure file has (a Bobcat file states its temperature and gravity on one line; a Diamondback file names its columns, then
 * states its gravity). */
export interface PicasoGrid { readonly profiles: string; readonly opacities: string; readonly headerLines: 1 | 2;
  /** The resampled opacity database, for models that state their own abundances (`model` on a node). */
  readonly database?: string;
  /** The folder of Exo-REM's cloud optical-constant tables, for released Exo-REM models (`exoRem` on a node). */
  readonly opticalConstants?: string }
/** `file` is a structure file under the grid's profiles; `model` is a release file holding the profile and the abundances. */
export interface PicasoNode { readonly teffK: number; readonly gravityMps2: number; readonly file: string; readonly clouds?: string; readonly model?: string;
  /** A released Exo-REM model: the folder of its temperature_profile_, vmr_ and spectra_ files, which end in `file`. */
  readonly exoRem?: string }

const fetchInto = (path: string, url: string) => { mkdirSync(resolve(path, '..'), { recursive: true }); runToolchainProcess('curl', ['-sSL', '--retry', '5', '-o', path, url]); };
const EXO_REM_FILES = ['temperature_profile', 'vmr', 'spectra'] as const, EXO_REM_CLOUDS = ['Fe', 'Mg2SiO4'] as const;

/** The models of Exo-REM's public grid at one metallicity (times solar) and C/O, as the release names them. The 660 MB archive
 * is fetched once and kept; its member list is read once. */
export function exoRemNodes(metallicity: number, co: number): (PicasoNode & { readonly logg: number })[] {
  const { entry } = descriptor(), archive = resolve(PATHS.exoRem, 'cloud_R500.tar.gz'), listing = resolve(PATHS.exoRem, 'members.txt');
  if (!existsSync(archive)) fetchInto(archive, dataUrl(entry, 'exoRem'));
  if (!existsSync(listing)) writeFileSync(listing, runToolchainProcess('tar', ['-tzf', archive], { maxBuffer: 256 * 1024 * 1024 }));
  const tag = `_met${metallicity.toFixed(2)}_CO${co.toFixed(2)}.dat`;
  return readFileSync(listing, 'utf8').split('\n').flatMap(member => {
    const match = /\/vmr_(YGP_(\d+)K_logg([\d.]+)_met[\d.]+_CO[\d.]+\.dat)$/u.exec(member);
    if (!match || !match[1]!.endsWith(tag)) return [];
    const logg = Number(match[3]);
    return [{ teffK: Number(match[2]), logg, gravityMps2: Number((10 ** logg / 100).toPrecision(6)), file: match[1]! }];
  });
}

/** The models named, unpacked from the archive, with Exo-REM's two optical-constant tables and the resampled opacity database. */
export function exoRemGrid(nodes: readonly PicasoNode[]): { grid: PicasoGrid; nodes: PicasoNode[] } {
  const { entry } = descriptor(), release = requireRecord(requireRecord(entry.data, 'data').exoRem, 'data.exoRem'), archive = resolve(PATHS.exoRem, 'cloud_R500.tar.gz');
  const folder = resolve(PATHS.exoRem, 'cloud_R500_updated'), members = nodes.flatMap(node => EXO_REM_FILES.map(kind => `${kind}_${node.file}`)).filter(member => !existsSync(resolve(folder, member)));
  if (members.length) runToolchainProcess('tar', ['-xzf', archive, '-C', PATHS.exoRem, ...members.map(member => `cloud_R500_updated/${member}`)], { maxBuffer: 256 * 1024 * 1024 });
  const constants = resolve(PATHS.exoRem, 'cloud_optical_constants');
  if (!EXO_REM_CLOUDS.every(cloud => existsSync(resolve(constants, `${cloud}.ocst.txt`)))) {
    const code = resolve(PATHS.exoRem, 'exorem.tar.gz'), inside = 'dist/exorem/data/cloud_optical_constants';
    fetchInto(code, requireString(release.code, 'data.exoRem.code'));
    runToolchainProcess('tar', ['-xzf', code, '-C', PATHS.exoRem, './dist/exorem/CHANGELOG.md', ...EXO_REM_CLOUDS.map(cloud => `./${inside}/${cloud}.ocst.txt`)]);
    // The tables are those of the release this toolchain names: its change log's first version heading says which it is.
    const version = /^#{2,3} \[([\d.]+)\]/mu.exec(readFileSync(resolve(PATHS.exoRem, 'dist/exorem/CHANGELOG.md'), 'utf8'))?.[1];
    if (version !== requireString(release.version, 'data.exoRem.version')) throw new Error(`The Exo-REM distribution is version ${version}, not the ${String(release.version)} that ${descriptor().file} names.`);
    mkdirSync(constants, { recursive: true });
    for (const cloud of EXO_REM_CLOUDS) writeFileSync(resolve(constants, `${cloud}.ocst.txt`), readFileSync(resolve(PATHS.exoRem, inside, `${cloud}.ocst.txt`)));
    rmSync(code, { force: true }); rmSync(resolve(PATHS.exoRem, 'dist'), { recursive: true, force: true });
  }
  if (!existsSync(PATHS.database)) fetchInto(PATHS.database, dataUrl(entry, 'resampledOpacities'));
  return { grid: { profiles: folder, opacities: '', headerLines: 1, database: PATHS.database, opticalConstants: constants }, nodes: nodes.map(node => ({ ...node, exoRem: folder })) };
}

/** The Sonora Elf Owl Y-type models of one metallicity, C/O (times solar) and log Kzz, as the release names them: every
 * temperature and gravity of the grid. The files are fetched by elfOwlGrid when a law is computed from them. */
const ELF_OWL = { teffK: [275, 300, 325, 350, 375, 400, 425, 450, 475, 500, 525, 550], gravityMps2: [17, 31, 56, 100, 178, 316, 562, 1000, 1780, 3160] };
export function elfOwlNodes(metallicity: number, co: number, logKzz: number): (PicasoNode & { readonly logg: number })[] {
  return ELF_OWL.teffK.flatMap(teffK => ELF_OWL.gravityMps2.map(gravityMps2 => ({ teffK, gravityMps2, logg: Number(Math.log10(gravityMps2 * 100).toFixed(2)),
    file: `spectra_logzz_${logKzz.toFixed(1)}_teff_${teffK.toFixed(1)}_grav_${gravityMps2.toFixed(1)}_mh_${metallicity.toFixed(1)}_co_${co.toFixed(1)}.nc` })));
}

/** The models named, present in the toolchain (their 10 GB archive is fetched, the models kept and the archive deleted), with
 * the resampled opacity database (6 GB, fetched once). */
export function elfOwlGrid(nodes: readonly PicasoNode[]): { grid: PicasoGrid; nodes: PicasoNode[] } {
  const { entry } = descriptor(), release = requireRecord(requireRecord(entry.data, 'data').elfOwl, 'data.elfOwl'), archives = requireRecord(release.archives, 'data.elfOwl.archives');
  mkdirSync(PATHS.elfOwl, { recursive: true });
  const missing = nodes.filter(node => !existsSync(resolve(PATHS.elfOwl, node.file)));
  // An archive spans three temperatures and is named by the first.
  const starts = Object.keys(archives).map(Number).sort((a, b) => a - b), archiveOf = (teffK: number) => requireString(archives[String(starts.filter(start => start <= teffK).at(-1))], `data.elfOwl.archives for ${teffK} K`);
  for (const archive of new Set(missing.map(node => archiveOf(node.teffK)))) {
    const path = resolve(PATHS.elfOwl, archive);
    runToolchainProcess('curl', ['-sSL', '--retry', '5', '-o', path, `${requireString(release.url, 'data.elfOwl.url')}${archive}`]);
    runToolchainProcess('tar', ['-xzf', path, '-C', PATHS.elfOwl, ...missing.filter(node => archiveOf(node.teffK) === archive).map(node => `./${node.file}`)]);
    rmSync(path, { force: true });
  }
  if (!existsSync(PATHS.database)) runToolchainProcess('curl', ['-sSL', '--retry', '5', '-o', PATHS.database, dataUrl(entry, 'resampledOpacities')]);
  return { grid: { profiles: PATHS.elfOwl, opacities: '', headerLines: 1, database: PATHS.database }, nodes: nodes.map(node => ({ ...node, model: resolve(PATHS.elfOwl, node.file) })) };
}

/** The Sonora Diamondback nodes of one metallicity and sedimentation efficiency: temperature (K), the gravity its file states
 * (m/s^2) with the grid's log g (steps of 0.5), the structure file and the cloud file beside it in the archive. */
export function diamondbackNodes(metallicity: number, fsed: number): (PicasoNode & { readonly logg: number })[] {
  const tag = `f${fsed}_m${metallicity > 0 ? '+' : ''}${metallicity.toFixed(1)}_co1.0.pt`;
  return readdirOrEmpty(PATHS.cloudyProfiles).flatMap(file => {
    const match = /^t(\d+)g(\d+)f/u.exec(file);
    if (!match || !file.endsWith(tag) || file !== `t${match[1]}g${match[2]}${tag}`) return [];
    const gravityMps2 = requireFiniteNumber(Number(readFileSync(resolve(PATHS.cloudyProfiles, file), 'utf8').split('\n')[1]), `${file} gravity`);
    return [{ teffK: Number(match[1]), gravityMps2, logg: Math.round(Math.log10(gravityMps2 * 100) * 2) / 2, file, clouds: file.replace(/\.pt$/u, '.cld') }];
  });
}

/** The grid of those nodes at a metallicity, with the cloud files of the nodes named unpacked from the archive. */
export function diamondbackGrid(metallicity: number, nodes: readonly PicasoNode[], toolchain = picasoToolchainSync()): { grid: PicasoGrid; nodes: PicasoNode[] } {
  const table = metallicity === 0 ? toolchain.opacities.split('/').at(-1)! : metalRichTables(descriptor().entry)[metallicity.toFixed(1)];
  if (!table) throw new Error(`The PICASO toolchain pins no correlated-k table for [M/H] ${metallicity} (${descriptor().file}).`);
  const opacities = resolve(PATHS.opacities, table);
  if (!existsSync(opacities) || !existsSync(PATHS.cloudArchive)) throw new Error(`The PICASO toolchain lacks the Diamondback data (${table}, the cloud archive); reinstall it: ${INSTALL}`);
  const missing = nodes.filter(node => !existsSync(resolve(PATHS.cloudProperties, node.clouds!)));
  if (missing.length) runToolchainProcess('unzip', ['-q', '-o', PATHS.cloudArchive, ...missing.map(node => `cloud_optical_properties/${node.clouds!}`), '-d', resolve(PATHS.cloudProperties, '..')]);
  return { grid: { profiles: PATHS.cloudyProfiles, opacities, headerLines: 2 }, nodes: nodes.map(node => ({ ...node, clouds: resolve(PATHS.cloudProperties, node.clouds!) })) };
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
if r.get('database'):
    # A model that states its own abundances is read with the resampled line opacities, a little wider than the band.
    lo, hi = band[:, 0].min() / 1e4, band[:, 0].max() / 1e4
    opa = jdi.opannection(wave_range=[lo - 0.05 * (hi - lo), hi + 0.05 * (hi - lo)], filename_db=r['database'])
else:
    opa = jdi.opannection(method='preweighted', ck_db=r['opacities'])
nodes = []
for node in r['nodes']:
    case = jdi.inputs(calculation='browndwarf')
    # One tangle uses the disc's symmetry: PICASO halves num_gangle, and its Gauss tables stop at 8 angles.
    case.phase_angle(0, num_gangle=2 * int(r['angles']), num_tangle=1)
    case.gravity(gravity=float(node['gravityMps2']), gravity_unit=u.Unit('m/s**2'))
    if node.get('model'):
        # An Elf Owl release file: the pressure (bar) and temperature (K) profile and the abundance of every species at each level.
        import pandas, xarray
        ds = xarray.load_dataset(node['model'])
        atmosphere = pandas.DataFrame({'pressure': ds['pressure'].values, 'temperature': ds['temperature'].values})
        for name in ds.data_vars:
            if name not in ('flux', 'temperature'): atmosphere[name] = ds[name].values
        case.atmosphere(df=atmosphere)
        rw = ds['wavelength'].values; rf = ds['flux'].values
    elif node.get('exoRem'):
        # A released Exo-REM model: the temperature at each level, and in each layer the abundance of every gas and the optical
        # depth and particle radius of each cloud. Pressures are in Pa; the first row names the columns, the second their units.
        import pandas
        def table(kind):
            rows = open(os.path.join(node['exoRem'], kind + '_' + node['file'])).read().splitlines()
            return rows[0].lstrip('# ').split(), np.array([[float(v) for v in row.split()] for row in rows[2:] if row.strip()])
        _, levels = table('temperature_profile'); names, layers = table('vmr')
        levels = levels[np.argsort(levels[:, 0])]; layers = layers[np.argsort(layers[:, 0])]
        level_p = levels[:, 0] / 1e5; layer_p = layers[:, 0] / 1e5
        atmosphere = pandas.DataFrame({'pressure': level_p, 'temperature': levels[:, 1]}); heavy = np.zeros(level_p.size)
        for i, name in enumerate(names):
            if not name.startswith('volume_mixing_ratio_'): continue
            gas = np.exp(np.interp(np.log(level_p), np.log(layer_p), np.log(np.maximum(layers[:, i], 1e-38))))
            atmosphere[name.replace('volume_mixing_ratio_', '')] = gas; heavy += gas
        # Hydrogen and helium are the rest, at the He/H of Exo-REM's namelists (0.08395).
        atmosphere['H2'] = (1 - heavy) / (1 + 2 * 8.395e-2); atmosphere['He'] = (1 - heavy) - atmosphere['H2']
        case.atmosphere(df=atmosphere)
        # Exo-REM's optical-constant table of a cloud: wavelengths and particle radii (m), then the extinction efficiency, the
        # single-scattering albedo and the asymmetry factor at each radius. It reads them linearly in wavenumber, then in radius,
        # continuing the end segments, and scales a layer's optical depth from its reference wavenumber (10,000 per cm) by the
        # extinction efficiency (objects.f90, update_cloud_optical_parameters).
        def constants(path):
            rows = open(path).read().splitlines(); at = 0
            def block(count, title=None):
                # The next count numbers, from the line after the title when one is named; comment lines between are skipped.
                nonlocal at
                if title: at = next(i for i in range(at, len(rows)) if rows[i].startswith(title)) + 1
                values = []
                while len(values) < count:
                    if not rows[at].startswith('#'): values += [float(v) for v in rows[at].split()]
                    at += 1
                return np.array(values[:count])
            nw, nr = int(rows[1]), int(rows[3])
            wavenumber = 1e-2 / block(nw, '# Wavelength axis'); radii = block(nr, '# Particle size axis'); order = np.argsort(wavenumber)
            if np.any(np.diff(radii) <= 0): raise ValueError(f'{path} lists its particle radii out of order')
            def grid(title):
                block(0, title)
                return np.array([block(nw) for _ in range(nr)])[:, order]
            return wavenumber[order], radii, grid('# Extinction'), grid('# Single Scat'), grid('# Assymetry')
        def linear(x, xs, ys):
            i = np.clip(np.searchsorted(xs, x) - 1, 0, len(xs) - 2)
            return ys[..., i] + (ys[..., i + 1] - ys[..., i]) * (x - xs[i]) / (xs[i + 1] - xs[i])
        wno = np.linspace(1e4 / (hi + 0.1 * (hi - lo)), 1e4 / (lo - 0.1 * (hi - lo)), 60)
        opd = np.zeros((layer_p.size, wno.size)); scattered = np.zeros_like(opd); forward = np.zeros_like(opd)
        for cloud in [name.replace('cloud_opacity_', '') for name in names if name.startswith('cloud_opacity_')]:
            sigma, radii, qext, albedo, asymmetry = constants(os.path.join(r['opticalConstants'], cloud + '.ocst.txt'))
            depth = layers[:, names.index('cloud_opacity_' + cloud)]; radius = layers[:, names.index('cloud_particle_radius_' + cloud)]
            at_radius = lambda values, j: linear(radius[j], radii, values.T)
            for j in np.nonzero(depth > 0)[0]:
                tau = depth[j] * np.maximum(at_radius(linear(wno, sigma, qext), j), 0) / max(float(at_radius(linear(1e4, sigma, qext), j)), 1e-300)
                w = np.clip(at_radius(linear(wno, sigma, albedo), j), 0, 1); g = np.clip(at_radius(linear(wno, sigma, asymmetry), j), -1, 1)
                opd[j] += tau; scattered[j] += tau * w; forward[j] += tau * w * g
        case.clouds(df=pandas.DataFrame({'pressure': np.repeat(layer_p, wno.size), 'wavenumber': np.tile(wno, layer_p.size), 'opd': opd.ravel(),
          'w0': np.where(opd > 0, scattered / np.maximum(opd, 1e-300), 0).ravel(), 'g0': np.where(scattered > 0, forward / np.maximum(scattered, 1e-300), 0).ravel()}))
        # The released spectrum: wavenumber (per cm) and the flux per wavenumber (W/m2 per cm-1), here per wavelength as PICASO's.
        _, released = table('spectra'); rw = 1e4 / released[:, 0]; rf = released[:, 1] * 1e3 / (rw * 1e-4) ** 2
    else:
        # A Bobcat structure file's first line states its Teff and gravity (m/s^2); a Diamondback file names its columns, then
        # states its gravity. Then level, pressure (bar), temperature (K), ...
        path = os.path.join(r['profiles'], node['file'])
        lines = open(path).readlines()
        if int(r['headerLines']) == 1:
            head = lines[0].split()
            if float(head[0]) != float(node['teffK']) or float(head[1]) != float(node['gravityMps2']): raise ValueError(f"{node['file']} states {head[0]} K, {head[1]} m/s^2")
        elif float(lines[1]) != float(node['gravityMps2']): raise ValueError(f"{node['file']} states {lines[1].strip()} m/s^2")
        pressure, temperature = np.loadtxt(path, usecols=[1, 2], unpack=True, skiprows=int(r['headerLines']))
        case.add_pt(temperature, pressure)
        case.premix_atmosphere(opa, verbose=False)
    # The release's cloud file: one row per layer and spectral window, with the optical depth, asymmetry and single-scattering albedo.
    if node.get('clouds'): case.clouds(filename=node['clouds'], sep=r'\s+', skiprows=1, header=None, names=['lvl', 'wv', 'opd', 'g0', 'w0', 'sigma'])
    # A cloudy model is solved with four-term spherical harmonics (Rooney, Batalha & Marley 2023, arXiv:2304.04830, benchmarked
    # there against discrete ordinates). Across a thick scattering cloud the two-stream solver's intensities are too flat toward
    # the limb, and its flux misses the one a release states; a cloud-free model's intensities are the same with either.
    cloudy = bool(node.get('clouds') or node.get('exoRem'))
    if cloudy: case.approx(rt_method='SH', stream=4)
    spectrum = case.spectrum(opa, calculation='thermal', full_output=True)
    full = spectrum['full_output']
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
    # A release file carries the spectrum its authors computed: the band flux computed here over theirs is the check that the
    # model was read as they read it.
    release = None
    if node.get('model') or node.get('exoRem'):
        mine = (np.asarray(spectrum['thermal'])[order] * transmission * np.diff(edges)).sum() / (transmission * np.diff(edges)).sum()
        ro = np.argsort(rw); rw = rw[ro]; rf = rf[ro]
        keep = (rw >= wl[0]) & (rw <= wl[-1]); rt = np.interp(rw[keep] * 1e4, band[:, 0], band[:, 1], left=0, right=0)
        redges = np.concatenate([[rw[keep][0]], (rw[keep][1:] + rw[keep][:-1]) / 2, [rw[keep][-1]]])
        release = float(mine / ((rf[keep] * rt * np.diff(redges)).sum() / (rt * np.diff(redges)).sum()))
    x = 1 - mu
    (i0, a, b), *_ = np.linalg.lstsq(np.stack([np.ones_like(x), -x, -x ** 2], axis=1), band_intensity, rcond=None)
    rel = band_intensity / i0
    nodes.append({'teffK': int(node['teffK']), 'gravityMps2': float(node['gravityMps2']), 'binsInBand': int((transmission > 0).sum()),
      'mu': mu.tolist(), 'intensity': rel.tolist(), 'centre': float(i0), 'u1': float(a / i0), 'u2': float(b / i0),
      'rms': float(np.sqrt(np.mean((rel - (1 - a / i0 * x - b / i0 * x ** 2)) ** 2))), 'solver': 'SH4' if cloudy else 'Toon89', **({} if release is None else {'releaseRatio': release})})
json.dump({'schema': 'cssearth-picaso@1', 'picaso': importlib.metadata.version('picaso'), 'nodes': nodes}, out)
`;

/** `intensity` is relative to the fitted disc centre, whose band-integrated intensity is `centre` (PICASO's units): the disc's
 * flux in the band is pi centre (1 - u1/3 - u2/6). */
export interface PicasoLimbNode { readonly teffK: number; readonly gravityMps2: number; readonly binsInBand: number; readonly mu: readonly number[]; readonly intensity: readonly number[]; readonly centre: number; readonly u1: number; readonly u2: number; readonly rms: number;
  /** For a node read from a release file: the band flux computed here over the flux of the release's own spectrum. */
  readonly releaseRatio?: number;
  /** The solver: four-term spherical harmonics for a cloudy model, the two-stream source-function technique for a cloud-free one. */
  readonly solver: 'SH4' | 'Toon89' }

/** The passband intensity each Bobcat node emits toward the observer at the emission cosines of PICASO's Gauss points (8, mu 0.19 to 1) (relative to the fitted disc centre), and the quadratic
 * law I(mu) = I0 [1 - u1 (1 - mu) - u2 (1 - mu)^2] fitted to it by least squares with I0 free. */
export function picasoLimbNodes(nodes: readonly PicasoNode[], angles = 8, toolchain = picasoToolchainSync(), passband = PATHS.passband, grid: PicasoGrid = { profiles: PATHS.profiles, opacities: toolchain.opacities, headerLines: 1 }) {
  const answer = requireRecord(JSON.parse(runToolchainProcess(toolchain.python, ['-c', PYTHON], { env: toolchain.env, maxBuffer: 256 * 1024 * 1024,
    input: JSON.stringify({ nodes, angles, opacities: grid.opacities, profiles: grid.profiles, headerLines: grid.headerLines, passband, ...(grid.database ? { database: grid.database } : {}), ...(grid.opticalConstants ? { opticalConstants: grid.opticalConstants } : {}) }) })) as unknown, 'PICASO answer');
  if (answer.schema !== 'cssearth-picaso@1' || answer.picaso !== toolchain.version) throw new Error(`PICASO answered as ${String(answer.picaso)}, expected ${toolchain.version}.`);
  const numbers = (value: unknown, label: string) => requireArray(value, label).map(v => requireFiniteNumber(v, label));
  return { picaso: toolchain.version, opacities: (grid.database ?? grid.opacities).split('/').at(-1)!, nodes: requireArray(answer.nodes, 'PICASO nodes').map((raw): PicasoLimbNode => {
    const node = requireRecord(raw, 'PICASO node');
    return { teffK: requireFiniteNumber(node.teffK, 'teffK'), gravityMps2: requireFiniteNumber(node.gravityMps2, 'gravityMps2'), binsInBand: requireFiniteNumber(node.binsInBand, 'binsInBand'),
      mu: numbers(node.mu, 'mu'), intensity: numbers(node.intensity, 'intensity'), centre: requireFiniteNumber(node.centre, 'centre'), u1: requireFiniteNumber(node.u1, 'u1'), u2: requireFiniteNumber(node.u2, 'u2'), rms: requireFiniteNumber(node.rms, 'rms'),
      solver: node.solver === 'SH4' ? 'SH4' : 'Toon89', ...(node.releaseRatio === undefined ? {} : { releaseRatio: requireFiniteNumber(node.releaseRatio, 'releaseRatio') }) };
  }) };
}

/** The transmission curve of an SVO filter (wavelength in angstroms, transmission), kept in the toolchain once fetched. The
 * install holds Bessell V; a law in another band names its filter here. */
export function picasoPassband(svo: string): string {
  if (!/^[\w.+-]+\/[\w.+-]+$/u.test(svo)) throw new TypeError(`"${svo}" is not an SVO filter id like MKO/NSFCam.H.`);
  const path = resolve(PICASO_ROOT, 'passband', `${svo.replace('/', '_')}.dat`);
  if (existsSync(path)) return path;
  const url = `${dataUrl(descriptor().entry, 'passbands')}${svo}`;
  mkdirSync(resolve(path, '..'), { recursive: true });
  runToolchainProcess('curl', ['-sSL', '--retry', '5', '-o', path, url]);
  // The service answers an unknown filter with an empty file.
  const rows = readFileSync(path, 'utf8').split(/\r?\n/u).filter(line => /^\s*[\d.]+\s+[\d.eE+-]+\s*$/u.test(line));
  if (rows.length < 2) { rmSync(path, { force: true }); throw new Error(`The SVO Filter Profile Service holds no transmission curve for ${svo} (${url}).`); }
  return path;
}

/** Whether the toolchain is installed from the current pins: a check that needs it skips where it is not. */
export const picasoInstalled = () => installedMarkerIssue(PICASO_ROOT, descriptor()) === null;

export function verifyPicaso() {
  const toolchain = picasoToolchainSync();
  const found = runToolchainProcess(toolchain.python, ['-c', "import importlib.metadata as m; print(m.version('picaso'))"], { env: toolchain.env }).trim();
  if (found !== toolchain.version) throw new Error(`Expected PICASO ${toolchain.version}, found ${found}.`);
  if (!bobcatNodes().length) throw new Error('The PICASO toolchain holds no Sonora Bobcat profiles.');
  return found;
}
