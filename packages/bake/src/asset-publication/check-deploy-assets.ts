import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { inventoryAssets, inventoriedObjectIds } from '../delivery/index.ts';
import { RUNTIME_ASSET_ORIGIN, fetchWithRetry } from '../objects/sources/index.ts';
import { parseCompleteWorldContext, parsePreparedSystemView, parsePreparedWorldContextSummary, parsePreparedWorldIndex, systemViewFile, systemViewOwner } from '@cssearth/objects';

const execFileAsync = promisify(execFile);
/** The checkout, found through this package's own name so the path holds from the sources and from `dist/`. */
const ROOT = resolve(dirname(createRequire(import.meta.url).resolve('@cssearth/bake/package.json')), '../..');
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.svg', '.txt', '.xml']);
const escapedOrigin = RUNTIME_ASSET_ORIGIN.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const runtimeAssetPattern = new RegExp(`${escapedOrigin}/runtime-assets/[a-f0-9]{64}/[a-zA-Z0-9._@/-]+`, 'gu');

export function runtimeAssetUrls(text: string): string[] {
  return [...new Set(text.match(runtimeAssetPattern) ?? [])].sort();
}

async function textFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await textFiles(path));
    else if (entry.isFile() && textExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

export function unknownRuntimeAssetUrls(referenced: readonly string[], inventoried: ReadonlySet<string>): string[] {
  return [...new Set(referenced.filter(url => !inventoried.has(url)))].sort();
}

/** A dropped connection is retried, as the asset restore retries it; a read that still fails names its URL. */
async function readPublishedText(url: string): Promise<string> {
  try { return (await fetchWithRetry(fetch, url)).toString('utf8'); }
  catch (cause) { throw new Error(`Could not read ${url}.`, { cause }); }
}

/** The site reads the Sun's world summary, each other system's bodies and each system's views as published, from their inventory hashes, while builds
 * regenerate them locally. A set re-pinned apart (2026-09-24: 48 systems, 44 views) passes every local build and breaks
 * in-app navigation, so every system the published summary names must have its published views, and they must parse. */
export async function checkPublishedWorldPair(root: string, fetchText: (url: string) => Promise<string> = readPublishedText) {
  const [summaryAsset] = await inventoryAssets(root, ['sun'], { location: 'prepared', filenames: ['world-context-summary.json'] });
  if (!summaryAsset) throw new Error('The Sun inventory lacks world-context-summary.json.');
  const summary = parsePreparedWorldContextSummary(JSON.parse(await fetchText(summaryAsset.url)));
  const hosts = [summary.focus, ...summary.bodies].filter(body => body.systemView).map(body => body.id);
  // Each view is in the package of the system that owns it (systemViewOwner in @cssearth/objects).
  const boundTo = new Map(summary.bodies.flatMap(body => body.boundTo ? [[body.id, body.boundTo.hostId] as const] : []));
  const ownerOf = (id: string) => systemViewOwner(id, host => boundTo.get(host));
  const owners = [...new Set(hosts.map(ownerOf))].sort();
  const assets = await inventoryAssets(root, owners, { location: 'prepared' });
  const disagree = (detail: string) => new Error(`The published world summary and system views disagree: ${detail} Run pnpm prepare:world-context, publish the changed packages and commit their inventories.`);
  const viewOf = (id: string) => assets.find(entry => entry.id === ownerOf(id) && entry.filename === systemViewFile(id));
  const missing = hosts.filter(id => !viewOf(id)).map(id => `${ownerOf(id)}/prepared/${systemViewFile(id)}`);
  if (missing.length) throw disagree(`the inventories lack ${missing.join(', ')}.`);
  for (let start = 0; start < hosts.length; start += 16) {
    await Promise.all(hosts.slice(start, start + 16).map(async id => {
      const text = await fetchText(viewOf(id)!.url);
      try { parsePreparedSystemView(JSON.parse(text), summary, id); }
      catch (error) { throw disagree(error instanceof Error ? error.message : String(error)); }
    }));
  }
  // The published index names each body's holder: every holder that is a file is published, and the summary with every
  // holder is the whole world the index lists.
  const [indexAsset] = await inventoryAssets(root, ['sun'], { location: 'prepared', filenames: ['world-index.json'] });
  if (!indexAsset) throw disagree('the inventory lacks world-index.json.');
  const indexInput: unknown = JSON.parse(await fetchText(indexAsset.url));
  const index = parsePreparedWorldIndex(indexInput);
  // Each holder that is a file is its own package's `members.json`, published in that package's inventory.
  const systems = [...new Set(Object.values(index.holders))].filter(id => !Object.hasOwn(index.rows, id)).sort();
  const systemAssets = await inventoryAssets(root, systems, { location: 'prepared', filenames: ['members.json'] });
  const unpublished = systems.filter(id => !systemAssets.some(entry => entry.id === id));
  if (unpublished.length) throw disagree(`the inventories of ${unpublished.join(', ')} lack members.json.`);
  const files = new Map<string, unknown>();
  for (let start = 0; start < systems.length; start += 16) {
    await Promise.all(systems.slice(start, start + 16).map(async id => {
      const asset = systemAssets.find(entry => entry.id === id)!;
      files.set(id, JSON.parse(await fetchText(asset.url)));
    }));
  }
  try { await parseCompleteWorldContext(summary, async id => files.get(id), indexInput); }
  catch (error) { throw disagree(error instanceof Error ? error.message : String(error)); }
  return hosts.length;
}

export async function checkDeployAssets(root = ROOT): Promise<{ files: number; urls: number }> {
  const { stdout } = await execFileAsync('git', ['diff', '--name-only', '--', 'src/objects'], { cwd: root });
  const drift = stdout.split('\n').map(path => path.trim()).filter(Boolean);
  if (drift.length) throw new Error(`The deploy preparation changed committed object metadata:\n${drift.join('\n')}\nPrepare and publish those assets explicitly before deploying.`);
  const files = await textFiles(resolve(root, 'dist'));
  const referenced = (await Promise.all(files.map(async file => runtimeAssetUrls(await readFile(file, 'utf8'))))).flat();
  if (!referenced.length) throw new Error('The R2 deploy emitted no runtime asset URLs.');
  const assets = await inventoryAssets(root, inventoriedObjectIds([], root));
  const unknown = unknownRuntimeAssetUrls(referenced, new Set(assets.map(asset => asset.url)));
  if (unknown.length) throw new Error(`The built site references runtime assets outside the committed inventories:\n${unknown.join('\n')}`);
  await checkPublishedWorldPair(root);
  return { files: files.length, urls: new Set(referenced).size };
}
