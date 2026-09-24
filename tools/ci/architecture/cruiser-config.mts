/** dependency-cruiser settings for the architecture map. dependency-cruiser only resolves imports here;
 * the rules live in `rules.mts` and are evaluated against the committed baseline. */
import type { ICruiseOptions } from 'dependency-cruiser';

/** Source trees the cruise starts from. Root configuration files (`astro.config.mts` and other
 * `*.config.*`) are added from the tracked file list, and `.astro` files are scanned separately
 * (`astro-imports.mts`), because dependency-cruiser has no `.astro` transpiler. */
export const CRUISE_ROOTS = ['packages', 'src', 'site', 'tools', 'labs', 'tests', 'netlify'] as const;
export const ROOT_CONFIG_FILE = /^[^/]+\.config\.[cm]?[jt]s$/u;

/** Resolution follows the repository's own TypeScript, tsconfig, `package.json#imports` and pnpm
 * workspace rules; the `.astro` scanner tries the same extensions in order. The `prepared/` exclude is
 * anchored to bodies' baked output: a bare `/prepared/` also hid the 23 source files in `tools/prepared/`. */
export const RESOLVE_EXTENSIONS = ['.ts', '.mts', '.tsx', '.js', '.mjs', '.cjs', '.d.ts', '.d.mts', '.json', '.astro'];

export const EXCLUDE_PATHS = ['(^|/)node_modules/', '(^|/)output/', '(^|/)\\.astro/', '(^|/)atlas/', '^src/objects/[^/]+/prepared/', 'source-cache/'];

export const CRUISE_OPTIONS: ICruiseOptions = {
  doNotFollow: { path: ['node_modules', '/dist/'] },
  exclude: { path: EXCLUDE_PATHS },
  tsPreCompilationDeps: true,
  tsConfig: { fileName: 'tsconfig.json' },
  detectJSDocImports: false,
  enhancedResolveOptions: {
    exportsFields: ['exports'],
    conditionNames: ['types', 'import', 'require', 'node', 'default'],
    extensions: RESOLVE_EXTENSIONS,
    mainFields: ['types', 'module', 'main'],
  },
  moduleSystems: ['es6', 'cjs', 'tsd'],
  skipAnalysisNotInRules: false,
};
