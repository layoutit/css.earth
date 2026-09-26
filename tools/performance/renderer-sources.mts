import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import rendererConfig from '../../packages/renderer/tsup.config.ts';

// tsup's shared chunks reach the client bundler as single modules, so one startup import pulled every
// renderer module sharing that chunk (the universe, volume and star runtimes) into the first load.
// The client build compiles the same entries from their TypeScript sources and splits per module.
// Renderer modules only declare and export, so an unused one is dropped rather than kept for its
// load-time effects; worker entries keep theirs. Server rendering and Node tools keep the built package.
const root = fileURLToPath(new URL('../../packages/renderer/', import.meta.url));
const sources = `${root}src/`;
const entries = new Map(Object.entries(rendererConfig.entry).map(([name, source]) => [`${root}dist/${name}.js`, source]));

export function rendererSources(): Plugin {
  return {
    name: 'cssearth-renderer-sources',
    apply: 'build',
    enforce: 'pre',
    async resolveId(id, importer, options) {
      if (options.ssr || !importer || (id !== '@cssearth/renderer' && !id.startsWith('@cssearth/renderer/'))) return null;
      const resolved = await this.resolve(id, importer, { ...options, skipSelf: true });
      return resolved ? entries.get(resolved.id) ?? null : null;
    },
    transform(_code, id, options) {
      if (options?.ssr || !id.startsWith(sources) || /-worker\.ts$/u.test(id)) return null;
      return { moduleSideEffects: false };
    },
  };
}
