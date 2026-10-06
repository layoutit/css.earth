/** Look up an object's records without writing a script: what its inventory lists, or what its source manifest declares.
 * Usage: node packages/bake/cli/lookup/index.mts inventory <id>... [--search=<text>] [--location=public|prepared] [--since=<revision>] [--urls] [--all] [--json]
 *        node packages/bake/cli/lookup/index.mts manifest <id>... [--search=<text>] [--kind=input|generated|document] [--consumer=<name>] [--full] [--all] [--json]
 *
 * `inventory` prints each file's location, byte count and name, 40 rows unless `--all`; `--urls` adds where each is
 * published, and `--since` compares with the inventory a git revision held (added, removed, changed). `manifest` prints
 * each declared input, generated file and document; `--search` reads every field and `--full` prints the whole entry.
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { formatInventoryLookup, inventoryAssets, inventoryLookup, inventoryLookupOptions } from '@cssearth/bake/delivery';
import { formatManifestLookup, manifestLookup, manifestLookupOptions } from '@cssearth/bake/sources';
import { INVENTORY_FILE, requireInventory, validateSourceManifest } from '@cssearth/objects/node';

const USAGE = 'Usage: pnpm lookup <inventory|manifest> <id>... [--search=<text>] [--all] [--json]';

/** The object's inventory at a git revision; null when that revision held none. */
function inventoryAt(root: string, id: string, revision: string) {
  const path = `src/objects/${id}/${INVENTORY_FILE}`;
  try { execFileSync('git', ['rev-parse', '--verify', '--quiet', `${revision}^{commit}`], { cwd: root, stdio: 'ignore' }); }
  catch { throw new TypeError(`Not a git revision: ${revision}.`); }
  if (!execFileSync('git', ['ls-tree', '--name-only', revision, '--', path], { cwd: root, encoding: 'utf8' }).trim()) return null;
  return requireInventory(id, JSON.parse(execFileSync('git', ['show', `${revision}:${path}`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })));
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
  throw new TypeError(USAGE);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [view, ...args] = process.argv.slice(2);
  // A wrong id, flag or revision is the reader's to correct: it gets the one line that says so, not a stack.
  try { console.log(await lookup(checkoutProjectRoot(import.meta.url), view, args)); }
  catch (error) { if (!(error instanceof TypeError)) throw error; console.error(error.message); process.exitCode = 1; }
}
