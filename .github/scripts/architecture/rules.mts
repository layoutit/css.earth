/** Layer rules over the file-level import graph. Each rule names the imports it forbids; the committed
 * baseline lists the ones that already exist, and the check fails only on new ones. */
import type { ImportEdge, ImportGraph } from './graph.mts';
import { byText } from './zones.mts';

export interface LayerRule {
  readonly id: string;
  /** Plain-language statement of the rule, printed with each new violation. */
  readonly description: string;
  readonly forbids: (from: string, to: string) => boolean;
  /** Tests may break this rule too (for rules about what a package can reach). */
  readonly includeTests?: boolean;
}
export interface Violation { readonly from: string; readonly to: string }

const under = (path: string, ...prefixes: readonly string[]) => prefixes.some(prefix => path.startsWith(prefix));
const topLevel = (path: string) => path.includes('/') ? path.slice(0, path.indexOf('/')) : '';

/** Code that works ahead of runtime: `tools/`, `@cssearth/bake` (items H, I, J moved the rest there) and the telescope command
 * `@cssearth/telescope-cli`, whose archive reductions and programs moved out of `tools/objects/`. */
export const PREPARATION_CODE = ['tools/', 'packages/bake/', 'packages/telescope-cli/'] as const;

/** The runtime: the site and the CSS renderer package's sources. */
export const RUNTIME_CODE = ['site/', 'packages/renderer/src/'] as const;

/** Entry glue that may reach into an application tree: Netlify functions and root build configuration
 * (`astro.config.mts` wires `tools/performance` and `tools/prepare` into the Astro build). Astro pages
 * live inside `site/` and need no entry here. */
export const ENTRY_GLUE: readonly RegExp[] = [/^netlify\//u, /^[^/]+\.config\.[cm]?[jt]s$/u];

export const APPLICATION_TREES = ['tools', 'site', 'labs', '.github'] as const;

const BAKE_NEBULA = 'packages/bake/src/nebula/', BAKE_OBJECTS = 'packages/bake/src/objects/';

export const LAYER_RULES: readonly LayerRule[] = [
  {
    id: 'packages-import-only-packages',
    description: 'packages/* may import only packages/*, npm dependencies and Node built-ins (type-only imports count)',
    forbids: (from, to) => from.startsWith('packages/') && !to.startsWith('packages/'),
    includeTests: true,
  },
  {
    id: 'nothing-imports-applications',
    description: 'tools/, site/, labs/ and .github/ (CI scripts) are entry points: nothing outside each tree imports it, entry glue excepted (type-only imports count)',
    forbids: (from, to) => APPLICATION_TREES.some(tree => topLevel(to) === tree && topLevel(from) !== tree)
      && !ENTRY_GLUE.some(pattern => pattern.test(from)),
  },
  {
    id: 'runtime-imports-no-preparation',
    description: 'site/ and packages/renderer/src/ must not import tools/, @cssearth/bake or @cssearth/telescope-cli (type-only imports count; tests may)',
    forbids: (from, to) => under(from, ...RUNTIME_CODE) && under(to, ...PREPARATION_CODE),
  },
  {
    id: 'nothing-imports-prepare-scripts',
    description: 'tools/prepare/cli/ holds the prepare entry scripts: nothing imports them, including other entries (type-only imports count); the libraries beside them in tools/prepare/ may be imported',
    forbids: (_from, to) => to.startsWith('tools/prepare/cli/'),
  },
  {
    id: 'nothing-imports-cli-entries',
    description: 'packages/*/cli/ holds command entries: nothing imports them, including other entries and the package itself (tests and type-only imports count)',
    forbids: (_from, to) => /^packages\/[^/]+\/cli\//u.test(to),
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
