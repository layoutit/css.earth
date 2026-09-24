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

/** Code that bakes assets ahead of runtime. `packages/bake` is the planned home (items H, I, J). */
export const PREPARATION_CODE = ['tools/', 'src/preparation/', 'src/renderers/css/preparation/', 'packages/bake/'] as const;

/** Entry glue that may reach into an application tree: Netlify functions and root build configuration
 * (`astro.config.mts` wires `tools/performance` and `tools/prepare` into the Astro build). Astro pages
 * live inside `site/` and need no entry here. */
export const ENTRY_GLUE: readonly RegExp[] = [/^netlify\//u, /^[^/]+\.config\.[cm]?[jt]s$/u];

export const APPLICATION_TREES = ['tools', 'site', 'labs'] as const;

export const LAYER_RULES: readonly LayerRule[] = [
  {
    id: 'packages-import-only-packages',
    description: 'packages/* may import only packages/*, npm dependencies and Node built-ins (type-only imports count)',
    forbids: (from, to) => from.startsWith('packages/') && !to.startsWith('packages/'),
    includeTests: true,
  },
  {
    id: 'nothing-imports-applications',
    description: 'tools/, site/ and labs/ are entry points: nothing outside each tree imports it, entry glue excepted (type-only imports count)',
    forbids: (from, to) => APPLICATION_TREES.some(tree => topLevel(to) === tree && topLevel(from) !== tree)
      && !ENTRY_GLUE.some(pattern => pattern.test(from)),
  },
  {
    id: 'runtime-imports-no-preparation',
    description: 'src/renderers/ and site/ must not import tools/ or preparation code (type-only imports count)',
    forbids: (from, to) => (from.startsWith('site/') || (from.startsWith('src/renderers/') && !from.startsWith('src/renderers/css/preparation/')))
      && under(to, ...PREPARATION_CODE),
  },
  {
    id: 'nothing-imports-prepare-scripts',
    description: 'tools/prepare/ holds entry scripts only: nothing imports them, including other prepare scripts (type-only imports count)',
    forbids: (_from, to) => to.startsWith('tools/prepare/'),
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
