import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { inventoriedAssets, inventoriedObjectIds, RUNTIME_ASSET_ORIGIN } from './runtime-assets.mts';

const execFileAsync = promisify(execFile);
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

export async function checkDeployAssets(root = resolve(import.meta.dirname, '..')): Promise<{ files: number; urls: number }> {
  const { stdout } = await execFileAsync('git', ['diff', '--name-only', '--', 'src/objects'], { cwd: root });
  const drift = stdout.split('\n').map(path => path.trim()).filter(Boolean);
  if (drift.length) throw new Error(`The deploy preparation changed committed object metadata:\n${drift.join('\n')}\nPrepare and publish those assets explicitly before deploying.`);
  const files = await textFiles(resolve(root, 'dist'));
  const referenced = (await Promise.all(files.map(async file => runtimeAssetUrls(await readFile(file, 'utf8'))))).flat();
  if (!referenced.length) throw new Error('The R2 deploy emitted no runtime asset URLs.');
  const assets = await inventoriedAssets(root, inventoriedObjectIds([], root));
  const unknown = unknownRuntimeAssetUrls(referenced, new Set(assets.map(asset => asset.url)));
  if (unknown.length) throw new Error(`The built site references runtime assets outside the committed inventories:\n${unknown.join('\n')}`);
  return { files: files.length, urls: new Set(referenced).size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await checkDeployAssets();
  console.log(`Verified ${result.urls} emitted runtime asset URL(s) across ${result.files} deploy file(s).`);
}
