/** Leads for the telescope API: what has been published about an object that could be drawn on it, from every DOI
 * repository at once.
 *
 * DataCite registers the DOIs of Zenodo, Dryad, Dataverse, Figshare, university repositories, the CDS (VizieR tables) and
 * MAST, and of every arXiv preprint. One search of its titles and descriptions therefore finds both the data releases and
 * the papers that name an object. A record is kept when it really names the object and speaks of one of three things, in
 * the order a page prefers them (.agents/skills/celestial-skill/references/scientific-faithfulness.md):
 *
 * - `map`: a measured phase curve, eclipse map or longitude map, which `new-object --phase-curve` draws from a paper's fit;
 * - `eclipse`: a measured secondary eclipse or dayside emission, which gives a dayside temperature;
 * - `simulation`: a published model of the object, which `new-object --simulation` draws from a released field.
 *
 * `searchLeads` asks for one object. `surveyLeads` asks for every object of a class, ten a request, and ranks them with
 * what each page opens on today, so the gray ones with a measured map come first. Nothing is downloaded and no lead
 * becomes a dataset here: a lead is read, and its numbers transcribed, by a person. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireRecord } from '@cssearth/core';
import { displayName } from '../papers.mts';
import { loadTargetCatalogue } from '../query.mts';
import { nameForms, namesObject } from './simulations.mts';

export const LEADS_SCHEMA = 'cssearth-telescope-leads@1';
export const DATACITE_DOIS = 'https://api.datacite.org/dois';
/** DataCite's client for arXiv: its records are preprints, with the abstract as their description. */
const ARXIV_CLIENT = 'arxiv.content';
/** Records that can hold data or a model. Text, images and presentations are left to the paper search. */
const DATA_TYPES = 'dataset,model,software,collection,other,workflow,interactive-resource';
const PAGE = 200, PAGES = 20, PACE_MS = 400, REQUEST_TIMEOUT_MS = 60_000, PLANETS_AT_ONCE = 10;
/** DataCite answers a busy moment with 429 or a 5xx: the same request is made again, twice, each after a longer wait. */
const RETRIES = 2, RETRY_MS = 5000;
const USER_AGENT = 'cssEarth-telescope/1.0 (https://css.earth)';

export type LeadClass = 'map' | 'eclipse' | 'simulation';
export const LEAD_CLASSES: readonly LeadClass[] = ['map', 'eclipse', 'simulation'];
const SPEAKS: Readonly<Record<LeadClass, RegExp>> = {
  map: /phase[- ]curves?|phase variations?|eclipse map|brightness map|temperature map|longitudinal|night[- ]?side|heat redistribution|hot ?spot|bare rock|no atmosphere/iu,
  eclipse: /secondary eclipses?|occultations?|day[- ]?side|thermal emission|emission spectr|brightness temperature/iu,
  simulation: /general circulation|atmospheric circulation|\bGCMs?\b|climate model|\b3D (?:model|simulation)s?|model outputs?|\bsimulat\w*/iu,
};
/** What a paper search asks DataCite for, beside the names: the words the three classes are recognised by. */
const PAPER_TERMS = ['phase curve', 'phase curves', 'phase variations', 'eclipse map', 'eclipse mapping', 'secondary eclipse', 'secondary eclipses', 'occultation', 'dayside', 'nightside',
  'thermal emission', 'brightness temperature', 'emission spectrum', 'general circulation model', 'GCM', 'climate model'];

export interface Lead {
  readonly doi: string; readonly url: string; readonly kind: 'paper' | 'data';
  /** Who holds it: "arXiv", "Zenodo", "Harvard Dataverse", "STScI/MAST". */
  readonly publisher: string; readonly year: number | null; readonly title: string; readonly description: string;
  /** The license identifier the record states, or null: most repositories outside Zenodo state none through DataCite. */
  readonly license: string | null;
  /** The best class the title speaks of, else the best the description speaks of; `inTitle` says which. */
  readonly class: LeadClass; readonly inTitle: boolean;
}
export interface LeadSearch { readonly schema: typeof LEADS_SCHEMA; readonly target: { readonly id: string; readonly name: string }; readonly names: readonly string[]; readonly leads: readonly Lead[] }

const phrase = (name: string) => `"${name.replace(/["\\]/gu, ' ')}"`;
const speaks = (text: string): LeadClass | undefined => LEAD_CLASSES.find(candidate => SPEAKS[candidate].test(text));

/** The search for records that name any of `names`: data records in every repository, or arXiv preprints that also speak of
 * a phase curve, an eclipse or a model. */
export function dataciteQuery(names: readonly string[], kind: Lead['kind'], page = 1): string {
  const list = nameForms(names).map(phrase).join(' OR '), named = `titles.title:(${list}) OR descriptions.description:(${list})`, terms = PAPER_TERMS.map(phrase).join(' OR ');
  const query = kind === 'paper' ? `(${named}) AND (titles.title:(${terms}) OR descriptions.description:(${terms}))` : named;
  return `${DATACITE_DOIS}?${new URLSearchParams({ query, ...(kind === 'paper' ? { 'client-id': ARXIV_CLIENT } : { 'resource-type-id': DATA_TYPES }), 'page[size]': String(PAGE), 'page[number]': String(page) })}`;
}

/** One page of DataCite's answer: its records, unclassified, and how many pages the search has. */
export function parseDatacite(value: unknown, kind: Lead['kind']): { readonly records: readonly Omit<Lead, 'class' | 'inTitle'>[]; readonly pages: number } {
  const response = requireRecord(value, 'DataCite response'), meta = requireRecord(response.meta ?? {}, 'DataCite response meta');
  const text = (list: unknown, key: string, label: string) => requireArray(list ?? [], label).map(item => { const part = requireRecord(item, label)[key]; return typeof part === 'string' ? part : ''; });
  const records = requireArray(response.data, 'DataCite response data').map((item, index) => {
    const label = `DataCite record ${index + 1}`, a = requireRecord(requireRecord(item, label).attributes, `${label}.attributes`);
    if (typeof a.doi !== 'string' || !a.doi) throw new TypeError(`${label}.attributes.doi must be a DOI.`);
    const publisher = typeof a.publisher === 'string' ? a.publisher : typeof requireRecord(a.publisher ?? {}, `${label}.publisher`).name === 'string' ? String(requireRecord(a.publisher, `${label}.publisher`).name) : '';
    const rights = text(a.rightsList, 'rightsIdentifier', `${label}.rightsList`).find(Boolean) ?? null, plain = (words: string) => words.replace(/<[^>]*>/gu, ' ').replace(/\s+/gu, ' ').trim();
    return { doi: a.doi.toLowerCase(), url: `https://doi.org/${a.doi}`, kind, publisher: kind === 'paper' ? 'arXiv' : publisher, year: typeof a.publicationYear === 'number' ? a.publicationYear : null,
      title: plain(text(a.titles, 'title', `${label}.titles`).join(' / ')), description: plain(text(a.descriptions, 'description', `${label}.descriptions`).join(' ')), license: rights };
  });
  return { records, pages: typeof meta.totalPages === 'number' ? meta.totalPages : 1 };
}

/** The record as a lead for an object of these names, or undefined when it does not name the object or speaks of none of the
 * three classes. The title decides before the description: a title names what the work is about. */
export function leadFor(record: Omit<Lead, 'class' | 'inTitle'>, names: readonly string[]): Lead | undefined {
  if (!namesObject(record, names)) return undefined;
  const titled = speaks(record.title), described = speaks(record.description), found = titled ?? described;
  return found ? { ...record, class: found, inTitle: titled !== undefined && namesObject({ title: record.title, description: '' }, names) } : undefined;
}

const rank = (lead: Lead) => (lead.inTitle ? 0 : 3) + LEAD_CLASSES.indexOf(lead.class);
/** Leads in the order they are worth reading: named in the title first, then by class, then the newest. One record per title:
 * Zenodo registers a DOI for every version. */
export function rankLeads(leads: readonly Lead[]): Lead[] {
  const titles = new Set<string>();
  return [...leads].sort((a, b) => rank(a) - rank(b) || (b.year ?? 0) - (a.year ?? 0) || a.doi.localeCompare(b.doi))
    .filter(lead => { const key = `${lead.kind} ${lead.title.toLowerCase()}`; if (titles.has(key)) return false; titles.add(key); return true; });
}

type Wait = (ms: number) => Promise<void>;
const pause: Wait = ms => new Promise(done => { setTimeout(done, ms); });

/** Every page of one search, paced; a busy answer is asked for again. */
async function pages(names: readonly string[], kind: Lead['kind'], fetcher: typeof fetch, wait: Wait, asked: { count: number }) {
  const records: Omit<Lead, 'class' | 'inTitle'>[] = [];
  for (let page = 1; page <= PAGES; page++) {
    if (asked.count++) await wait(PACE_MS);
    const url = dataciteQuery(names, kind, page), ask = () => fetcher(url, { redirect: 'follow', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { accept: 'application/vnd.api+json', 'user-agent': USER_AGENT } });
    let response = await ask();
    for (let retry = 1; retry <= RETRIES && (response.status === 429 || response.status >= 500); retry++) { await wait(retry * RETRY_MS); asked.count++; response = await ask(); }
    if (!response.ok) throw new Error(`DataCite returned HTTP ${response.status} for a search of ${names.length} names (${kind}, page ${page}).`);
    const parsed = parseDatacite(await response.json(), kind);
    records.push(...parsed.records);
    if (page >= parsed.pages) break;
  }
  return records;
}

export interface LeadSearchOptions { readonly target: string; readonly directory?: string; readonly progress?: (line: string) => void; readonly fetcher?: typeof fetch; readonly wait?: Wait }

export async function searchLeads(root: string, options: LeadSearchOptions): Promise<LeadSearch> {
  const fetcher = options.fetcher ?? fetch, progress = options.progress ?? (() => undefined), asked = { count: 0 };
  const catalogue = await loadTargetCatalogue(root), target = displayName(options.target, catalogue);
  const names = [target.name, ...catalogue.find(entry => entry.id === target.id)?.aliases ?? []];
  progress(`Searching DataCite for data releases and arXiv papers that name ${target.name}…`);
  const records = [...await pages(names, 'data', fetcher, options.wait ?? pause, asked), ...await pages(names, 'paper', fetcher, options.wait ?? pause, asked)];
  const result: LeadSearch = { schema: LEADS_SCHEMA, target, names: nameForms(names), leads: rankLeads(records.flatMap(record => leadFor(record, names) ?? [])) };
  if (options.directory) { await mkdir(options.directory, { recursive: true }); await writeFile(resolve(options.directory, 'leads.json'), `${JSON.stringify(result, null, 2)}\n`); }
  return result;
}

const HEADINGS: Readonly<Record<LeadClass, string>> = { map: 'Measured phase curve or map', eclipse: 'Measured eclipse or dayside emission', simulation: 'Published simulation' };
const line = (lead: Lead) => `   ${lead.year ?? 'year unknown'} · ${lead.publisher}${lead.kind === 'data' ? ` · license ${lead.license ?? 'not stated to DataCite'}` : ''} · ${lead.title}\n     ${lead.url}`;

export function formatLeads(result: LeadSearch, directory?: string): string {
  const lines = [`${result.target.name} · ${result.leads.length} lead${result.leads.length === 1 ? '' : 's'} in DataCite: data releases in every DOI repository, and arXiv papers`, ''];
  for (const leadClass of LEAD_CLASSES) {
    const found = result.leads.filter(lead => lead.class === leadClass);
    if (!found.length) continue;
    lines.push(`${HEADINGS[leadClass]} (${found.length})`, ...found.map(lead => `${lead.inTitle ? '' : '   (from its description, not its title)\n'}${line(lead)}`), '');
  }
  if (!result.leads.length) lines.push('No record names this object and speaks of a phase curve, an eclipse or a model.', '');
  else lines.push('A lead is read before anything is shown: new-object --phase-curve takes a paper\'s fitted table, new-object --simulation a released field.', '');
  if (directory) lines.push(`Saved: ${resolve(directory, 'leads.json')}`, '');
  return lines.join('\n');
}

/** What an object's page opens on: the science kind of its default dataset ("neutral-shape", "dayside-thermal-color"), with the
 * format of a scientific map ("terrestrial-scientific:published-phase-curve-map"), or "image" for a photographed surface. */
export async function opensOn(root: string, id: string): Promise<string | undefined> {
  const read = async (path: string) => JSON.parse(await readFile(resolve(root, 'src/objects', id, path), 'utf8')) as unknown;
  try {
    const content = requireRecord(await read('source/content/object.json'), `${id} content`), raster = requireRecord(await read('source/preparation/raster.json'), `${id} raster recipe`);
    const chosen = requireRecord(content.datasets ?? {}, `${id} datasets`).defaultDataset;
    const surface = requireArray(raster.surfaces ?? [], `${id} surfaces`).map(entry => requireRecord(entry, `${id} surface`)).find(entry => entry.id === chosen);
    if (!surface) return undefined;
    const science = surface.science === undefined ? undefined : requireRecord(surface.science, `${id} science`);
    return science === undefined ? 'image' : `${String(science.kind)}${typeof science.format === 'string' ? `:${science.format}` : ''}`;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}

/** Kinds that draw no map: the neutral shape, or one color over the whole body. These are the pages a lead can improve. */
const UNIFORM = new Set(['neutral-shape', 'dayside-thermal-color', 'disc-integrated-band-color']);

export interface SurveyRow { readonly id: string; readonly name: string; readonly opensOn: string | undefined; readonly leads: readonly Lead[] }
export interface LeadSurvey { readonly schema: typeof LEADS_SCHEMA; readonly archiveClass: string; readonly objects: number; readonly requests: number; readonly failures: readonly string[]; readonly rows: readonly SurveyRow[] }
export interface LeadSurveyOptions { readonly archiveClass: string; readonly directory?: string; readonly progress?: (line: string) => void; readonly fetcher?: typeof fetch; readonly wait?: Wait }

/** Every object of one class, ten a request. A record is matched against every object, not only the ten it was asked for:
 * one release often names several. Rows are the objects with a lead, the pages without a map first, then by their best lead. */
export async function surveyLeads(root: string, options: LeadSurveyOptions): Promise<LeadSurvey> {
  const fetcher = options.fetcher ?? fetch, progress = options.progress ?? (() => undefined), wait = options.wait ?? pause, asked = { count: 0 }, failures: string[] = [];
  const objects = (await loadTargetCatalogue(root)).filter(entry => entry.archiveClass === options.archiveClass), records = new Map<string, Omit<Lead, 'class' | 'inTitle'>>();
  for (let start = 0; start < objects.length; start += PLANETS_AT_ONCE) {
    const group = objects.slice(start, start + PLANETS_AT_ONCE), names = group.flatMap(entry => [entry.name, ...entry.aliases]);
    for (const kind of ['data', 'paper'] as const) {
      try { for (const record of await pages(names, kind, fetcher, wait, asked)) records.set(`${kind} ${record.doi}`, record); }
      catch (error) { failures.push(`${group.map(entry => entry.id).join(', ')} (${kind}): ${(error as Error).message.split('\n')[0]}`); }
    }
    if (start % (10 * PLANETS_AT_ONCE) === 0) progress(`${Math.min(start + PLANETS_AT_ONCE, objects.length)} of ${objects.length} objects asked, ${records.size} records`);
  }
  const rows: SurveyRow[] = [];
  for (const entry of objects) {
    const names = [entry.name, ...entry.aliases], leads = rankLeads([...records.values()].flatMap(record => leadFor(record, names) ?? []));
    if (leads.length) rows.push({ id: entry.id, name: entry.name, opensOn: await opensOn(root, entry.id), leads });
  }
  const open = (row: SurveyRow) => row.opensOn === undefined || UNIFORM.has(row.opensOn) ? 0 : 1;
  rows.sort((a, b) => open(a) - open(b) || rank(a.leads[0]!) - rank(b.leads[0]!) || a.id.localeCompare(b.id));
  const result: LeadSurvey = { schema: LEADS_SCHEMA, archiveClass: options.archiveClass, objects: objects.length, requests: asked.count, failures, rows };
  if (options.directory) { await mkdir(options.directory, { recursive: true }); await writeFile(resolve(options.directory, 'leads-survey.json'), `${JSON.stringify(result, null, 2)}\n`); }
  return result;
}

export function formatSurvey(result: LeadSurvey, directory?: string): string {
  const open = result.rows.filter(row => row.opensOn === undefined || UNIFORM.has(row.opensOn)), titled = (row: SurveyRow, leadClass: LeadClass) => row.leads[0]!.inTitle && row.leads[0]!.class === leadClass;
  const lines = [`${result.objects} ${result.archiveClass} objects asked in ${result.requests} requests: ${result.rows.length} have a lead, ${open.length} of them on a page that opens on no map`, ''];
  for (const leadClass of LEAD_CLASSES) {
    const found = open.filter(row => titled(row, leadClass));
    if (!found.length) continue;
    lines.push(`${HEADINGS[leadClass]}, named in a title, page without a map (${found.length})`,
      ...found.map(row => `   ${row.name} (${row.opensOn ?? 'no package'}): ${row.leads[0]!.year ?? 'year unknown'} ${row.leads[0]!.title.slice(0, 96)} ${row.leads[0]!.url}`), '');
  }
  const rest = open.filter(row => !row.leads[0]!.inTitle);
  if (rest.length) lines.push(`Named in a description only (${rest.length}): ${rest.map(row => row.name).join(', ')}`, '');
  for (const failure of result.failures) lines.push(`Not asked: ${failure}`);
  if (directory) lines.push(`Saved: ${resolve(directory, 'leads-survey.json')}`, '');
  return lines.join('\n');
}
