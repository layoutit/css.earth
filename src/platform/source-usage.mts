import { productSourceIds, validateObjectProvenance } from './object-provenance.mts';
import type { ProvenanceDocument } from './object-provenance.mts';
import { parseSourceBinding, sourceArray, sourceEnum, sourceId, sourceObject, sourcePath, sourceText, sourceUnique, sourceUrl } from './source-catalog.mts';
import type { SourceResolver, SourceReference } from './source-catalog.mts';

export type SourceUseKind = 'product-input' | 'method' | 'citation' | 'shared-context' | 'artwork';
export interface SourceUse {
  readonly catalogueId: string; readonly kind: SourceUseKind;
  readonly consumerKind: 'object-product' | 'object-fact' | 'mission' | 'machine' | 'shared-context' | 'artwork';
  readonly consumerId: string; readonly consumerLabel: string;
  readonly ownerPath: string; readonly locator: string; readonly evidence: string;
  readonly objectId?: string; readonly productId?: string; readonly localSourceId?: string;
  readonly citationUrl?: string;
  readonly lensIds: readonly string[]; readonly limitations: readonly string[];
  readonly credit?: string; readonly license?: string; readonly redistribution?: string;
}
export interface SourceDataset { readonly objectId: string; readonly objectName: string; readonly lensId: string; readonly label: string; readonly href: string; }
export interface SourceUsage {
  readonly edges: readonly SourceUse[]; readonly datasets: readonly SourceDataset[];
  readonly bySource: Readonly<Record<string, readonly number[]>>; readonly byObject: Readonly<Record<string, readonly number[]>>;
}
export interface SourceUsageObject { readonly id: string; readonly name: string; readonly route: string; readonly controls: readonly {readonly id: string; readonly label: string}[]; readonly provenance: ProvenanceDocument; }
export const sourceDatasetKey = (objectId: string, lensId: string) => `${objectId}/${lensId}`;
export function sourceUsageIndexes(edges: readonly SourceUse[]) {
  const bySource: Record<string, number[]> = Object.create(null), byObject: Record<string, number[]> = Object.create(null);
  const add = (index: Record<string, number[]>, key: string, value: number) => (index[key] ??= []).push(value);
  edges.forEach((edge,index) => { add(bySource,edge.catalogueId,index); if (edge.objectId) add(byObject,edge.objectId,index); });
  const freeze = (index: Record<string, number[]>) => Object.freeze(Object.fromEntries(Object.entries(index).map(([key, values]) => [key,Object.freeze(values)])));
  return {bySource:freeze(bySource),byObject:freeze(byObject)};
}
const useKind = (role: SourceReference['role']): SourceUseKind => role === 'material' ? 'product-input' : role === 'reference' ? 'citation' : role;
/** All source relationships come from bindings and existing product lineage, never mission participation or URL matching. */
export function compileSourceUsage(objects: readonly SourceUsageObject[], sources: SourceResolver, metadata: readonly SourceUse[] = []): SourceUsage {
  const edges: SourceUse[] = [], datasets: SourceDataset[] = [];
  sourceUnique(objects.map(object => object.id), 'usage object');
  for (const object of objects) {
    const document = validateObjectProvenance(object.provenance,object.id), local = new Map(document.sources.map(source => [source.id,source]));
    const controls = new Set(object.controls.map(lens => lens.id)), usedLenses = new Set<string>();
    sourceUnique(object.controls.map(lens => lens.id), 'dataset control');
    for (const source of document.sources) if (source.sourceBinding) parseSourceBinding(source.sourceBinding,sources);
    for (const product of document.products) {
      const lensIds = [...(product.lensIds ?? [])];
      if (lensIds.some(id => !controls.has(id))) throw new TypeError(`Unknown source dataset: ${object.id}/${product.id}.`);
      for (const localSourceId of productSourceIds(document,product.id)) {
        const source = local.get(localSourceId)!;
        const binding = source.sourceBinding;
        if (binding?.kind !== 'catalogued') continue;
        for (const ref of binding.references) {
          const canonical = sources[ref.catalogueId];
          if (!canonical) throw new TypeError(`Unknown source binding: ${ref.catalogueId}.`);
          const limitations = [...(product.limitations ?? [])];
          if (product.interpretation?.kind) limitations.unshift(`Prepared interpretation: ${product.interpretation.kind}.`);
          if (product.interpretation?.sourceKind) limitations.unshift(`Source interpretation: ${product.interpretation.sourceKind}.`);
          edges.push(Object.freeze({ catalogueId: canonical.id, kind: useKind(ref.role), consumerKind:'object-product',
            consumerId:`${object.id}/${product.id}`,consumerLabel:`${object.name} · ${product.label}`,
            objectId:object.id,productId:product.id,localSourceId,
            ownerPath:`src/planets/${object.id}/source/manifest.json`,locator:ref.locator ?? source.path,evidence:ref.evidence,
            lensIds:Object.freeze(lensIds),limitations:Object.freeze(limitations),credit:source.credit,
            ...(source.license === undefined ? {} : {license:source.license}),...(source.redistribution === undefined ? {} : {redistribution:source.redistribution}) }));
          lensIds.forEach(id => usedLenses.add(id));
        }
      }
    }
    for (const lens of object.controls) if (usedLenses.has(lens.id)) {
      if (object.route !== `/${object.id}/`) throw new TypeError('Source dataset needs an object route.');
      datasets.push(Object.freeze({objectId:object.id,objectName:object.name,lensId:lens.id,label:lens.label,href:`${object.route}#dataset=${encodeURIComponent(lens.id)}`}));
    }
  }
  edges.push(...metadata);
  return parseSourceUsage({edges,datasets,...sourceUsageIndexes(edges)},sources);
}
export function parseSourceUsage(raw: unknown, sources: SourceResolver): SourceUsage {
  const value = sourceObject(raw,['edges','datasets','bySource','byObject']);
  const datasets = sourceArray(value.datasets,raw => {
    const dataset = sourceObject(raw,['objectId','objectName','lensId','label','href']), objectId = sourceId(dataset.objectId),lensId = sourceId(dataset.lensId);
    const href = sourceText(dataset.href); if (href !== `/${objectId}/#dataset=${encodeURIComponent(lensId)}`) throw new TypeError('Invalid source dataset URL.');
    return Object.freeze({objectId,lensId,href,objectName:sourceText(dataset.objectName),label:sourceText(dataset.label)});
  });
  const keys = datasets.map(dataset => sourceDatasetKey(dataset.objectId,dataset.lensId)); sourceUnique(keys,'dataset destination');
  const edges = sourceArray(value.edges,raw => {
    const edge = sourceObject(raw,['catalogueId','kind','consumerKind','consumerId','consumerLabel','ownerPath','locator','evidence','objectId','productId','localSourceId','citationUrl','lensIds','limitations','credit','license','redistribution']);
    const catalogueId = sourceId(edge.catalogueId), kind = sourceEnum(edge.kind,['product-input','method','citation','shared-context','artwork']);
    if (!Object.hasOwn(sources,catalogueId) || sources[catalogueId].id !== catalogueId) throw new TypeError('Usage must name a canonical source.');
    const consumerKind = sourceEnum(edge.consumerKind,['object-product','object-fact','mission','machine','shared-context','artwork']);
    const lensIds = sourceArray(edge.lensIds,sourceId); sourceUnique(lensIds,'usage lens');
    const objectId = edge.objectId === undefined ? undefined : sourceId(edge.objectId);
    if (consumerKind === 'object-product') {
      if (!objectId || edge.productId === undefined || edge.localSourceId === undefined || kind === 'shared-context') throw new TypeError('Incomplete source product use.');
      if (lensIds.some(lensId => !keys.includes(sourceDatasetKey(objectId,lensId)))) throw new TypeError('Source use names an unknown dataset.');
    } else if (consumerKind === 'object-fact') {
      if (!objectId || kind !== 'citation' || edge.citationUrl === undefined || edge.productId !== undefined || edge.localSourceId !== undefined || lensIds.length) throw new TypeError('A factsheet citation cannot become an observation or product input.');
    } else if (objectId || edge.productId !== undefined || edge.localSourceId !== undefined || lensIds.length ||
      (consumerKind === 'mission' || consumerKind === 'machine' ? kind !== 'citation' : kind !== consumerKind)) throw new TypeError('Metadata citation cannot become an object observation.');
    if (consumerKind !== 'object-fact' && edge.citationUrl !== undefined) throw new TypeError('Unexpected factsheet citation URL.');
    return Object.freeze({catalogueId,kind,consumerKind,consumerId:sourceText(edge.consumerId),consumerLabel:sourceText(edge.consumerLabel),
      ownerPath:sourcePath(edge.ownerPath),locator:sourceText(edge.locator),evidence:sourceText(edge.evidence),lensIds,
      limitations:sourceArray(edge.limitations,sourceText),...(objectId === undefined ? {} : {objectId}),
      ...(edge.citationUrl === undefined ? {} : {citationUrl:sourceUrl(edge.citationUrl)}),
      ...(edge.productId === undefined ? {} : {productId:sourceText(edge.productId)}),...(edge.localSourceId === undefined ? {} : {localSourceId:sourceText(edge.localSourceId)}),
      ...(edge.credit === undefined ? {} : {credit:sourceText(edge.credit)}),...(edge.license === undefined ? {} : {license:sourceText(edge.license)}),
      ...(edge.redistribution === undefined ? {} : {redistribution:sourceText(edge.redistribution)})});
  });
  sourceUnique(edges.map(edge => JSON.stringify(edge)),'usage edge');
  const indexes = sourceUsageIndexes(edges);
  for (const key of ['bySource','byObject'] as const) if (JSON.stringify(value[key]) !== JSON.stringify(indexes[key])) throw new TypeError(`Inconsistent source usage index: ${key}.`);
  const usedKeys = new Set(edges.flatMap(edge => edge.objectId ? edge.lensIds.map(id => sourceDatasetKey(edge.objectId!,id)) : []));
  if (usedKeys.size !== datasets.length) throw new TypeError('Source dataset has no usage edge.');
  return Object.freeze({edges,datasets,...indexes});
}
export function sourceDatasetViews(usage: SourceUsage, catalogueId: string, objectId?: string): readonly SourceDataset[] {
  const keys = new Set((usage.bySource[catalogueId] ?? []).flatMap(index => {
    const edge = usage.edges[index]; return edge.objectId && (!objectId || edge.objectId === objectId) ? edge.lensIds.map(id => sourceDatasetKey(edge.objectId!,id)) : [];
  }));
  return usage.datasets.filter(dataset => keys.has(sourceDatasetKey(dataset.objectId,dataset.lensId)));
}
