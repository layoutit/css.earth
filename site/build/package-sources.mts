import { basename, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import rendererConfig from '../../packages/renderer/tsup.config.ts';
import objectsConfig from '../../packages/objects/tsup.config.ts';
import engineConfig from '../../packages/engine/tsup.config.ts';

// tsup's shared chunks reach the client bundler as single modules, so one startup import pulled every
// renderer module sharing that chunk (the universe, volume and star runtimes) into the first load, and every
// object contract the objects package's one bundle holds into the chunk of its first importer. The engine's one bundle
// did the same: the startup cover's single `smoothstep` put the whole engine (29.6 KB of 50.8 KB) in every page's first load.
// The client build compiles the same entries from their TypeScript sources and splits per module.
// Renderer, objects and engine modules only declare and export, so an unused one is dropped rather than kept for its
// load-time effects; worker entries keep theirs. Server rendering and Node tools keep the built packages.
const packages: readonly { name: string; directory: string; config: unknown }[] = [
  { name: '@cssearth/renderer', directory: 'renderer', config: rendererConfig },
  { name: '@cssearth/objects', directory: 'objects', config: objectsConfig },
  { name: '@cssearth/engine', directory: 'engine', config: engineConfig }];
const built = packages.map(({ name, directory, config }) => {
  const root = fileURLToPath(new URL(`../../packages/${directory}/`, import.meta.url));
  return { name, sources: `${root}src/`, entries: new Map<string, string>(entryPairs(config, root).map(([output, source]) => [`${root}dist/${output}.js`, source])) };
});

/** A tsup config's entries as [output name, absolute source]: a named map (`{ index: <source> }`) or a list of sources, each
 * built under its file name. A relative source is relative to the package. */
function entryPairs(config: unknown, root: string): [string, string][] {
  const entry: unknown = config && typeof config === 'object' && 'entry' in config ? config.entry : undefined;
  if (Array.isArray(entry) && entry.every(source => typeof source === 'string')) {
    return entry.map(source => [basename(source).replace(/\.ts$/u, ''), isAbsolute(source) ? source : resolve(root, source)]);
  }
  if (entry && typeof entry === 'object' && Object.values(entry).every(source => typeof source === 'string')) {
    return Object.entries(entry).map(([output, source]) => [output, isAbsolute(String(source)) ? String(source) : resolve(root, String(source))]);
  }
  throw new TypeError(`${root}tsup.config.ts must declare concrete entries.`);
}

/** `names` limits the plugin to some of the packages (a worker build names only the objects package). */
export function packageSources(names: readonly string[] = packages.map(({ name }) => name)): Plugin {
  const owners = built.filter(({ name }) => names.includes(name));
  return {
    name: 'cssearth-package-sources',
    apply: 'build',
    enforce: 'pre',
    async resolveId(id, importer, options) {
      const owner = owners.find(({ name }) => id === name || id.startsWith(`${name}/`));
      if (options.ssr || !importer || !owner) return null;
      const resolved = await this.resolve(id, importer, { ...options, skipSelf: true });
      return resolved ? owner.entries.get(resolved.id) ?? null : null;
    },
    transform(_code, id, options) {
      if (options?.ssr || !owners.some(({ sources }) => id.startsWith(sources)) || /-worker\.ts$/u.test(id)) return null;
      return { moduleSideEffects: false };
    },
  };
}
