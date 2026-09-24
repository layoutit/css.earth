/** Every archive the star generator reads, behind one small fetch interface so the tests run offline on fixtures. Each call names
 * the URL it read; a failed request says which archive, which URL and which status. */
import { requireString } from '../../sources/source-values.mts';

export interface Archive {
  /** GET, or POST a form when `form` is given; the response text. */
  text(url: string, form?: Readonly<Record<string, string>>): Promise<string>;
  bytes(url: string): Promise<Buffer>;
  /** Whether a HEAD request answers 200. */
  exists(url: string): Promise<boolean>;
}

/** A dropped connection, before or during the transfer, is retried twice, a second apart; an HTTP error answer is not, so a
 * failed service is reported at once. Every failure names its URL. A request that gives nothing for TRANSFER_TIMEOUT_MS is a
 * dropped connection: the archives answer in seconds, and a hung one would otherwise hold a batch forever. */
export const TRANSFER_TIMEOUT_MS = 120_000;
async function transfer<T>(url: string, read: (response: Response) => Promise<T>, init?: RequestInit): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(TRANSFER_TIMEOUT_MS) });
      if (!response.ok) throw new HttpError(`${url} answered ${response.status} ${response.statusText}${init?.body ? ` for ${String(init.body).slice(0, 200)}` : ''}.`);
      return await read(response);
    } catch (error) {
      if (error instanceof HttpError || attempt === 3) throw error instanceof HttpError ? error : new Error(`${url}: ${(error as Error).message} after ${attempt} attempts.`);
      await new Promise(done => setTimeout(done, 1000 * attempt));
    }
  }
}
class HttpError extends Error {}
export const liveArchive: Archive = {
  text: (url, form) => transfer(url, response => response.text(), form ? { method: 'POST', body: new URLSearchParams(form) } : undefined),
  bytes: url => transfer(url, async response => Buffer.from(await response.arrayBuffer())),
  exists: url => transfer(url, async response => response.status === 200, { method: 'HEAD' }).catch(error => { if (error instanceof HttpError) return false; throw error; }),
};

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
  readonly sourceId: string; readonly ra: number; readonly dec: number; readonly parallax: number; readonly parallaxError: number;
  readonly pmra: number; readonly pmdec: number; readonly radialVelocity?: number; readonly radialVelocityError?: number; readonly ruwe: number;
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
  return { sourceId, ra: number('ra'), dec: number('dec'), parallax: number('parallax'), parallaxError: number('parallax_error'), pmra: number('pmra'), pmdec: number('pmdec'),
    ...(radialVelocity === undefined ? {} : { radialVelocity, ...(radialVelocityError === undefined ? {} : { radialVelocityError }) }),
    ruwe: number('ruwe'), g: number('phot_g_mean_mag'), hasXpSampled: cell('has_xp_sampled') === 'true' || cell('has_xp_sampled') === 'True',
    ...(massFlame ? { massFlame } : {}), ...(radiusFlame ? { radiusFlame } : {}) };
}

export async function fetchGaiaRow(archive: Archive, sourceId: string) {
  const csv = await archive.text(GAIA_TAP, gaiaRowForm(sourceId));
  return { csv, row: parseGaiaRow(csv, sourceId) };
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
/** How a star is named and identified: the telescope's SIMBAD resolver, whose answers are pinned as evidence (sky/target.mts). */
export type Resolver = (name: string) => Promise<{ readonly mainId: string; readonly identifiers: readonly string[] } | undefined>;
export const telescopeResolver = (root: string): Resolver => async name => {
  const { resolveSkyTarget } = await import('../telescopes/sky/target.mts');
  return (await resolveSkyTarget(root, name))?.target;
};
/** SIMBAD's identifiers for a spec's target or Gaia source; a target and a Gaia id that name different stars are refused. */
export async function identify(resolver: Resolver, target: string | undefined, gaia: string | undefined, id: string): Promise<Identifiers & { readonly gaia: string }> {
  const name = target ?? `Gaia DR3 ${gaia}`, found = await resolver(name);
  if (!found) throw new Error(`${id}: SIMBAD does not know ${name}.`);
  const ids = readIdentifiers(found.mainId, found.identifiers);
  if (gaia && ids.gaia && ids.gaia !== gaia) throw new Error(`${id}: SIMBAD names ${name} Gaia DR3 ${ids.gaia}, not the spec's ${gaia}.`);
  const source = gaia ?? ids.gaia;
  if (!source) throw new Error(`${id}: SIMBAD lists no Gaia DR3 identifier for ${name}; give gaia in the spec.`);
  return { ...ids, gaia: source };
}

export interface Publication { readonly id: string; readonly title: string; readonly creators: readonly string[]; readonly year: string; readonly publisher?: string; readonly doi?: string; readonly arxiv?: string; readonly bibcode?: string; readonly wikipedia?: { readonly revision?: string }; readonly url: string; readonly page?: true }
const clean = (value: string) => value.replace(/\s+/gu, ' ').trim();
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
    ...(container ? { publisher: [container, volume, page].filter(Boolean).join(' ') } : {}) };
}
/** The publication behind a cited URL: an arXiv abstract or a DOI link. Any other URL is cited as a web page by its author. */
export async function fetchPublication(archive: Archive, url: string): Promise<Publication | undefined> {
  const arxiv = /arxiv\.org\/abs\/([0-9]{4}\.[0-9]{4,5})/u.exec(url)?.[1];
  if (arxiv) return parseArxivEntry(await archive.text(`https://export.arxiv.org/api/query?id_list=${arxiv}`), arxiv, url);
  const bibcode = /adsabs\.harvard\.edu\/abs\/([^/?#]+)/u.exec(url)?.[1];
  if (bibcode) {
    // An ADS link, as the NASA Exoplanet Archive cites each parameter set: identified by its bibcode, with no lookup.
    const code = decodeURIComponent(bibcode), year = code.slice(0, 4);
    return { id: `publication-${code.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')}`, title: `Reference ${code}`, creators: [], year, url: `https://ui.adsabs.harvard.edu/abs/${code}`, bibcode: code };
  }
  const wiki = /^https:\/\/en\.wikipedia\.org\/wiki\/([^#?]+)/u.exec(url)?.[1];
  if (wiki) {
    // A Wikipedia article, quoted by the reader text (prose.mts): a reference page credited to its contributors under CC BY-SA 4.0.
    const title = decodeURIComponent(wiki).replace(/_/gu, ' ');
    return { id: `wikipedia-${title.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')}`, title, creators: ['Wikipedia contributors'], year: '', url, page: true, wikipedia: {} };
  }
  const doi = /doi\.org\/(10\.\S+)$/u.exec(url)?.[1];
  if (doi) return parseCrossref(await archive.text(`https://api.crossref.org/works/${encodeURIComponent(doi)}`), doi, url);
  // Any other page (an archive's documentation, ExoFOP): a reference page named by its address.
  const { hostname, pathname } = new URL(url), id = `page-${`${hostname}${pathname}`.toLowerCase().replace(/\.(html?|php)$/u, '').replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')}`;
  return { id, title: `${hostname}${pathname}`, creators: [], year: '', url, page: true };
}
