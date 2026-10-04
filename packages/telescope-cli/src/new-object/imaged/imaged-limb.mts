/** Limb darkening for a directly imaged planet. Its disc is unresolved, so its dataset is one measured infrared color; without
 * a limb law that color fills a flat disc. A star takes its law from a model-atmosphere grid at its own temperature and gravity
 * (limb.mts), and so does the planet, from the grid computed for objects this cool in the bands its color is drawn from:
 * Claret, Hauschildt & Witte (2012, A&A 546, A14), quadratic laws of PHOENIX model atmospheres from 1,500 to 4,800 K and
 * log g 2.5 to 5.5. The H law is taken, the middle band of a J, H, K color. It is a model's darkening, not a measurement, and
 * the texts say so.
 *
 *   new-object --imaged-limb <id>...
 *
 * The temperature is the planet's own, from its measurements record; the gravity follows from the mass and radius of its
 * astronomy record. The CDS serves the table as one fixed-width file; the nodes around the planet are kept beside it as
 * tab-separated text, which the bake's grid reader interpolates (packages/bake/src/objects/stellar, readLimbGrid).
 *
 * A planet the table does not reach (cooler than 1,500 K, or colored in other bands) has no published law. Planets this cool
 * are cloudy, and a cloud-free model's law is not theirs: in the H band near 1,000 K it darkens the limb to black. So the law is
 * computed (picaso-limb.mts) from the cloudy Sonora Diamondback model a paper fitted to the planet, which the package records
 * with its citation in source/photometry/atmosphere-fit.json, in the middle band of the planet's color, at the fit's own
 * temperature and gravity. A fit of the cloud-free Sonora Elf Owl grid or of Exo-REM's public cloudy grid is read the same way.
 * A planet with no such record gets no law. That route needs the PICASO toolchain.
 *
 * The run also brings the package's documents in line with its color: the README's dataset paragraph, the credits and the
 * ledger of a planet that was a gray sphere before its color still said so.
 *
 * A self-luminous planet with no color is a gray disc, and flat too. Where a paper's fit is recorded with the band the planet is
 * seen in (`band` in the fit record), the same law darkens the gray; its shape paragraph and credit stay as they are. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { readLimbGrid } from '@cssearth/bake/objects/stellar';
import { WORKSPACE } from '@cssearth/telescope/node';
import { authorContextMarkers, MARKER_PATH } from '../../source-authoring/context-markers.mts';
import type { Archive } from '../archives/archives.mts';
import { bindInputs, json, type PackageFiles } from '../dataset.mts';
import { diamondback, DIAMONDBACK, ELF_OWL, elfOwl, EXO_REM, exoRem, fromPicaso, PICASO } from '../picaso-limb.mts';

export const CLARET_2012 = { table: 'https://cdsarc.cds.unistra.fr/ftp/J/A+A/546/A14/tableab.dat', cite: 'Claret, Hauschildt & Witte (2012), A&A 546, A14', catalogue: 'J/A+A/546/A14',
  band: 'H', file: 'photometry/claret-2012-h-quadratic.tsv', input: 'claret-2012-limb-darkening' } as const;
/** The table's Johnson J, H and K laws: the band that holds the middle band of a planet's color (SPHERE's K1 and K2 are parts of
 * K, its H2 and H3 of H), or undefined for a color in other bands. */
export type ClaretBand = 'J' | 'H' | 'K';
export const claretBand = (middleBand: string): ClaretBand | undefined => /(?:^|\s)H[23]?$/u.test(middleBand) ? 'H' : /(?:^|\s)K[12s]?$/u.test(middleBand) ? 'K' : /(?:^|\s)J$/u.test(middleBand) ? 'J' : undefined;
const claretFile = (band: ClaretBand) => `photometry/claret-2012-${band.toLowerCase()}-quadratic.tsv`;
const models = (band: ClaretBand) => ({ Filt: band, Met: 'L', Mod: 'qs' }), COLUMNS = { teff: 'Teff', logg: 'logg', u1: 'a', u2: 'b' };
const HEADER = ['logg\tTeff\tZ\txi\ta\tb\tFilt\tMet\tMod', '[cm/s2]\tK\t[Sun]\tkm/s\t \t \t \t \t ', '-----\t------\t----\t----\t--------\t--------\t--\t-\t--'];
// The table's fixed columns (its ReadMe, "Byte-by-byte Description of file: tableab.dat"), as zero-based slices.
const FIELDS = [[0, 5], [6, 12], [13, 17], [18, 22], [23, 31], [32, 40], [41, 43], [44, 45], [46, 48]] as const;
const PACKAGE_FILES = ['README.md', 'NOTICE.md', 'investigations.json', 'source/preparation/raster.json', 'source/content/object.json', 'source/manifest.json'] as const;

/** The table's least-squares rows of one band as the tab-separated text the grid reader takes, each cell as printed. */
export function claret2012Grid(table: string, band: ClaretBand = CLARET_2012.band) {
  const MODELS = models(band);
  const rows = table.split(/\r?\n/u).map(line => FIELDS.map(([from, to]) => line.slice(from, to).trim())).filter(cells => cells[6] === MODELS.Filt && cells[7] === MODELS.Met && cells[8] === MODELS.Mod);
  if (!rows.length) throw new TypeError(`${CLARET_2012.catalogue} tableab.dat holds no ${band}-band rows: its layout has changed (${CLARET_2012.table}).`);
  return [...HEADER, ...rows.map(cells => cells.join('\t'))].join('\n') + '\n';
}

/** A law with the file of nodes it is read from, the manifest entry of that file, and what the documents say of it. */
export interface ImagedLimb { readonly limbDarkening: Record<string, unknown>; readonly file: string; readonly text: string; readonly u1: number; readonly u2: number; readonly sentence: string;
  readonly input: Record<string, unknown>; readonly credit: string; readonly evidence: readonly string[]; readonly problem: string;
  /** The record of the published fit a computed law is read at, as a manifest entry. */
  readonly fit?: Record<string, unknown> }

/** A paper's fit of a public grid of cloudy model atmospheres to the planet: the model a computed law is read from. */
export const ATMOSPHERE_FIT = { schema: 'cssearth-atmosphere-grid-fit@1', path: 'photometry/atmosphere-fit.json', grids: ['sonora-diamondback', 'sonora-elf-owl', 'exo-rem'] } as const;
/** A Diamondback fit states its sedimentation efficiency; an Elf Owl fit its C/O (times solar) and log Kzz; an Exo-REM fit its
 * C/O as the number ratio. The metallicity is [M/H]. `note` is what a reader must know of the fit beyond its values: which of a
 * paper's fits it is and why, or what the fit adds to the model that the law leaves out. */
export interface AtmosphereFit { readonly grid: typeof ATMOSPHERE_FIT.grids[number]; readonly teffK: number; readonly logg: number; readonly metallicity: number; readonly fsed?: number; readonly co?: number; readonly logKzz?: number; readonly note?: string;
  /** For a planet with no color: the band it is seen in, which the law is computed in. */
  readonly band?: string;
  readonly source: { readonly citation: string; readonly url: string; readonly locator: string } }
export function parseAtmosphereFit(value: unknown, where: string): AtmosphereFit {
  const record = requireRecord(value, where), source = requireRecord(record.source, `${where} source`);
  if (record.schema !== ATMOSPHERE_FIT.schema) throw new TypeError(`${where}: schema is ${String(record.schema)}, not ${ATMOSPHERE_FIT.schema}.`);
  const grid = ATMOSPHERE_FIT.grids.find(name => name === record.grid);
  if (!grid) throw new TypeError(`${where}: grid is ${String(record.grid)}; a law is computed from ${ATMOSPHERE_FIT.grids.join(' or ')} models only.`);
  return { grid, teffK: requireFiniteNumber(record.teffK, `${where} teffK`), logg: requireFiniteNumber(record.logg, `${where} logg`), metallicity: requireFiniteNumber(record.metallicity, `${where} metallicity`),
    ...(grid === 'sonora-diamondback' ? { fsed: requireFiniteNumber(record.fsed, `${where} fsed`) } : { co: requireFiniteNumber(record.co, `${where} co`), ...(grid === 'exo-rem' ? {} : { logKzz: requireFiniteNumber(record.logKzz, `${where} logKzz`) }) }),
    ...(record.note === undefined ? {} : { note: requireString(record.note, `${where} note`) }), ...(record.band === undefined ? {} : { band: requireString(record.band, `${where} band`) }),
    source: { citation: requireString(source.citation, `${where} source.citation`), url: requireString(source.url, `${where} source.url`), locator: requireString(source.locator, `${where} source.locator`) } };
}

/** The filters PICASO computes a law in, by the name a color record gives its middle band. */
const PICASO_BANDS: Readonly<Record<string, { readonly name: string; readonly svo: string; readonly slug: string }>> = {
  'MKO H': { name: 'MKO H', svo: 'MKO/NSFCam.H', slug: 'h' }, '2MASS H': { name: '2MASS H', svo: '2MASS/2MASS.H', slug: 'h' },
  'SPHERE K1': { name: 'SPHERE K1', svo: 'Paranal/SPHERE.IRDIS_D_K12_1', slug: 'k1' }, 'GPI K1': { name: 'GPI K1', svo: 'Gemini/GPI.K1', slug: 'k1' },
  F410M: { name: 'JWST/NIRCam F410M', svo: 'JWST/NIRCam.F410M', slug: 'f410m' }, F430M: { name: 'JWST/NIRCam F430M', svo: 'JWST/NIRCam.F430M', slug: 'f430m' }, F1065C: { name: 'JWST/MIRI F1065C', svo: 'JWST/MIRI.F1065C', slug: 'f1065c' } };
const LIMB_INPUTS = /-(?:claret-2012-limb-darkening|picaso-(?:diamondback|elf-owl|exo-rem)-limb-darkening|atmosphere-fit)$/u;

/** The law PICASO computes from the cloudy model a paper fitted to the planet, in the middle band of its color (the toolchain
 * runs here). */
export function fittedImagedLimb(id: string, fit: AtmosphereFit, middleBand: string): { limb?: ImagedLimb; why?: string } {
  const filter = PICASO_BANDS[middleBand];
  if (!filter) return { why: `no law is computed in ${middleBand}, the ${fit.band === middleBand ? 'band it is seen in' : 'middle band of its color'}` };
  const cloudy = fit.grid !== 'sonora-elf-owl', band = { name: filter.name, svo: filter.svo, file: `photometry/picaso-${fit.grid.replace(/^sonora-/u, '')}-${filter.slug}-quadratic.tsv` };
  const choice = fromPicaso(id, fit.teffK, fit.logg, band, { flag: '--imaged-limb', because: `the one ${fit.source.citation} fit to this planet, because no table reaches a planet this cold and nobody has resolved its disc` },
    fit.grid === 'sonora-diamondback' ? diamondback(fit.metallicity, fit.fsed!) : fit.grid === 'exo-rem' ? exoRem(fit.metallicity, fit.co!) : elfOwl(fit.metallicity, fit.co!, fit.logKzz!));
  const file = choice.files![0]!, { u1, u2 } = choice.coefficients!;
  // How far the models the law is read between differ: each one's intensity at the lowest of the angles computed.
  const edges = [...file.text.matchAll(/; I\/I0 [\d. -]*?(-?[\d.]+); rms/gu)].map(match => Math.round(Number(match[1]) * 100));
  // Where the release states each model's spectrum: how much of its band flux PICASO finds.
  const ratios = [...file.text.matchAll(/band flux ([\d.]+) of the release's own spectrum/gu)].map(match => Math.round(Number(match[1]) * 100));
  const reproduced = ratios.length ? ` PICASO finds ${Math.min(...ratios) === Math.max(...ratios) ? `${ratios[0]}%` : `${Math.min(...ratios)}% to ${Math.max(...ratios)}%`} of the band flux the release states for those models.` : '';
  return { limb: { limbDarkening: choice.limbDarkening as Record<string, unknown>, file: file.path, text: file.text, u1, u2, sentence: choice.sentence, input: choice.inputs![0]!,
    fit: { id: `${id}-atmosphere-fit`, path: ATMOSPHERE_FIT.path, origin: fit.source.url, credit: `${fit.source.citation}, ${fit.source.locator}`, license: 'Factual numerical values; source attribution retained',
      acquisition: 'Transcribed from the paper: the model of the public grid it fits to the planet, each value as printed', redistribution: 'Factual parameter transcription only; no paper figures', consumers: ['datasets'],
      sourceBinding: { kind: 'local', reason: 'Published fit transcribed with its source; repinned when edited.' } },
    credit: `${choice.credit} Model fit: ${fit.source.citation}.`, evidence: fit.grid === 'sonora-diamondback' ? [DIAMONDBACK.release, PICASO.opacities, fit.source.url] : fit.grid === 'exo-rem' ? [EXO_REM.release, EXO_REM.code, ELF_OWL.opacities, fit.source.url] : [ELF_OWL.release, ELF_OWL.opacities, fit.source.url],
    problem: `- **Model limb.** The limb darkening is computed from the ${cloudy ? 'cloudy' : 'cloud-free'} model a paper fitted to the planet, in ${fit.band === middleBand ? 'the band it is seen in' : 'the middle band of its color'}, not a measurement of this planet; another model grid would give another law. Among the ${edges.length} models it is read between, the disc near its edge (the lowest of the eight angles) is ${Math.min(...edges)}% to ${Math.max(...edges)}% as bright as the centre.${reproduced}` } };
}

/** The law at a planet's temperature and gravity, with the nodes it is read between as the file kept beside the planet, or
 * why the grid does not reach it. */
export function imagedLimb(grid: string, teffK: number, logg: number, band: ClaretBand = CLARET_2012.band): { limb?: ImagedLimb; why?: string } {
  const MODELS = models(band), file = claretFile(band);
  const recipe = { law: 'quadratic' as const, source: 'grid' as const, path: file, teffK, logg, models: MODELS, columns: COLUMNS };
  const [header, units, rule, ...rows] = grid.trimEnd().split('\n'), nodes = rows.map(row => row.split('\t')), span = (column: number) => { const values = nodes.map(cells => Number(cells[column])); return [Math.min(...values), Math.max(...values)] as const; };
  const [coolest, hottest] = span(1), [lowest, highest] = span(0);
  if (teffK < coolest || teffK > hottest) return { why: `at ${teffK.toLocaleString('en-US')} K it is outside the ${coolest.toLocaleString('en-US')} to ${hottest.toLocaleString('en-US')} K of the models ${CLARET_2012.cite} tabulate` };
  if (logg < lowest || logg > highest) return { why: `at log g ${logg} it is outside the log g ${lowest} to ${highest} of the models ${CLARET_2012.cite} tabulate` };
  const { corners } = readLimbGrid(grid, recipe);
  const text = [header, units, rule, ...rows.filter(row => { const cells = row.split('\t'); return corners.some(corner => corner.logg === Number(cells[0]) && corner.teff === Number(cells[1])); })].join('\n') + '\n';
  const { u1, u2 } = readLimbGrid(text, recipe);
  return { limb: { limbDarkening: { law: 'quadratic', path: file, grid: { teffK, logg, models: MODELS }, columns: COLUMNS }, file, text, u1, u2,
    input: { path: file, origin: CLARET_2012.table, credit: `${CLARET_2012.cite} (CDS ${CLARET_2012.catalogue})`, license: 'CDS catalogue data, public with citation of the paper and CDS', licenseEvidence: ['https://cds.unistra.fr/vizier-org/licences_vizier.html'],
      acquisition: `Rows of tableab.dat: the quadratic ${band} coefficients (least-squares fits, quasi-spherical models) of the grid nodes the planet's temperature and gravity lie between, each cell as printed, the fixed columns rewritten as tabs.`,
      redistribution: 'Catalogue rows retained with their citation.', consumers: ['assets', 'datasets'] },
    credit: `Limb darkening: ${CLARET_2012.cite}, CDS ${CLARET_2012.catalogue}.`, evidence: [CLARET_2012.table],
    problem: '- **Model limb.** The limb darkening is a model atmosphere at the planet\'s temperature and gravity, in the middle band of its color, not a measurement of this planet.',
    sentence: `dimmed toward the limb by the quadratic law ${CLARET_2012.cite} compute from PHOENIX model atmospheres for the ${band} band at ${Math.round(teffK).toLocaleString('en-US')} K and log g ${logg} (u1 ${u1.toFixed(3)}, u2 ${u2.toFixed(3)}): a model, not a measurement of this planet` } };
}

const COLOR_CREDIT = 'Color: infrared false color from the flux densities of';
const GRAY_CREDIT = 'Shape: a sphere of the model radius in the shared neutral gray; no image or color of the planet\'s surface exists.';
const EDGE = '; darkening toward the edge from a model atmosphere.', DISC = ' The disc is dimmed toward the limb by ', NOTE = ' The darkening toward the edge is ';

/** The dataset a law darkens: the infrared color, or for a self-luminous planet with no color its gray shape. */
function bandColorSurface(raster: Record<string, unknown>, id: string) {
  const surfaces = requireArray(raster.surfaces, `${id} raster surfaces`).map(entry => requireRecord(entry, `${id} raster surface`)), of = (kind: string) => surfaces.find(entry => requireRecord(entry.science ?? {}, `${id} science`).kind === kind);
  const surface = of('disc-integrated-band-color') ?? (raster.emission === undefined ? undefined : of('neutral-shape'));
  if (!surface) throw new TypeError(`${id}: no infrared color dataset, so there is no disc color to darken.`);
  if (raster.emission === undefined) throw new TypeError(`${id}: it is lit by its star, which shades its disc already.`);
  return surface;
}

/** Put the law on the package's infrared-color dataset: recipe, limb plate, dataset texts, the node file and its manifest entry.
 * A rerun replaces what an earlier run wrote. */
export function installImagedLimb(files: PackageFiles, id: string, limb: ImagedLimb) {
  const s = `src/objects/${id}/source`, read = (path: string) => requireRecord(JSON.parse(String(files.get(path))), path);
  const raster = read(`${s}/preparation/raster.json`), surface = bandColorSurface(raster, id), science = requireRecord(surface.science, `${id} science`);
  science.limbDarkening = limb.limbDarkening;
  science.qualification = `${requireString(science.qualification, `${id} science.qualification`).split(DISC)[0]!.trim()} The disc is ${limb.sentence}.`;
  const limbMaterial = requireRecord(requireRecord(requireRecord(raster.emission, `${id} emission`).metadata, `${id} emission.metadata`).limbMaterial, `${id} limbMaterial`);
  limbMaterial.composition = 'black alpha darkens the disc according to the selected limb-darkening law; transparent outside the silhouette';
  files.set(`${s}/preparation/raster.json`, json(raster));
  files.set(`${s}/${limb.file}`, limb.text);

  const content = read(`${s}/content/object.json`), controls = requireArray(requireRecord(content.datasets, `${id} datasets`).controls, `${id} controls`).map(entry => requireRecord(entry, `${id} control`));
  const control = controls.find(entry => entry.id === surface.id);
  if (!control) throw new TypeError(`${id}: source/content/object.json has no control for the ${String(surface.id)} dataset.`);
  control.qualification = `${requireString(control.qualification, `${id} control.qualification`).split(EDGE)[0]!.replace(/\.\s*$/u, '')}${EDGE}`;
  control.notes = `${requireString(control.notes, `${id} control.notes`).split(NOTE)[0]!.trim()}${NOTE}${limb.sentence.replace(/^dimmed toward the limb by /u, '')}.`;
  files.set(`${s}/content/object.json`, json(content));

  // One law, one node file: the entry of an earlier run, from either source, is replaced.
  const manifest = read(`${s}/manifest.json`), input = String(limb.input.id ?? `${id}-${CLARET_2012.input}`);
  manifest.inputs = [...requireArray(manifest.inputs, `${id} manifest inputs`).filter(entry => !LIMB_INPUTS.test(String(requireRecord(entry, `${id} manifest input`).id))), { id: input, ...limb.input }, ...(limb.fit ? [limb.fit] : [])];
  // The map marker is the same disc, dimmed by the same law (source-authoring/context-markers.mts).
  manifest.generatedIntermediates = requireArray(manifest.generatedIntermediates ?? [], `${id} generated intermediates`).map(entry => {
    const marker = requireRecord(entry, `${id} generated intermediate`);
    if (marker.path !== MARKER_PATH || marker.recipe === undefined) return marker;
    const recipe = requireRecord(marker.recipe, `${id} marker recipe`);
    return { ...marker, credit: String(marker.credit).replace('color as a disc;', 'color as a disc, dimmed toward the limb by its law;'), recipe: { ...recipe, inputs: [...new Set([...requireArray(recipe.inputs, `${id} marker inputs`).map(String).filter(name => !LIMB_INPUTS.test(name)), input])] } };
  });
  files.set(`${s}/manifest.json`, json(manifest));
  bindInputs(files, id);
}

/** Bring the README, credits and ledger in line with the planet's color and, when it has one, its limb law. A planet with no
 * color (no `record`) keeps its shape paragraph and credit: only its limb is documented. */
export function documentImagedColor(files: PackageFiles, id: string, record: Record<string, unknown> | undefined, recordPath: string, limb: { law: ImagedLimb; gravity: string } | undefined, none?: string) {
  const o = `src/objects/${id}`, generated = '**Infrared color dataset.** The default dataset paints the sphere one false color from its measured flux';
  const colored = record && (() => {
    const source = requireRecord(record.source, `${id} band color source`), citation = requireString(source.citation, `${id} band color citation`);
    const unit = requireString(record.unit, `${id} band color unit`), fluxes = requireArray(record.bands, `${id} bands`).map(entry => requireRecord(entry, `${id} band`));
    const bands = fluxes.map(band => `${requireString(band.band, `${id} band name`)} ${requireFiniteNumber(band.wavelengthMicrometres, `${id} band wavelength`)} µm`);
    // The README gives each flux with its error: a faint band's error is the uncertainty of the hue.
    const measured = fluxes.map((band, index) => `${bands[index]} (${requireFiniteNumber(band.value, `${id} band value`)} ± ${requireFiniteNumber(band.error, `${id} band error`)} ${unit})`);
    return { citation, bands, url: requireString(source.url, `${id} band color url`),
      paragraph: `${generated} in three infrared bands: red ${measured[0]}, green ${measured[1]}, blue ${measured[2]} (${citation}; [record](source/${recordPath})). Display range: ${requireString(record.displayRangeSource, `${id} displayRangeSource`).replace(/^T/u, 't')} Not a natural color; nobody has resolved its disc.` };
  })();
  // With no law, the reason is the ledger's when it records one (a finding written by hand, with the papers checked), else the route's.
  const ledger = requireRecord(JSON.parse(String(files.get(`${o}/investigations.json`))), `${id} ledger`), entries = requireArray(ledger.entries, `${id} ledger entries`).map(entry => requireRecord(entry, `${id} ledger entry`));
  const recorded = limb ? undefined : entries.find(entry => entry.id === 'limb-darkening' && entry.status !== 'included');
  const limbLine = limb ? `**Limb.** The disc is ${limb.law.sentence} ([nodes](source/${limb.law.file})). ${limb.gravity}.` : recorded ? `**Limb.** ${requireString(recorded.finding, `${id} limb finding`)}` : none && `**Limb.** No limb darkening is drawn: ${none}.`;
  // A planet colored after it was scaffolded still has the gray sphere's paragraph, which the color's replaces. A color paragraph
  // written by hand is kept.
  const lines = String(files.get(`${o}/README.md`)).split('\n'), keepsOwn = !colored || lines.some(line => /^\*\*[^*]*color dataset\.\*\*/iu.test(line) && !line.startsWith(generated));
  const kept = lines.filter(line => !line.startsWith('**Limb.**') && !line.startsWith('- **Model limb.**') && (keepsOwn || (!line.startsWith('**Shape dataset.**') && !line.startsWith(generated))));
  const heading = kept.some(line => line.startsWith('**Rotation.**')) ? '**Rotation.**' : '## Evidence', at = kept.findIndex(line => line.startsWith(heading));
  if (at < 0) throw new TypeError(`${id}: README.md has no "${heading}" to place the dataset paragraphs before.`);
  kept.splice(at, 0, ...[...(keepsOwn ? [] : [colored!.paragraph]), ...(limbLine ? [limbLine] : [])].flatMap(line => [line, '']));
  const problems = kept.indexOf('## Known problems');
  if (limb && problems >= 0) { let end = problems + 1; while (end < kept.length && !kept[end]!.startsWith('## ') && !kept[end]!.startsWith('[')) end++; while (kept[end - 1] === '') end--; kept.splice(end, 0, limb.law.problem); }
  files.set(`${o}/README.md`, kept.join('\n').replace(/\n{3,}/gu, '\n\n'));

  // The credits: the gray sphere's stock line no longer holds, and the color and the law are credited after the lines written by
  // hand. A color credit written by hand is kept as it is.
  const notice = String(files.get(`${o}/NOTICE.md`)).split('\n').filter(line => !line.startsWith('Limb darkening: ') && !(colored && line.startsWith(COLOR_CREDIT)))
    .map(line => colored && line === GRAY_CREDIT ? 'Shape: a sphere of the model radius; no image resolves the planet.' : line);
  const credits = [...(!colored || notice.some(line => line.startsWith('Color:')) ? [] : [`${COLOR_CREDIT} ${colored.citation} (${colored.bands.join(', ')}).`]), ...(limb ? [limb.law.credit] : [])];
  files.set(`${o}/NOTICE.md`, `${[...notice, ...credits.flatMap(line => ['', line])].join('\n').replace(/\n{3,}/gu, '\n\n').trimEnd()}\n`);

  const shown = colored ? `Shown in infrared false color from its measured flux in ${colored.bands.join(', ')} (${colored.citation}).` : '';
  ledger.entries = [...entries.filter(entry => entry.id !== 'limb-darkening' || entry === recorded).map(entry => !colored || entry.id !== 'band-color' ? entry
    : { ...entry, status: 'included', finding: `${shown} ${String(entry.finding).replace(shown, '').replace(/,? so (?:the planet|it) is the shared neutral gray\./u, '.').trim()}`.trim(), evidence: [...new Set([...requireArray(entry.evidence ?? [], `${id} ledger evidence`), colored.url])] }),
    ...(!colored || entries.some(entry => entry.id === 'band-color' || entry.id === 'color') ? [] : [{ id: 'band-color', subject: 'A false color from three measured bands', status: 'included', finding: shown, evidence: [colored.url] }]),
    ...(limb ? [{ id: 'limb-darkening', subject: 'Limb darkening', status: 'included', finding: `The disc is ${limb.law.sentence}. ${limb.gravity}.`, evidence: [...limb.law.evidence] }] : [])];
  files.set(`${o}/investigations.json`, json(ledger));
}

/** `new-object --imaged-limb`: give each imaged planet named a law at its own temperature and gravity, the published table's
 * where it reaches and PICASO's where it does not, and bring its documents in line with its color. Returns one line per planet;
 * nothing is baked here. */
export async function addImagedLimbs(root: string, ids: readonly string[], archive: Archive, progress = (_line: string) => {}, computed: typeof fittedImagedLimb = fittedImagedLimb): Promise<string[]> {
  const table = await archive.text(CLARET_2012.table), grids = new Map<ClaretBand, string>(), lines: string[] = [], say = (line: string) => { lines.push(line); progress(line); };
  for (const id of ids) {
    const o = resolve(root, 'src/objects', id), files: PackageFiles = new Map();
    for (const path of PACKAGE_FILES) files.set(`src/objects/${id}/${path}`, await readFile(resolve(o, path), 'utf8'));
    const body = requireRecord(JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies', `${id}.json`), 'utf8')), `${id} body`), physical = requireRecord(body.physical, `${id} physical`);
    const measurements = requireRecord(JSON.parse(await readFile(resolve(o, 'source/measurements.json'), 'utf8')), `${id} measurements`);
    let surface: Record<string, unknown>;
    try { surface = bandColorSurface(requireRecord(JSON.parse(String(files.get(`src/objects/${id}/source/preparation/raster.json`))), `${id} raster`), id); } catch (error) { say(`${id}: ${(error as Error).message}`); continue; }
    const fit = await readFile(resolve(o, 'source', ATMOSPHERE_FIT.path), 'utf8').then(record => parseAtmosphereFit(JSON.parse(record), `${id} ${ATMOSPHERE_FIT.path}`), (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return undefined; throw error; });
    // A planet with no color is gray: its law is read in the band its fit record says it is seen in.
    const gray = requireRecord(surface.science, `${id} science`).kind === 'neutral-shape', recordPath = gray ? '' : requireString(surface.source, `${id} band color path`);
    const record = gray ? undefined : requireRecord(JSON.parse(await readFile(resolve(o, 'source', recordPath), 'utf8')), `${id} band color`);
    const middleBand = record ? requireString(requireRecord(requireArray(record.bands, `${id} bands`)[1], `${id} middle band`).band, `${id} middle band name`) : fit?.band, band = middleBand === undefined ? undefined : claretBand(middleBand);
    const gm = Number(physical.gravitationalParameterKm3PerS2), radiusKm = requireFiniteNumber(physical.meanRadiusKm, `${id} meanRadiusKm`), teffK = Number(measurements.effectiveTemperatureK);
    // log g in cgs from GM (km^3/s^2) and the radius (km).
    const logg = Number(Math.log10(gm * 1e15 / (radiusKm * 1e5) ** 2).toFixed(2));
    const why = !(teffK > 0) ? 'its measurements record cites no temperature' : !(gm > 0) ? 'its astronomy record has no mass, so its gravity is unknown' : undefined;
    // The published table where it reaches the planet in the middle band of its color; else the law computed from the model a paper
    // fitted to the planet; and why if neither.
    const published = why || !band ? undefined : imagedLimb(grids.get(band) ?? grids.set(band, claret2012Grid(table, band)).get(band)!, teffK, logg, band);
    let limb = published?.limb, outside = why ?? published?.why ?? (middleBand === undefined ? 'it has no measured color whose band a law could be read in' : `its ${gray ? 'band' : 'color\'s middle band'}, ${middleBand}, is not in the J, H or K of the published table`);
    if (!why && !limb && !fit) outside = `${outside}; and no paper's fit of a cloudy model grid is recorded for it (source/${ATMOSPHERE_FIT.path})`;
    if (!why && !limb && fit && middleBand !== undefined) try { const answer = computed(id, fit, middleBand); limb = answer.limb; outside = [outside, answer.why].filter(Boolean).join('; '); } catch (error) { outside = `${outside}; ${(error as Error).message}`; }
    if (limb) installImagedLimb(files, id, limb);
    documentImagedColor(files, id, record, recordPath, limb && { law: limb, gravity: limb.fit
      ? `The temperature and gravity are that fit's (${fit!.source.locator}; [record](source/${ATMOSPHERE_FIT.path})), not the ${teffK.toLocaleString('en-US')} K of its measurements record${fit!.note ? `. ${fit!.note.replace(/\.$/u, '')}` : ''}`
      : `Its temperature is the ${teffK.toLocaleString('en-US')} K of its measurements record; log g ${logg} follows from the mass and radius of its astronomy record (packages/astronomy/data/bodies/${id}.json)` }, outside);
    for (const [path, value] of files) await writeFile(resolve(root, path), value);
    // The marker author draws in the checkout it runs in; a package written to a scratch root keeps the marker it has.
    if (limb && resolve(root) === resolve(WORKSPACE)) await authorContextMarkers([id]);
    say(limb ? `${id}: limb law ${limb.fit ? `from the model ${fit!.source.citation} fit (${fit!.teffK} K, log g ${fit!.logg})` : `at ${teffK} K, log g ${logg}`}: u1 ${limb.u1.toFixed(3)}, u2 ${limb.u2.toFixed(3)}` : `${id}: no limb law: ${outside}; documents brought in line with its ${gray ? 'shape' : 'color'}`);
  }
  return lines;
}
