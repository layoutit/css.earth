/** What the JSON records beside an object hold, read without writing a script: one value, wherever it is kept. Each
 * file is read as its entries, an entry being an object or list that holds values of its own, and a search text selects
 * the entries whose path, keys or values contain it, so a label finds the value stored beside it.
 * `packages/bake/cli/lookup/index.mts records` is the command; it reads every JSON file of the package outside `prepared/`. */
import { parseArgs } from 'node:util';
import { lookupObjectIds, lookupRows } from '../delivery/index.ts';

export type RecordScalar = string | number | boolean | null;
/** A value an entry holds itself: a scalar, or a list of nothing but scalars (a vector, a row of numbers). */
export type RecordValue = RecordScalar | readonly RecordScalar[];
/** One parsed JSON file, named by its path inside the object package. */
export interface RecordFile { file: string; value: unknown }
/** `path` is a jq path into the file, so `jq '<path>' <file>` prints the entry whole. */
export interface RecordEntry { file: string; path: string; fields: Readonly<Record<string, RecordValue>> }
export interface RecordLookupOptions { ids: readonly string[]; search?: string; file?: string; full: boolean; all: boolean; json: boolean }
/** `unread` names the `.json` files that do not parse (a Python writer's `NaN`, say); the lookup reads the others. */
export interface RecordLookup { id: string; total: number; files: readonly { file: string; entries: number }[]; entries: readonly RecordEntry[]; unread: readonly string[] }

export function recordLookupOptions(args: readonly string[]): RecordLookupOptions {
  const { values, positionals } = parseArgs({ args: [...args], strict: true, allowPositionals: true, options: {
    search: { type: 'string' }, file: { type: 'string' },
    full: { type: 'boolean', default: false }, all: { type: 'boolean', default: false }, json: { type: 'boolean', default: false },
  } });
  return { ids: lookupObjectIds(positionals), search: values.search, file: values.file, full: values.full, all: values.all, json: values.json };
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

/** The entries a lookup selects. `file` keeps the files whose path contains it; the search reads an entry's path, keys
 * and values. `files` counts every file read, so a lookup with neither says where the object's records are. */
export function recordLookup(id: string, records: readonly RecordFile[], { search, file }: Pick<RecordLookupOptions, 'search' | 'file'>, unread: readonly string[] = []): RecordLookup {
  const text = search?.toLocaleLowerCase('en'), named = file?.toLocaleLowerCase('en');
  const read = records.map(record => ({ file: record.file, entries: [...entriesOf(record.file, record.value, '')] }));
  const entries = read.filter(record => named === undefined || record.file.toLocaleLowerCase('en').includes(named)).flatMap(record => record.entries)
    .filter(entry => !text || `${entry.path} ${JSON.stringify(entry.fields)}`.toLocaleLowerCase('en').includes(text));
  return { id, total: read.reduce((sum, record) => sum + record.entries.length, 0), files: read.map(record => ({ file: record.file, entries: record.entries.length })), entries, unread };
}

/** A value is cut to the first length and an entry's values together to the second; `--full` prints them whole. */
const VALUE_LENGTH = 80, ROW_LENGTH = 200;
const count = (value: number) => value.toLocaleString('en');

export function formatRecordLookup(lookup: RecordLookup, options: Pick<RecordLookupOptions, 'search' | 'file' | 'full' | 'all'>) {
  const unread = lookup.unread.length ? [`not JSON, so not read: ${lookup.unread.join(', ')}`] : [];
  if (options.search === undefined && options.file === undefined) {
    const width = Math.max(0, ...lookup.files.map(record => count(record.entries).length));
    return [`${lookup.id}: ${count(lookup.total)} entries in ${count(lookup.files.length)} JSON files`,
      ...lookupRows(lookup.files.map(record => `${count(record.entries).padStart(width)}  ${record.file}`), options.all), ...unread].join('\n') + '\n';
  }
  const scope = [options.file === undefined ? undefined : `in files named "${options.file}"`, options.search === undefined ? undefined : `matching "${options.search}"`]
    .filter(part => part !== undefined).join(', ');
  const cut = (text: string, length: number) => text.length > length ? `${text.slice(0, length)}…` : text;
  // The values that hold the searched text come first, so the cut never hides what was asked for.
  const text = options.search?.toLocaleLowerCase('en'), asked = ([key, value]: [string, RecordValue]) => text !== undefined && `${key} ${JSON.stringify(value)}`.toLocaleLowerCase('en').includes(text);
  const values = (entry: RecordEntry) => { const fields = Object.entries(entry.fields); return [...fields.filter(asked), ...fields.filter(field => !asked(field))]; };
  const row = (entry: RecordEntry) => options.full ? `${entry.file}  ${entry.path}\n${JSON.stringify(entry.fields, null, 2).replace(/^/gmu, '  ')}`
    : `${entry.file}  ${entry.path}  ${cut(values(entry).map(([key, value]) => `${key}: ${cut(JSON.stringify(value), VALUE_LENGTH)}`).join(', '), ROW_LENGTH)}`;
  return [`${lookup.id}: ${count(lookup.entries.length)} of ${count(lookup.total)} entries (${scope}) in ${count(new Set(lookup.entries.map(entry => entry.file)).size)} of ${count(lookup.files.length)} JSON files`,
    ...lookupRows(lookup.entries.map(row), options.all), ...unread].join('\n') + '\n';
}
