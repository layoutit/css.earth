/** What the JSON records beside an object hold, read without writing a script: one value, wherever it is kept. Each
 * file is read as its entries, an entry being an object or list that holds values of its own, and a search text selects
 * the entries whose path, keys or values contain it, so a label finds the value stored beside it.
 * `packages/bake/cli/lookup/index.mts` is the command: `records` reads every JSON file of the package outside `prepared/`,
 * `prepared` the restored bake under it, `--every` asks every object package at once, and `--by` counts the selected
 * entries by the value one of their keys holds. */
import { parseArgs } from 'node:util';
import { lookupObjectIds, lookupRows } from '../delivery/index.ts';

export type RecordScalar = string | number | boolean | null;
/** A value an entry holds itself: a scalar, or a list of nothing but scalars (a vector, a row of numbers). */
export type RecordValue = RecordScalar | readonly RecordScalar[];
/** One parsed JSON file, named by its path inside the object package. */
export interface RecordFile { file: string; value: unknown }
/** `path` is a jq path into the file, so `jq '<path>' <file>` prints the entry whole. */
export interface RecordEntry { file: string; path: string; fields: Readonly<Record<string, RecordValue>> }
/** `every` asks every object package, so it names no ids. `by` names a key: only the entries that hold it are selected,
 * and they are counted by its value in place of being listed. */
export interface RecordLookupOptions { ids: readonly string[]; every: boolean; search?: string; file?: string; by?: string; full: boolean; all: boolean; json: boolean }
/** `files` counts the entries of each file read and `listed` the JSON files the package holds: a caller that knows the
 * file asked for reads only that one. `unread` names the files that do not parse (a Python writer's `NaN`, say). */
export interface RecordLookup { id: string; total: number; listed: number; files: readonly { file: string; entries: number }[]; entries: readonly RecordEntry[]; unread: readonly string[] }

export function recordLookupOptions(args: readonly string[]): RecordLookupOptions {
  const { values, positionals } = parseArgs({ args: [...args], strict: true, allowPositionals: true, options: {
    search: { type: 'string' }, file: { type: 'string' }, by: { type: 'string' }, every: { type: 'boolean', default: false },
    full: { type: 'boolean', default: false }, all: { type: 'boolean', default: false }, json: { type: 'boolean', default: false },
  } });
  if (values.every && positionals.length) throw new TypeError('Name object ids or pass --every, not both.');
  if (values.every && values.search === undefined && values.file === undefined && values.by === undefined) throw new TypeError('--every needs --search, --file or --by.');
  if (values.by !== undefined && !values.by) throw new TypeError('--by takes a key.');
  return { ids: values.every ? [] : lookupObjectIds(positionals), every: values.every, search: values.search, file: values.file, by: values.by, full: values.full, all: values.all, json: values.json };
}

const isScalar = (value: unknown): value is RecordScalar => value === null || typeof value !== 'object';
const isValue = (value: unknown): value is RecordValue => isScalar(value) || Array.isArray(value) && value.every(isScalar);

/** The entries of one JSON value, in document order. A list of objects holds no value of its own, so only its items are entries. */
function* entriesOf(file: string, value: unknown, path: string): Generator<RecordEntry> {
  if (isValue(value)) { if (!path) yield { file, path: '.', fields: { '.': value } }; return; }
  const children: [key: string, path: string, child: unknown][] = Array.isArray(value) ? value.map((child, index) => [`[${index}]`, `${path || '.'}[${index}]`, child])
    : Object.entries(value as object).map(([key, child]) => [key, /^[A-Za-z_]\w*$/u.test(key) ? `${path}.${key}` : `${path || '.'}[${JSON.stringify(key)}]`, child]);
  const fields = Object.fromEntries(children.flatMap(([key, , child]) => isValue(child) ? [[key, child]] : []));
  if (Object.keys(fields).length) yield { file, path: path || '.', fields };
  for (const [, childPath, child] of children) if (!isValue(child)) yield* entriesOf(file, child, childPath);
}

/** A value as a row prints it, which is also what a search reads: `classification: "planet"` finds that pair. */
const pair = ([key, value]: [string, RecordValue]) => `${key}: ${JSON.stringify(value)}`;

/** Whether `--file` names this file: any part of its path, whatever the case. */
export const recordFileNamed = (file: string, named: string | undefined) => named === undefined || file.toLocaleLowerCase('en').includes(named.toLocaleLowerCase('en'));

/** The entries a lookup selects. `file` keeps the files whose path contains it; the search reads an entry's path, keys
 * and values; `by` keeps the entries that hold that key. `files` counts every file read, so a lookup with neither says where the object's records are. */
export function recordLookup(id: string, records: readonly RecordFile[], { search, file, by }: Pick<RecordLookupOptions, 'search' | 'file' | 'by'>,
  unread: readonly string[] = [], listed = records.length + unread.length): RecordLookup {
  const text = search?.toLocaleLowerCase('en'), files: { file: string; entries: number }[] = [], entries: RecordEntry[] = [];
  // Entries are counted as they are read and only the selected ones kept: a search of every object's restored bake peaked
  // at 833 MB this way, and at 1,011 MB while each file's entries were held.
  for (const record of records) {
    const named = recordFileNamed(record.file, file);
    let held = 0;
    for (const entry of entriesOf(record.file, record.value, '')) {
      held++;
      if (named && (by === undefined || Object.hasOwn(entry.fields, by)) && (!text || `${entry.path} ${Object.entries(entry.fields).map(pair).join(', ')}`.toLocaleLowerCase('en').includes(text))) entries.push(entry);
    }
    files.push({ file: record.file, entries: held });
  }
  return { id, total: files.reduce((sum, record) => sum + record.entries, 0), listed, files, entries, unread };
}

/** A value is cut to the first length and an entry's values together to the second; `--full` prints them whole. */
const VALUE_LENGTH = 80, ROW_LENGTH = 200;
const count = (value: number) => value.toLocaleString('en');

type RecordFormatOptions = Pick<RecordLookupOptions, 'search' | 'file' | 'by' | 'full' | 'all'>;
const scopeOf = (options: RecordFormatOptions) => [options.file === undefined ? undefined : `in files named "${options.file}"`, options.search === undefined ? undefined : `matching "${options.search}"`]
  .filter(part => part !== undefined).join(', ');
/** One entry's line: its file, its jq path and its values. The values that hold the searched text come first, so the cut never hides what was asked for. */
function entryRow(entry: RecordEntry, options: RecordFormatOptions) {
  if (options.full) return `${entry.file}  ${entry.path}\n${JSON.stringify(entry.fields, null, 2).replace(/^/gmu, '  ')}`;
  const cut = (text: string, length: number) => text.length > length ? `${text.slice(0, length)}…` : text;
  const text = options.search?.toLocaleLowerCase('en'), asked = (field: [string, RecordValue]) => text !== undefined && pair(field).toLocaleLowerCase('en').includes(text);
  const fields = Object.entries(entry.fields), values = [...fields.filter(asked), ...fields.filter(field => !asked(field))];
  return `${entry.file}  ${entry.path}  ${cut(values.map(([key, value]) => `${key}: ${cut(JSON.stringify(value), VALUE_LENGTH)}`).join(', '), ROW_LENGTH)}`;
}

/** How many of the entries hold each value of one key, the most frequent first. */
export function recordTally(entries: readonly RecordEntry[], key: string): { value: RecordValue; entries: number }[] {
  const tally = new Map<string, { value: RecordValue; entries: number }>();
  for (const entry of entries) {
    if (!Object.hasOwn(entry.fields, key)) continue;
    const value = entry.fields[key], text = JSON.stringify(value), counted = tally.get(text);
    if (counted) counted.entries++; else tally.set(text, { value, entries: 1 });
  }
  return [...tally.values()].sort((a, b) => b.entries - a.entries || JSON.stringify(a.value).localeCompare(JSON.stringify(b.value), 'en'));
}
function tallyRows(entries: readonly RecordEntry[], key: string) {
  const tally = recordTally(entries, key), width = Math.max(0, ...tally.map(counted => count(counted.entries).length));
  return tally.map(counted => { const text = JSON.stringify(counted.value); return `${count(counted.entries).padStart(width)}  ${text.length > VALUE_LENGTH ? `${text.slice(0, VALUE_LENGTH)}…` : text}`; });
}

export function formatRecordLookup(lookup: RecordLookup, options: RecordFormatOptions) {
  const unread = lookup.unread.length ? [`not JSON, so not read: ${lookup.unread.join(', ')}`] : [], scope = scopeOf(options);
  const within = `in ${count(new Set(lookup.entries.map(entry => entry.file)).size)} of ${count(lookup.listed)} JSON files`;
  if (options.by !== undefined) return [`${lookup.id}: ${count(lookup.entries.length)} of ${count(lookup.total)} entries hold ${options.by}${scope ? ` (${scope})` : ''} ${within}`,
    ...lookupRows(tallyRows(lookup.entries, options.by), options.all), ...unread].join('\n') + '\n';
  if (options.search === undefined && options.file === undefined) {
    const width = Math.max(0, ...lookup.files.map(record => count(record.entries).length));
    return [`${lookup.id}: ${count(lookup.total)} entries in ${count(lookup.listed)} JSON files`,
      ...lookupRows(lookup.files.map(record => `${count(record.entries).padStart(width)}  ${record.file}`), options.all), ...unread].join('\n') + '\n';
  }
  return [`${lookup.id}: ${count(lookup.entries.length)} of ${count(lookup.total)} entries (${scope}) ${within}`,
    ...lookupRows(lookup.entries.map(entry => entryRow(entry, options)), options.all), ...unread].join('\n') + '\n';
}

/** Every object's selected entries as one list, each row led by its object id, or with `by` one count over them all: what `--every` prints. */
export function formatRecordSweep(lookups: readonly RecordLookup[], options: RecordFormatOptions) {
  const holding = lookups.filter(lookup => lookup.entries.length), selected = holding.reduce((sum, lookup) => sum + lookup.entries.length, 0), scope = scopeOf(options);
  const rows = options.by !== undefined ? tallyRows(holding.flatMap(lookup => lookup.entries), options.by) : holding.flatMap(lookup => lookup.entries.map(entry => `${lookup.id}  ${entryRow(entry, options)}`));
  const unread = lookups.flatMap(lookup => lookup.unread.map(file => `${lookup.id}/${file}`));
  return [`${count(holding.length)} of ${count(lookups.length)} objects hold ${count(selected)} entries${options.by === undefined ? '' : ` with ${options.by}`}${scope ? ` (${scope})` : ''}; ${count(lookups.reduce((sum, lookup) => sum + lookup.files.length, 0))} JSON files read`,
    ...lookupRows(rows, options.all), ...(unread.length ? [`not JSON, so not read: ${unread.join(', ')}`] : [])].join('\n') + '\n';
}
