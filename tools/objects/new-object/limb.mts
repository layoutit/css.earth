/** A new star's limb darkening: the quadratic law a model-atmosphere grid gives at the star's own temperature and gravity, read by
 * the colour lens's own interpolator so a grid counts only if its four surrounding nodes exist.
 *
 * 1. Claret & Bloemen (2011), ATLAS models, Johnson V (VizieR J/A+A/529/A75, table-af): the visible band the colour is drawn in.
 * 2. Claret (2017), PHOENIX models, TESS band (J/A+A/600/A30, tableab, Mod PC): cool stars and brown dwarfs the ATLAS grid does
 *    not reach.
 *
 * Outside both grids, or where a node is missing, no law is drawn and the reason is recorded; the value is never extrapolated.
 * A spec may decline a law with its own reason. */
import { interpolateQuadraticLimbDarkening, type QuadraticLimbDarkening } from '../observation/stellar/stellar-photometric-color.mts';
import { VIZIER_ASU, type Archive } from './archives.mts';

interface Grid {
  readonly key: 'atlas' | 'phoenix'; readonly file: string; readonly source: string; readonly cite: string; readonly models: string; readonly band: string;
  readonly vizier: string; readonly modelColumns: Readonly<Record<string, string>>; readonly columns: { readonly teff: string; readonly logg: string; readonly u1: string; readonly u2: string };
  readonly form: (teff: string, logg: string) => Record<string, string>;
}
export const GRIDS: readonly Grid[] = [
  { key: 'atlas', file: 'photometry/claret-2011-v-quadratic.tsv', source: 'J/A+A/529/A75/table-af', cite: 'Claret & Bloemen (2011), A&A 529, A75', models: 'ATLAS', band: 'Johnson V', vizier: 'J/A+A/529/A75',
    modelColumns: { Filt: 'V', Met: 'L', Mod: 'A' }, columns: { teff: 'Teff', logg: 'logg', u1: 'a', u2: 'b' },
    form: (teff, logg) => ({ '-source': 'J/A+A/529/A75/table-af', '-out.max': '500', Teff: teff, logg, Z: '=0', xi: '=2', Filt: 'V', Met: 'L', Mod: 'A', '-out': 'logg,Teff,Z,xi,a,b,Filt,Met,Mod' }) },
  { key: 'phoenix', file: 'photometry/claret-2017-tess-quadratic.tsv', source: 'J/A+A/600/A30/tableab', cite: 'Claret (2017), A&A 600, A30', models: 'PHOENIX', band: 'TESS', vizier: 'J/A+A/600/A30',
    modelColumns: { Type: 'q', Mod: 'PC' }, columns: { teff: 'Teff', logg: 'logg', u1: 'aLSM', u2: 'bLSM' },
    form: (teff, logg) => ({ '-source': 'J/A+A/600/A30/tableab', '-out.max': '500', Teff: teff, logg, Z: '=0', Type: 'q', Mod: 'PC', '-out': 'logg,Teff,Z,L/HP,aLSM,bLSM,Type,Mod' }) },
];
const strip = (text: string) => text.replace(/^#.*\n/gmu, '').replace(/^\s*\n/gmu, '');
const REPLACEMENTS = [{ pattern: '^#.*\\n', flags: 'gm', replacement: '' }, { pattern: '^\\s*\\n', flags: 'gm', replacement: '' }];

export interface LimbChoice {
  readonly limbDarkening?: Record<string, unknown>; readonly file?: { readonly path: string; readonly text: string };
  readonly acquisition?: Record<string, unknown>; readonly input?: Record<string, unknown>; readonly coefficients?: QuadraticLimbDarkening;
  /** The sentence the lens qualification, README and NOTICE use. */
  readonly sentence: string; readonly credit?: string; readonly grid?: Grid['key'];
}

/** The rows of a grid around the star: a wide window first to find the bracketing nodes, then only those, as the plan restores them. */
export async function chooseLimb(id: string, teffK: number, logg: number, archive: Archive, decline?: string): Promise<LimbChoice> {
  if (decline) return { sentence: `No limb darkening is drawn: ${decline}` };
  const reasons: string[] = [];
  // Both grids' wide windows are requested at once; the first grid that brackets the star is used.
  const wides = await Promise.all(GRIDS.map(grid => archive.text(VIZIER_ASU, grid.form(`${Math.floor(teffK - 1000)}..${Math.ceil(teffK + 1000)}`, `${(logg - 1).toFixed(2)}..${(logg + 1).toFixed(2)}`)).then(strip)));
  for (const [g, grid] of GRIDS.entries()) {
    const wide = wides[g]!;
    const recipe = { law: 'quadratic' as const, source: 'grid' as const, path: grid.file, teffK, logg, models: grid.modelColumns, columns: grid.columns };
    try {
      interpolateQuadraticLimbDarkening(wide, recipe);
    } catch (error) { reasons.push(`${grid.cite} (${grid.models}): ${(error as Error).message}`); continue; }
    // The bracketing nodes, then a request for exactly those.
    const rows = wide.split('\n').filter(line => /^\s*[\d.-]/u.test(line)).map(line => line.split('\t').map(cell => cell.trim()));
    const header = wide.split('\n')[0]!.split('\t').map(cell => cell.trim()), at = (name: string) => header.indexOf(name);
    const nodes = rows.filter(row => Object.entries(grid.modelColumns).every(([key, value]) => row[at(key)] === value));
    const values = (column: string) => [...new Set(nodes.map(row => Number(row[at(column)])))].sort((a, b) => a - b);
    const around = (list: number[], value: number) => { const lo = list.findIndex((v, i) => v <= value && list[i + 1]! >= value); return [list[lo]!, list[lo + 1]!]; };
    const [t0, t1] = around(values(grid.columns.teff), teffK), [g0, g1] = around(values(grid.columns.logg), logg);
    const form = grid.form(`${t0}..${t1}`, `${g0}..${g1}`), text = strip(await archive.text(VIZIER_ASU, form));
    const coefficients = interpolateQuadraticLimbDarkening(text, recipe);
    const law = `the quadratic law ${grid.cite} compute${grid.key === 'atlas' ? '' : 's'} from ${grid.models} model atmospheres for the ${grid.band} band at ${teffK.toLocaleString('en-US')} K and log g ${logg}`;
    return {
      limbDarkening: { law: 'quadratic', path: grid.file, grid: { teffK, logg, models: grid.modelColumns }, columns: grid.columns }, file: { path: grid.file, text }, coefficients, grid: grid.key,
      acquisition: { kind: 'request-download', groups: ['restore', 'refresh'], path: grid.file, url: VIZIER_ASU, form, requiredText: ['logg\tTeff'], replacements: REPLACEMENTS },
      input: { id: `${id}-claret-${grid.key === 'atlas' ? '2011' : '2017'}-limb-darkening`, path: grid.file, origin: VIZIER_ASU, credit: `${grid.cite} (VizieR ${grid.vizier})`,
        license: 'VizieR catalogue data, public with citation of the paper and CDS', licenseEvidence: ['https://cds.unistra.fr/vizier-org/licences_vizier.html'],
        acquisition: `VizieR request in source/preparation/acquisition.json: the quadratic ${grid.band} coefficients of the grid nodes at ${t0}..${t1} K, log g ${g0}..${g1}, solar metallicity.`,
        redistribution: 'Catalogue rows retained unchanged with their citation.', consumers: ['assets', 'lenses'] },
      sentence: `dimmed toward the limb by ${law} (u1 ${coefficients.u1.toFixed(3)}, u2 ${coefficients.u2.toFixed(3)}): a model, because no fit of this star's limb is used`,
      credit: `Limb darkening: ${grid.cite}, via VizieR ${grid.vizier}.`,
    };
  }
  return { sentence: `No limb darkening is drawn: at ${teffK.toLocaleString('en-US')} K and log g ${logg} no model grid used here reaches it (${reasons.join('; ')})` };
}
