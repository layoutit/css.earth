/** Build-derived identity for the complete local TypeScript module closure of an operation. */
import { createHash } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { build, type Plugin } from 'esbuild';
import rendererBuild from '../../../packages/renderer/tsup.config.ts';

export interface ImplementationFingerprint { readonly sha256: string; readonly files: readonly { readonly path: string; readonly sha256: string }[] }

/** Workspace entries whose TypeScript sources an identity follows as local modules. The FITS reader was a local module
 * (`tools/fits/`) before it became `@cssearth/fits`, the SPICE kernel readers were local modules (`tools/spice/`) before
 * they became `@cssearth/spice`, and the telescope library's product records, label readers and astronomy-package clients
 * were local modules under `tools/objects/` before they became `@cssearth/telescope`, and the photometric models and raster lane
 * were local modules (`tools/photometry/`, `src/preparation/raster/`) before they became `@cssearth/bake/photometry` and
 * `@cssearth/bake/raster`, as were the scene and presentation compilers (`src/renderers/css/preparation/`, `src/platform/`,
 * `tools/prepared/`) before `@cssearth/bake/scene` and `@cssearth/bake/presentation`; following them keeps every operation identified by the code it ran. Other packages stay external, as they always were. */
const FOLLOWED_WORKSPACE_ENTRIES: Readonly<Record<string, string>> = {
  '@cssearth/fits': 'packages/fits/src/index.ts',
  '@cssearth/fits/node': 'packages/fits/src/node/index.ts',
  '@cssearth/spice': 'packages/spice/src/index.ts',
  '@cssearth/spice/node': 'packages/spice/src/node/index.ts',
  '@cssearth/telescope': 'packages/telescope/src/index.ts',
  '@cssearth/telescope/node': 'packages/telescope/src/node/index.ts',
  '@cssearth/bake/photometry': 'packages/bake/src/photometry/index.ts',
  '@cssearth/bake/raster': 'packages/bake/src/raster/index.ts',
  '@cssearth/bake/scene': 'packages/bake/src/scene/index.ts',
  '@cssearth/bake/presentation': 'packages/bake/src/presentation/index.ts',
  '@cssearth/bake/shell': 'packages/bake/src/shell/index.ts',
  '@cssearth/bake/stars': 'packages/bake/src/stars/index.ts',
  '@cssearth/bake/volume-leaves': 'packages/bake/src/volume-leaves/index.ts',
};
/** The CSS renderer runtime was relative modules under `src/renderers/css/` before it became `@cssearth/renderer`, and an
 * operation that renders or validates prepared data ran them as its own code. Its built entries map to the sources its
 * tsup configuration names (`@cssearth/renderer/navigation` → `src/navigation/index.ts`); its source subpaths name the file. */
const RENDERER_ENTRIES: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(rendererBuild.entry)
  .map(([name, source]) => [name, `src/${source.slice(source.lastIndexOf('/src/') + '/src/'.length)}`]));
function rendererSource(specifier: string): string | undefined {
  if (specifier !== '@cssearth/renderer' && !specifier.startsWith('@cssearth/renderer/')) return undefined;
  const subpath = specifier.slice('@cssearth/renderer/'.length);
  const built = RENDERER_ENTRIES[subpath || 'index'];
  if (built) return `packages/renderer/${built}`;
  return /^[a-z-]+\/[\w./-]+\.ts$/u.test(subpath) && !subpath.split('/').includes('..') ? `packages/renderer/src/${subpath}` : undefined;
}
/** An esbuild plugin that bundles the followed workspace entries from their sources under `root`. */
export function followedWorkspaceSources(root: string): Plugin {
  return { name: 'followed-workspace-sources', setup(builder) {
    builder.onResolve({ filter: /^@cssearth\// }, args => {
      const source = FOLLOWED_WORKSPACE_ENTRIES[args.path] ?? rendererSource(args.path);
      return source ? { path: resolve(root, source) } : undefined;
    });
  } };
}

export async function implementationFingerprint(root: string, entries: readonly string[]): Promise<ImplementationFingerprint> {
  const absolute = entries.map(entry => isAbsolute(entry) ? entry : resolve(root, entry));
  const canonicalRoot = realpathSync(root);
  const result = await build({ absWorkingDir: root, entryPoints: absolute, outdir: resolve(root, '.fingerprint-output'), bundle: true, write: false, metafile: true, platform: 'node', format: 'esm',
    packages: 'external', conditions: ['types'], treeShaking: false, logLevel: 'silent', plugins: [followedWorkspaceSources(root), {
      name: 'authored-generated-imports',
      setup(builder) {
        builder.onResolve({ filter: /\.js$/ }, args => {
          if (!args.path.startsWith('.')) return;
          const requested = resolve(args.resolveDir, args.path), marker = `${sep}dist${sep}`, at = requested.lastIndexOf(marker);
          if (at < 0) return;
          const stem = `${requested.slice(0, at)}${sep}${requested.slice(at + marker.length, -3)}`;
          for (const source of [`${stem}.ts`, `${stem}.mts`, resolve(stem, 'index.ts'), resolve(stem, 'index.mts')]) {
            if (existsSync(source) && !relative(canonicalRoot, realpathSync(source)).startsWith('..')) return { path: source };
          }
          return;
        });
      },
    }] });
  const paths = Object.keys(result.metafile.inputs).map(path => resolve(root, path)).filter(path => !relative(root, path).startsWith('..')).sort();
  const files = await Promise.all(paths.map(async path => { const bytes = await readFile(path); return { path: relative(root, path), sha256: createHash('sha256').update(bytes).digest('hex'), bytes }; }));
  const digest = createHash('sha256');
  for (const file of files) digest.update(file.path.length.toString()).update(':').update(file.path).update(':').update(file.bytes);
  return { sha256: digest.digest('hex'), files: files.map(({ path, sha256 }) => ({ path, sha256 })) };
}
