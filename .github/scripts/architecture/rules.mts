/** Layer rules over the file-level import graph. Each rule names the imports it forbids; the committed
 * baseline lists existing debt for ratcheted rules; no-baseline rules fail on every finding. */
import type { ImportEdge, ImportGraph } from './graph.mts';
import { byText } from './zones.mts';

export interface LayerRule {
  readonly id: string;
  /** Plain-language statement of the rule, printed with each new violation. */
  readonly description: string;
  readonly forbids: (from: string, to: string) => boolean;
  /** Tests may break this rule too (for rules about what a package can reach). */
  readonly includeTests?: boolean;
  /** Every finding fails; baseline updates must never record this rule. */
  readonly noBaseline?: boolean;
}
export interface Violation { readonly from: string; readonly to: string }

const under = (path: string, ...prefixes: readonly string[]) => prefixes.some(prefix => path.startsWith(prefix));
const topLevel = (path: string) => path.includes('/') ? path.slice(0, path.indexOf('/')) : '';

/** Code that works ahead of runtime: `@cssearth/bake` and the telescope command `@cssearth/telescope-cli`. The `tools/` folder that
 * held the rest is retired (`retired-folders` in repository-rules.mts). */
export const PREPARATION_CODE = ['packages/bake/', 'packages/telescope-cli/'] as const;

/** The runtime: the site and the CSS renderer package's sources. */
export const RUNTIME_CODE = ['site/', 'packages/renderer/src/'] as const;

/** Site-owned preparation: build plugins and the preparers that read site modules. Build-time code, so it may import the bake;
 * the runtime never imports it, and packages never import any of `site/`. */
export const SITE_BUILD = 'site/build/';

/** Entry glue that may reach into an application tree: Netlify functions and root build configuration
 * (`astro.config.mts` wires `site/build` into the Astro build). Astro pages
 * live inside `site/` and need no entry here. */
export const ENTRY_GLUE: readonly RegExp[] = [/^netlify\//u, /^[^/]+\.config\.[cm]?[jt]s$/u];

export const APPLICATION_TREES = ['site', 'labs', '.github'] as const;

/** The one existing test that reaches into an application tree from outside it: the performance lab's source-map test
 * builds with the site's `performanceSourceMaps` plugin. Named exactly (`from\nto`) rather than baselined, so any other
 * import, in a test or not, still fails; the smell is recorded in untangle/ABSTRACTIONS.md. */
export const APPLICATION_IMPORT_EXCEPTIONS: ReadonlySet<string> = new Set(['labs/performance/source-maps.test.mts\nsite/build/source-maps.mts']);

const BAKE_NEBULA = 'packages/bake/src/nebula/', BAKE_OBJECTS = 'packages/bake/src/objects/';

/** Per-body and per-mission authoring folders: `authoring-is-leaf` forbids importing into them from outside. */
const AUTHORING_ROOTS = ['packages/bake/authoring/', 'packages/telescope-cli/authoring/'] as const;
/** The one file the nebula lab reads a circumstellar authoring module from directly (path + dynamic import), named
 * explicitly rather than opening the leaf rule to all of `labs/`. */
const AUTHORING_LEAF_EXCEPTIONS = new Set(['labs/nebula/packages/lab/src/adapters/preparation/circumstellar.ts']);

export const LAYER_RULES: readonly LayerRule[] = [
  {
    id: 'packages-import-only-packages',
    noBaseline: true,
    description: 'packages/* may import only packages/*, npm dependencies and Node built-ins (type-only imports count)',
    forbids: (from, to) => from.startsWith('packages/') && !to.startsWith('packages/'),
    includeTests: true,
  },
  {
    id: 'nothing-imports-applications',
    noBaseline: true,
    description: 'site/, labs/ and .github/ (CI scripts) are entry points: nothing outside each tree imports it, entry glue and APPLICATION_IMPORT_EXCEPTIONS excepted (tests and type-only imports count)',
    forbids: (from, to) => APPLICATION_TREES.some(tree => topLevel(to) === tree && topLevel(from) !== tree)
      && !ENTRY_GLUE.some(pattern => pattern.test(from)) && !APPLICATION_IMPORT_EXCEPTIONS.has(`${from}\n${to}`),
    includeTests: true,
  },
  {
    id: 'runtime-imports-no-preparation',
    description: 'site/ (except its build-time site/build/) and packages/renderer/src/ must not import @cssearth/bake or @cssearth/telescope-cli (type-only imports count; tests may)',
    forbids: (from, to) => under(from, ...RUNTIME_CODE) && !from.startsWith(SITE_BUILD) && under(to, ...PREPARATION_CODE),
  },
  {
    id: 'runtime-imports-no-site-build',
    description: 'site/build/ is site-owned preparation: the rest of site/ never imports it (type-only imports count; tests and entry glue may)',
    forbids: (from, to) => from.startsWith('site/') && !from.startsWith(SITE_BUILD) && to.startsWith(SITE_BUILD),
  },
  {
    id: 'nothing-imports-cli-entries',
    description: 'package cli entries are not imported (astronomy cli shares its existing helpers; tests and type-only imports count)',
    forbids: (_from, to) => /^packages\/[^/]+\/cli\//u.test(to)
      && !/^packages\/astronomy\/cli\/(?:lib\/|body-records\.mts$|body-epoch-ephemeris\.mts$|scene-ephemeris\.mts$|generate-heliocentric\.mts$)/u.test(to),
    includeTests: true,
  },
  {
    id: 'telescope-imports-no-bake',
    description: 'packages/telescope must never import @cssearth/bake: acquisition stays below preparation (tests and type-only imports count)',
    forbids: (from, to) => from.startsWith('packages/telescope/') && to.startsWith('packages/bake/'),
    includeTests: true,
  },
  {
    id: 'bake-nebula-and-objects-independent',
    description: 'in @cssearth/bake, nebula/ and objects/ never import each other, in either direction (tests and type-only imports count)',
    forbids: (from, to) => (from.startsWith(BAKE_NEBULA) && to.startsWith(BAKE_OBJECTS)) || (from.startsWith(BAKE_OBJECTS) && to.startsWith(BAKE_NEBULA)),
    includeTests: true,
  },
  {
    id: 'authoring-is-leaf',
    description: 'packages/bake/authoring/ and packages/telescope-cli/authoring/ hold per-body and per-mission authoring scripts: '
      + 'nothing imports them except their own tests, and the one lab entry named in AUTHORING_LEAF_EXCEPTIONS (tests and type-only imports count)',
    forbids: (from, to) => AUTHORING_ROOTS.some(root => to.startsWith(root))
      && !AUTHORING_ROOTS.some(root => from.startsWith(root)) && !AUTHORING_LEAF_EXCEPTIONS.has(from),
    includeTests: true,
  },
];

/** Every forbidden file-to-file import per rule, sorted and without duplicates. */
export function evaluateRules(graph: ImportGraph, rules: readonly LayerRule[] = LAYER_RULES): Map<string, Violation[]> {
  const result = new Map<string, Violation[]>();
  for (const rule of rules) {
    const seen = new Map<string, Violation>();
    for (const edge of graph.edges) if (applies(rule, edge) && rule.forbids(edge.from, edge.to)) seen.set(`${edge.from}\n${edge.to}`, { from: edge.from, to: edge.to });
    result.set(rule.id, [...seen.values()].sort(compareViolations));
  }
  return result;
}

function applies(rule: LayerRule, edge: ImportEdge): boolean { return rule.includeTests === true || !edge.test; }

export function compareViolations(left: Violation, right: Violation): number {
  return byText(left.from, right.from) || byText(left.to, right.to);
}

export const NO_BASELINE_RULES: ReadonlySet<string> = new Set(LAYER_RULES.filter(rule => rule.noBaseline).map(rule => rule.id));
