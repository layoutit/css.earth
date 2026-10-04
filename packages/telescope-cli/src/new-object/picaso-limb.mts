/** The limb law of a brown dwarf colder than every published table: PICASO (Batalha et al. 2019) computes the V-band intensity
 * that the cloud-free Sonora Bobcat atmospheres (Marley et al. 2021) around the dwarf's temperature and gravity emit at eight
 * viewing angles, the quadratic law is fitted to each, and the color dataset reads between those nodes as it reads any grid. The
 * nodes are written as a small grid file beside the star, with each node's intensities, so the law can be checked without the
 * toolchain; `--star-limb` recomputes it (packages/telescope/toolchains/picaso-toolchain.json pins what runs).
 *
 * An imaged planet colder than every table takes the same route (`--imaged-limb`, imaged/imaged-limb.mts) in the middle band of
 * its infrared color, from the cloudy Sonora Diamondback model (Morley et al. 2024) a paper fitted to it, with that release's
 * cloud optical properties: the band, the body and the models are the three things a caller names. */
import { bobcatNodes, diamondbackGrid, diamondbackNodes, picasoLimbNodes, picasoPassband, picasoToolchainSync, type PicasoGrid, type PicasoNode } from '@cssearth/telescope/node';
import { interpolateGrid, readLimbGrid } from '@cssearth/bake/objects/stellar';
import type { LimbChoice } from './limb.mts';

export const PICASO = { cite: 'PICASO 4.1 (Batalha et al. 2019, ApJ 878, 70)', models: 'Sonora Bobcat cloud-free (Marley et al. 2021, ApJ 920, 85)',
  file: 'photometry/picaso-bobcat-v-quadratic.tsv', profiles: 'https://doi.org/10.5281/zenodo.5063476', opacities: 'https://doi.org/10.5281/zenodo.18636725' } as const;
const logg = (gravityMps2: number) => Number(Math.log10(gravityMps2 * 100).toFixed(4));
/** Three decimals, a value that rounds to zero written without a sign. */
const coefficient = (value: number) => (Math.abs(value) < 0.0005 ? 0 : value).toFixed(3);

/** The band a law is computed in (an SVO filter id) with the node file's name, and the body it is for: the flag that recomputes
 * it and the end of its sentence. */
export interface PicasoBand { readonly name: string; readonly svo: string; readonly file: string }
export interface PicasoBody { readonly flag: string; readonly because: string }
/** The model atmospheres a law is computed from: their name and release, the nodes the toolchain holds (a grid stepped in log g
 * names each node's), and for a grid with its own tables and cloud files, what PICASO reads them with. */
export interface PicasoModels { readonly name: string; readonly release: string; readonly input: string; readonly kind: string; readonly with: string;
  readonly nodes: () => readonly (PicasoNode & { readonly logg?: number })[]; readonly prepare?: (nodes: readonly PicasoNode[]) => { grid: PicasoGrid; nodes: PicasoNode[] } }
const BESSELL_V: PicasoBand = { name: 'Bessell V', svo: 'Generic/Bessell.V', file: PICASO.file };
const DWARF: PicasoBody = { flag: '--star-limb', because: 'because no table reaches a dwarf this cold and no fit of this star\'s limb is used' };
const BOBCAT: PicasoModels = { name: PICASO.models, release: PICASO.profiles, input: 'picaso-bobcat-limb-darkening', kind: 'a cloud-free model', with: '', nodes: bobcatNodes };
export const DIAMONDBACK = { cite: 'Morley et al. 2024, ApJ 975, 59', release: 'https://doi.org/10.5281/zenodo.12735103' } as const;
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
  const profile = (node: { teffK: number; gravityMps2: number }) => byNode.get(`${node.teffK}/${node.gravityMps2}`)!.file.replace(/\.(?:dat|pt)$/u, '');
  const text = [
    `# ${PICASO.cite}: the ${band.name} (SVO ${band.svo}) intensity of ${models.name} structures (${models.release})${models.with},`,
    `# with the PICASO 4.0 correlated-k table ${run.opacities} (${PICASO.opacities}), energy-weighted over PICASO's bins,`,
    '# at the emission cosines of its eight Gauss points; a and b are the least-squares quadratic law with the centre intensity free.',
    ...run.nodes.map(node => `# ${profile(node)}: mu ${node.mu.map(v => v.toFixed(4)).join(' ')}; I/I0 ${node.intensity.map(v => v.toFixed(4)).join(' ')}; rms ${node.rms.toFixed(5)}`),
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
      license: 'Project-computed model values; the Sonora profiles and PICASO correlated-k tables are CC BY 4.0, PICASO is GPL-3.0',
      acquisition: `Computed by node packages/telescope-cli/src/new-object/new-object-cli.mts ${body.flag} ${id} (packages/telescope-cli/src/new-object/picaso-limb.mts, @cssearth/telescope/node picasoLimbNodes) at the nodes ${chosen.map(profile).join(', ')}.`,
      redistribution: 'Model coefficients and the intensities they are fitted to, with the model and tool cited.', consumers: ['assets', 'datasets'],
      sourceBinding: { kind: 'local', reason: `Computed with the pinned PICASO toolchain; ${body.flag} recomputes it.` } }],
    sentence: `dimmed toward the limb by the quadratic law fitted to the ${band.name} intensity ${PICASO.cite} computes from ${models.name} model atmospheres at ${teffK.toLocaleString('en-US')} K and log g ${starLogg}, read between the models ${chosen.map(profile).join(', ')} (u1 ${coefficient(coefficients.u1)}, u2 ${coefficient(coefficients.u2)}; the law fits each model's eight angles within ${(worst * 100).toFixed(2)}% of the centre): ${models.kind}, ${body.because}`,
    credit: `Limb darkening: computed with ${PICASO.cite} on ${models.name} profiles (${models.release}) and the PICASO 4.0 correlated-k tables (${PICASO.opacities}).`,
  };
}
