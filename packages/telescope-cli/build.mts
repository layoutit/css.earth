import { build } from 'esbuild';
import { chmod, rm } from 'node:fs/promises';
await rm(new URL('./dist', import.meta.url), { recursive: true, force: true });
await build({ entryPoints: [new URL('./src/cli.mts', import.meta.url).pathname], outfile: new URL('./dist/telescope.mjs', import.meta.url).pathname, bundle: true, platform: 'node', format: 'esm', target: 'node22', banner: { js: '#!/usr/bin/env node' } });
await chmod(new URL('./dist/telescope.mjs', import.meta.url), 0o755);
