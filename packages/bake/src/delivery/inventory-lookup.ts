/** What an object's inventory lists, read without writing a script: its files with their byte counts and where each is
 * published, narrowed by a search text or a location, or compared with the inventory another git revision held.
 * `packages/bake/cli/lookup/index.mts inventory` is the command. It reads the inventory; `verifyInventory` checks the files. */
import { parseArgs } from 'node:util';
import { ASSET_LOCATIONS, INVENTORY_FILE, type AssetLocation, type Inventory, type InventoryAsset } from '@cssearth/objects/node';
import type { RuntimeAssetLocation } from './runtime-assets.ts';

export interface InventoryLookupOptions { ids: readonly string[]; search?: string; location?: AssetLocation; since?: string; urls: boolean; all: boolean; json: boolean }
export interface InventoryLookup { id: string; inventoried: boolean; total: number; bytes: number; files: readonly RuntimeAssetLocation[];
  since?: { added: readonly RuntimeAssetLocation[]; removed: readonly InventoryAsset[]; changed: readonly (RuntimeAssetLocation & { bytesBefore: number })[]; unchanged: number } }

/** Rows a lookup prints before it says how many it left out; `--all` lifts it. */
export const LOOKUP_ROWS = 40;
/** The object ids a lookup names: at least one, each an object package's directory name. */
export function lookupObjectIds(positionals: readonly string[]): string[] {
  if (!positionals.length) throw new TypeError('Name at least one object id.');
  const unsafe = positionals.find(id => !/^[a-z][a-z0-9-]*$/u.test(id));
  if (unsafe !== undefined) throw new TypeError(`Not an object id: ${unsafe}.`);
  return [...new Set(positionals)];
}
export function lookupRows(rows: readonly string[], all: boolean): string[] {
  return all || rows.length <= LOOKUP_ROWS ? [...rows] : [...rows.slice(0, LOOKUP_ROWS), `… ${rows.length - LOOKUP_ROWS} more; narrow with --search or pass --all`];
}

export function inventoryLookupOptions(args: readonly string[]): InventoryLookupOptions {
  const { values, positionals } = parseArgs({ args: [...args], strict: true, allowPositionals: true, options: {
    search: { type: 'string' }, location: { type: 'string' }, since: { type: 'string' },
    urls: { type: 'boolean', default: false }, all: { type: 'boolean', default: false }, json: { type: 'boolean', default: false },
  } });
  const location = ASSET_LOCATIONS.find(name => name === values.location);
  if (values.location !== undefined && !location) throw new TypeError(`Choose a location from ${ASSET_LOCATIONS.join(', ')}.`);
  if (values.since !== undefined && !values.since.trim()) throw new TypeError('--since takes a git revision.');
  return { ids: lookupObjectIds(positionals), search: values.search, location, since: values.since, urls: values.urls, all: values.all, json: values.json };
}

const key = (asset: InventoryAsset) => `${asset.location}/${asset.filename}`;
const byteSum = (assets: readonly InventoryAsset[]) => assets.reduce((sum, asset) => sum + asset.bytes, 0);

/** The inventoried files a lookup selects. `located` is null for an object without an inventory. With `before`, the
 * inventory another revision held (null when it held none), the selection is also split into what was added, removed
 * and changed since: a file changed when its content address did. */
export function inventoryLookup(id: string, located: readonly RuntimeAssetLocation[] | null,
  { search, location }: Pick<InventoryLookupOptions, 'search' | 'location'>, before?: Readonly<Inventory> | null): InventoryLookup {
  const text = search?.toLocaleLowerCase('en');
  const selects = (asset: InventoryAsset) => (!location || asset.location === location) && (!text || asset.filename.toLocaleLowerCase('en').includes(text));
  const files = (located ?? []).filter(selects);
  const lookup = { id, inventoried: located !== null, total: located?.length ?? 0, bytes: byteSum(files), files };
  if (before === undefined) return lookup;
  const earlier = new Map((before?.assets ?? []).filter(selects).map(asset => [key(asset), asset])), current = new Set(files.map(key));
  const added = files.filter(asset => !earlier.has(key(asset)));
  const changed = files.flatMap(asset => { const was = earlier.get(key(asset)); return was && was.sha256 !== asset.sha256 ? [{ ...asset, bytesBefore: was.bytes }] : []; });
  return { ...lookup, since: { added, removed: [...earlier.values()].filter(asset => !current.has(key(asset))), changed, unchanged: files.length - added.length - changed.length } };
}

const count = (value: number) => value.toLocaleString('en');
const signed = (value: number) => `${value < 0 ? '-' : value > 0 ? '+' : ''}${count(Math.abs(value))}`;

export function formatInventoryLookup(lookup: InventoryLookup, options: Pick<InventoryLookupOptions, 'search' | 'location' | 'since' | 'urls' | 'all'>) {
  if (!lookup.inventoried && !lookup.since) return `${lookup.id}: no ${INVENTORY_FILE}; nothing baked is published for it\n`;
  const scope = [options.location, options.search === undefined ? undefined : `matching "${options.search}"`].filter(part => part !== undefined).join(', ');
  const row = (mark: string, asset: InventoryAsset & { url?: string }, size = count(asset.bytes), width = 11) =>
    `${mark}${asset.location.padEnd(9)} ${size.padStart(width)}  ${asset.filename}${options.urls && asset.url ? `\n    ${asset.url}` : ''}`;
  if (lookup.since) {
    const { added, removed, changed, unchanged } = lookup.since;
    const delta = changed.reduce((sum, asset) => sum + asset.bytes - asset.bytesBefore, 0);
    const sizes = changed.map(asset => `${count(asset.bytesBefore)} → ${count(asset.bytes)}`), width = Math.max(11, ...sizes.map(size => size.length));
    return [`${lookup.id} since ${options.since}${scope ? ` (${scope})` : ''}: ${added.length} added (${signed(byteSum(added))} bytes), ${removed.length} removed (${signed(-byteSum(removed))} bytes), ${changed.length} changed (${signed(delta)} bytes), ${unchanged} unchanged`,
      ...lookupRows([...added.map(asset => row('+ ', asset, count(asset.bytes), width)), ...removed.map(asset => row('- ', asset, count(asset.bytes), width)),
        ...changed.map((asset, index) => row('~ ', asset, sizes[index], width))], options.all)].join('\n') + '\n';
  }
  const places = ASSET_LOCATIONS.map(place => `${place} ${lookup.files.filter(asset => asset.location === place).length}`).join(', ');
  return [`${lookup.id}: ${scope ? `${lookup.files.length} of ${lookup.total} files (${scope})` : `${lookup.total} files`}, ${count(lookup.bytes)} bytes${scope ? '' : ` (${places})`}`,
    ...lookupRows(lookup.files.map(asset => row('', asset)), options.all)].join('\n') + '\n';
}
