/** The limb law of a brown dwarf colder than every published table: PICASO (Batalha et al. 2019) computes the V-band intensity
 * that the cloud-free Sonora Bobcat atmospheres (Marley et al. 2021) around the dwarf's temperature and gravity emit at eight
 * viewing angles, the quadratic law is fitted to each, and the colour lens reads between those nodes as it reads any grid. The
 * nodes are written as a small grid file beside the star, with each node's intensities, so the law can be checked without the
 * toolchain; `--star-limb` recomputes it (packages/telescope/toolchains/picaso-toolchain.json pins what runs). */
import { bobcatNodes, picasoLimbNodes } from '@cssearth/telescope/node';
import { interpolateGrid, readLimbGrid } from '@cssearth/bake/objects/stellar';
import type { LimbChoice } from './limb.mts';

export const PICASO = { cite: 'PICASO 4.1 (Batalha et al. 2019, ApJ 878, 70)', models: 'Sonora Bobcat cloud-free (Marley et al. 2021, ApJ 920, 85)',
  file: 'photometry/picaso-bobcat-v-quadratic.tsv', profiles: 'https://doi.org/10.5281/zenodo.5063476', opacities: 'https://doi.org/10.5281/zenodo.18636725' } as const;
const logg = (gravityMps2: number) => Number(Math.log10(gravityMps2 * 100).toFixed(4));

export function fromPicaso(id: string, teffK: number, starLogg: number): LimbChoice {
  const available = bobcatNodes().map(node => ({ ...node, teff: node.teffK, logg: logg(node.gravityMps2), u1: 0, u2: 0 }));
  if (!available.length) throw new Error('the PICASO toolchain holds no Bobcat profiles: node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts picaso install');
  const { corners } = interpolateGrid(available, { teff: teffK, logg: starLogg });
  const chosen = corners.map(corner => available.find(node => node.teff === corner.teff && node.logg === corner.logg)!);
  const run = picasoLimbNodes(chosen.map(({ teffK: t, gravityMps2, file }) => ({ teffK: t, gravityMps2, file })));
  const files = new Map(chosen.map(node => [`${node.teffK}/${node.gravityMps2}`, node.file.replace(/\.dat$/u, '')]));
  const profile = (node: { teffK: number; gravityMps2: number }) => files.get(`${node.teffK}/${node.gravityMps2}`)!;
  const text = [
    `# ${PICASO.cite}: the Bessell V (SVO Generic/Bessell.V) intensity of ${PICASO.models} structures (${PICASO.profiles}),`,
    `# with the PICASO 4.0 correlated-k table ${run.opacities} (${PICASO.opacities}), energy-weighted over PICASO's bins,`,
    '# at the emission cosines of its eight Gauss points; a and b are the least-squares quadratic law with the centre intensity free.',
    ...run.nodes.map(node => `# ${profile(node)}: mu ${node.mu.map(v => v.toFixed(4)).join(' ')}; I/I0 ${node.intensity.map(v => v.toFixed(4)).join(' ')}; rms ${node.rms.toFixed(5)}`),
    'Teff\tlogg\ta\tb\tProfile', 'K\t[cgs]\t\t\t',
    ...run.nodes.map(node => `${node.teffK}\t${logg(node.gravityMps2)}\t${node.u1.toFixed(6)}\t${node.u2.toFixed(6)}\t${profile(node)}`),
  ].join('\n') + '\n';
  const columns = { teff: 'Teff', logg: 'logg', u1: 'a', u2: 'b' };
  const coefficients = readLimbGrid(text, { law: 'quadratic', source: 'grid', path: PICASO.file, teffK, logg: starLogg, models: {}, columns });
  const worst = Math.max(...run.nodes.map(node => node.rms));
  return {
    limbDarkening: { law: 'quadratic', path: PICASO.file, grid: { teffK, logg: starLogg, models: {} }, columns },
    files: [{ path: PICASO.file, text }], grid: 'picaso', coefficients: { u1: coefficients.u1, u2: coefficients.u2, u1Bounds: coefficients.u1Bounds, u2Bounds: coefficients.u2Bounds },
    inputs: [{ id: `${id}-picaso-bobcat-limb-darkening`, path: PICASO.file, origin: PICASO.profiles, credit: `${PICASO.cite} on ${PICASO.models} profiles`,
      license: 'Project-computed model values; the Sonora Bobcat profiles and PICASO correlated-k tables are CC BY 4.0, PICASO is GPL-3.0',
      acquisition: `Computed by node tools/objects/new-object.mts --star-limb ${id} (tools/objects/new-object/picaso-limb.mts, @cssearth/telescope/node picasoLimbNodes) at the Bobcat nodes ${chosen.map(profile).join(', ')}.`,
      redistribution: 'Model coefficients and the intensities they are fitted to, with the model and tool cited.', consumers: ['assets', 'lenses'],
      sourceBinding: { kind: 'local', reason: 'Computed with the pinned PICASO toolchain; --star-limb recomputes it.' } }],
    sentence: `dimmed toward the limb by the quadratic law fitted to the Bessell V intensity ${PICASO.cite} computes from ${PICASO.models} model atmospheres at ${teffK.toLocaleString('en-US')} K and log g ${starLogg}, read between the models ${chosen.map(profile).join(', ')} (u1 ${coefficients.u1.toFixed(3)}, u2 ${coefficients.u2.toFixed(3)}; the law fits each model's eight angles within ${(worst * 100).toFixed(2)}% of the centre): a cloud-free model, because no table reaches a dwarf this cold and no fit of this star's limb is used`,
    credit: `Limb darkening: computed with ${PICASO.cite} on ${PICASO.models} profiles (${PICASO.profiles}) and the PICASO 4.0 correlated-k tables (${PICASO.opacities}).`,
  };
}
