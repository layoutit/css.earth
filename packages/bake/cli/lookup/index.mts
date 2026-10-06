/** Look up an object's records without writing a script: what its inventory lists, what its source manifest declares,
 * or one value wherever its JSON records keep it.
 * Usage: node packages/bake/cli/lookup/index.mts inventory <id>... [--search=<text>] [--location=public|prepared] [--since=<revision>] [--urls] [--all] [--json]
 *        node packages/bake/cli/lookup/index.mts manifest <id>... [--search=<text>] [--kind=input|generated|document] [--consumer=<name>] [--full] [--all] [--json]
 *        node packages/bake/cli/lookup/index.mts records <id>... [--search=<text>] [--file=<text>] [--full] [--all] [--json]
 *
 * `inventory` prints each file's location, byte count and name, 40 rows unless `--all`; `--urls` adds where each is
 * published, and `--since` compares with the inventory a git revision held (added, removed, changed). `manifest` prints
 * each declared input, generated file and document; `--search` reads every field and `--full` prints the whole entry.
 * `records` reads every JSON file of the package outside `prepared/`: alone it lists the files, and `--search` prints each
 * entry whose path, keys or values contain the text, with the file, the jq path and the entry's values.
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { formatInventoryLookup, inventoryAssets, inventoryLookup, inventoryLookupOptions } from '@cssearth/bake/delivery';
import { formatManifestLookup, formatRecordLookup, manifestLookup, manifestLookupOptions, recordLookup, recordLookupOptions, type RecordFile } from '@cssearth/bake/sources';
import { INVENTORY_FILE, requireInventory, validateSourceManifest } from '@cssearth/objects/node';

const USAGE = 'Usage: pnpm lookup <inventory|manifest|records> <id>... [--search=<text>] [--all] [--json]';

/** The object's inventory at a git revision; null when that revision held none. */
function inventoryAt(root: string, id: string, revision: string) {
  const path = `src/objects/${id}/${INVENTORY_FILE}`;
  try { execFileSync('git', ['rev-parse', '--verify', '--quiet', `${revision}^{commit}`], { cwd: root, stdio: 'ignore' }); }
  catch { throw new TypeError(`Not a git revision: ${revision}.`); }
  if (!execFileSync('git', ['ls-tree', '--name-only', revision, '--', path], { cwd: root, encoding: 'utf8' }).trim()) return null;
  return requireInventory(id, JSON.parse(execFileSync('git', ['show', `${revision}:${path}`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })));
}

/** Every JSON file of an object package by its path inside the package, parsed; `unread` names those that do not parse.
 * `prepared/` holds restored bakes, not records. */
async function recordFiles(directory: string, within = '', found: { records: RecordFile[]; unread: string[] } = { records: [], unread: [] }) {
  for (const entry of (await readdir(resolve(directory, within), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const file = join(within, entry.name);
    if (entry.isDirectory()) { if (file !== 'prepared') await recordFiles(directory, file, found); continue; }
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try { found.records.push({ file, value: JSON.parse(await readFile(resolve(directory, file), 'utf8')) as unknown }); }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; found.unread.push(file); }
  }
  return found;
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
  if (view === 'records') {
    const options = recordLookupOptions(args), lookups = [];
    for (const id of options.ids) { const { records, unread } = await recordFiles(directory(id)); lookups.push(recordLookup(id, records, options, unread)); }
    return options.json ? JSON.stringify(lookups, null, 2) : lookups.map(found => formatRecordLookup(found, options)).join('\n').trimEnd();
  }
  throw new TypeError(USAGE);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [view, ...args] = process.argv.slice(2);
  // A wrong id, flag or revision is the reader's to correct: it gets the one line that says so, not a stack.
  try { console.log(await lookup(checkoutProjectRoot(import.meta.url), view, args)); }
  catch (error) { if (!(error instanceof TypeError)) throw error; console.error(error.message); process.exitCode = 1; }
}
