/** Simulation survey for the telescope API: which model outputs of an object a paper has released.
 *
 * Zenodo is asked for dataset records that name the object. A record is kept when its title or description really names
 * it and speaks of a simulation or a model, and it is listed with its license, size and files. Nothing is downloaded,
 * and no record becomes a dataset here: the scientific-faithfulness rule on published simulations
 * (.agents/skills/celestial-skill/references/scientific-faithfulness.md) says when one may be shown, and
 * `new-object --simulation` adds one from an entry a person wrote after reading the paper. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { displayName } from '../papers.mts';
import { loadTargetCatalogue } from '../query.mts';

export const SIMULATIONS_SCHEMA = 'cssearth-telescope-simulations@1';
export const ZENODO_RECORDS = 'https://zenodo.org/api/records';
export const MAX_RECORDS = 25;
const REQUEST_TIMEOUT_MS = 20_000;
const USER_AGENT = 'cssEarth-telescope/1.0 (https://css.earth)';
/** Files named in the report before the rest are counted. */
const FILES_LISTED = 3;

export interface ZenodoFile { readonly name: string; readonly bytes: number; readonly url: string }
export interface ZenodoRecord {
  readonly id: string; readonly doi: string; readonly url: string; readonly title: string; readonly description: string; readonly year: number | null;
  readonly creators: readonly string[]; readonly moreCreators: boolean;
  /** The license identifier the record states ("cc-by-4.0"), or null when it states none. */
  readonly license: string | null;
  readonly files: readonly ZenodoFile[]; readonly bytes: number;
}
export interface SimulationSearch {
  readonly schema: typeof SIMULATIONS_SCHEMA; readonly target: { readonly id: string; readonly name: string }; readonly names: readonly string[];
  readonly query: string;
  /** Dataset records that name the object, and those of them that speak of a simulation or model: the ones listed. */
  readonly naming: number; readonly records: readonly (ZenodoRecord & { readonly reuse: ReuseLicense | null })[];
}
export interface ReuseLicense { readonly name: string; readonly url: string }

/** Licenses that allow a derived picture to be made and shown with attribution. A no-derivatives license does not, and an
 * identifier outside this list is not assumed to. cssEarth is non-commercial, so the non-commercial terms can be met. */
const REUSE: Readonly<Record<string, ReuseLicense>> = {
  'cc-by-4.0': { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  'cc-by-sa-4.0': { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  'cc-by-nc-4.0': { name: 'CC BY-NC 4.0', url: 'https://creativecommons.org/licenses/by-nc/4.0/' },
  'cc-by-nc-sa-4.0': { name: 'CC BY-NC-SA 4.0', url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' },
  'cc-zero': { name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  'cc0-1.0': { name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
};
/** The reuse license an identifier names, or null when it names none this tool knows allows reuse. */
export const reuseLicense = (identifier: string | null): ReuseLicense | null => identifier === null ? null : REUSE[identifier.toLowerCase()] ?? null;

const plain = (html: string) => html.replace(/<[^>]*>/gu, ' ').replace(/&nbsp;/gu, ' ').replace(/&amp;/gu, '&').replace(/&quot;/gu, '"').replace(/&#39;|&apos;/gu, "'").replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/\s+/gu, ' ').trim();

export function parseZenodoRecord(value: unknown, label = 'Zenodo record'): ZenodoRecord {
  const record = requireRecord(value, label), metadata = requireRecord(record.metadata, `${label}.metadata`);
  const id = String(record.id ?? ''), title = requireString(metadata.title, `${label}.metadata.title`).replace(/\s+/gu, ' ').trim();
  if (!/^\d+$/u.test(id)) throw new TypeError(`${label}.id must be a record number.`);
  const creators = requireArray(metadata.creators ?? [], `${label}.metadata.creators`).map((creator, index) => requireString(requireRecord(creator, `${label}.metadata.creators[${index}]`).name, `${label}.metadata.creators[${index}].name`));
  const license = metadata.license === undefined || metadata.license === null ? null : requireString(requireRecord(metadata.license, `${label}.metadata.license`).id, `${label}.metadata.license.id`);
  const date = typeof metadata.publication_date === 'string' && /^\d{4}/u.test(metadata.publication_date) ? Number(metadata.publication_date.slice(0, 4)) : null;
  const files = requireArray(record.files ?? [], `${label}.files`).map((entry, index) => {
    const file = requireRecord(entry, `${label}.files[${index}]`), name = requireString(file.key, `${label}.files[${index}].key`), bytes = file.size;
    if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 0) throw new TypeError(`${label}.files[${index}].size must be a whole number of bytes.`);
    return { name, bytes, url: `https://zenodo.org/records/${id}/files/${encodeURIComponent(name)}?download=1` };
  });
  return { id, doi: typeof record.doi === 'string' && record.doi ? record.doi : `10.5281/zenodo.${id}`, url: `https://zenodo.org/records/${id}`, title,
    description: typeof metadata.description === 'string' ? plain(metadata.description) : '', year: date, creators: creators.slice(0, 3), moreCreators: creators.length > 3,
    license, files, bytes: files.reduce((sum, file) => sum + file.bytes, 0) };
}

export function parseZenodoSearch(value: unknown): readonly ZenodoRecord[] {
  const response = requireRecord(value, 'Zenodo response'), hits = requireRecord(response.hits, 'Zenodo response hits');
  return requireArray(hits.hits, 'Zenodo response hits').map((hit, index) => parseZenodoRecord(hit, `Zenodo record ${index + 1}`));
}

const words = (value: string): string => ` ${value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
/** A planet is written with and without a space before its letter ("TRAPPIST-1e", "TRAPPIST-1 e"): both are searched and matched. */
export function nameForms(names: readonly string[]): string[] {
  return [...new Set(names.map(name => name.trim()).filter(Boolean).flatMap(name => {
    const planet = /^(.*[^\s])\s?([b-z])$/u.exec(name);
    return planet && /\d$/u.test(planet[1]!) ? [`${planet[1]}${planet[2]}`, `${planet[1]} ${planet[2]}`] : [name];
  }))];
}
/** Whether the record's title or description names the object by any of its names. A planet is also named by its letter in
 * a list after its host: "TRAPPIST-1b, c and d" names TRAPPIST-1 d. */
export function namesObject(record: Pick<ZenodoRecord, 'title' | 'description'>, names: readonly string[]): boolean {
  const text = words(`${record.title} ${record.description}`);
  return nameForms(names).some(name => text.includes(words(name))) || names.some(name => {
    const planet = /^(.*\d)\s?([b-z])$/u.exec(name.trim());
    if (!planet) return false;
    // words() leaves letters, digits and single spaces, so the host needs no escaping.
    const lists = new RegExp(`${words(planet[1]!).trimEnd()} ?([b-z](?: (?:and |or )?[b-z])+) `, 'gu');
    return [...text.matchAll(lists)].some(list => list[1]!.split(/ (?:and |or )?/u).includes(planet[2]!));
  });
}
const SIMULATION = /\bsimulat\w*|\bGCMs?\b|general circulation|climate model|model outputs?|hydrodynamic\w*|\b3D models?\b|radiative[- ]transfer model/iu;
/** Whether the record speaks of a simulation or a model, in its title or description. */
export const speaksOfSimulation = (record: Pick<ZenodoRecord, 'title' | 'description'>): boolean => SIMULATION.test(`${record.title} ${record.description}`);

/** Zenodo's search takes a query string: any of the names as a phrase, among dataset records. */
export function zenodoQuery(names: readonly string[]): string {
  const phrases = nameForms(names).map(name => `"${name.replace(/["\\]/gu, ' ')}"`);
  return `${ZENODO_RECORDS}?${new URLSearchParams({ q: phrases.join(' OR '), type: 'dataset', size: String(MAX_RECORDS), sort: 'bestmatch' })}`;
}

export interface SimulationSearchOptions { readonly target: string; readonly directory?: string; readonly progress?: (line: string) => void; readonly fetcher?: typeof fetch }

export async function searchSimulations(root: string, options: SimulationSearchOptions): Promise<SimulationSearch> {
  const fetcher = options.fetcher ?? fetch, progress = options.progress ?? (() => undefined);
  const catalogue = await loadTargetCatalogue(root), target = displayName(options.target, catalogue);
  const names = [target.name, ...catalogue.find(entry => entry.id === target.id)?.aliases ?? []], query = zenodoQuery(names);
  progress(`Searching Zenodo for datasets that name ${target.name}…`);
  const response = await fetcher(query, { redirect: 'follow', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { accept: 'application/json', 'user-agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Zenodo returned HTTP ${response.status} for ${query}.`);
  const naming = parseZenodoSearch(await response.json()).filter(record => namesObject(record, names));
  const result: SimulationSearch = { schema: SIMULATIONS_SCHEMA, target, names: nameForms(names), query, naming: naming.length,
    records: naming.filter(speaksOfSimulation).map(record => ({ ...record, reuse: reuseLicense(record.license) })) };
  if (options.directory) { await mkdir(options.directory, { recursive: true }); await writeFile(resolve(options.directory, 'simulations.json'), `${JSON.stringify(result, null, 2)}\n`); }
  return result;
}

/** Bytes as a reader says them: 53.4 MB, 18.5 GB. */
export const sizeText = (bytes: number): string => bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : bytes >= 1e3 ? `${(bytes / 1e3).toFixed(1)} kB` : `${bytes} bytes`;

export function formatSimulations(result: SimulationSearch, directory?: string): string {
  const lines = [`${result.target.name} · ${result.records.length} simulation record${result.records.length === 1 ? '' : 's'} among ${result.naming} Zenodo dataset${result.naming === 1 ? '' : 's'} that name it`, ''];
  for (const [index, record] of result.records.entries()) {
    const listed = record.files.slice(0, FILES_LISTED).map(file => `${file.name} (${sizeText(file.bytes)})`).join(', '), more = record.files.length - FILES_LISTED;
    lines.push(`${index + 1}. ${record.title} (${record.year ?? 'year unknown'})`, `   ${record.creators.join('; ')}${record.moreCreators ? ' et al.' : ''}`,
      `   DOI: ${record.doi} · license: ${record.reuse ? `${record.reuse.name}, reuse allowed` : record.license ? `${record.license}, not one this tool knows allows reuse` : 'none stated'}`,
      `   ${record.files.length} file${record.files.length === 1 ? '' : 's'}, ${sizeText(record.bytes)}: ${listed}${more > 0 ? ` and ${more} more` : ''}`, `   ${record.url}`);
  }
  if (!result.records.length) lines.push('No Zenodo dataset names this object and speaks of a simulation or a model.');
  else lines.push('', 'A listed record is a lead, not a dataset: read its paper, then write a new-object --simulation entry.');
  if (directory) lines.push('', `Saved: ${resolve(directory, 'simulations.json')}`);
  return `${lines.join('\n')}\n`;
}
