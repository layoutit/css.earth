import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { isPreparedCluster, type PreparedCatalogObject } from '@cssearth/catalog';
import credits from './prepared-source-credits.json' with { type: 'json' };
import { parseSourceCredits } from '@cssearth/objects/provenance';
import { projectRoot } from '@cssearth/core/node';

// Astro prepares these ordinary links. The browser never reads Markdown or
// reconstructs a document from scientific citations.
// Resolve against the discovered project root rather than `process.cwd()` (a
// workspace-filtered script runs elsewhere) or `import.meta.url` (once Astro
// bundles this module into `dist/.prerender/chunks`, its own URL no longer
// sits beside the project root).
const root = projectRoot(import.meta.url);
const revision = process.env.COMMIT_REF || execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root, encoding: 'utf8',
}).trim();
if (!/^[a-f0-9]{40}$/u.test(revision)) throw new Error('Source documentation needs the build commit.');
const checked = new Set<string>();
// Each object's provider index, computed when the source catalogue was written (@cssearth/objects/provenance source-credits.ts).
const PROVIDERS = parseSourceCredits(credits).providers;
const sourceProviders = (objectId: string): readonly string[] => PROVIDERS[objectId] ?? [];
const creditLabel = (providers: readonly string[]) => {
  if (!providers.length) return 'Sources';
  const shown: string[] = [];
  for (const provider of providers) {
    if (shown.length === 3 || provider.length > 20) continue;
    const next = [...shown, provider];
    const remaining = providers.length - next.length;
    const label = `Sources: ${next.join(', ')}${remaining ? ` and ${remaining} more` : ''}`;
    if (label.length <= 52) shown.push(provider);
  }
  if (!shown.length) return `Sources: ${providers.length} credited ${providers.length === 1 ? 'name' : 'names'}`;
  const remaining = providers.length - shown.length;
  return `Sources: ${shown.join(', ')}${remaining ? ` and ${remaining} more` : ''}`;
};

export function sourceDocumentation(objectId: string, name: string) {
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(objectId)) throw new Error(`Invalid source document owner: ${objectId}`);
  const path = `src/objects/${objectId}/README.md`;
  if (!checked.has(path)) {
    if (!existsSync(resolve(root, path))) throw new Error(`Missing source document: ${path}`);
    checked.add(path);
  }
  return { href: `https://github.com/layoutit/cssEarth/blob/${revision}/${path}`,
    label: creditLabel(sourceProviders(objectId)) };
}

export function focusSourceDocumentation(object: PreparedCatalogObject, catalogId: string) {
  const owner = isPreparedCluster(object) ? 'galaxy-clusters'
    : object.detailedObjectId ?? (catalogId === 'galaxies' ? 'local-group' : object.id);
  return sourceDocumentation(owner, object.name);
}

// A star hosts its system overview, but its own maps do not own the other bodies'
// credits. Prepare the overview's union from the system's prepared members.
export function systemSourceDocumentation(system: { readonly id: string; readonly name: string; readonly memberIds: readonly string[] }) {
  const providers = [...new Set([system.id, ...system.memberIds].flatMap(sourceProviders))];
  return { ...sourceDocumentation(system.id, system.name), label: creditLabel(providers) };
}
/** An overview's source document is its object's README; the observable universe is drawn from the Nearby Universe's
 * data (its DESI galaxies and quasars and the cosmic microwave background), so its README documents both. */
const OVERVIEW_DOCUMENT_OWNERS: Readonly<Record<string, string>> = { 'observable-universe': 'nearby-universe' };
export function overviewSourceDocumentation(scope: string, name: string) {
  return sourceDocumentation(OVERVIEW_DOCUMENT_OWNERS[scope] ?? scope, name);
}
