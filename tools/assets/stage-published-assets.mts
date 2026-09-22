import { copyFile, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireInventory } from '../../src/platform/runtime-asset-closure.mts';
import { sha256 } from '../../src/platform/sha256.mts';

/** Refuse links at every component, including the inventory itself. Never follow PR-controlled paths. */
async function regularPath(root: string, path: string, optional = false): Promise<boolean> {
  let current = resolve(root);
  const components = path.split('/');
  for (const [index, component] of components.entries()) {
    if (!component || component === '.' || component === '..' || component.includes('\\')) throw new Error(`Unsafe asset path: ${path}`);
    current = resolve(current, component);
    const entry = await lstat(current).catch((error: unknown) => {
      if (optional && error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (!entry) return false;
    if (entry.isSymbolicLink() || (index === components.length - 1 ? !entry.isFile() : !entry.isDirectory())) {
      throw new Error(`Asset path must contain only regular files and directories: ${path}`);
    }
  }
  return true;
}

/**
 * The bake runner is untrusted. Compare its inventories with a separate, frozen PR checkout, verify every
 * byte, and copy only validated inventory paths. Nothing from the artifact can replace publishing tools.
 * The caller must not execute anything in sourceRoot or artifactRoot, or run PR processes concurrently.
 */
export async function stagePublishedAssets({ artifactRoot, sourceRoot, root, objectId }: {
  artifactRoot: string; sourceRoot: string; root: string; objectId: string;
}): Promise<number> {
  if (!/^[a-z][a-z0-9-]*$/u.test(objectId)) throw new Error(`Unsafe object id: ${objectId}`);
  const base = `src/objects/${objectId}`;
  const inventories: { path: string; bytes: Buffer | null }[] = [];
  const files = new Set<string>();
  const path = `${base}/inventory.json`;
  const committed = await regularPath(sourceRoot, path, true);
  const uploaded = await regularPath(artifactRoot, path, true);
  if (committed !== uploaded) throw new Error(`Artifact inventory differs from the PR commit: ${path}`);
  if (!committed) inventories.push({ path, bytes: null });
  else {
    const bytes = await readFile(resolve(artifactRoot, path));
    if (!bytes.equals(await readFile(resolve(sourceRoot, path)))) throw new Error(`Artifact inventory differs from the PR commit: ${path}`);
    const value: unknown = JSON.parse(bytes.toString('utf8'));
    const manifest = requireInventory(objectId, value);
    inventories.push({ path, bytes });
    for (const asset of manifest.assets) {
      const directory = asset.location === 'prepared' ? `${base}/prepared` : `public/scenes/${objectId}`;
      const assetPath = `${directory}/${asset.filename}`;
      await regularPath(artifactRoot, assetPath);
      const content = await readFile(resolve(artifactRoot, assetPath));
      if (content.length !== asset.bytes || sha256(content) !== asset.sha256) throw new Error(`Artifact bytes differ from the committed inventory: ${assetPath}`);
      files.add(assetPath);
    }
  }
  if (!files.size) throw new Error(`No committed assets to publish for ${objectId}`);
  // Validate destinations before writing anything; a trusted checkout may still contain unexpected links.
  for (const path of [...files, ...inventories.map(item => item.path)]) await regularPath(root, path, true);
  for (const path of files) {
    const destination = resolve(root, path);
    if (relative(root, destination).startsWith('..')) throw new Error(`Asset escaped its checkout: ${path}`);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(resolve(artifactRoot, path), destination);
  }
  for (const { path, bytes } of inventories) {
    const destination = resolve(root, path);
    if (bytes === null) await rm(destination, { force: true });
    else {
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, bytes);
    }
  }
  return files.size;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [artifactRoot, sourceRoot, objectId, ...extra] = process.argv.slice(2);
  if (!artifactRoot || !sourceRoot || !objectId || extra.length) throw new Error('Usage: stage-published-assets.mts <artifact-root> <PR-checkout> <object-id>');
  const count = await stagePublishedAssets({ artifactRoot, sourceRoot, objectId, root: resolve(import.meta.dirname, '../..') });
  console.log(`Verified and staged ${count} committed asset(s) for ${objectId}.`);
}
