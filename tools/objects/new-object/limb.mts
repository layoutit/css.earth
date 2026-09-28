/** A new star's limb darkening: the quadratic law a model-atmosphere grid gives at the star's own temperature and gravity, read by
 * the colour lens's own interpolator so a grid counts only if its four surrounding nodes exist.
 *
 * 1. Claret & Bloemen (2011), ATLAS models, Johnson V (VizieR J/A+A/529/A75, table-af): the visible band the colour is drawn in.
 * 2. Reeve & Howarth (2016), non-LTE TLUSTY models, Bessell V (J/MNRAS/456/1294, summary1): hot stars (27,500-55,000 K) down to
 *    the Eddington limit in gravity, where ATLAS stops (a blue supergiant such as HD 226868 at log g 3.35). The OStar02 grid at solar
 *    abundance (code G, microturbulence 10 km/s); its "quad - 2" fit, least squares with the disc-centre intensity fixed, the method of
 *    Claret's quadratic coefficients above. The table names each model by a file name (OG31000g335v10: temperature, 100 x log g),
 *    which the request rewrites into Teff and logg columns.
 * 3. Claret (2017), PHOENIX models, TESS band (J/A+A/600/A30, tableab, Mod PC): cool stars and brown dwarfs the ATLAS grid does
 *    not reach.
 *
 * Outside both grids, or where a node is missing, no law is drawn and the reason is recorded; the value is never extrapolated.
 * A spec may decline a law with its own reason. */
import { interpolateQuadraticLimbDarkening, type QuadraticLimbDarkening } from '@cssearth/bake/objects/stellar';
import { VIZIER_ASU, type Archive } from './archives.mts';

interface Grid {
  readonly key: 'atlas' | 'tlusty' | 'phoenix'; readonly inputId: string; readonly file: string; readonly source: string; readonly cite: string; readonly models: string; readonly band: string;
  readonly vizier: string; readonly modelColumns: Readonly<Record<string, string>>; readonly columns: { readonly teff: string; readonly logg: string; readonly u1: string; readonly u2: string };
  readonly form: (teff: string, logg: string) => Record<string, string>;
  /** Rewrites of the returned table into the columns above, applied after the comment lines are dropped (and on restore). */
  readonly rewrite?: readonly { readonly pattern: string; readonly flags: string; readonly replacement: string }[];
}
export const GRIDS: readonly Grid[] = [
  { key: 'atlas', inputId: 'claret-2011-limb-darkening', file: 'photometry/claret-2011-v-quadratic.tsv', source: 'J/A+A/529/A75/table-af', cite: 'Claret & Bloemen (2011), A&A 529, A75', models: 'ATLAS', band: 'Johnson V', vizier: 'J/A+A/529/A75',
    modelColumns: { Filt: 'V', Met: 'L', Mod: 'A' }, columns: { teff: 'Teff', logg: 'logg', u1: 'a', u2: 'b' },
    form: (teff, logg) => ({ '-source': 'J/A+A/529/A75/table-af', '-out.max': '500', Teff: teff, logg, Z: '=0', xi: '=2', Filt: 'V', Met: 'L', Mod: 'A', '-out': 'logg,Teff,Z,xi,a,b,Filt,Met,Mod' }) },
  { key: 'tlusty', inputId: 'reeve-2016-limb-darkening', file: 'photometry/reeve-2016-v-quadratic.tsv', source: 'J/MNRAS/456/1294/summary1', cite: 'Reeve & Howarth (2016), MNRAS 456, 1294',
    models: 'non-LTE TLUSTY', band: 'Bessell V', vizier: 'J/MNRAS/456/1294', modelColumns: {}, columns: { teff: 'Teff', logg: 'logg', u1: 'a', u2: 'b' },
    // The grid has no temperature or gravity column to select by: the whole solar V-band O-star grid is 69 rows.
    form: () => ({ '-source': 'J/MNRAS/456/1294/summary1', '-out.max': '500', FileName: 'OG*', Filter: 'Bessell-V', '-out': 'FileName,quad2.2,quad2.3' }),
    // The header gains the units line VizieR leaves blank here: the grid reader skips the line after the header as units.
    rewrite: [{ pattern: String.raw`^FileName\tquad2\.2\tquad2\.3`, flags: 'm', replacement: 'logg\tTeff\ta\tb\n[cgs]\tK\t\t' },
      { pattern: String.raw`^O[A-Z](\d{5})g(\d)(\d{2})v\d+\t`, flags: 'gm', replacement: '$2.$3\t$1\t' }] },
  { key: 'phoenix', inputId: 'claret-2017-limb-darkening', file: 'photometry/claret-2017-tess-quadratic.tsv', source: 'J/A+A/600/A30/tableab', cite: 'Claret (2017), A&A 600, A30', models: 'PHOENIX', band: 'TESS', vizier: 'J/A+A/600/A30',
    modelColumns: { Type: 'q', Mod: 'PC' }, columns: { teff: 'Teff', logg: 'logg', u1: 'aLSM', u2: 'bLSM' },
    form: (teff, logg) => ({ '-source': 'J/A+A/600/A30/tableab', '-out.max': '500', Teff: teff, logg, Z: '=0', Type: 'q', Mod: 'PC', '-out': 'logg,Teff,Z,L/HP,aLSM,bLSM,Type,Mod' }) },
];
const strip = (text: string) => text.replace(/^#.*\n/gmu, '').replace(/^\s*\n/gmu, '');
const rewritten = (grid: Grid, text: string) => (grid.rewrite ?? []).reduce((out, { pattern, flags, replacement }) => out.replace(new RegExp(pattern, `${flags}u`), replacement), strip(text));
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
  const wides = await Promise.all(GRIDS.map(grid => archive.text(VIZIER_ASU, grid.form(`${Math.floor(teffK - 1000)}..${Math.ceil(teffK + 1000)}`, `${(logg - 1).toFixed(2)}..${(logg + 1).toFixed(2)}`)).then(text => rewritten(grid, text))));
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
    const form = grid.form(`${t0}..${t1}`, `${g0}..${g1}`), text = rewritten(grid, await archive.text(VIZIER_ASU, form));
    const coefficients = interpolateQuadraticLimbDarkening(text, recipe);
    const law = `the quadratic law ${grid.cite} compute${grid.key === 'phoenix' ? 's' : ''} from ${grid.models} model atmospheres for the ${grid.band} band at ${teffK.toLocaleString('en-US')} K and log g ${logg}`;
    return {
      limbDarkening: { law: 'quadratic', path: grid.file, grid: { teffK, logg, models: grid.modelColumns }, columns: grid.columns }, file: { path: grid.file, text }, coefficients, grid: grid.key,
      acquisition: { kind: 'request-download', groups: ['restore', 'refresh'], path: grid.file, url: VIZIER_ASU, form, requiredText: ['logg\tTeff'], replacements: [...REPLACEMENTS, ...grid.rewrite ?? []] },
      input: { id: `${id}-${grid.inputId}`, path: grid.file, origin: VIZIER_ASU, credit: `${grid.cite} (VizieR ${grid.vizier})`,
        license: 'VizieR catalogue data, public with citation of the paper and CDS', licenseEvidence: ['https://cds.unistra.fr/vizier-org/licences_vizier.html'],
        acquisition: `VizieR request in source/preparation/acquisition.json: the quadratic ${grid.band} coefficients of ${grid.rewrite ? `the whole grid (the nodes used are ${t0}..${t1} K, log g ${g0}..${g1}), its model names rewritten into Teff and logg columns` : `the grid nodes at ${t0}..${t1} K, log g ${g0}..${g1}`}, solar metallicity.`,
        redistribution: grid.rewrite ? 'Catalogue rows retained with their citation, each model name rewritten into its Teff and logg.' : 'Catalogue rows retained unchanged with their citation.', consumers: ['assets', 'lenses'] },
      sentence: `dimmed toward the limb by ${law} (u1 ${coefficients.u1.toFixed(3)}, u2 ${coefficients.u2.toFixed(3)}): a model, because no fit of this star's limb is used`,
      credit: `Limb darkening: ${grid.cite}, via VizieR ${grid.vizier}.`,
    };
  }
  return { sentence: `No limb darkening is drawn: at ${teffK.toLocaleString('en-US')} K and log g ${logg} no model grid used here reaches it (${reasons.join('; ')})` };
}
