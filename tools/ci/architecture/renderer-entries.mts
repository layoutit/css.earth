/** The renderer's compiled `dist/` entries and their sources, read from its own tsup config.
 *
 * `site/`, `tools/` and tests import the renderer through `src/renderers/css/dist/<entry>.js`. Counting
 * each import as the entry's source keeps those edges in the graph whether or not the renderer is built. */
import { posix, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireRecord, requireString } from '@cssearth/core';

export const RENDERER_DIST = 'src/renderers/css/dist/';

export const RENDERER_BUILD_CONFIG = 'src/renderers/css/tsup.config.ts';

/** The renderer's tsup config, loaded by path so this tool does not add its own import edge into the renderer. */
export async function loadRendererBuildConfig(root: string): Promise<unknown> {
  const module: unknown = await import(pathToFileURL(resolve(root, RENDERER_BUILD_CONFIG)).href);
  return requireRecord(module, RENDERER_BUILD_CONFIG).default;
}

/** `src/renderers/css/dist/<entry>` (no extension) to the repository-relative source file. */
export function rendererDistEntries(root: string, config: unknown): Map<string, string> {
  const entry = requireRecord(requireRecord(config, 'renderer tsup config').entry, 'renderer tsup entry');
  return new Map(Object.entries(entry).map(([name, source]) =>
    [`${RENDERER_DIST}${name}`, relative(root, requireString(source, `renderer tsup entry ${name}`)).split('\\').join('/')]));
}

/** The source behind a compiled renderer path such as `src/renderers/css/dist/navigation.js` or `.d.ts`. */
export function distSource(path: string, entries: ReadonlyMap<string, string>): string | undefined {
  const normalised = posix.normalize(path);
  if (!normalised.startsWith(RENDERER_DIST)) return undefined;
  return entries.get(normalised.replace(/(\.d)?\.[cm]?[jt]s$/u, ''));
}
