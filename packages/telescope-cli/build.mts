import { build } from 'esbuild';
import { chmod, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { packageBundlePlugins } from './src/package-bundle.mts';
import { preparePackageData, preparePublishPackage } from './src/package-data.mts';

const packageRoot = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('../..', import.meta.url));
await rm(new URL('./dist', import.meta.url), { recursive: true, force: true });
await rm(new URL('./.package', import.meta.url), { recursive: true, force: true });
await rm(new URL('./data', import.meta.url), { recursive: true, force: true });
await preparePackageData(root, packageRoot);
await build({
  entryPoints: { telescope: new URL('./src/bin.mts', import.meta.url).pathname, cli: new URL('./src/cli.mts', import.meta.url).pathname },
  outdir: new URL('./dist', import.meta.url).pathname, outExtension: { '.js': '.mjs' },
  bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external',
  plugins: packageBundlePlugins(root), banner: { js: '#!/usr/bin/env node' },
});
await chmod(new URL('./dist/telescope.mjs', import.meta.url), 0o755);
const { build: buildEntries } = await import('tsup');
await buildEntries({ config: 'tsup.config.ts' });
await preparePublishPackage(root, packageRoot);
