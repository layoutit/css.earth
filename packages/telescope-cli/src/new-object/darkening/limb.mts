/** A star's limb darkening: the law a model-atmosphere grid gives at the star's own temperature, gravity and (for spherical models)
 * mass, read by the color dataset's own interpolator (@cssearth/bake/objects/stellar, limb-laws.ts). The grids are tried in this order,
 * the first that holds a complete set of nodes around the star winning; every existing star keeps the grid it was read from.
 *
 * 1. Claret & Bloemen (2011), ATLAS models, Johnson V (VizieR J/A+A/529/A75, table-af): the visible band the color is drawn in.
 * 2. Reeve & Howarth (2016), non-LTE TLUSTY models, Bessell V (J/MNRAS/456/1294, summary1): hot stars (27,500-55,000 K) down to
 *    the Eddington limit in gravity, where ATLAS stops. The OStar02 grid at solar abundance (code G, microturbulence 10 km/s); its
 *    "quad - 2" fit, least squares with the disc-centre intensity fixed. The table names each model by a file name
 *    (OG31000g335v10: temperature, 100 x log g), which the request rewrites into Teff and logg columns.
 * 3. Neilson & Lester (2013), spherical ATLAS (SATLAS) models, Johnson V (J/A+A/554/A98, table3): cool giants and supergiants down to
 *    log g -1, by mass as well; the law of an extended atmosphere may reach zero before the edge, where it is held dark.
 * 4. Howarth (2011), ATLAS9 models to the Eddington limit, Bessell V (J/MNRAS/413/1515, grid A10/P00v02r): one coefficient file per
 *    model, for hot giants below the gravities of the Claret table (Rigel's log g 1.8 at 12,100 K). Energy-integrating (ucE) laws.
 * 5. Claret (2017), PHOENIX models, TESS band (J/A+A/600/A30, tableab, Mod PC): cool stars and brown dwarfs down to 1,500 K.
 * 6. PICASO on the cloud-free Sonora Bobcat atmospheres, Bessell V (picaso-limb.mts): brown dwarfs colder than every table, computed
 *    with the pinned toolchain at the model nodes around the dwarf.
 *
 * A white dwarf is read from none of these: its gravity is beyond them all, and its law depends on what its atmosphere is made of.
 * When the spec cites its atmosphere class, the law is read from Claret et al. (2020), white-dwarf model atmospheres, Johnson V
 * (J/A+A/634/A93, tableab): pure hydrogen (DA, 3,750-60,000 K), pure helium (DB, 10,000-40,000 K) or helium with a trace of hydrogen
 * (DBA), log g 5 to 9.5. A white dwarf with no cited class, or one the grid of its class does not reach (a helium atmosphere under
 * 10,000 K), gets no law.
 *
 * Where a node beside the star is missing, the law is read between the nearest nodes that all exist. Outside every grid no law is
 * drawn and the reason is recorded; nothing is extrapolated. A spec may decline a law with its own reason. */
import { interpolateGrid, readHowarthNode, readLimbGrid, type GridNode, type QuadraticLimbDarkening } from '@cssearth/bake/objects/stellar';
import { VIZIER_ASU, type Archive } from '../archives/archives.mts';
import { fromPicaso, PICASO } from './picaso-limb.mts';
import type { LimbChoice, LimbGridKey, WhiteDwarfAtmosphere } from './limb-choice.mts';

interface Grid {
  readonly key: LimbGridKey; readonly inputId: string; readonly file: string; readonly source: string; readonly cite: string; readonly models: string; readonly band: string;
  readonly vizier: string; readonly modelColumns: Readonly<Record<string, string>>;
  readonly columns: { readonly teff: string; readonly logg: string; readonly u1: string; readonly u2: string; readonly mass?: string };
  readonly form: (teff: string, logg: string, mass?: string) => Record<string, string>;
  /** Rewrites of the returned table into the columns above, applied after the comment lines are dropped (and on restore). */
  readonly rewrite?: readonly { readonly pattern: string; readonly flags: string; readonly replacement: string }[];
  /** How far around the star the first request looks for nodes, for a grid coarser than 1,000 K. */
  readonly window?: { readonly teff: number; readonly logg: number };
}
/** The atmospheres Claret et al. (2020) tabulate for white dwarfs. */
const ATMOSPHERE_WORDS: Readonly<Record<WhiteDwarfAtmosphere, string>> = { DA: 'pure-hydrogen (DA) white-dwarf', DB: 'pure-helium (DB) white-dwarf', DBA: 'helium with trace hydrogen (DBA) white-dwarf' };
/** Claret et al. (2020) for one atmosphere class: 5,000 K apart above 20,000 K, so the first request looks 6,000 K either side. */
export const whiteDwarfGrid = (atmosphere: WhiteDwarfAtmosphere): Grid => ({ key: 'white-dwarf', inputId: 'claret-2020-limb-darkening', file: 'photometry/claret-2020-v-quadratic.tsv', source: 'J/A+A/634/A93/tableab',
  cite: 'Claret et al. (2020), A&A 634, A93', models: ATMOSPHERE_WORDS[atmosphere], band: 'Johnson V', vizier: 'J/A+A/634/A93', modelColumns: { Mod: atmosphere, Filter: 'V' }, columns: { teff: 'Teff', logg: 'logg', u1: 'a', u2: 'b' },
  window: { teff: 6000, logg: 0.5 },
  form: (teff, logg) => ({ '-source': 'J/A+A/634/A93/tableab', '-out.max': '500', Teff: teff, logg, Mod: `=${atmosphere}`, Filter: '=V', '-out': 'logg,Teff,Z,a,b,Mod,Filter' }) });
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
  { key: 'neilson', inputId: 'neilson-2013-limb-darkening', file: 'photometry/neilson-2013-v-quadratic.tsv', source: 'J/A+A/554/A98/table3', cite: 'Neilson & Lester (2013), A&A 554, A98', models: 'spherical ATLAS (SATLAS)', band: 'Johnson V', vizier: 'J/A+A/554/A98',
    modelColumns: {}, columns: { teff: 'Teff', logg: 'logg', u1: 'a(V)', u2: 'b(V)', mass: 'M' },
    form: (teff, logg, mass) => ({ '-source': 'J/A+A/554/A98/table3', '-out.max': '5000', Teff: teff, logg, ...(mass ? { M: mass } : {}), '-out': 'Teff,logg,M,a(V),b(V)' }) },
  // The same paper's B-star grid (TLUSTY BStar06, 15,000 to 30,000 K): at 18,000 K it reaches log g 2.00, where ATLAS stops at 2.5,
  // so a B supergiant or hypergiant has a law. Its solar composition at 2 km/s is the one set that spans every gravity (163 models).
  // After the grids every earlier star was read from, so none of them changes.
  { key: 'tlusty-b', inputId: 'reeve-2016-b-limb-darkening', file: 'photometry/reeve-2016-b-v-quadratic.tsv', source: 'J/MNRAS/456/1294/summary1', cite: 'Reeve & Howarth (2016), MNRAS 456, 1294',
    models: 'non-LTE TLUSTY B-star', band: 'Bessell V', vizier: 'J/MNRAS/456/1294', modelColumns: {}, columns: { teff: 'Teff', logg: 'logg', u1: 'a', u2: 'b' },
    form: () => ({ '-source': 'J/MNRAS/456/1294/summary1', '-out.max': '500', FileName: 'BG*v02', Filter: 'Bessell-V', '-out': 'FileName,quad2.2,quad2.3' }),
    rewrite: [{ pattern: String.raw`^FileName\tquad2\.2\tquad2\.3`, flags: 'm', replacement: 'logg\tTeff\ta\tb\n[cgs]\tK\t\t' },
      { pattern: String.raw`^B[A-Z](\d{5})g(\d)(\d{2})v\d+\t`, flags: 'gm', replacement: '$2.$3\t$1\t' }] },
  { key: 'phoenix', inputId: 'claret-2017-limb-darkening', file: 'photometry/claret-2017-tess-quadratic.tsv', source: 'J/A+A/600/A30/tableab', cite: 'Claret (2017), A&A 600, A30', models: 'PHOENIX', band: 'TESS', vizier: 'J/A+A/600/A30',
    modelColumns: { Type: 'q', Mod: 'PC' }, columns: { teff: 'Teff', logg: 'logg', u1: 'aLSM', u2: 'bLSM' },
    form: (teff, logg) => ({ '-source': 'J/A+A/600/A30/tableab', '-out.max': '500', Teff: teff, logg, Z: '=0', Type: 'q', Mod: 'PC', '-out': 'logg,Teff,Z,L/HP,aLSM,bLSM,Type,Mod' }) },
];
/** Howarth (2011): its model list, and the directory of the solar-abundance, 2 km/s grid whose coefficient files are read. */
export const HOWARTH = { cite: 'Howarth (2011), MNRAS 413, 1515', vizier: 'J/MNRAS/413/1515', grid: 'A10/P00v02r', passband: 'Bessell-V',
  files: 'https://cdsarc.cds.unistra.fr/ftp/J/MNRAS/413/1515', directory: 'photometry/howarth-2011' } as const;
const strip = (text: string) => text.replace(/^#.*\n/gmu, '').replace(/^\s*\n/gmu, '');
const rewritten = (grid: Grid, text: string) => (grid.rewrite ?? []).reduce((out, { pattern, flags, replacement }) => out.replace(new RegExp(pattern, `${flags}u`), replacement), strip(text));
const REPLACEMENTS = [{ pattern: '^#.*\\n', flags: 'gm', replacement: '' }, { pattern: '^\\s*\\n', flags: 'gm', replacement: '' }];
const LICENSE = { license: 'VizieR catalogue data, public with citation of the paper and CDS', licenseEvidence: ['https://cds.unistra.fr/vizier-org/licences_vizier.html'] };


// The node range a request names, written as the grid writes its values (the form every existing package restores with).
const range = (values: readonly number[]) => `${Math.min(...values)}..${Math.max(...values)}`;
/** Where a spherical model's law reaches zero, as a fraction of the radius: the disc is drawn dark outside it. */
function edgeNote(law: { u1: number; u2: number }) {
  if (1 - law.u1 - law.u2 >= 0) return '';
  let mu = 0;
  while (mu < 1 && 1 - law.u1 * (1 - mu) - law.u2 * (1 - mu) ** 2 < 0) mu += 1e-4;
  return `; the model atmosphere is extended, and the law reaches zero at ${(Math.sqrt(1 - mu * mu) * 100).toFixed(1)}% of the radius, where the disc is drawn dark`;
}

/** A TSV grid: a wide window first to find the corner nodes the reader uses, then a request for exactly those, as the plan restores them. */
async function fromGrid(id: string, grid: Grid, teffK: number, logg: number, massSolar: number | undefined, archive: Archive) {
  if (grid.columns.mass && massSolar === undefined) throw new RangeError('the grid is of spherical models, read by mass, and the star has no measured mass');
  const recipe = { law: 'quadratic' as const, source: 'grid' as const, path: grid.file, teffK, logg, ...(grid.columns.mass ? { massSolar } : {}), models: grid.modelColumns, columns: grid.columns };
  const reach = grid.window ?? { teff: 1000, logg: 1 };
  const wide = rewritten(grid, await archive.text(VIZIER_ASU, grid.form(`${Math.floor(teffK - reach.teff)}..${Math.ceil(teffK + reach.teff)}`, `${(logg - reach.logg).toFixed(2)}..${(logg + reach.logg).toFixed(2)}`, grid.columns.mass ? '0..100' : undefined)));
  const { corners } = readLimbGrid(wide, recipe);
  const teffs = corners.map(c => c.teff), loggs = corners.map(c => c.logg), masses = corners.flatMap(c => c.mass === undefined ? [] : [c.mass]);
  const form = grid.form(range(teffs), range(loggs), masses.length ? range(masses) : undefined), text = rewritten(grid, await archive.text(VIZIER_ASU, form));
  const coefficients = readLimbGrid(text, recipe);
  const law = `the quadratic law ${grid.cite} compute${grid.key === 'phoenix' ? 's' : ''} from ${grid.models} model atmospheres for the ${grid.band} band at ${Math.round(teffK).toLocaleString('en-US')} K and log g ${logg}${massSolar !== undefined && grid.columns.mass ? ` for ${massSolar} solar masses` : ''}`;
  return {
    limbDarkening: { law: 'quadratic', path: grid.file, grid: { teffK, logg, ...(grid.columns.mass ? { massSolar } : {}), models: grid.modelColumns }, columns: grid.columns },
    files: [{ path: grid.file, text }], grid: grid.key, coefficients: { u1: coefficients.u1, u2: coefficients.u2, u1Bounds: coefficients.u1Bounds, u2Bounds: coefficients.u2Bounds },
    acquisitions: [{ kind: 'request-download', groups: ['restore', 'refresh'], path: grid.file, url: VIZIER_ASU, form, requiredText: [grid.columns.mass ? 'Teff\tlogg' : 'logg\tTeff'], replacements: [...REPLACEMENTS, ...grid.rewrite ?? []] }],
    inputs: [{ id: `${id}-${grid.inputId}`, path: grid.file, origin: VIZIER_ASU, credit: `${grid.cite} (VizieR ${grid.vizier})`, ...LICENSE,
      acquisition: `VizieR request in source/preparation/acquisition.json: the quadratic ${grid.band} coefficients of ${grid.rewrite ? `the whole grid (the nodes used are ${range(teffs)} K, log g ${range(loggs)}), its model names rewritten into Teff and logg columns` : `the grid nodes at ${range(teffs)} K, log g ${range(loggs)}${masses.length ? `, ${range(masses)} solar masses` : ''}`}, solar metallicity.`,
      redistribution: grid.rewrite ? 'Catalogue rows retained with their citation, each model name rewritten into its Teff and logg.' : 'Catalogue rows retained unchanged with their citation.', consumers: ['assets', 'datasets'] }],
    sentence: `dimmed toward the limb by ${law} (u1 ${coefficients.u1.toFixed(3)}, u2 ${coefficients.u2.toFixed(3)})${edgeNote(coefficients)}: a model, because no fit of this star's limb is used`,
    credit: `Limb darkening: ${grid.cite}, via VizieR ${grid.vizier}.`,
  } satisfies LimbChoice;
}

/** Howarth (2011): the models around the star from the catalogue's list, then the coefficient file of each corner model. */
async function fromHowarth(id: string, teffK: number, logg: number, archive: Archive) {
  const list = strip(await archive.text(VIZIER_ASU, { '-source': 'J/MNRAS/413/1515/models', '-out.max': '2000', Teff: `${Math.floor(teffK - 2000)}..${Math.ceil(teffK + 2000)}`, logg: `${(logg - 1).toFixed(1)}..${(logg + 1).toFixed(1)}`, '-out': 'File,Teff,logg' }));
  const models = list.split('\n').map(line => line.split('\t').map(cell => cell.trim())).filter(([file]) => file?.startsWith(`${HOWARTH.grid}/`))
    .map(([file, teff, g]) => ({ file: file!, teff: Number(teff), logg: Number(g), u1: 0, u2: 0 }));
  const { corners } = interpolateGrid(models, { teff: teffK, logg });
  const chosen = corners.map(corner => models.find(model => model.teff === corner.teff && model.logg === corner.logg)!);
  const files = await Promise.all(chosen.map(async model => {
    const name = model.file.split('/').at(-1)!, url = `${HOWARTH.files}/${model.file}.ucE`;
    return { path: `${HOWARTH.directory}/${name}.ucE`, text: await archive.text(url), url };
  }));
  const nodes: GridNode[] = files.map(file => readHowarthNode(file.path, file.text, HOWARTH.passband));
  const coefficients = interpolateGrid(nodes, { teff: teffK, logg });
  return {
    limbDarkening: { law: 'quadratic', howarth: { paths: files.map(file => file.path), teffK, logg, passband: HOWARTH.passband } },
    files: files.map(({ path, text }) => ({ path, text })), grid: 'howarth' as const, coefficients: { u1: coefficients.u1, u2: coefficients.u2, u1Bounds: coefficients.u1Bounds, u2Bounds: coefficients.u2Bounds },
    acquisitions: files.map(file => ({ kind: 'download', groups: ['restore', 'refresh'], path: file.path, url: file.url })),
    inputs: files.map(file => ({ id: `${id}-howarth-2011-${file.path.split('/').at(-1)!.replace(/\.ucE$/u, '')}`, path: file.path, origin: file.url, credit: `${HOWARTH.cite} (VizieR ${HOWARTH.vizier})`, ...LICENSE,
      acquisition: `Download of the ${HOWARTH.grid} model's energy-integrating (ucE) coefficient file from the CDS archive, retained unchanged.`,
      redistribution: 'Catalogue file retained unchanged with its citation.', consumers: ['assets', 'datasets'] })),
    sentence: `dimmed toward the limb by the quadratic law ${HOWARTH.cite} computes from ATLAS9 model atmospheres for the Bessell V band at ${Math.round(teffK).toLocaleString('en-US')} K and log g ${logg}, read between the models ${chosen.map(model => model.file.split('/').at(-1)).join(', ')} (u1 ${coefficients.u1.toFixed(3)}, u2 ${coefficients.u2.toFixed(3)}): a model, because no fit of this star's limb is used`,
    credit: `Limb darkening: ${HOWARTH.cite}, CDS J/MNRAS/413/1515.`,
  } satisfies LimbChoice;
}

/** The law of the first grid that holds the star, or the reasons none does. `massSolar` reads spherical grids; `whiteDwarf` is the
 * cited atmosphere class of a white dwarf, whose law is read from its own grid and no other. */
export async function chooseLimb(id: string, teffK: number, logg: number, archive: Archive, decline?: string, massSolar?: number, whiteDwarf?: WhiteDwarfAtmosphere): Promise<LimbChoice> {
  if (decline) return { sentence: `No limb darkening is drawn: ${decline}` };
  if (whiteDwarf) {
    const grid = whiteDwarfGrid(whiteDwarf);
    try { return await fromGrid(id, grid, teffK, logg, undefined, archive); }
    catch (error) { return { sentence: `No limb darkening is drawn: at ${Math.round(teffK).toLocaleString('en-US')} K and log g ${logg} the ${grid.models} grid of ${grid.cite} does not reach it (${(error as Error).message})` }; }
  }
  const reasons: string[] = [];
  for (const grid of [...GRIDS.slice(0, 3), 'howarth' as const, GRIDS[3]!, GRIDS[4]!, 'picaso' as const]) {
    try { return grid === 'howarth' ? await fromHowarth(id, teffK, logg, archive) : grid === 'picaso' ? fromPicaso(id, teffK, logg) : await fromGrid(id, grid, teffK, logg, massSolar, archive); }
    catch (error) { reasons.push(`${grid === 'howarth' ? HOWARTH.cite : grid === 'picaso' ? `${PICASO.cite} (${PICASO.models})` : `${grid.cite} (${grid.models})`}: ${(error as Error).message}`); }
  }
  return { sentence: `No limb darkening is drawn: at ${Math.round(teffK).toLocaleString('en-US')} K and log g ${logg}${massSolar === undefined ? '' : ` for ${massSolar} solar masses`} no model grid used here reaches it (${reasons.join('; ')})` };
}
