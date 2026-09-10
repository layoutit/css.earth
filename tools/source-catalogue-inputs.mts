import { createHash } from 'node:crypto';
import { sourceArray, sourceObject, sourceText, parseSourceBinding } from '../src/platform/source-catalog.mts';
import type { SourceBinding, SourceResolver } from '../src/platform/source-catalog.mts';
import type { SourceUse } from '../src/platform/source-usage.mts';

/** Matches the frozen migration rows without making new identity decisions. */
export function canonicalSourceJson(raw: unknown): string {
  if (Array.isArray(raw)) return `[${raw.map(canonicalSourceJson).join(',')}]`;
  if (raw !== null && typeof raw === 'object') return `{${Object.entries(sourceObject(raw)).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([key,value]) => `${JSON.stringify(key)}:${canonicalSourceJson(value)}`).join(',')}}`;
  const value = JSON.stringify(raw); if (value === undefined) throw new TypeError('Invalid source JSON.'); return value;
}
export const sourceSha256 = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export interface SourceInventoryEntry { readonly ownerPath: string; readonly localId: string; readonly binding: SourceBinding; readonly used: boolean; }
export function sourceInventory(manifest: unknown, ownerPath: string, sources: SourceResolver, usedPaths: ReadonlySet<string>, migration: unknown): SourceInventoryEntry[] {
  const entries: SourceInventoryEntry[] = [];
  const accepted = sourceArray(sourceObject(migration).entries, sourceObject);
  for (const section of ['inputs','documents','generatedIntermediates']) {
    for (const raw of sourceArray(sourceObject(manifest)[section] ?? [], sourceObject)) {
      if (section !== 'inputs' && !usedPaths.has(sourceText(raw.path))) continue;
      const binding = parseSourceBinding(raw.sourceBinding, sources), localId = sourceText(raw.id ?? raw.path);
      if (binding.kind === 'unresolved') {
        const previous = accepted.find(entry => entry.ownerPath === ownerPath && entry.localId === localId);
        const {sourceBinding, ...original} = raw;
        if (!previous || canonicalSourceJson(previous.binding) !== canonicalSourceJson(binding) || previous.beforeSha256 !== sourceSha256(canonicalSourceJson(original))) throw new TypeError(`Unreviewed unresolved source: ${ownerPath}#${localId}.`);
      }
      entries.push({ownerPath,localId,binding,used:usedPaths.has(sourceText(raw.path))});
    }
  }
  return entries;
}
/** Read claim-local citations recursively; metadata never supplies lens or observation edges. */
export function metadataCitations(raw: unknown, ownerPath: string, sources: SourceResolver): SourceUse[] {
  const edges: SourceUse[] = [], catalog = sourceObject(raw);
  for (const [collection,consumerKind] of [['missions','mission'],['spacecraft','spacecraft']] as const) {
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
