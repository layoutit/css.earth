import { sourceArray, sourceObject, sourceText, parseSourceBinding } from '../../src/platform/source-catalog.mts';
import type { SourceBinding, SourceResolver } from '../../src/platform/source-catalog.mts';
import type { SourceUse } from '../../src/platform/source-usage.mts';
import type { Fact } from '../objects/content/types.js';

export function factsheetCitations(panel: { facts: readonly Fact[]; moreFacts: readonly Fact[] }, ownerPath: string, object: { id: string }): SourceUse[] {
  return (['facts', 'moreFacts'] as const).flatMap(group => panel[group].flatMap((fact, index): SourceUse[] => {
    if (!fact.source) return [];
    const citation = fact.source;
    return [{ catalogueId: citation.catalogueId, kind: 'citation', consumerKind: 'object-fact',
      consumerId: `${object.id}/${fact.id}`, consumerLabel: `${fact.label}: ${fact.value}`,
      objectId: object.id, ownerPath, locator: `/panel/${group}/${index}/source`, citationUrl: citation.url,
      evidence: `Checked ${citation.checked}${citation.path ? ` · ${citation.path}` : ''}${citation.locator ? ` · ${citation.locator}` : ''}`,
      lensIds: [], limitations: [],
    }];
  }));
}

export interface SourceInventoryEntry { readonly ownerPath: string; readonly localId: string; readonly binding: SourceBinding; readonly used: boolean; }
export function sourceInventory(manifest: unknown, ownerPath: string, sources: SourceResolver, usedPaths: ReadonlySet<string>): SourceInventoryEntry[] {
  const entries: SourceInventoryEntry[] = [];
  for (const section of ['inputs','documents','generatedIntermediates']) {
    for (const raw of sourceArray(sourceObject(manifest)[section] ?? [], sourceObject)) {
      if (section !== 'inputs' && !usedPaths.has(sourceText(raw.path))) continue;
      const localId = sourceText(raw.id ?? raw.path);
      if (raw.sourceBinding === undefined) throw new TypeError(`Source entry without a binding: ${ownerPath}#${localId}.`);
      const binding = parseSourceBinding(raw.sourceBinding, sources);
      if (binding.kind === 'unresolved') throw new TypeError(`Unresolved source: ${ownerPath}#${localId}.`);
      entries.push({ownerPath,localId,binding,used:usedPaths.has(sourceText(raw.path))});
    }
  }
  return entries;
}
/** Read claim-local citations recursively; metadata never supplies lens or observation edges. */
export function metadataCitations(raw: unknown, ownerPath: string, sources: SourceResolver): SourceUse[] {
  const edges: SourceUse[] = [], catalog = sourceObject(raw);
  for (const [collection,consumerKind] of [['missions','mission'],['facilities','facility']] as const) {
    for (const [entityIndex,entity] of sourceArray(catalog[collection],sourceObject).entries()) {
      const consumerId = sourceText(entity.id), consumerLabel = sourceText(sourceObject(entity.name).value);
      const walk = (value: unknown, locator: string) => {
        if (Array.isArray(value)) { value.forEach((value,index) => walk(value,`${locator}/${index}`)); return; }
        if (!value || typeof value !== 'object') return;
        for (const [key,field] of Object.entries(sourceObject(value))) {
          if (key === 'citations') for (const citation of sourceArray(field,sourceObject)) {
            const id = sourceText(citation.catalogueId); if (!sources[id]) throw new TypeError('Unknown metadata source.');
            edges.push({catalogueId:sources[id].id,kind:'citation',consumerKind,consumerId,consumerLabel,ownerPath,locator:`${locator}/citations`,
              evidence:`Checked ${sourceText(citation.checkedOn)}${citation.locator ? ` · ${sourceText(citation.locator)}` : ''}${citation.evidence ? ` · ${sourceText(citation.evidence)}` : ''}`,lensIds:[],limitations:[]});
          } else walk(field,`${locator}/${key}`);
        }
      };
      walk(entity,`/${collection}/${entityIndex}`);
    }
  }
  return edges;
}
