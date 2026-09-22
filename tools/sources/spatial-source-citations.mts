import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parsePreparedGalaxyCatalog, resolveSpatialCitation } from '../../packages/catalog/src/spatial.ts';
import { parsePreparedClusterCatalog } from '../../packages/catalog/src/clusters.ts';
import { sourceObject } from '../../src/platform/source-catalog.mts';
import type { SourceResolver } from '../../src/platform/source-catalog.mts';
import type { SourceUse } from '../../src/platform/source-usage.mts';
import { hasErrorCode } from './source-values.mts';

const quantityLabels: Readonly<Record<string, string>> = { skyPosition: 'Sky position', distance: 'Distance', halfLightRadius: 'Half-light radius', membership: 'Membership', redshift: 'Redshift' };

/** Bibliography bindings join the same usage graph as factsheet citations.
 * They remain citations: resolving a paper never turns it into an observation.
 */
export async function spatialSourceCitations(root: string, sources: SourceResolver,
  input = (path: string) => readFile(resolve(root, path))): Promise<SourceUse[]> {
  const edges: SourceUse[] = [];
  for (const directory of await readdir(resolve(root, 'src/objects'), { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const path = `src/objects/${directory.name}/prepared/catalogue.json`;
    let raw: unknown;
    try { raw = JSON.parse((await input(path)).toString('utf8')); }
    catch (error) { if (hasErrorCode(error, 'ENOENT')) continue; throw error; }
    const schema = sourceObject(raw).schema;
    if (schema !== 'cssearth-galaxy-catalog@1' && schema !== 'cssearth-cluster-catalog@1') continue;
    const catalog = schema === 'cssearth-galaxy-catalog@1' ? parsePreparedGalaxyCatalog(raw) : parsePreparedClusterCatalog(raw);
    for (const source of catalog.sources) for (const ref of source.references ?? []) {
      const canonical = ref.catalogueId && sources[ref.catalogueId];
      if (!canonical || !canonical.identifiers.some(id => id.type === 'bibliography-key' && id.value === ref.id)) {
        throw new TypeError(`Unbound spatial publication: ${path}/${ref.id}.`);
      }
    }
    for (const [index, row] of catalog.objects.entries()) {
      const claims = { skyPosition: row.skyPosition, distance: row.distance,
        ...('halfLightRadius' in row ? { halfLightRadius: row.halfLightRadius } : {}),
        ...('membership' in row ? { membership: row.membership } : {}),
        ...('redshift' in row ? { redshift: row.redshift } : {}) };
      for (const [field, claim] of Object.entries(claims)) {
        if (!claim?.sourceRef) continue;
        const reference = resolveSpatialCitation(claim.sourceRef, catalog.sources);
        if (!reference?.catalogueId) continue; // Release/field locators retain their existing pinned source owner.
        edges.push({ catalogueId: reference.catalogueId, kind: 'citation', consumerKind: 'spatial-measurement',
          consumerId: `${row.id}/${field}`, consumerLabel: `${row.name} · ${quantityLabels[field] ?? field}`, objectId: row.id,
          ownerPath: path, locator: `/objects/${index}/${field}`, evidence: `Published reference ${claim.sourceRef} retained by the pinned catalogue.`,
          citationUrl: reference.url, lensIds: [], limitations: ['Citation attribution; no independent verification of the published measurement.'] });
      }
    }
  }
  return edges;
}
