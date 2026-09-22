import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { isPreparedCluster, type PreparedCatalogObject } from '@cssearth/catalog';
import { SOURCE_CATALOGUE } from './sources-catalog.mts';
import { projectRoot } from '../tools/cli/project-root.mts';

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
const providerNames = new Map<string, readonly string[]>();
const compactProviders = ['NASA', 'ESA', 'JPL', 'USGS', 'JAXA', 'CSA', 'ISRO', 'STScI', 'ESO', 'NOIRLab', 'NAOJ', 'AMNH', 'CDS', 'OpenSpace', 'DAMIT'];
const compactProviderPattern = new RegExp(`\\b(?:${compactProviders.join('|')})\\b`, 'gu');

/** Format the already-prepared credits once per document owner, during Astro's build. */
function sourceProviders(objectId: string) {
  const cached = providerNames.get(objectId);
  if (cached) return cached;
  const uses = (SOURCE_CATALOGUE.usage.byObject[objectId] ?? []).map(index => SOURCE_CATALOGUE.usage.edges[index]);
  const providers = [...new Set([
    ...uses.flatMap(use => {
      const publisher = SOURCE_CATALOGUE.sources[use.catalogueId].publisher;
      const credit = use.credit ?? publisher ?? '';
      // The footer is a short provider index; complete author and institutional
      // credits remain in the linked document. Only abbreviations actually
      // present in the recorded credit are eligible for the compact label.
      return credit.match(compactProviderPattern)
        ?? (publisher ? [publisher] : credit ? [credit] : []);
    }),
    ...SOURCE_CATALOGUE.usage.edges.filter(use => use.kind === 'shared-context' && use.ownerPath.startsWith(`src/objects/${objectId}/`))
      .map(use => use.consumerLabel),
  ])];
  providerNames.set(objectId, providers);
  return providers;
}
const creditLabel = (providers: readonly string[]) => providers.length ? `Sources: ${providers.join(', ')}` : 'Sources';

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
  const summary = compactProviders.filter(provider => providers.includes(provider));
  // A large system abbreviates its many providers; a small one without any abbreviated provider names them.
  if (!summary.length) return { ...sourceDocumentation(system.id, system.name), label: creditLabel(providers) };
  if (providers.some(provider => !compactProviders.includes(provider))) summary.push('others');
  return { ...sourceDocumentation(system.id, system.name), label: creditLabel(summary) };
}
export function overviewSourceDocumentation(scope: string, name: string) {
  return sourceDocumentation(scope, name);
}
