/** Draft specs for the stars of another galaxy from any VizieR table that lists them one by one:
 * `new-object --from-table CLASS:GALAXY=TABLE[#ROW] --out spec.json`.
 *
 * CLASS is what the stars are (TABLE_CLASSES): it says which of the table's columns the draft needs and which published relation
 * turns them into a radius and a temperature, as sh0es.mts does for the Cepheids of one paper. GALAXY is the id of the galaxy's
 * object: the star is placed inside it as the app draws it, where its sight line crosses the midplane of the galaxy's own
 * image-layer disc, and moves with SIMBAD's radial velocity of the galaxy. TABLE is the VizieR table (J/ApJ/743/176/table1); its
 * columns are found by vizier-tables.mts. Its paper is credited from the head of the catalogue's ReadMe, and the source cited is the
 * catalogue itself, by the DOI CDS registered for it: the table is what was read.
 *
 * ROW picks the stars, as comma-separated parts. `COLUMN=VALUE` keeps the rows with that cell; a bare value keeps the row the table
 * names so; `all` drafts every row kept. With neither, one star is drafted: the longest period the class's relation covers. A table
 * of several galaxies is narrowed to this one by the column that holds its name (NGC3351), when a cell matches a name the galaxy's
 * package lists. Each star's `position.row` is the fewest cells that pick its row again: its name in the table, else its period and
 * the cells after it. `featured` makes the one star drafted a map target (a ring, a name, a click) and a row of its galaxy's list;
 * without it the star is a plain dot, as every star of a batch is (spec.mts `featured`).
 *
 * A table whose rows have no position of their own (a reanalysis that gives every star its galaxy's centre) places its stars by
 * SIMBAD instead, through the SIMBAD name CDS added to each row. The star is named as SIMBAD names it when SIMBAD holds a star at
 * its position, and as its table writes it otherwise.
 *
 * A table that lists each star by its detector pixel (the HST Cepheid papers: chip, X, Y) places its stars through the exposure those
 * pixels were measured on, which the paper says and the table does not: `exposure=mast:HST/product/u35i0101r_c0m.fits` names it and
 * `firstPixel=1` the coordinate the paper's software gives the centre of the first pixel (1 for DAOPHOT and ALLFRAME, 0.5 for HSTphot).
 * The chip is the image extension of that number. Such a star keeps its table's name: the exposure's pointing is too coarse to tell
 * which of SIMBAD's stars it is (images/image-pixel.mts).
 *
 * `telescope stars GALAXY` lists the tables worth trying (stars/stars.mts). */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { imageLayerDisc, imageLayerDiscDistanceKpc } from '@cssearth/bake/image-layers';
import { VIZIER_ASU, type Archive } from '../archives.mts';
import { preferredName, simbadIdentifiers } from '../../display-name.mts';
import { slug } from '../../identity.mts';
import type { CataloguePosition } from '../../spec-types.mts';
import { fetchImagePixel } from '../images/image-pixel.mts';
import { GROENEWEGEN_2020, galaxyVelocity, relationCepheidDraft } from '../sh0es.mts';
import { simbadAt, simbadQuoted, simbadRows } from './simbad-tap.mts';
import { catalogueOf, DECIMAL_POSITION, parseVizierReadMe, starColumns, vizierDataRows, vizierReadMeUrl, vizierTables, type StarColumns } from './vizier-tables.mts';

/** A star of the class that SIMBAD lists within this of a row's position is that row's star. A ground-based table gives right
 * ascension to a tenth of a second of time, 1.5"; M83's [TTS2003] C2 is 1.4" from its row in Bonanos & Stanek (2003). */
export const SIMBAD_MATCH_ARCSEC = 2;
const PARSEC_M = 3.0856775814913673e16, KEY_CELLS = 3;
type Cells = Readonly<Record<string, string>>;

/** What a class of star needs from its table and how its draft is made. */
interface TableClass {
  /** The star as a reader meets it: "A Cepheid in the galaxy M81". */
  readonly noun: string;
  /** The longest period the class's relation was fitted to; the default star is chosen under it. */
  readonly longestPeriodDays: number;
  readonly relation: string;
  /** The root of the class's branch in SIMBAD's type tree: a star matched by position must be on it. */
  readonly simbadRoot: string;
}
export const TABLE_CLASSES: Readonly<Record<string, TableClass>> = {
  // Radius and temperature from Groenewegen's (2020) period relations for Galactic fundamental-mode Cepheids (sh0es.mts).
  cepheid: { noun: 'Cepheid', longestPeriodDays: GROENEWEGEN_2020.longestPeriodDays, relation: `${GROENEWEGEN_2020.credit}'s period relations`, simbadRoot: 'Ce*' },
};

export interface TableRequest { readonly starClass: string; readonly galaxy: string; readonly table: string; readonly filters: Cells; readonly named?: string; readonly all: boolean; readonly featured: boolean;
  /** The archived exposure the table's pixels were measured on, and the paper's coordinate of the first pixel's centre. */
  readonly exposure?: { readonly product: string; readonly firstPixel: number } }
const RESERVED = ['exposure', 'firstPixel'];
export function parseTableRequest(name: string): TableRequest {
  const match = /^([a-z][a-z-]*):([a-z][a-z0-9-]*)=([A-Z]+\/[\w+/.-]+?)(?:#(.+))?$/u.exec(name.trim());
  if (!match) throw new TypeError(`${name} is not CLASS:GALAXY=TABLE[#ROW] (cepheid:m81=J/ApJ/743/176/table1); the classes are ${Object.keys(TABLE_CLASSES).join(', ')}.`);
  if (!TABLE_CLASSES[match[1]!]) throw new TypeError(`${name}: no class ${match[1]}; the classes are ${Object.keys(TABLE_CLASSES).join(', ')}.`);
  const parts = (match[4] ?? '').split(',').map(part => part.trim()).filter(Boolean), bare = parts.filter(part => !part.includes('=') && part !== 'all' && part !== 'featured');
  if (bare.length > 1) throw new TypeError(`${name}: ROW names one star (${bare.join(', ')} are ${bare.length}); the other parts are COLUMN=VALUE, all or featured.`);
  if (parts.includes('all') && parts.includes('featured')) throw new TypeError(`${name}: featured marks one star a reader should find; all would mark every row of the table.`);
  const given = Object.fromEntries(parts.filter(part => part.includes('=')).map(part => { const at = part.indexOf('='); return [part.slice(0, at).trim(), part.slice(at + 1).trim()]; }));
  const { exposure: product, firstPixel } = given;
  if ((product === undefined) !== (firstPixel === undefined) || (product !== undefined && (!/^mast:[A-Za-z0-9_-]+\/product\/[\w.+-]+\.fits$/u.test(product) || !['0', '0.5', '1'].includes(firstPixel!))))
    throw new TypeError(`${name}: a table of detector pixels is placed with both exposure=mast:HST/product/FILE.fits, the exposure they were measured on, and firstPixel=0.5, 1 or 0, the paper's coordinate of the first pixel's centre.`);
  return { starClass: match[1]!, galaxy: match[2]!, table: match[3]!, all: parts.includes('all'), featured: parts.includes('featured'), ...(bare[0] ? { named: bare[0] } : {}),
    ...(product ? { exposure: { product, firstPixel: Number(firstPixel) } } : {}), filters: Object.fromEntries(Object.entries(given).filter(([column]) => !RESERVED.includes(column))) };
}

/** A bibcode's journal reference as a reader meets it: 2012A&A...539A.138F is "A&A 539, A138". */
export function bibcodeReference(bibcode: string) {
  const match = /^(\d{4})([A-Za-z&.]{5})([\d.]{4})([A-Za-z.])([\d.]{4})[A-Z]$/u.exec(bibcode);
  if (!match) throw new TypeError(`${bibcode} is not a 19-character bibcode.`);
  const plain = (part: string) => part.replaceAll('.', '');
  return { year: match[1]!, reference: `${plain(match[2]!)} ${plain(match[3]!)}, ${match[4] === '.' ? '' : match[4]}${plain(match[5]!)}` };
}
/** "Gerke et al. (2011), ApJ 743, 176": the authors' surnames as the catalogue's ReadMe lists them, the reference from the bibcode. */
export function paperCredit(names: readonly string[], bibcode: string) {
  const { year, reference } = bibcodeReference(bibcode);
  if (!names.length) throw new Error(`${bibcode}: no author is named, so the paper cannot be credited.`);
  const authors = `${names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} & ${names[1]}` : `${names[0]} et al.`} (${year})`;
  return { authors, credit: `${authors}, ${reference}` };
}

interface GalaxyRecord { readonly classification?: string; readonly physical?: { readonly name?: string }; readonly star?: { readonly distanceParsecs?: number; readonly sources?: { readonly distance?: string } } }
interface GalaxyDescriptor { readonly properties?: { readonly worldFrame?: { readonly bodyRadiusM?: number }; readonly catalog?: { readonly aliases?: readonly string[] } } }
/** The galaxy a star is drafted into: its record, its names, its drawn disc and the radius its package frames. */
export async function readGalaxy(root: string, id: string) {
  const path = `packages/astronomy/data/bodies/${id}.json`, record = JSON.parse(await readFile(resolve(root, path), 'utf8').catch(() => { throw new Error(`${id}: no astronomy record ${path}; GALAXY is the id of a galaxy already in the universe.`); })) as GalaxyRecord;
  if (record.classification !== 'galaxy') throw new TypeError(`${id}: ${path} classification is ${JSON.stringify(record.classification)}, not "galaxy".`);
  const name = record.physical?.name, parsecs = record.star?.distanceParsecs, distance = record.star?.sources?.distance, url = /https:\/\/[^\s)]+/u.exec(distance ?? '')?.[0];
  if (!name || !(Number(parsecs) > 0) || !distance || !url) throw new TypeError(`${id}: ${path} needs physical.name, star.distanceParsecs and a star.sources.distance that cites an https URL.`);
  const recipePath = `src/objects/${id}-layers/source/recipe.json`, recipe = JSON.parse(await readFile(resolve(root, recipePath), 'utf8').catch(() => { throw new Error(`${id}: no ${recipePath}; a star is placed on the disc its galaxy is drawn as, and ${name} has none.`); })) as Parameters<typeof imageLayerDisc>[0];
  const objectPath = `src/objects/${id}/object.json`, properties = (JSON.parse(await readFile(resolve(root, objectPath), 'utf8')) as GalaxyDescriptor).properties, frame = properties?.worldFrame?.bodyRadiusM;
  if (!(Number(frame) > 0)) throw new TypeError(`${id}: ${objectPath} properties.worldFrame.bodyRadiusM is ${JSON.stringify(frame)}; it bounds where a star of the galaxy can be placed.`);
  return { id, name, names: [name, ...properties?.catalog?.aliases ?? []], reader: /galaxy/iu.test(name) ? `the ${name}` : `the galaxy ${name}`, parsecs: parsecs!, distance, url, recipe, recipePath, disc: imageLayerDisc(recipe), radiusPc: frame! / PARSEC_M };
}
export type Galaxy = Awaited<ReturnType<typeof readGalaxy>>;

const unit = (raDeg: number, decDeg: number) => { const ra = raDeg * Math.PI / 180, dec = decDeg * Math.PI / 180; return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)] as const; };
/** Where the star sits in the galaxy as it is drawn: the midplane crossing of its sight line. A crossing outside the radius the
 * galaxy's package frames is refused: a star of another galaxy, or one far off the major axis of a steeply inclined disc. */
export function placeInGalaxy(galaxy: Pick<Galaxy, 'id' | 'name' | 'distance' | 'url' | 'recipe' | 'recipePath' | 'disc' | 'radiusPc'>, raDeg: number, decDeg: number, star: string) {
  const { target, geometry } = galaxy.recipe, outside = (found: string) => new RangeError(`${star}: its sight line ${found}, outside the ${Math.round(galaxy.radiusPc).toLocaleString('en-US')} pc src/objects/${galaxy.id}/object.json frames (worldFrame.bodyRadiusM); the star is not in ${galaxy.name} as drawn (${galaxy.recipePath}: inclination ${geometry.inclinationDeg} deg).`);
  let kiloparsecs: number;
  try { kiloparsecs = imageLayerDiscDistanceKpc(galaxy.disc, raDeg, decDeg); } catch { throw outside('never meets the disc'); }
  const parsecs = Math.round(kiloparsecs * 1000), here = unit(raDeg, decDeg), centre = unit(target.centerRaDeg, target.centerDecDeg);
  const fromCentre = Math.hypot(...here.map((axis, index) => axis * parsecs - centre[index]! * target.distancePc));
  if (fromCentre > galaxy.radiusPc) throw outside(`meets the disc ${Math.round(fromCentre).toLocaleString('en-US')} pc from the centre`);
  return { value: parsecs, url: galaxy.url,
    source: `Placed in ${galaxy.name} as the app draws it, where the star's sight line crosses the disc's midplane: ${parsecs.toLocaleString('en-US')} pc (${galaxy.recipePath}: centre ${Math.round(target.distancePc).toLocaleString('en-US')} pc, inclination ${geometry.inclinationDeg} deg, line of nodes ${geometry.lineOfNodesPaDeg} deg). The galaxy's distance, which places the galaxy and not a star within it: ${galaxy.distance}` };
}

const plain = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/gu, '');
const own = (column: string) => column !== 'recno' && !column.startsWith('_') && !/^(?:RA|DE)(?:J2000|B1950|deg)?$/u.test(column);
/** Whether a column names rows: every row has a cell, and at least `share` of them differ (two stars of one table may share an ID). */
const names = (rows: readonly Cells[], column: string, share = 1) => rows.every(cells => cells[column]) && new Set(rows.map(cells => cells[column])).size >= share * rows.length;

/** The rows the request keeps, each with the fewest cells that pick it out of the whole table again (the spec's `position.row`). */
export function pickRows(rows: readonly Cells[], columns: StarColumns, request: TableRequest, galaxyNames: readonly string[], period: (cells: Cells) => number, longestPeriodDays: number) {
  const header = Object.keys(rows[0] ?? {}).filter(own), absent = Object.keys(request.filters).filter(column => !header.includes(column));
  if (absent.length) throw new Error(`${request.table} has no column ${absent.join(', ')}; its columns are ${header.join(', ')}.`);
  // A table of several galaxies names each row's galaxy: the column whose cells match a name of this one narrows it.
  const known = new Set(galaxyNames.map(plain)), galaxyColumn = Object.keys(request.filters).length ? undefined : header.find(column => new Set(rows.map(cells => cells[column])).size > 1 && rows.some(cells => known.has(plain(cells[column] ?? ''))));
  const filters: Cells = galaxyColumn ? { [galaxyColumn]: rows.find(cells => known.has(plain(cells[galaxyColumn] ?? '')))![galaxyColumn]! } : request.filters;
  const kept = rows.filter(cells => Object.entries(filters).every(([column, cell]) => cells[column] === cell));
  if (!kept.length) throw new Error(`${request.table}: no row has ${Object.entries(filters).map(([column, cell]) => `${column} = ${cell}`).join(', ')}; cells are compared as VizieR writes them.`);
  // The column the table's metadata calls the star's name may be a number (an ID) and may repeat once in a while; any other column
  // names a row only when it comes before the period, as a name does and a remark does not, by text that never repeats.
  const free = (column: string | undefined): column is string => !!column && !(column in filters) && column !== columns.simbadName, leading = header.slice(0, Math.max(0, header.indexOf(columns.period?.column ?? '')));
  const named = free(columns.identifier) && names(kept, columns.identifier, 0.9) ? columns.identifier : leading.find(column => free(column) && names(kept, column) && kept.every(cells => !Number.isFinite(Number(cells[column]))));
  const keyOf = (cells: Cells): Cells => {
    const tried: Record<string, string> = { ...filters }, match = () => rows.filter(row => Object.entries(tried).every(([column, cell]) => row[column] === cell)).length;
    for (const column of [named, columns.period?.column, ...header].filter((candidate): candidate is string => !!candidate && cells[candidate] !== '')) {
      if (match() === 1 || Object.keys(tried).length >= Object.keys(filters).length + KEY_CELLS) break;
      tried[column] ??= cells[column]!;
    }
    if (match() !== 1) throw new Error(`${request.table}: no ${KEY_CELLS} cells of the row ${JSON.stringify(cells)} pick it alone; give them as #COLUMN=VALUE,COLUMN=VALUE.`);
    return tried;
  };
  const one = (found: readonly Cells[], what: string) => { if (found.length !== 1) throw new Error(`${request.table}: ${what} matches ${found.length} rows, not one.`); return found; };
  const picked = request.named ? one(named ? kept.filter(cells => cells[named] === request.named) : [], `${named ?? 'no naming column'} = ${request.named}`)
    : request.all || kept.length === 1 ? kept
    : [kept.filter(cells => period(cells) <= longestPeriodDays).reduce<Cells | undefined>((longest, cells) => !longest || period(cells) > period(longest) ? cells : longest, undefined)].filter((cells): cells is Cells => !!cells);
  if (!picked.length) throw new Error(`${request.table}: none of its ${kept.length} rows has a period within the ${longestPeriodDays} d the relation covers.`);
  return { named, kept, rows: picked.map(cells => ({ cells, key: keyOf(cells) })) };
}

/** SIMBAD's object of a name, as it writes the name (spaces kept: the spec's `row.main_id` must equal it), with its position. */
async function simbadObject(archive: Archive, name: string) {
  const [row] = await simbadRows(archive, `SELECT b.main_id, b.ra, b.dec, b.coo_bibcode FROM basic AS b JOIN ident AS n ON b.oid = n.oidref WHERE n.id = ${simbadQuoted(name)}`);
  const raDeg = Number(row?.ra), decDeg = Number(row?.dec);
  return row?.main_id && row.ra && row.dec && Number.isFinite(raDeg) && Number.isFinite(decDeg) ? { mainId: row.main_id, raDeg, decDeg, bibcode: row.coo_bibcode || undefined } : undefined;
}

/** `new-object --from-table CLASS:GALAXY=TABLE[#ROW]... --out spec.json`. */
export async function draftsFromTable(names: readonly string[], archive: Archive, root: string) {
  const stars: Record<string, unknown>[] = [], report: string[] = [];
  for (const name of names) {
    const request = parseTableRequest(name), starClass = TABLE_CLASSES[request.starClass]!, galaxy = await readGalaxy(root, request.galaxy);
    const held = await vizierTables(archive, request.table), table = held?.tables.find(candidate => candidate.name === request.table);
    if (!held || !table) throw new Error(`VizieR holds no table ${request.table}; \`telescope stars ${request.galaxy}\` lists the tables of the papers on its stars.`);
    if (!held.doi) throw new Error(`VizieR ${request.table}: its answer states no catalogue DOI and no resource number to form one, so the table cannot be cited.`);
    const published = parseVizierReadMe(await archive.text(vizierReadMeUrl(catalogueOf(request.table))), catalogueOf(request.table)), cited = paperCredit(published.authors, published.bibcode);
    const paper = { url: `https://doi.org/${held.doi}`, credit: cited.credit }, columns = starColumns(table);
    if (!columns.period) throw new Error(`${request.table} has no period column (${table.columns.map(column => column.name).join(', ')}); a ${starClass.noun} is drafted from its period.`);
    const rows = vizierDataRows(await archive.text(VIZIER_ASU, { '-source': request.table, '-out.all': '', '-out.add': `${DECIMAL_POSITION.ra},${DECIMAL_POSITION.dec}`, '-out.max': '99999' }), request.table);
    const degrees = (cells: Cells, column: string) => { const value = Number(cells[column]); return cells[column] && Number.isFinite(value) ? value : undefined; };
    const period = (cells: Cells) => { const value = Number(cells[columns.period!.column]); return cells[columns.period!.column] && Number.isFinite(value) ? columns.period!.log ? Number((10 ** value).toPrecision(4)) : value : Number.NaN; };
    const picked = pickRows(rows, columns, request, galaxy.names, period, starClass.longestPeriodDays);
    // A position is the star's own when the galaxy's rows do not repeat one: a reanalysis lists every star at its galaxy's centre.
    // One row alone cannot say, so the whole table is asked.
    const judged = picked.kept.length > 1 ? picked.kept : rows, places = new Set(judged.map(cells => `${cells[DECIMAL_POSITION.ra]} ${cells[DECIMAL_POSITION.dec]}`)).size;
    const ownPositions = places > judged.length / 2 && judged.every(cells => degrees(cells, DECIMAL_POSITION.ra) !== undefined);
    const pixel = request.exposure && columns.pixel;
    if (request.exposure && !pixel) throw new Error(`${request.table} has no detector pixel columns (${table.columns.map(column => column.name).join(', ')}); exposure= places a table that lists X and Y.`);
    if (!pixel && !ownPositions && !columns.simbadName) throw new Error(`${request.table} gives its rows no position of their own (${DECIMAL_POSITION.ra}, ${DECIMAL_POSITION.dec} are empty or one place for every row) and no SIMBAD name; its stars cannot be placed from it.`);
    const velocity = await galaxyVelocity(archive, galaxy.name), kiloparsecs = galaxy.parsecs / 1000, far = kiloparsecs >= 1000 ? `${(kiloparsecs / 1000).toFixed(1)} million parsecs` : `${Math.round(kiloparsecs)} kiloparsecs`;
    for (const { cells, key } of picked.rows) {
      const days = period(cells), where = `${request.table} ${Object.entries(key).map(([column, cell]) => `${column} = ${cell}`).join(', ')}`;
      if (!(days > 0)) throw new Error(`${where}: ${columns.period.column} is ${JSON.stringify(cells[columns.period.column])}, not a period.`);
      // The SIMBAD name CDS added to a row is the star's, whether or not the row has a position; without one the star is looked for at its place.
      const listedName = columns.simbadName ? cells[columns.simbadName] : undefined, listed = listedName ? await simbadObject(archive, listedName) : undefined, placed = ownPositions || pixel ? undefined : listed;
      // A pixel is of one chip's frame: a row with no chip, on a camera of several, was measured on a mosaic of them and has no header.
      if (pixel && pixel.chip && !/^[1-9]\d*$/u.test(cells[pixel.chip] ?? '')) throw new Error(`${where}: ${pixel.chip} is ${JSON.stringify(cells[pixel.chip])}, not a chip number; its ${pixel.x} and ${pixel.y} are not of one detector's frame.`);
      const byPixel: CataloguePosition | undefined = pixel ? { archive: 'mast', catalogue: request.exposure!.product, row: { extension: `SCI,${pixel.chip ? cells[pixel.chip] : 1}`, x: cells[pixel.x]!, y: cells[pixel.y]! }, firstPixel: request.exposure!.firstPixel, url: paper.url,
        credit: `${paper.credit}, VizieR ${where} (${[pixel.chip, pixel.x, pixel.y].filter(Boolean).map(column => `${column} ${cells[column!]}`).join(', ')})` } : undefined;
      const onImage = byPixel && await fetchImagePixel(archive, byPixel, where);
      if (!pixel && !ownPositions && !placed) throw new Error(`${where}: SIMBAD holds no position for ${columns.simbadName} = ${JSON.stringify(listedName)}, and the table gives the row none of its own.`);
      const raDeg = onImage?.ra ?? placed?.raDeg ?? degrees(cells, DECIMAL_POSITION.ra)!, decDeg = onImage?.dec ?? placed?.decDeg ?? degrees(cells, DECIMAL_POSITION.dec)!;
      const simbadName = (listed?.mainId ?? (onImage ? undefined : await simbadAt(archive, raDeg, decDeg, SIMBAD_MATCH_ARCSEC, starClass.simbadRoot))?.name)?.replace(/\s+/gu, ' ');
      const written = picked.named ? `${galaxy.name} ${starClass.noun} ${cells[picked.named]}` : undefined;
      const starName = (simbadName ? preferredName(await simbadIdentifiers(archive, simbadName))?.name ?? simbadName : undefined) ?? written;
      if (!starName) throw new Error(`${where}: SIMBAD lists no ${starClass.noun} within ${SIMBAD_MATCH_ARCSEC}" of RA ${raDeg}, Dec ${decDeg} and the table names none, so the star has no name.`);
      const position: CataloguePosition = byPixel ?? (placed
        ? { archive: 'simbad', catalogue: 'basic', row: { main_id: placed.mainId }, url: `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(simbadName!)}`,
          credit: `${paper.credit}, VizieR ${where}, names the star in SIMBAD (${columns.simbadName}); SIMBAD holds its position${placed.bibcode ? `, from ${placed.bibcode}` : ' and names no paper for it'}` }
        : { catalogue: request.table, row: key, columns: DECIMAL_POSITION, credit: paper.credit, url: paper.url });
      const shown = days.toFixed(days < 10 ? 2 : 1);
      stars.push({ ...request.featured ? { featured: true as const } : {}, ...relationCepheidDraft({ id: slug(starName), name: starName, ...(simbadName ? { target: simbadName } : {}), galaxy: galaxy.name, inside: galaxy.id, periodDays: days, paper, position,
        periodSource: `${paper.credit}, VizieR ${where} (${columns.period.column}${columns.period.log ? ` ${cells[columns.period.column]}` : ''})`,
        description: `A ${starClass.noun} in ${galaxy.reader} that pulsates every ${shown} days.`, distance: placeInGalaxy(galaxy, raDeg, decDeg, where), velocity,
        text: { card: `A ${starClass.noun} in ${galaxy.reader}, ${far} away, that swells and shrinks every ${shown} days.`, introduction: `${cited.authors} list its pulsation at ${shown} days.`,
          locator: `VizieR ${where}: ${columns.period.column}` } }) });
    }
    report.push(`${name}: ${picked.rows.length} ${starClass.noun}${picked.rows.length === 1 ? '' : 's'} of ${paper.credit} in ${galaxy.name}${pixel ? `, placed by pixel on ${request.exposure!.product}` : ownPositions ? '' : ', placed by SIMBAD'}; radius and temperature from ${starClass.relation}.`);
  }
  return { stars, report };
}
