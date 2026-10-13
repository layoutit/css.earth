import { build } from 'esbuild';
import { chmod, mkdir, mkdtemp, readdir, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageBundlePlugins } from './src/package-bundle.mts';
import { preparePackageData, validatePublishPackage } from './src/package-data.mts';

const packageRoot = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('../..', import.meta.url));
await rm(new URL('./.package', import.meta.url), { recursive: true, force: true });
await mkdir(resolve(root, 'output'), { recursive: true });
const staging = await mkdtemp(resolve(root, 'output/telescope-package-build-'));
/** Existing source processes may be using these files while a maintainer packs. Publish each completed file atomically. */
async function publishDirectory(source: string, destination: string): Promise<void> {
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true }), names = new Set(entries.map(entry => entry.name));
  for (const entry of entries) {
    const from = resolve(source, entry.name), to = resolve(destination, entry.name);
    if (entry.isDirectory()) await publishDirectory(from, to);
    else await rename(from, to);
  }
  for (const entry of await readdir(destination)) if (!names.has(entry)) await rm(resolve(destination, entry), { recursive: true, force: true });
}
try {
  await preparePackageData(root, packageRoot, staging);
  await build({
    entryPoints: { telescope: new URL('./src/bin.mts', import.meta.url).pathname, cli: new URL('./src/cli.mts', import.meta.url).pathname },
    outdir: resolve(staging, 'dist'), outExtension: { '.js': '.mjs' },
    bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external',
    plugins: packageBundlePlugins(root), banner: { js: '#!/usr/bin/env node' },
  });
  await chmod(resolve(staging, 'dist/telescope.mjs'), 0o755);
  const { build: buildEntries } = await import('tsup');
  await buildEntries({ config: 'tsup.config.ts', outDir: resolve(staging, 'dist') });
  await publishDirectory(resolve(staging, 'data'), resolve(packageRoot, 'data'));
  await publishDirectory(resolve(staging, 'dist'), resolve(packageRoot, 'dist'));
  await validatePublishPackage(root, packageRoot);
} finally { await rm(staging, { recursive: true, force: true }); }
