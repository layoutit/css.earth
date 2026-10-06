/** Look up an object's records without writing a script: what its inventory lists, what its source manifest declares,
 * or one value wherever its JSON records, or the bake restored under `prepared/`, keep it.
 * Usage: node packages/bake/cli/lookup/index.mts inventory <id>... [--search=<text>] [--location=public|prepared] [--since=<revision>] [--urls] [--all] [--json]
 *        node packages/bake/cli/lookup/index.mts manifest <id>... [--search=<text>] [--kind=input|generated|document] [--consumer=<name>] [--full] [--all] [--json]
 *        node packages/bake/cli/lookup/index.mts records <id>...|--every [--search=<text>] [--file=<text>] [--full] [--all] [--json]
 *        node packages/bake/cli/lookup/index.mts prepared <id>...|--every [--search=<text>] [--file=<text>] [--full] [--all] [--json]
 *
 * `inventory` prints each file's location, byte count and name, 40 rows unless `--all`; `--urls` adds where each is
 * published, and `--since` compares with the inventory a git revision held (added, removed, changed). `manifest` prints
 * each declared input, generated file and document; `--search` reads every field and `--full` prints the whole entry.
 * `records` reads every JSON file of the package outside `prepared/`: alone it lists the files, and `--search` prints each
 * entry whose path, keys or values contain the text, with the file, the jq path and the entry's values. `prepared` asks
 * the same of the JSON files under `prepared/`. `--file` reads only the files whose path contains its text, and `--every`
 * asks every object package, printing one list of rows led by their object id.
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { formatInventoryLookup, inventoryAssets, inventoryLookup, inventoryLookupOptions } from '@cssearth/bake/delivery';
import { formatManifestLookup, formatRecordLookup, formatRecordSweep, manifestLookup, manifestLookupOptions, recordFileNamed, recordLookup, recordLookupOptions, type RecordFile, type RecordLookup, type RecordLookupOptions } from '@cssearth/bake/sources';
import { INVENTORY_FILE, requireInventory, validateSourceManifest } from '@cssearth/objects/node';

/** Object packages `--every` reads at once. A search of every record (5,549 objects, 74,576 files) took 17.5 s one object at a time and 7.1 s with sixteen. */
const READ_TOGETHER = 16;
const USAGE = 'Usage: pnpm lookup <inventory|manifest|records|prepared> <id>... [--search=<text>] [--all] [--json]';

/** The object's inventory at a git revision; null when that revision held none. */
function inventoryAt(root: string, id: string, revision: string) {
  const path = `src/objects/${id}/${INVENTORY_FILE}`;
  try { execFileSync('git', ['rev-parse', '--verify', '--quiet', `${revision}^{commit}`], { cwd: root, stdio: 'ignore' }); }
  catch { throw new TypeError(`Not a git revision: ${revision}.`); }
  if (!execFileSync('git', ['ls-tree', '--name-only', revision, '--', path], { cwd: root, encoding: 'utf8' }).trim()) return null;
  return requireInventory(id, JSON.parse(execFileSync('git', ['show', `${revision}:${path}`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })));
}

/** The JSON files under one directory of an object package, by their path inside the package. The records are every
 * file outside `prepared/`, which holds the restored bake; the `prepared` view starts there instead. */
async function jsonFiles(directory: string, within: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of (await readdir(resolve(directory, within), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const file = join(within, entry.name);
    if (entry.isDirectory()) { if (file !== 'prepared') files.push(...await jsonFiles(directory, file)); }
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(file);
  }
  return files;
}

/** One object's lookup over its records, or over its restored bake. Only the files `--file` names are read; a file that does not parse is named, not read. */
async function recordsOf(id: string, directory: string, prepared: boolean, options: RecordLookupOptions) {
  const listed = prepared && !existsSync(resolve(directory, 'prepared')) ? [] : await jsonFiles(directory, prepared ? 'prepared' : '');
  const records: RecordFile[] = [], unread: string[] = [];
  for (const file of listed.filter(name => recordFileNamed(name, options.file))) {
    try { records.push({ file, value: JSON.parse(await readFile(resolve(directory, file), 'utf8')) as unknown }); }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; unread.push(file); }
  }
  return recordLookup(id, records, options, unread, listed.length);
}

/** The text one lookup prints, for the checkout at `root`. */
async function lookup(root: string, view: string | undefined, args: readonly string[]) {
  const directory = (id: string) => {
    const path = resolve(root, 'src/objects', id);
    if (!existsSync(path)) throw new TypeError(`No object package src/objects/${id}.`);
    return path;
  };
  if (view === 'inventory') {
    const options = inventoryLookupOptions(args), lookups = [];
    for (const id of options.ids) {
      const located = existsSync(resolve(directory(id), INVENTORY_FILE)) ? await inventoryAssets(root, [id]) : null;
      lookups.push(inventoryLookup(id, located, options, options.since === undefined ? undefined : inventoryAt(root, id, options.since)));
    }
    return options.json ? JSON.stringify(lookups, null, 2) : lookups.map(found => formatInventoryLookup(found, options)).join('\n').trimEnd();
  }
  if (view === 'manifest') {
    const options = manifestLookupOptions(args), lookups = [];
    for (const id of options.ids) {
      const path = resolve(directory(id), 'source/manifest.json');
      if (!existsSync(path)) throw new TypeError(`${id} has no source/manifest.json.`);
      lookups.push(manifestLookup(id, validateSourceManifest(id, JSON.parse(await readFile(path, 'utf8')), { inputs: 'optional' }), options));
    }
    return options.json ? JSON.stringify(lookups, null, 2) : lookups.map(found => formatManifestLookup(found, options)).join('\n').trimEnd();
  }
  if (view === 'records' || view === 'prepared') {
    const options = recordLookupOptions(args), prepared = view === 'prepared', lookups: RecordLookup[] = [];
    const ids = options.every ? (await readdir(resolve(root, 'src/objects'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort() : options.ids;
    for (let at = 0; at < ids.length; at += READ_TOGETHER) lookups.push(...await Promise.all(ids.slice(at, at + READ_TOGETHER).map(id => recordsOf(id, directory(id), prepared, options))));
    if (options.every) return options.json ? JSON.stringify(lookups.filter(found => found.entries.length), null, 2) : formatRecordSweep(lookups, options).trimEnd();
    const text = (found: RecordLookup) => prepared && !found.listed ? `${found.id}: nothing is restored under prepared/; pnpm setup:assets --object=${found.id} restores it\n` : formatRecordLookup(found, options);
    return options.json ? JSON.stringify(lookups, null, 2) : lookups.map(text).join('\n').trimEnd();
  }
  throw new TypeError(USAGE);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [view, ...args] = process.argv.slice(2);
  // A wrong id, flag or revision is the reader's to correct: it gets the one line that says so, not a stack.
  try { console.log(await lookup(checkoutProjectRoot(import.meta.url), view, args)); }
  catch (error) { if (!(error instanceof TypeError)) throw error; console.error(error.message); process.exitCode = 1; }
}
