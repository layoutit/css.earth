import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isPreparedCluster, type PreparedCatalogObject } from '@cssearth/catalog';
import { SOURCE_CATALOGUE } from './sources-catalog.mts';
import solarWorld from '../src/objects/sun/prepared/world-context.json' with { type: 'json' };

// Astro prepares these ordinary links. The browser never reads Markdown or
// reconstructs a document from scientific citations.
const revision = process.env.COMMIT_REF || execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: new URL('../', import.meta.url), encoding: 'utf8',
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
    if (!existsSync(new URL(`../${path}`, import.meta.url))) throw new Error(`Missing source document: ${path}`);
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

// The Sun hosts this overview, but its solar maps do not own the other bodies'
// credits. Prepare the overview's union from the actual world body registry.
const solarSystemProviders = [...new Set(['sun', ...solarWorld.bodies.map(body => body.id)].flatMap(sourceProviders))];
const solarSystemSummary = compactProviders.filter(provider => solarSystemProviders.includes(provider));
if (solarSystemProviders.some(provider => !compactProviders.includes(provider))) solarSystemSummary.push('others');
export function overviewSourceDocumentation(scope: string, name: string) {
  const document = sourceDocumentation(scope === 'solar-system' ? 'sun' : scope, name);
  return scope === 'solar-system' ? { ...document, label: creditLabel(solarSystemSummary) } : document;
}
