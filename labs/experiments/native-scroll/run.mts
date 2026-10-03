import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build, type Plugin } from 'esbuild';

/** Bundle `@cssearth/renderer` and the telescope command's native camera modules into the preview: their sources are
 * TypeScript, and the renderer's sibling imports name `.js`, which Node cannot load unbundled. A lab imports no application
 * tree; this consumer owns its bundler, as `labs/nebula` owns its own. */
const bundleSourcePackages: Plugin = {
  name: 'bundle-source-packages',
  setup(builder) {
    builder.onResolve({ filter: /^@cssearth\/(?:renderer|telescope-cli)(?:\/|$)/ }, args =>
      ({ path: createRequire(resolve(args.resolveDir, 'bundle-source-packages.cjs')).resolve(args.path) }));
  },
};

// Keep generated modules in ignored output; the experiment runs from the repo root.
const directory = resolve('output/native-scroll');
await mkdir(directory, { recursive: true });
const outfile = resolve(directory, 'preview.mjs');
await build({ entryPoints: ['labs/experiments/native-scroll/preview.mts'], outfile,
  bundle: true, platform: 'node', format: 'esm', packages: 'external', plugins: [bundleSourcePackages] });
await import(pathToFileURL(outfile).href);
