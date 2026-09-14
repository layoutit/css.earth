import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Keep generated modules in ignored output; the experiment runs from the repo root.
const directory = resolve('output/native-scroll');
await mkdir(directory, { recursive: true });
const outfile = resolve(directory, 'preview.mjs');
await build({ entryPoints: ['tools/experiments/native-scroll/preview.mts'], outfile,
  bundle: true, platform: 'node', format: 'esm', packages: 'external' });
await import(pathToFileURL(outfile).href);
