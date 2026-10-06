/** The module resolver of the cruise, for the imports dependency-cruiser cannot read itself (`.astro` files).
 *
 * dependency-cruiser resolves with enhanced-resolve plus tsconfig-paths-webpack-plugin (the same pinned
 * versions are dev dependencies here), configured from `CRUISE_OPTIONS`, and retries an unresolved `.js`,
 * `.mjs` or `.cjs` specifier as its TypeScript source. This builds the same resolver from the same options, so
 * a tsconfig path alias, a workspace export or a `package.json#imports` pattern resolves in an Astro component
 * exactly as in a `.ts` file. The architecture tests compare the two on the repository's own imports. */
import { extname, isAbsolute, relative, resolve as resolvePath } from 'node:path';
import enhancedResolve from 'enhanced-resolve';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import { CRUISE_OPTIONS, RESOLVE_EXTENSIONS } from './cruiser-config.mts';

/** Resolves `specifier` imported by the repository file `from`: the repository-relative (posix) target, or
 * undefined when nothing resolves. Targets under `node_modules/` are returned as resolved, for the caller to judge. */
export type Resolve = (from: string, specifier: string) => string | undefined;

/** dependency-cruiser's retry for an unresolved `./x.js`, `.jsx`, `.mjs` or `.cjs`: resolve `./x` again (its
 * resolver is cached once per cruise, so with the same extension list) and keep the answer only when it is
 * TypeScript. */
const RETRIED = new Set(['.js', '.jsx', '.mjs', '.cjs']);
const TYPESCRIPT_ISH = new Set(['.ts', '.tsx', '.cts', '.mts']);

/** `tsconfigBaseUrl` is the `baseUrl` of the tsconfig the cruise receives (`extractTSConfig`); only whether it is
 * set matters, as it does to dependency-cruiser. */
export function createResolver(root: string, tsconfigPath: string, tsconfigBaseUrl: string | undefined): Resolve {
  const configured = CRUISE_OPTIONS.enhancedResolveOptions ?? {};
  // `create.sync` reads through enhanced-resolve's cached Node file system (4 s), as dependency-cruiser does.
  const extensions = configured.extensions ?? RESOLVE_EXTENSIONS;
  const resolver = enhancedResolve.create.sync({
    // dependency-cruiser's defaults, then the plugin it adds for a tsconfig, then CRUISE_OPTIONS on top.
    symlinks: true,
    modules: ['node_modules', 'node_modules/@types'],
    // dependency-cruiser passes `baseUrl: './'` (the working directory) when the tsconfig has none;
    // `buildImportGraph` runs the cruise from the repository root, so the root is the same base.
    plugins: [new TsconfigPathsPlugin({ configFile: tsconfigPath, baseUrl: tsconfigBaseUrl ? undefined : root, extensions: [...extensions], silent: true })],
    exportsFields: [...configured.exportsFields ?? []],
    conditionNames: [...configured.conditionNames ?? []],
    mainFields: [...configured.mainFields ?? []],
    extensions: [...extensions],
    useSyncFileSystemCalls: true,
  });
  const attempt = (directory: string, request: string): string | undefined => {
    try {
      const found = resolver({}, directory, request);
      return typeof found === 'string' ? found : undefined;
    } catch { return undefined; }
  };
  return (from, raw) => {
    const specifier = raw.replace(/\?.*$/u, '');
    const directory = resolvePath(root, from, '..');
    let found = attempt(directory, specifier);
    if (found === undefined && RETRIED.has(extname(specifier))) {
      const candidate = attempt(directory, specifier.slice(0, -extname(specifier).length));
      if (candidate !== undefined && TYPESCRIPT_ISH.has(extname(candidate))) found = candidate;
    }
    if (found === undefined) return undefined;
    const path = relative(root, found).split('\\').join('/');
    return isAbsolute(path) || path.startsWith('../') ? undefined : path;
  };
}
