import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { inventoryAssets, inventoriedObjectIds } from '../delivery/index.ts';
import { RUNTIME_ASSET_ORIGIN, fetchWithRetry } from '../objects/sources/index.ts';
import { parsePreparedSystemView, parsePreparedWorldContextSummary, parsePreparedWorldSystem, starsWithoutSystem } from '@cssearth/objects';

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
  const viewFiles = hosts.map(id => `system-views/${id}.json`);
  const assets = await inventoryAssets(root, ['sun'], { location: 'prepared', filenames: viewFiles });
  const disagree = (detail: string) => new Error(`The Sun's published world summary and system views disagree: ${detail} Run pnpm prepare:world-context, publish the Sun and commit its inventory.`);
  const missing = viewFiles.filter(name => !assets.some(entry => entry.filename === name));
  if (missing.length) throw disagree(`the inventory lacks ${missing.join(', ')}.`);
  for (let start = 0; start < hosts.length; start += 16) {
    await Promise.all(hosts.slice(start, start + 16).map(async id => {
      const asset = assets.find(entry => entry.filename === `system-views/${id}.json`)!, text = await fetchText(asset.url);
      try { parsePreparedSystemView(JSON.parse(text), summary, id); }
      catch (error) { throw disagree(error instanceof Error ? error.message : String(error)); }
    }));
  }
  // Every system the summary defers has its published file, and it holds the bodies the summary lists for it.
  // A star that hosts itself has no file: its row is in the published `world-stars.json`, which the build copies into the
  // star's object entry.
  const ownRows = starsWithoutSystem(summary.deferred);
  if (ownRows.length) {
    const [table] = await inventoryAssets(root, ['sun'], { location: 'prepared', filenames: ['world-stars.json'] });
    if (!table) throw disagree('the inventory lacks world-stars.json.');
    const stars = JSON.parse(await fetchText(table.url)) as Record<string, unknown>;
    for (const id of ownRows) {
      try { parsePreparedWorldSystem(stars[id], summary, id); }
      catch (error) { throw disagree(error instanceof Error ? error.message : String(error)); }
    }
  }
  const systems = [...new Set((summary.deferred ?? []).filter(body => body.host !== body.id).map(body => body.host))], systemFiles = systems.map(id => `world-systems/${id}.json`);
  const systemAssets = await inventoryAssets(root, ['sun'], { location: 'prepared', filenames: systemFiles });
  const unpublished = systemFiles.filter(name => !systemAssets.some(entry => entry.filename === name));
  if (unpublished.length) throw disagree(`the inventory lacks ${unpublished.join(', ')}.`);
  for (let start = 0; start < systems.length; start += 16) {
    await Promise.all(systems.slice(start, start + 16).map(async id => {
      const asset = systemAssets.find(entry => entry.filename === `world-systems/${id}.json`)!;
      try { parsePreparedWorldSystem(JSON.parse(await fetchText(asset.url)), summary, id); }
      catch (error) { throw disagree(error instanceof Error ? error.message : String(error)); }
    }));
  }
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
