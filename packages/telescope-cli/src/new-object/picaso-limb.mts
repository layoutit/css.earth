/** The limb law of a brown dwarf colder than every published table: PICASO (Batalha et al. 2019) computes the V-band intensity
 * that the cloud-free Sonora Bobcat atmospheres (Marley et al. 2021) around the dwarf's temperature and gravity emit at eight
 * viewing angles, the quadratic law is fitted to each, and the color dataset reads between those nodes as it reads any grid. The
 * nodes are written as a small grid file beside the star, with each node's intensities, so the law can be checked without the
 * toolchain; `--star-limb` recomputes it (packages/telescope/toolchains/picaso-toolchain.json pins what runs).
 *
 * An imaged planet colder than every table takes the same route (`--imaged-limb`, imaged/imaged-limb.mts) in the middle band of
 * its infrared color, from the model a paper fitted to it: a cloudy Sonora Diamondback model (Morley et al. 2024) with that
 * release's cloud optical properties, or a cloud-free Sonora Elf Owl model (Mukherjee et al. 2024), whose release states the
 * abundances of its disequilibrium chemistry, or a cloudy model of Exo-REM's public grid (Charnay et al. 2018), whose release
 * states each layer's abundances and the optical depth and particle radius of its iron and silicate clouds. The band, the body
 * and the models are the three things a caller names. */
import { bobcatNodes, diamondbackGrid, diamondbackNodes, elfOwlGrid, elfOwlNodes, exoRemGrid, exoRemNodes, picasoLimbNodes, picasoPassband, picasoToolchainSync, type PicasoGrid, type PicasoNode } from '@cssearth/telescope/node';
import { interpolateGrid, readLimbGrid } from '@cssearth/bake/objects/stellar';
import type { LimbChoice } from './limb.mts';

export const PICASO = { cite: 'PICASO 4.1 (Batalha et al. 2019, ApJ 878, 70)', models: 'Sonora Bobcat cloud-free (Marley et al. 2021, ApJ 920, 85)',
  file: 'photometry/picaso-bobcat-v-quadratic.tsv', profiles: 'https://doi.org/10.5281/zenodo.5063476', opacities: 'https://doi.org/10.5281/zenodo.18636725' } as const;
const logg = (gravityMps2: number) => Number(Math.log10(gravityMps2 * 100).toFixed(4));
/** The solver of a cloudy model. */
const SH4 = 'four-term spherical harmonics (Rooney, Batalha & Marley 2023, arXiv:2304.04830)';
/** Three decimals, a value that rounds to zero written without a sign. */
const coefficient = (value: number) => (Math.abs(value) < 0.0005 ? 0 : value).toFixed(3);

/** The band a law is computed in (an SVO filter id) with the node file's name, and the body it is for: the flag that recomputes
 * it and the end of its sentence. */
export interface PicasoBand { readonly name: string; readonly svo: string; readonly file: string }
export interface PicasoBody { readonly flag: string; readonly because: string }
/** The model atmospheres a law is computed from: their name and release, the nodes the toolchain holds (a grid stepped in log g
 * names each node's), and for a grid with its own tables and cloud files, what PICASO reads them with. */
export interface PicasoModels { readonly name: string; readonly release: string; readonly input: string; readonly kind: string; readonly with: string;
  /** The opacities a model is read with, when not the pre-weighted correlated-k tables: their name and release. */
  readonly opacities?: { readonly name: string; readonly release: string };
  /** The terms of what the law is computed from, when not the Sonora release's; and a profile's name as a sentence gives it. */
  readonly license?: string; readonly short?: (profile: string) => string;
  readonly nodes: () => readonly (PicasoNode & { readonly logg?: number })[]; readonly prepare?: (nodes: readonly PicasoNode[]) => { grid: PicasoGrid; nodes: PicasoNode[] } }
const BESSELL_V: PicasoBand = { name: 'Bessell V', svo: 'Generic/Bessell.V', file: PICASO.file };
const DWARF: PicasoBody = { flag: '--star-limb', because: 'because no table reaches a dwarf this cold and no fit of this star\'s limb is used' };
const BOBCAT: PicasoModels = { name: PICASO.models, release: PICASO.profiles, input: 'picaso-bobcat-limb-darkening', kind: 'a cloud-free model', with: '', nodes: bobcatNodes };
export const DIAMONDBACK = { cite: 'Morley et al. 2024, ApJ 975, 59', release: 'https://doi.org/10.5281/zenodo.12735103' } as const;
export const ELF_OWL = { cite: 'Mukherjee et al. 2024, ApJ 963, 73', release: 'https://doi.org/10.5281/zenodo.10381250', opacities: 'https://doi.org/10.5281/zenodo.3759675' } as const;
/** The cloud-free Sonora Elf Owl models of one metallicity, C/O (times solar) and log Kzz, read with their own abundances. */
export const elfOwl = (metallicity: number, co: number, logKzz: number): PicasoModels => ({ name: `Sonora Elf Owl cloud-free (${ELF_OWL.cite}; [M/H] ${metallicity > 0 ? '+' : ''}${metallicity.toFixed(1)}, C/O ${co} times solar, log Kzz ${logKzz})`,
  release: ELF_OWL.release, input: 'picaso-elf-owl-limb-darkening', kind: 'a cloud-free model', with: ' and the abundances the release states',
  opacities: { name: 'PICASO\'s resampled opacity database', release: ELF_OWL.opacities },
  nodes: () => elfOwlNodes(metallicity, co, logKzz), prepare: nodes => elfOwlGrid(nodes) });
export const EXO_REM = { cite: 'Charnay et al. 2018, ApJ 854, 172', release: 'https://lesia.obspm.fr/exorem/YGP_grids/old_grids_2021/', code: 'https://gitlab.obspm.fr/Exoplanet-Atmospheres-LESIA/exorem',
  /** The grid's steps: metallicity in half decades from 0.32 to 100 times solar, C/O in steps of 0.05 from 0.10 to 0.80. */
  metallicity: [-0.5, 2, 0.5], co: [0.1, 0.8, 0.05] } as const;
/** The grid's value nearest a fitted one, which must lie within the grid. */
function nearest(value: number, [from, to, step]: readonly [number, number, number], what: string) {
  if (value < from - step / 2 || value > to + step / 2) throw new RangeError(`${what} ${value} is outside the ${from} to ${to} of Exo-REM's public grid.`);
  return Math.min(to, Math.max(from, Number((Math.round(value / step) * step).toFixed(2))));
}
/** The cloudy models of Exo-REM's public grid at the composition nearest a fitted metallicity ([M/H]) and C/O: the grid steps
 * by half a decade in metallicity and 0.05 in C/O, and a law is read between temperatures and gravities only. */
export const exoRem = (metallicity: number, co: number): PicasoModels => {
  const solar = Number((10 ** nearest(metallicity, EXO_REM.metallicity, '[M/H]')).toFixed(2)), ratio = nearest(co, EXO_REM.co, 'C/O');
  return { name: `Exo-REM cloudy (${EXO_REM.cite}; ${solar} times solar metallicity, C/O ${ratio.toFixed(2)})`, release: EXO_REM.release, input: 'picaso-exo-rem-limb-darkening', kind: 'a cloudy model',
    with: ', the optical depth and particle radius of the iron and silicate clouds the release states for each layer, and Exo-REM\'s optical constants of both',
    opacities: { name: 'PICASO\'s resampled opacity database', release: ELF_OWL.opacities }, short: profile => profile.replace(/_met.*$/u, ''),
    license: 'Project-computed model values; the Exo-REM grid is public and its README asks that its papers be cited, Exo-REM with its cloud optical constants is under the MIT license, PICASO is GPL-3.0',
    nodes: () => exoRemNodes(solar, ratio), prepare: nodes => exoRemGrid(nodes) };
};
/** The cloudy Sonora Diamondback models of one metallicity and sedimentation efficiency. */
export const diamondback = (metallicity: number, fsed: number): PicasoModels => ({ name: `Sonora Diamondback cloudy (${DIAMONDBACK.cite}; [M/H] ${metallicity > 0 ? '+' : ''}${metallicity.toFixed(1)}, f_sed ${fsed})`,
  release: DIAMONDBACK.release, input: 'picaso-diamondback-limb-darkening', kind: 'a cloudy model', with: ' and the release\'s cloud optical properties',
  nodes: () => diamondbackNodes(metallicity, fsed), prepare: nodes => diamondbackGrid(metallicity, nodes) });

export function fromPicaso(id: string, teffK: number, starLogg: number, band: PicasoBand = BESSELL_V, body: PicasoBody = DWARF, models: PicasoModels = BOBCAT): LimbChoice {
  const available = models.nodes().map(node => ({ ...node, teff: node.teffK, logg: node.logg ?? logg(node.gravityMps2), u1: 0, u2: 0 }));
  if (!available.length) throw new Error(`the PICASO toolchain holds no ${models.name} profiles: node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts picaso install`);
  const { corners } = interpolateGrid(available, { teff: teffK, logg: starLogg });
  const chosen = corners.map(corner => available.find(node => node.teff === corner.teff && node.logg === corner.logg)!);
  const structures = chosen.map(({ teffK: t, gravityMps2, file, clouds }) => ({ teffK: t, gravityMps2, file, ...(clouds === undefined ? {} : { clouds }) })), prepared = models.prepare?.(structures);
  const run = picasoLimbNodes(prepared?.nodes ?? structures, 8, picasoToolchainSync(), picasoPassband(band.svo), prepared?.grid);
  const byNode = new Map(chosen.map(node => [`${node.teffK}/${node.gravityMps2}`, node]));
  const profile = (node: { teffK: number; gravityMps2: number }) => byNode.get(`${node.teffK}/${node.gravityMps2}`)!.file.replace(/\.(?:dat|pt|nc)$/u, '');
  const opacities = models.opacities ? `${models.opacities.name} ${run.opacities} (${models.opacities.release})` : `the PICASO 4.0 correlated-k table ${run.opacities} (${PICASO.opacities})`;
  const text = [
    `# ${PICASO.cite}: the ${band.name} (SVO ${band.svo}) intensity of ${models.name} structures (${models.release})${models.with},`,
    `# with ${opacities}, energy-weighted over PICASO's bins,`,
    ...(run.nodes.some(node => node.solver === 'SH4') ? [`# solved with ${SH4},`] : []),
    '# at the emission cosines of its eight Gauss points; a and b are the least-squares quadratic law with the centre intensity free.',
    ...run.nodes.map(node => `# ${profile(node)}: mu ${node.mu.map(v => v.toFixed(4)).join(' ')}; I/I0 ${node.intensity.map(v => v.toFixed(4)).join(' ')}; rms ${node.rms.toFixed(5)}${node.releaseRatio === undefined ? '' : `; band flux ${node.releaseRatio.toFixed(3)} of the release's own spectrum`}`),
    'Teff\tlogg\ta\tb\tProfile', 'K\t[cgs]\t\t\t',
    ...run.nodes.map(node => `${node.teffK}\t${byNode.get(`${node.teffK}/${node.gravityMps2}`)!.logg}\t${node.u1.toFixed(6)}\t${node.u2.toFixed(6)}\t${profile(node)}`),
  ].join('\n') + '\n';
  const columns = { teff: 'Teff', logg: 'logg', u1: 'a', u2: 'b' };
  const coefficients = readLimbGrid(text, { law: 'quadratic', source: 'grid', path: band.file, teffK, logg: starLogg, models: {}, columns });
  const worst = Math.max(...run.nodes.map(node => node.rms));
  return {
    limbDarkening: { law: 'quadratic', path: band.file, grid: { teffK, logg: starLogg, models: {} }, columns },
    files: [{ path: band.file, text }], grid: 'picaso', coefficients: { u1: coefficients.u1, u2: coefficients.u2, u1Bounds: coefficients.u1Bounds, u2Bounds: coefficients.u2Bounds },
    inputs: [{ id: `${id}-${models.input}`, path: band.file, origin: models.release, credit: `${PICASO.cite} on ${models.name} profiles`,
      license: models.license ?? 'Project-computed model values; the Sonora profiles and PICASO correlated-k tables are CC BY 4.0, PICASO is GPL-3.0',
      acquisition: `Computed by node packages/telescope-cli/src/new-object/new-object-cli.mts ${body.flag} ${id} (packages/telescope-cli/src/new-object/picaso-limb.mts, @cssearth/telescope/node picasoLimbNodes) at the nodes ${chosen.map(profile).join(', ')}.`,
      redistribution: 'Model coefficients and the intensities they are fitted to, with the model and tool cited.', consumers: ['assets', 'datasets'],
      sourceBinding: { kind: 'local', reason: `Computed with the pinned PICASO toolchain; ${body.flag} recomputes it.` } }],
    sentence: `dimmed toward the limb by the quadratic law fitted to the ${band.name} intensity ${PICASO.cite} computes from ${models.name} model atmospheres at ${teffK.toLocaleString('en-US')} K and log g ${starLogg}, read between the models ${chosen.map(node => (models.short ?? (name => name))(profile(node))).join(', ')} (u1 ${coefficient(coefficients.u1)}, u2 ${coefficient(coefficients.u2)}; the law fits each model's eight angles within ${(worst * 100).toFixed(2)}% of the centre): ${models.kind}, ${body.because}`,
    credit: `Limb darkening: computed with ${PICASO.cite} on ${models.name} profiles (${models.release}) and ${models.opacities ? `${models.opacities.name} (${models.opacities.release})` : `the PICASO 4.0 correlated-k tables (${PICASO.opacities})`}.`,
  };
}
