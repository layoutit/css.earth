import { packageBundlePlugins, publishDirectory } from './src/package/index.mts';
import { preparePackageBuildInputs } from './src/package/build-inputs.mts';
import { build } from 'esbuild';
import { chmod, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('../..', import.meta.url));
await preparePackageBuildInputs(root);
// tsup resolves its entries, declaration paths and package metadata from the working directory.
process.chdir(packageRoot);
await rm(new URL('./.package', import.meta.url), { recursive: true, force: true });
await mkdir(resolve(root, 'output'), { recursive: true });
const staging = await mkdtemp(resolve(root, 'output/telescope-package-build-'));
try {
  await build({
    entryPoints: { telescope: new URL('./src/bin.mts', import.meta.url).pathname, cli: new URL('./src/cli.mts', import.meta.url).pathname },
    outdir: resolve(staging, 'dist'), outExtension: { '.js': '.mjs' },
    bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external',
    plugins: packageBundlePlugins(root), banner: { js: '#!/usr/bin/env node' },
  });
  await chmod(resolve(staging, 'dist/telescope.mjs'), 0o755);
  const { build: buildEntries } = await import('tsup');
  await buildEntries({ config: 'tsup.config.ts', outDir: resolve(staging, 'dist') });
  await publishDirectory(resolve(staging, 'dist'), resolve(packageRoot, 'dist'));
} finally { await rm(staging, { recursive: true, force: true }); }
