/** The facts a star's page lists from its own measurements record (source/measurements.json).
 *
 * A star's record holds its temperature, and what the metadata pass added: luminosity, spectral type, age and rotation
 * period, each beside the sentence that says where it is printed. Its page listed only the radius and the distance. This
 * turns each of those values into a fact of the page, cited to the same sentence.
 *
 * A fact names a record of the source catalogue (src/sources). The sentence's own address finds it: the record that holds
 * that address, or, for a value of Gaia DR3, the star's own Gaia record. A value whose sentence leads to no record is left
 * out: nothing is cited to a record that does not hold it. The writer (facts.mts) can first make the records of the papers
 * such sentences name, the way the generator makes a paper's record.
 *
 * The mass is the one the star's body record (packages/astronomy/data/bodies) derives its GM from. It is copied into the
 * measurements record with its sentence, so the fact has evidence inside the star's own package.
 *
 * A rotation period is shown as the star's day only when the catalogued periods the record lists do not contradict it: when
 * the period they would adopt (star-metadata.mts adoptPeriod) lies within PERIOD_AGREEMENT of it, or they adopt none.
 *
 * Nothing is fitted here, and a fact the page already lists is never replaced. */
import { decodeEntities } from '../archives/archives.mts';
import { GM_SUN } from '../hosted.mts';
import { adoptPeriod, PERIOD_AGREEMENT, recordedPeriods } from './star-metadata.mts';

/** What a fact needs of a record of the source catalogue. */
export interface CitedRecord { readonly id: string; readonly label: string; readonly checked: string }
export interface FactSource { readonly catalogueId: string; readonly url: string; readonly label: string; readonly checked: string; readonly path: string; readonly locator: string }
export interface StarFact { readonly id: string; readonly label: string; readonly value: string; readonly source: FactSource }
/** The source catalogue as this pass reads it: its records by each address they hold, and by id. */
export interface SourceIndex { readonly byAddress: Map<string, CitedRecord>; readonly byId: Map<string, CitedRecord>; /** Each record's id by the identities it holds (a DOI, an arXiv number, a bibcode). */ readonly byIdentity: Map<string, string> }

const GAIA_ARCHIVE = 'https://gea.esac.esa.int/archive/', EVIDENCE = 'source/measurements.json';
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
/** One spelling for the forms a paper's address is written in: a bibcode's "&" is often written "%26". */
export const sameAddress = (url: string) => { let plain = url; try { plain = decodeURIComponent(url); } catch { /* An address that is not percent-encoded stands as written. */ }
  return plain.replace(/^http:/u, 'https:').replace(/\/abstract$/u, '').replace(/\/+$/u, ''); };
/** The addresses a sentence prints, in its order. */
export const addressesIn = (sentence: string) => [...sentence.matchAll(/https?:\/\/[^\s)]+/gu)].map(match => match[0].replace(/[.,;]+$/u, ''));

/** Whether an address is a paper's: an ADS abstract, a DOI or an arXiv abstract. */
export const isPaper = (url: string) => /adsabs\.harvard\.edu\/abs\/|doi\.org\/10\.|arxiv\.org\/abs\//u.test(url);
/** The identities a record holds, spelled one way. */
export const identitiesOf = (raw: Readonly<Record<string, unknown>>) => (Array.isArray(raw.identifiers) ? (raw.identifiers as unknown[]).filter(isRecord) : []).map(identifier => `${String(identifier.type).toLowerCase()}:${String(identifier.value).toLowerCase()}`);

/** How a record is named beside a fact: its credit line when that is a citation (it names a year), else its title, cut
 * to the author and year a paper's title begins with. A credit line that is an acknowledgement to print is not a name. */
export function recordLabel(credit: unknown, title: unknown): string {
  const line = typeof credit === 'string' ? credit.replace(/^Cite /u, '').replace(/\.$/u, '') : '', named = typeof title === 'string' ? title : '';
  return /\(\d{4}\)|\b\d{4}\b/u.test(line) ? line : /^(.{1,60}? \(\d{4}\)): /u.exec(named)?.[1] ?? (named || line);
}
/** Add one record of the source catalogue to the index. It was checked on the latest day its evidence was, or, when its
 * evidence names no day, on `today`, the day this pass found it holds the address. Returns the record as a fact cites it,
 * or undefined for a record with no credit line or title. */
export function indexRecord(index: SourceIndex, raw: unknown, today: string): CitedRecord | undefined {
  if (!isRecord(raw) || typeof raw.id !== 'string') return undefined;
  const list = (key: string) => Array.isArray(raw[key]) ? (raw[key] as unknown[]).filter(isRecord) : [];
  for (const identity of identitiesOf(raw)) if (!index.byIdentity.has(identity)) index.byIdentity.set(identity, raw.id);
  const checked = list('evidence').map(entry => entry.checkedOn).filter((day): day is string => typeof day === 'string').sort().at(-1) ?? today;
  const label = recordLabel(list('statements').find(statement => statement.kind === 'credit')?.text, raw.title);
  if (!label) return undefined;
  const record = { id: raw.id, label, checked }, addresses = [...list('links'), ...list('evidence')].map(entry => entry.url).filter((url): url is string => typeof url === 'string');
  for (const identifier of list('identifiers')) { const type = String(identifier.type).toLowerCase(), value = String(identifier.value);
    if (type === 'doi') addresses.push(`https://doi.org/${value}`); else if (type === 'arxiv') addresses.push(`https://arxiv.org/abs/${value}`); else if (type === 'bibliography-key' || type === 'bibcode') addresses.push(`https://ui.adsabs.harvard.edu/abs/${value}`); }
  index.byId.set(record.id, record);
  for (const address of addresses) if (!index.byAddress.has(sameAddress(address))) index.byAddress.set(sameAddress(address), record);
  return record;
}
/** The records of the source catalogue (the parsed files of src/sources) as an index. */
export function sourceIndex(records: readonly unknown[], today: string): SourceIndex {
  const index: SourceIndex = { byAddress: new Map(), byId: new Map(), byIdentity: new Map() };
  for (const raw of records) indexRecord(index, raw, today);
  return index;
}

/** The record a value's sentence leads to, with the address to print: the first of the sentence's addresses a record
 * holds; else, for a value of Gaia DR3, the star's own Gaia record. */
export function citation(starId: string, sentence: string, index: SourceIndex): Omit<FactSource, 'path' | 'locator'> | undefined {
  for (const url of addressesIn(sentence)) { const record = index.byAddress.get(sameAddress(url)); if (record) return { catalogueId: record.id, url, label: record.label, checked: record.checked }; }
  const gaia = sentence.includes('Gaia DR3') ? index.byId.get(`gaia-dr3-${starId}`) : undefined;
  return gaia ? { catalogueId: gaia.id, url: GAIA_ARCHIVE, label: sentence.startsWith('Gaia DR3 FLAME') ? 'Gaia DR3 FLAME' : 'Gaia DR3', checked: gaia.checked } : undefined;
}

/** The mass a star's body record derives its GM from, in solar masses, with the sentence the record gives for it. Undefined
 * when the record words its mass another way. */
export function recordedMass(body: unknown): { readonly massSolar: number; readonly massSource: string } | undefined {
  if (!isRecord(body) || !isRecord(body.physical) || typeof body.physicalNotes !== 'string') return undefined;
  const gm = body.physical.gravitationalParameterKm3PerS2, end = body.physicalNotes.indexOf('; GM is that mass times the JPL solar GM'), start = end < 0 ? -1 : body.physicalNotes.lastIndexOf('Mass ', end);
  if (typeof gm !== 'number' || !(gm > 0) || start < 0) return undefined;
  return { massSolar: Number((gm / GM_SUN).toFixed(4)), massSource: `${body.physicalNotes.slice(start, end)}. The mass this star's body record takes its GM from (packages/astronomy/data/bodies).` };
}

/** A measurements record with `fields` added before `shape`; fields it already holds are kept as they are. */
export function withFields(record: Readonly<Record<string, unknown>>, fields: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const fresh = Object.fromEntries(Object.entries(fields).filter(([key]) => !(key in record))), out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) { if (key === 'shape') Object.assign(out, fresh); out[key] = value; }
  return 'shape' in record ? out : { ...out, ...fresh };
}

const digits = (value: number, significant: number) => value.toLocaleString('en-US', { maximumSignificantDigits: significant });
/** Each fact this pass writes: its id and label, the record's field and its source field, the ids under which a page may
 * already say the same, and the words for the value. */
export const STAR_FACTS = [
  { id: 'mass', label: 'Mass', field: 'massSolar', source: 'massSource', said: ['mass'], words: (value: number | string) => `${digits(Number(value), 3)} solar masses` },
  { id: 'temperature', label: 'Surface temperature', field: 'effectiveTemperatureK', source: 'effectiveTemperatureSource', said: ['temperature', 'surface-temperature', 'photosphere-temperature'], words: (value: number | string) => `${Math.round(Number(value)).toLocaleString('en-US')} K` },
  { id: 'luminosity', label: 'Luminosity', field: 'luminosityLogSolar', source: 'luminositySource', said: ['luminosity'], words: (value: number | string) => `${digits(10 ** Number(value), 2)} times the Sun's` },
  // An archive prints a type's uncertainty as an HTML entity, sometimes without its semicolon.
  { id: 'spectral-type', label: 'Spectral type', field: 'spectralType', source: 'spectralTypeSource', said: ['spectral-type'], words: (value: number | string) => decodeEntities(String(value).replace(/&plusmn;?/gu, '±')) },
  { id: 'age', label: 'Age', field: 'ageGyr', source: 'ageSource', said: ['age'], words: (value: number | string) => Number(value) >= 1 ? `${digits(Number(value), 2)} billion years` : `${digits(Number(value) * 1000, 2)} million years` },
  { id: 'rotation', label: 'Day', field: 'rotationPeriodDays', source: 'rotationPeriodSource', said: ['rotation', 'rotation-period'], words: (value: number | string) => Number(value) >= 100 ? `${Math.round(Number(value)).toLocaleString('en-US')} days` : Number(value) >= 2 ? `${Number(value).toFixed(1)} days` : `${Math.round(Number(value) * 24)} hours` },
] as const;

/** Whether the catalogued periods a record lists leave its rotation period standing. */
export function periodStands(record: Readonly<Record<string, unknown>>): boolean {
  const days = record.rotationPeriodDays, adopted = adoptPeriod(recordedPeriods(record));
  return typeof days === 'number' && (!adopted || Math.abs(adopted.days - days) <= PERIOD_AGREEMENT * days);
}

export interface StarFacts { readonly facts: readonly StarFact[]; /** The fields that hold a value no record of the catalogue could be cited for, each with its sentence. */ readonly uncited: readonly { readonly field: string; readonly sentence: string }[]; /** Whether a rotation period was held back because the catalogued ones contradict it. */ readonly contradicted: boolean }
/** The facts `record` gives a page that already lists the facts `listed` (their ids). */
export function starFacts(starId: string, record: Readonly<Record<string, unknown>>, listed: ReadonlySet<string>, index: SourceIndex): StarFacts {
  const facts: StarFact[] = [], uncited: { field: string; sentence: string }[] = []; let contradicted = false;
  for (const fact of STAR_FACTS) {
    const value = record[fact.field], sentence = record[fact.source];
    if ((typeof value !== 'number' && typeof value !== 'string') || value === '' || typeof sentence !== 'string' || fact.said.some(id => listed.has(id))) continue;
    if (fact.id === 'rotation' && !periodStands(record)) { contradicted = true; continue; }
    const cited = citation(starId, sentence, index);
    if (!cited) { uncited.push({ field: fact.field, sentence }); continue; }
    facts.push({ id: fact.id, label: fact.label, value: fact.words(value), source: { ...cited, path: EVIDENCE, locator: `${fact.field}; ${fact.source}` } });
  }
  return { facts, uncited, contradicted };
}
