/** Every archive the star generator reads, behind one small fetch interface so the tests run offline on fixtures. Each call names
 * the URL it read; a failed request says which archive, which URL and which status. */
import { requireString } from '@cssearth/core';
import { assertRangeResponse, rangeRequestHeader, type SourceRange } from '@cssearth/objects/node';
import { decodeEntities } from '../orbit.mts';
import type { CataloguePosition } from '../spec.mts';

export interface Archive {
  /** GET, or POST a form when `form` is given; the response text. */
  text(url: string, form?: Readonly<Record<string, string>>): Promise<string>;
  /** The whole answer, or exactly the bytes of `range`: a ranged request answered with anything else is refused. */
  bytes(url: string, range?: SourceRange): Promise<Buffer>;
  /** Whether a HEAD request answers 200. */
  exists(url: string): Promise<boolean>;
  /** Where a redirecting URL points, without following it; undefined when it does not redirect. */
  location?(url: string): Promise<string | undefined>;
}

/** A dropped connection, before or during the transfer, is retried twice, a second apart; an HTTP error answer is not, so a
 * failed service is reported at once. Every failure names its URL. A request that gives nothing for TRANSFER_TIMEOUT_MS is a
 * dropped connection: the archives answer in seconds, and a hung one would otherwise hold a batch forever. A service that asks us
 * to slow down (429, or 503 with Retry-After) is waited for as it asks and tried again, up to five times for a 429 and three for a 5xx; and a host with a
 * published request pace is never asked faster than that (PACE_MS). */
export const TRANSFER_TIMEOUT_MS = 120_000;
export const USER_AGENT = 'cssEarth-telescope/1.0 (https://css.earth)';
/** arXiv's API terms: no more than one request every three seconds (https://info.arxiv.org/help/api/tou.html). */
export const PACE_MS: Readonly<Record<string, number>> = { 'export.arxiv.org': 3000 };
const nextSlot = new Map<string, number>();
/** Every pause the transfer takes: its pace, a rate limit, a retry. A test passes one that returns at once. */
type Wait = (ms: number) => Promise<void>;
const pause: Wait = ms => new Promise(done => setTimeout(done, ms));
async function paced(url: string, wait: Wait) {
  const host = new URL(url).host, pace = PACE_MS[host];
  if (!pace) return;
  const now = Date.now(), slot = Math.max(now, nextSlot.get(host) ?? 0);
  nextSlot.set(host, slot + pace);
  if (slot > now) await wait(slot - now);
}
async function transfer<T>(url: string, read: (response: Response) => Promise<T>, init: RequestInit | undefined, wait: Wait): Promise<T> {
  for (let attempt = 1, slowed = 0; ; attempt++) {
    try {
      await paced(url, wait);
      // Every request names the tool, as the telescope's paper search does; Zenodo refuses one that does not.
      const response = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...(init?.headers as Record<string, string> | undefined) }, signal: AbortSignal.timeout(TRANSFER_TIMEOUT_MS) });
      const retryAfter = Number(response.headers.get('retry-after'));
      // A rate limit or a server error is the archive's moment, not an answer: wait (as long as it asks) and ask again. A draft of
      // 24 hosts met a bare 503 from the NASA TAP service, which used to leave the whole host out.
      // arXiv still answered 429 after 10 + 20 + 30 s during an 818-host batch (2026-09-29), so a rate limit is given five tries,
      // doubling from 15 s: about six minutes in all. The same batch met Gaia's TAP answering 500 through 1 + 2 + 3 s; a 5xx now waits 5,
      // 10 and 15 s.
      const limited = response.status === 429;
      if ((limited || response.status >= 500) && slowed < (limited ? 5 : 3)) {
        slowed++; attempt--;
        await response.body?.cancel();
        await wait(Math.min(120, retryAfter > 0 ? retryAfter : limited ? 15 * 2 ** (slowed - 1) : 5 * slowed) * 1000);
        continue;
      }
      if (!response.ok) throw new HttpError(`${url} answered ${response.status} ${response.statusText}${init?.body ? ` for ${String(init.body).slice(0, 200)}` : ''}.`);
      return await read(response);
    } catch (error) {
      if (error instanceof HttpError || attempt === 3) throw error instanceof HttpError ? error : new Error(`${url}: ${(error as Error).message} after ${attempt} attempts.`);
      await wait(1000 * attempt);
    }
  }
}
class HttpError extends Error {}
export const createLiveArchive = (wait: Wait = pause): Archive => ({
  text: (url, form) => transfer(url, response => response.text(), form ? { method: 'POST', body: new URLSearchParams(form) } : undefined, wait),
  bytes: (url, range) => transfer(url, async response => { if (range) assertRangeResponse(response, range, url); return Buffer.from(await response.arrayBuffer()); }, range ? { headers: { range: rangeRequestHeader(range) } } : undefined, wait),
  exists: url => transfer(url, async response => response.status === 200, { method: 'HEAD' }, wait).catch(error => { if (error instanceof HttpError) return false; throw error; }),
  location: url => fetch(url, { redirect: 'manual', headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TRANSFER_TIMEOUT_MS) }).then(response => response.status >= 300 && response.status < 400 ? response.headers.get('location') ?? undefined : undefined),
});
export const liveArchive: Archive = createLiveArchive();

export const GAIA_TAP = 'https://gea.esac.esa.int/tap-server/tap/sync';
export const VIZIER_ASU = 'https://vizier.cds.unistra.fr/viz-bin/asu-tsv';
export const xpSampledUrl = (sourceId: string) => `https://gea.esac.esa.int/data-server/data?RETRIEVAL_TYPE=XP_SAMPLED&ID=${sourceId}&FORMAT=csv&DATA_STRUCTURE=RAW&RELEASE=Gaia+DR3`;
/** The Gaia partner data centre at ARI Heidelberg: a TAP mirror of Gaia DR3 that also serves the XP sampled spectra, used when
 * ESA's DataLink server is down. Its rows are the same product (stellar-photometric-color.mts readXpSampledSpectrum). */
export const ARI_TAP = 'https://gaia.ari.uni-heidelberg.de/tap/sync';
export const xpSampledMirrorForm = (sourceId: string) => ({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: `SELECT source_id, ra, dec, flux, flux_error, solution_id FROM gaiadr3.xp_sampled_mean_spectrum WHERE source_id = ${sourceId}` });
export const ngslUrl = (hd: number) => { const n = String(hd).padStart(6, '0'); return `https://archive.stsci.edu/pub/hlsp/stisngsl/v2/hd${n}/h_stis_ngsl_hd${n}_v2.fits`; };
export const PULKOVO_TABLE5 = 'https://cdsarc.cds.unistra.fr/ftp/III/201/table5.dat';
export const KHARITONOV_CATALOG = 'https://cdsarc.cds.unistra.fr/ftp/III/202/catalog.dat';
export const BURNASHEV_PART2 = 'https://cdsarc.cds.unistra.fr/ftp/III/126/part2.dat.gz';

/** The gaia_source row with its FLAME mass and radius, exactly as the acquisition plan asks for it again. */
export const gaiaRowQuery = (sourceId: string) => `SELECT s.source_id, s.ref_epoch, s.ra, s.dec, s.parallax, s.parallax_error, s.pmra, s.pmdec, s.radial_velocity, s.radial_velocity_error, s.ruwe, s.phot_g_mean_mag, s.bp_rp, s.has_xp_sampled, a.mass_flame, a.mass_flame_lower, a.mass_flame_upper, a.radius_flame, a.radius_flame_lower, a.radius_flame_upper FROM gaiadr3.gaia_source AS s LEFT JOIN gaiadr3.astrophysical_parameters AS a ON a.source_id = s.source_id WHERE s.source_id = ${sourceId}`;
export const gaiaRowForm = (sourceId: string) => ({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: gaiaRowQuery(sourceId) });

export interface GaiaRow {
  /** Parallax, proper motion and RUWE are absent for a two-parameter solution: a position only, as for stars in other galaxies. */
  readonly sourceId: string; readonly ra: number; readonly dec: number; readonly parallax?: number; readonly parallaxError?: number;
  readonly pmra?: number; readonly pmdec?: number; readonly radialVelocity?: number; readonly radialVelocityError?: number; readonly ruwe?: number;
  readonly g: number; readonly hasXpSampled: boolean;
  readonly massFlame?: readonly [number, number, number]; readonly radiusFlame?: readonly [number, number, number];
}

/** A one-row Gaia CSV: header, then the row. Empty cells are absent values. */
export function parseGaiaRow(csv: string, sourceId: string): GaiaRow {
  const lines = csv.trim().split(/\r?\n/u);
  if (lines.length !== 2) throw new TypeError(`Gaia DR3 ${sourceId}: the archive returned ${lines.length - 1} rows, not one.`);
  const header = lines[0]!.split(','), cells = lines[1]!.split(',');
  const cell = (name: string) => { const i = header.indexOf(name); if (i < 0) throw new TypeError(`Gaia DR3 ${sourceId}: no ${name} column.`); return cells[i]!.replace(/^"|"$/gu, ''); };
  const number = (name: string) => { const value = Number(cell(name)); if (!cell(name) || !Number.isFinite(value)) throw new TypeError(`Gaia DR3 ${sourceId}: ${name} is empty.`); return value; };
  const optional = (name: string) => cell(name) === '' ? undefined : number(name);
  if (cell('source_id') !== sourceId) throw new TypeError(`Gaia DR3 ${sourceId}: the row is source ${cell('source_id')}.`);
  const triple = (name: string) => { const v = optional(`${name}_flame`), lo = optional(`${name}_flame_lower`), hi = optional(`${name}_flame_upper`); return v === undefined || lo === undefined || hi === undefined ? undefined : [v, lo, hi] as const; };
  const radialVelocity = optional('radial_velocity'), radialVelocityError = optional('radial_velocity_error'), massFlame = triple('mass'), radiusFlame = triple('radius');
  // A five-parameter solution has all of parallax, proper motion and RUWE; a two-parameter one has none of them.
  const astrometry = ['parallax', 'parallax_error', 'pmra', 'pmdec', 'ruwe'].map(name => [name, optional(name)] as const), given = astrometry.filter(([, value]) => value !== undefined);
  if (given.length && given.length !== astrometry.length) throw new TypeError(`Gaia DR3 ${sourceId}: ${astrometry.filter(([, value]) => value === undefined).map(([name]) => name).join(', ')} empty while ${given.map(([name]) => name).join(', ')} are given.`);
  const [parallax, parallaxError, pmra, pmdec, ruwe] = astrometry.map(([, value]) => value);
  return { sourceId, ra: number('ra'), dec: number('dec'), ...(given.length ? { parallax: parallax!, parallaxError: parallaxError!, pmra: pmra!, pmdec: pmdec!, ruwe: ruwe! } : {}),
    ...(radialVelocity === undefined ? {} : { radialVelocity, ...(radialVelocityError === undefined ? {} : { radialVelocityError }) }), g: number('phot_g_mean_mag'), hasXpSampled: cell('has_xp_sampled') === 'true' || cell('has_xp_sampled') === 'True',
    ...(massFlame ? { massFlame } : {}), ...(radiusFlame ? { radiusFlame } : {}) };
}

export async function fetchGaiaRow(archive: Archive, sourceId: string) {
  const csv = await archive.text(GAIA_TAP, gaiaRowForm(sourceId));
  return { csv, row: parseGaiaRow(csv, sourceId) };
}

/** One row of a VizieR table, for a star Gaia cannot see (spec `position`): the whole row as VizieR serves it, archived beside the
 * body, and the J2000 position it gives. A star a paper lists by its detector pixel is held the same way: `tsv` is then the header of
 * the archived exposure's extension, and `image` says where in the file it lies (images/image-pixel.mts). Coordinates a paper prints in a
 * table no archive holds are a row too, with nothing kept: the paper is cited by its DOI, as every other printed value is (`paper`). */
export interface CatalogueRow { readonly catalogue: string; readonly tsv: string; readonly form: Readonly<Record<string, string>>; readonly cells: Readonly<Record<string, string>>; readonly ra: number; readonly dec: number; readonly words: string;
  /** The columns the position was read from: the table's RAJ2000 and DEJ2000 unless the spec names others. */
  readonly columns: { readonly ra: string; readonly dec: string };
  /** Where the row is held, and how a manifest records it (rowArchive). */
  readonly archive: 'VizieR' | 'SIMBAD' | 'MAST' | 'DOI'; readonly paper?: { readonly url: string }; readonly image?: { readonly url: string; readonly file: string; readonly extension: string; readonly range: SourceRange };
  /** The Julian year of the position, 2000 unless the spec's `motion` says otherwise, and the row's proper motion (mas/yr) when it names the columns. */
  readonly epoch: number; readonly pmra?: number; readonly pmdec?: number }
/** Where a catalogue-placed star's archived row is kept, beside where a Gaia row would be; an exposure's header is kept beside it. */
export const CATALOGUE_ROW_PATH = 'photometry/catalogue-row.tsv', EXPOSURE_HEADER_PATH = 'photometry/exposure-header.txt';
export const SIMBAD_TAP = 'https://simbad.cds.unistra.fr/simbad/sim-tap/sync';
export const catalogueRowUrl = (position: CataloguePosition) => position.archive === 'simbad' ? SIMBAD_TAP : VIZIER_ASU;
/** SIMBAD's own position of an object, with the paper it names for it: ICRS at J2000, as its `basic` table holds it. */
const simbadRowForm = (mainId: string) => ({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'tsv', QUERY: `SELECT main_id, ra, dec, coo_bibcode FROM basic WHERE main_id = '${mainId.replaceAll("'", "''")}'` });
export const catalogueRowForm = (position: CataloguePosition): Record<string, string> => position.archive === 'simbad' ? simbadRowForm(position.row.main_id!) : ({ '-source': position.catalogue, '-out.all': '', '-out.max': '2',
  // VizieR's answer holds a table's default columns; the proper-motion columns and its computed decimal position are asked for by name.
  ...(position.motion || position.columns ? { '-out.add': [...position.columns ? [position.columns.ra, position.columns.dec] : [], ...position.motion ? [position.motion.ra, position.motion.dec] : []].join(',') } : {}), ...position.row });
/** The row `position.row` picks; exactly one, with a decimal J2000 position. */
export function parseCatalogueRow(tsv: string, position: CataloguePosition, where: string): Omit<CatalogueRow, 'tsv' | 'form'> {
  const words = `${position.catalogue} row ${Object.entries(position.row).map(([column, cell]) => `${column} = ${cell}`).join(', ')}`;
  const lines = tsv.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  // A VizieR answer has a units line and a rule under its header; a SIMBAD answer has neither, and quotes its strings.
  const simbad = position.archive === 'simbad', held = simbad ? 'SIMBAD' : 'VizieR', text = (cell: string) => simbad && /^".*"$/u.test(cell) ? cell.slice(1, -1) : cell.trim();
  const header = lines[0]?.split('\t').map(cell => cell.trim()) ?? [], rows = lines.slice(simbad ? 1 : 3).map(line => line.split('\t').map(text));
  if (rows.length !== 1) throw new Error(`${where}: ${held} ${words} matches ${rows.length} rows, not one; ${simbad ? 'main_id is the name as SIMBAD writes it, spaces included' : 'add the columns that tell them apart to position.row'}.`);
  const cells = Object.fromEntries(header.map((column, i) => [column, rows[0]![i] ?? '']));
  for (const [column, cell] of Object.entries(position.row)) if (cells[column] !== cell) throw new Error(`${where}: ${held} ${words}: the row found has ${column} = ${cells[column] ?? '(no such column)'}, not ${cell}.`);
  const degrees = (column: string) => { const value = Number(cells[column]); if (!cells[column] || !Number.isFinite(value)) throw new Error(`${where}: ${held} ${words} has no decimal ${column} (${cells[column] ?? 'no such column'}); the position must be decimal J2000 degrees.`); return value; };
  const motion = (column: string) => { const value = Number(cells[column]); if (!cells[column] || !Number.isFinite(value)) throw new Error(`${where}: VizieR ${words} has no proper motion in ${column} (${cells[column] ?? 'no such column'}).`); return value; };
  const columns = simbad ? { ra: 'ra', dec: 'dec' } : position.columns ?? { ra: 'RAJ2000', dec: 'DEJ2000' };
  return { catalogue: position.catalogue, cells, ra: degrees(columns.ra), dec: degrees(columns.dec), columns, archive: held, words, epoch: position.motion?.epoch ?? 2000,
    ...(position.motion ? { pmra: motion(position.motion.ra), pmdec: motion(position.motion.dec) } : {}) };
}
export const CATALOGUE_ROW_REPLACEMENTS = [{ pattern: '^#.*\\n', flags: 'gm', replacement: '' }, { pattern: '^\\s*\\n', flags: 'gm', replacement: '' }] as const;
const stableVizier = (text: string) => CATALOGUE_ROW_REPLACEMENTS.reduce((out, { pattern, flags, replacement }) => out.replace(new RegExp(pattern, `${flags}u`), replacement), text);
export async function fetchCatalogueRow(archive: Archive, position: CataloguePosition, where: string): Promise<CatalogueRow> {
  if (position.archive === 'mast') return (await import('./images/image-pixel.mts')).fetchImagePixel(archive, position, where);
  if (position.archive === 'paper') {
    const columns = position.columns!, ra = sexagesimal(position.row[columns.ra]!) * 15, dec = sexagesimal(position.row[columns.dec]!);
    if (!(ra >= 0 && ra < 360 && Math.abs(dec) <= 90)) throw new RangeError(`${where}: ${columns.ra} ${position.row[columns.ra]}, ${columns.dec} ${position.row[columns.dec]} is not a place on the sky.`);
    return { catalogue: position.catalogue, tsv: '', form: {}, cells: position.row, ra, dec, columns, archive: 'DOI', paper: { url: position.url }, epoch: 2000,
      words: `${position.catalogue} row ${Object.entries(position.row).map(([column, cell]) => `${column} = ${cell}`).join(', ')}` };
  }
  // The response's dated comment lines and blank lines are dropped so the archived bytes are stable (CATALOGUE_ROW_REPLACEMENTS).
  const form = catalogueRowForm(position), tsv = stableVizier(await archive.text(catalogueRowUrl(position), form));
  return { ...parseCatalogueRow(tsv, position, where), tsv, form };
}

/** Gaia DR3's eclipsing-binary period of a source, in days, when its variability pipeline fitted one (gaiadr3.vari_eclipsing_binary). */
export async function fetchGaiaEclipsingPeriod(archive: Archive, sourceId: string): Promise<number | undefined> {
  const csv = await archive.text(GAIA_TAP, { REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: `SELECT frequency FROM gaiadr3.vari_eclipsing_binary WHERE source_id = ${sourceId}` });
  const value = csv.trim().split(/\r?\n/u)[1]?.trim();
  return value ? 1 / Number(value) : undefined;
}

export interface Identifiers { readonly main: string; readonly gaia?: string; readonly hd?: number; readonly hr?: number; readonly hip?: number }
/** The numbers the archives are searched by, read from SIMBAD's identifier list: HD, HR, HIP and the Gaia DR3 source_id. */
export function readIdentifiers(main: string, identifiers: readonly string[]): Identifiers {
  const out: { main: string; gaia?: string; hd?: number; hr?: number; hip?: number } = { main };
  for (const identifier of identifiers) {
    const id = identifier.replace(/\s+/gu, ' ').trim(), catalogue = /^(HD|HR|HIP) (\d+)$/u.exec(id), gaia = /^Gaia DR3 (\d+)$/u.exec(id);
    if (catalogue) out[catalogue[1]!.toLowerCase() as 'hd' | 'hr' | 'hip'] = Number(catalogue[2]);
    if (gaia) out.gaia = gaia[1]!;
  }
  return out;
}
/** How a star is named and identified: the telescope's SIMBAD resolver, whose answers are pinned as evidence (`@cssearth/telescope/node`, `sky-target.ts`). */
export type Resolver = (name: string) => Promise<{ readonly mainId: string; readonly identifiers: readonly string[] } | undefined>;
export const telescopeResolver = (root: string): Resolver => async name => {
  const { resolveSkyTarget } = await import('@cssearth/telescope/node');
  return (await resolveSkyTarget(root, name))?.target;
};
/** SIMBAD's identifiers for a spec's target or Gaia source; a target and a Gaia id that name different stars are refused. */
export async function identify(resolver: Resolver, target: string | undefined, gaia: string | undefined, id: string): Promise<Identifiers & { readonly gaia: string }> {
  // A catalogue name SIMBAD does not hold (some KIC numbers) is not fatal when the spec also gives the star's Gaia DR3 source.
  // The archive writes a binary's component apart ("K2-288 B"); SIMBAD may hold it joined ("K2-288B").
  const joined = target && /^(.+\S) ([A-C])$/u.exec(target);
  const byTarget = target ? await resolver(target) ?? (joined ? await resolver(`${joined[1]}${joined[2]}`) : undefined) : undefined, name = byTarget || !gaia ? target ?? `Gaia DR3 ${gaia}` : `Gaia DR3 ${gaia}`;
  const found = byTarget ?? await resolver(name);
  // A Gaia source SIMBAD has never catalogued (most distant giants) is still that source: the Gaia row the generator reads
  // next is its identity and its evidence. A target without a Gaia source is refused.
  if (!found && gaia) return { main: `Gaia DR3 ${gaia}`, gaia };
  if (!found) throw new Error(`${id}: SIMBAD does not know ${target ?? name}.`);
  const ids = readIdentifiers(found.mainId, found.identifiers);
  if (gaia && ids.gaia && ids.gaia !== gaia) throw new Error(`${id}: SIMBAD names ${name} Gaia DR3 ${ids.gaia}, not the spec's ${gaia}.`);
  const source = gaia ?? ids.gaia;
  if (!source) throw new Error(`${id}: SIMBAD lists no Gaia DR3 identifier for ${name}; give gaia in the spec.`);
  return { ...ids, gaia: source };
}

/** How a citation names one author: the surname, or a collaboration's whole name ("GRAVITY Collaboration", not "Collaboration"). */
export const isCollaboration = (creator: string) => /\b(collaboration|consortium|team)\b/iu.test(creator);
export const citedName = (creator: string) => isCollaboration(creator) ? creator.trim() : creator.split(' ').at(-1)!;
export interface Publication { readonly id: string; readonly title: string; readonly creators: readonly string[]; readonly year: string; readonly publisher?: string; readonly doi?: string; readonly arxiv?: string; readonly bibcode?: string; readonly wikipedia?: { readonly revision?: string }; readonly url: string; readonly page?: true }
// arXiv's Atom feed and Crossref's JSON both carry HTML entities in titles and journal names ("A&amp;A").
const clean = (value: string) => decodeEntities(value).replace(/\s+/gu, ' ').trim();
/** An arXiv abstract link resolved through the arXiv API. */
export function parseArxivEntry(xml: string, arxiv: string, url: string): Publication {
  const entry = /<entry>([\s\S]*?)<\/entry>/u.exec(xml)?.[1];
  if (!entry) throw new TypeError(`arXiv ${arxiv}: no entry in the API response.`);
  const field = (name: string) => new RegExp(`<(?:[a-z]+:)?${name}[^>]*>([\\s\\S]*?)</(?:[a-z]+:)?${name}>`, 'u').exec(entry)?.[1];
  const title = field('title'), published = field('published');
  if (!title || !published) throw new TypeError(`arXiv ${arxiv}: the entry has no title or date.`);
  const creators = [...entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/gu)].map(m => clean(m[1]!));
  const doi = field('doi'), journal = field('journal_ref');
  return { id: `arxiv-${arxiv.replace(/\./gu, '-')}`, title: clean(title), creators, year: published.slice(0, 4), url,
    ...(journal ? { publisher: clean(journal) } : {}), ...(doi ? { doi: clean(doi) } : {}), arxiv };
}
/** A DOI resolved through Crossref. */
export function parseCrossref(json: string, doi: string, url: string): Publication {
  const message = (JSON.parse(json) as { message?: Record<string, any> }).message;
  if (!message) throw new TypeError(`DOI ${doi}: Crossref returned no record.`);
  const title = requireString(message.title?.[0], `DOI ${doi} title`), year = String(message.issued?.['date-parts']?.[0]?.[0] ?? '');
  const creators = (message.author ?? []).map((a: { given?: string; family?: string }) => clean(`${a.given ?? ''} ${a.family ?? ''}`));
  const container = message['container-title']?.[0], volume = message.volume, page = message.page ?? message['article-number'];
  return { id: `doi-${doi.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/-$/u, '')}`, title: clean(title), creators, year, url, doi,
    ...(container ? { publisher: clean([container, volume, page].filter(Boolean).join(' ')) } : {}) };
}
/** A DOI resolved through DataCite, the registry of the DOIs Crossref does not hold (CDS VizieR catalogues, Zenodo deposits). */
export function parseDatacite(json: string, doi: string, url: string): Publication {
  const attributes = (JSON.parse(json) as { data?: { attributes?: Record<string, any> } }).data?.attributes;
  if (!attributes) throw new TypeError(`DOI ${doi}: DataCite returned no record.`);
  const title = requireString(attributes.titles?.[0]?.title, `DOI ${doi} title`), year = String(attributes.publicationYear ?? '');
  const creators = (attributes.creators ?? []).map((c: { name?: string; givenName?: string; familyName?: string }) => clean(c.familyName ? `${c.givenName ?? ''} ${c.familyName}` : c.name ?? ''));
  const publisher = typeof attributes.publisher === 'string' ? attributes.publisher : attributes.publisher?.name;
  return { id: `doi-${doi.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/-$/u, '')}`, title: clean(title), creators, year, url, doi, ...(publisher ? { publisher: clean(String(publisher)) } : {}) };
}
/** A DOI's publication: Crossref's record, or DataCite's when Crossref does not hold the DOI. */
async function doiPublication(archive: Archive, doi: string, url: string): Promise<Publication> {
  try { return parseCrossref(await archive.text(`https://api.crossref.org/works/${encodeURIComponent(doi)}`), doi, url); }
  catch (error) {
    if (!/\b404\b/u.test((error as Error).message)) throw error;
    return parseDatacite(await archive.text(`https://api.datacite.org/dois/${encodeURIComponent(doi)}`), doi, url);
  }
}
/** Publications already asked of an archive in this run, by URL. A batch cites the same few papers on every star, and arXiv is
 * asked no faster than once in three seconds (PACE_MS): 154 Cepheids citing two arXiv papers each waited six seconds a star for
 * records the first star had read (2026-10-01). A failed read is not kept, so the next star asks again. */
const publicationsRead = new WeakMap<Archive, Map<string, Promise<Publication | undefined>>>();
/** The publication behind a cited URL: an arXiv abstract or a DOI link. Any other URL is cited as a web page by its author. Read
 * once per archive and URL in a run. */
export function fetchPublication(archive: Archive, url: string): Promise<Publication | undefined> {
  let read = publicationsRead.get(archive);
  if (!read) publicationsRead.set(archive, read = new Map());
  let publication = read.get(url);
  if (!publication) {
    read.set(url, publication = readPublication(archive, url));
    publication.catch(() => { read.delete(url); });
  }
  return publication;
}
async function readPublication(archive: Archive, url: string): Promise<Publication | undefined> {
  const arxiv = /arxiv\.org\/abs\/([0-9]{4}\.[0-9]{4,5})/u.exec(url)?.[1];
  if (arxiv) return parseArxivEntry(await archive.text(`https://export.arxiv.org/api/query?id_list=${arxiv}`), arxiv, url);
  const bibcode = /adsabs\.harvard\.edu\/abs\/([^/?#]+)/u.exec(url)?.[1];
  if (bibcode) {
    // An ADS link, as the NASA Exoplanet Archive cites each parameter set. ADS's public link gateway redirects a bibcode to the
    // paper's arXiv page and its DOI, with no API key; the paper is then read as an arXiv or Crossref record, with the bibcode kept.
    const code = decodeURIComponent(bibcode), year = code.slice(0, 4), landing = `https://ui.adsabs.harvard.edu/abs/${code}`;
    const gateway = (type: string) => archive.location?.(`https://ui.adsabs.harvard.edu/link_gateway/${encodeURIComponent(code)}/${type}`).catch(() => undefined);
    const [eprint, published] = await Promise.all([gateway('EPRINT_HTML'), gateway('PUB_HTML')]);
    // A publisher's own address can end in the DOI instead of going through doi.org (iopscience.iop.org/article/10.1086/316343).
    const linkedArxiv = /arxiv\.org\/abs\/([0-9]{4}\.[0-9]{4,5})/u.exec(eprint ?? '')?.[1], linkedDoi = (/doi\.org\/(10\.\S+)$/u.exec(published ?? '') ?? /\/(10\.\d{4,9}\/[^\s?#]+)$/u.exec(published ?? ''))?.[1];
    // The published paper first (Crossref, the better citation, with no request limit), its preprint id kept alongside; the arXiv API
    // (one request every 3 s) only for a paper with no DOI.
    if (linkedDoi) {
      const doi = decodeURIComponent(linkedDoi), paper = await doiPublication(archive, doi, landing);
      // Crossref may list no authors: the archive cites TOI-2447 b to 2024MNRAS.533..109G, a correction whose DOI record has none.
      // The preprint the bibcode links names them.
      const creators = paper.creators.length || !linkedArxiv ? paper.creators : parseArxivEntry(await archive.text(`https://export.arxiv.org/api/query?id_list=${linkedArxiv}`), linkedArxiv, landing).creators;
      return { ...paper, creators, ...(linkedArxiv ? { arxiv: linkedArxiv } : {}), bibcode: code, year };
    }
    // The year is the bibcode's, the published one the archive cites, not the preprint's.
    if (linkedArxiv) return { ...parseArxivEntry(await archive.text(`https://export.arxiv.org/api/query?id_list=${linkedArxiv}`), linkedArxiv, landing), bibcode: code, year };
    return { id: `publication-${code.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')}`, title: `Reference ${code}`, creators: [], year, url: `https://ui.adsabs.harvard.edu/abs/${code}`, bibcode: code };
  }
  const wiki = /^https:\/\/en\.wikipedia\.org\/wiki\/([^#?]+)/u.exec(url)?.[1];
  if (wiki) {
    // A Wikipedia article, quoted by the reader text (prose.mts): a reference page credited to its contributors under CC BY-SA 4.0.
    const title = decodeURIComponent(wiki).replace(/_/gu, ' ');
    return { id: `wikipedia-${title.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')}`, title, creators: ['Wikipedia contributors'], year: '', url, page: true, wikipedia: {} };
  }
  const doi = /doi\.org\/(10\.\S+)$/u.exec(url)?.[1];
  if (doi) return doiPublication(archive, doi, url);
  // Any other page (an archive's documentation, ExoFOP): a reference page named by its address.
  // The query names the record when there is one: SIMBAD's sim-id page is one path for every star.
  const { hostname, pathname, search } = new URL(url), id = `page-${`${hostname}${pathname.replace(/\.(html?|php)$/u, '')}${decodeURIComponent(search)}`.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')}`;
  return { id, title: `${hostname}${pathname}`, creators: [], year: '', url, page: true };
}

/** A sexagesimal angle as printed ("12:21:55.068", "-00:01:22.600") in its own unit; the sign is the text's, so -00 stays negative. */
export function sexagesimal(text: string) {
  const [whole, minutes, seconds] = text.replace(/^[+-]/u, '').split(':').map(Number);
  return (text.startsWith('-') ? -1 : 1) * (whole! + minutes! / 60 + seconds! / 3600);
}
/** How a manifest records the archive a catalogue-placed star's row came from: where it is asked, its credit and terms, the page a
 * reader opens, the request in words, the file it is kept in and the operation that fetches it again. SIMBAD's credit and terms are
 * CDS's own (https://cds.unistra.fr/help/acknowledgement/); MAST's are STScI's (https://archive.stsci.edu/publishing/data-use). */
export interface RowArchive { readonly origin: string; readonly credit: string; readonly license: string; readonly licenseEvidence: readonly string[]; readonly page: string; readonly acquisition: string;
  /** The kept file, the manifest input's name, what the star was placed by, who keeps the archive, and the bytes kept when they are a range of the file. */
  readonly path?: string; readonly input?: string; readonly kept: 'row' | 'pixel'; readonly keeper: string; readonly redistribution: string; readonly range?: SourceRange; readonly operation?: Readonly<Record<string, unknown>> }
/** `selected` is the cells that picked the row: a restore must find them in the answer. */
export function rowArchive(row: Pick<CatalogueRow, 'archive' | 'catalogue' | 'words' | 'cells' | 'columns' | 'form' | 'image' | 'paper'>, selected: readonly string[] = []): RowArchive {
  // A paper's printed coordinates: nothing is kept or fetched again, the paper is cited.
  if (row.paper) return { origin: row.paper.url, credit: '', license: '', licenseEvidence: [], page: row.paper.url, acquisition: '', kept: 'row', keeper: 'as the paper prints them', redistribution: '' };
  if (row.image) {
    const { url, file, extension, range } = row.image;
    return { origin: url, credit: `${file} (Mikulski Archive for Space Telescopes, STScI)`, license: 'Public NASA mission data (MAST)', licenseEvidence: ['https://archive.stsci.edu/publishing/data-use'],
      page: url, path: EXPOSURE_HEADER_PATH, input: 'exposure-header', range, kept: 'pixel', keeper: 'MAST, STScI', redistribution: 'One image header, retained unchanged with its credit.',
      acquisition: `One byte-range request to MAST in source/preparation/acquisition.json: the header of extension ${extension} of ${file} (bytes ${range.offset} to ${range.offset + range.length - 1}), whose world coordinates place the pixel. The image itself is not fetched.`,
      operation: { kind: 'download', groups: ['restore', 'refresh'], path: EXPOSURE_HEADER_PATH, url } };
  }
  const held = { path: CATALOGUE_ROW_PATH, input: 'catalogue-row', kept: 'row' as const, keeper: 'CDS, Strasbourg', redistribution: 'One catalogue row, retained unchanged with its credit.' };
  const operation = (url: string) => ({ kind: 'request-download', groups: ['restore', 'refresh'], path: CATALOGUE_ROW_PATH, url, form: row.form, replacements: CATALOGUE_ROW_REPLACEMENTS, requiredText: [row.columns.ra, ...selected] });
  return row.archive === 'SIMBAD'
    ? { ...held, operation: operation(SIMBAD_TAP), origin: SIMBAD_TAP, credit: 'SIMBAD (CDS; Wenger et al. 2000, A&AS 143, 9)', license: 'CDS SIMBAD database: free use with acknowledgement', licenseEvidence: ['https://cds.unistra.fr/help/acknowledgement/'],
      page: `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(row.cells.main_id ?? '')}`, acquisition: `SIMBAD TAP query in source/preparation/acquisition.json: ${row.words}, its position and the paper SIMBAD names for it.` }
    : { ...held, operation: operation(VIZIER_ASU), origin: VIZIER_ASU, credit: `VizieR ${row.catalogue} (CDS)`, license: 'CDS VizieR catalogue: free use with citation', licenseEvidence: ['https://cds.unistra.fr/vizier-org/licences_vizier.html'],
      page: `https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=${row.catalogue}`, acquisition: `VizieR ASU TSV query in source/preparation/acquisition.json: ${row.words}, every column, with the response's dated comment lines and blank lines removed so the bytes are stable.` };
}
