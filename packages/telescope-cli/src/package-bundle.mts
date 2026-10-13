/** Packaging adaptations: follow source owners and retain module identities after bundling. */
import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import type { Plugin } from 'esbuild';
import { followedWorkspaceSources } from './implementation-dependencies.mts';

export function packageBundlePlugins(root: string): Plugin[] {
  return [followedWorkspaceSources(root), {
    name: 'standalone-package-layout',
    setup(builder) {
      const entries: Readonly<Record<string, string>> = {
        '@cssearth/core': 'core/src/index.ts', '@cssearth/core/node': 'core/src/node/index.ts',
        '@cssearth/core/schema': 'core/src/schema.ts', '@cssearth/core/oracle': 'core/src/node/oracle/fixture.mts',
        '@cssearth/objects/archived-camera': 'objects/src/prepared-data/camera/archived-camera.ts', '@cssearth/astronomy': 'astronomy/src/index.ts',
        '@cssearth/engine': 'engine/src/index.ts',
        '@cssearth/telescope/sphere/lane': 'telescope-cli/src/sphere/sphere-lane.mts',
      };
      builder.onResolve({ filter: /^@cssearth\// }, args => {
        const source = entries[args.path];
        if (source) return { path: resolve(root, 'packages', source) };
        // A missing source mapping must never silently become an unpublished runtime import.
        throw new Error(`No bundled source entry for ${args.path}`);
      });
      builder.onLoad({ filter: /\.[cm]?ts$/ }, async args => {
        const path = relative(resolve(root, 'packages'), args.path).replaceAll('\\', '/');
        if (path.startsWith('../')) return undefined;
        const [owner, ...parts] = path.split('/');
        const source = parts.join('/');
        let contents = await readFile(args.path, 'utf8');
        // Each imported command keeps its source URL. Otherwise every main guard becomes true in cli.mjs.
        if (!(owner === 'telescope-cli' && ['src/bin.mts', 'src/cli.mts'].includes(source))) {
          const location = owner === 'telescope-cli' ? `../data/cli/${source}` : `../data/${owner}/${source}`;
          const moduleUrl = `new URL(${JSON.stringify(location)}, __PACKAGE_BUNDLE_URL__).href`;
          contents = contents.replaceAll('import.meta.main', 'false').replaceAll('import.meta.url', moduleUrl)
            .replaceAll('import.meta.filename', `__packageFilePath(${moduleUrl})`)
            .replaceAll('import.meta.dirname', `__packageFilePath(new URL('.', ${moduleUrl}))`);
        }
        // Data owners remain distinct inside one npm package; their original package need not be installed.
        contents = contents.replace(/createRequire\([^;\n]*?\)\.resolve\(['"]@cssearth\/([a-z-]+)\/package\.json['"]\)/gu,
          (_match: string, name: string) => name === 'telescope'
            ? "createRequire(__PACKAGE_BUNDLE_URL__).resolve('@cssearth/telescope/package.json')"
            : `__packageFilePath(new URL('../data/${name}/package.json', __PACKAGE_BUNDLE_URL__))`);
        contents = contents.replaceAll('__PACKAGE_BUNDLE_URL__', 'import.meta.url');
        return { contents: `import { fileURLToPath as __packageFilePath } from 'node:url';\n${contents.replace(/^#![^\n]*\n/u, '')}`, loader: 'ts' };
      });
    },
  }];
}
