import type { ProductInputEvidence } from './product-input-evidence.js';
import { parseCapture } from './exploration-catalog.js';
import type { Capture } from './exploration-catalog.js';
import { parseSourceBinding, sourceArray, sourceObject, sourcePath, sourceText } from '../sources/catalog.js';
import type { SourceBinding } from '../sources/catalog.js';

/** One source record of an object's manifest, as the catalogues read it. */
export interface LineageSource {
  readonly id: string; readonly path: string; readonly credit: string;
  readonly license?: string; readonly redistribution?: string;
  /** Set when the input is a dataset's own source rather than a file supporting it. */
  readonly datasetId?: string;
  readonly capture?: Capture; readonly sourceBinding?: SourceBinding;
  readonly dependencies: readonly string[];
}
/** One prepared product (usually a dataset) and the manifest sources its recipe reads. */
export interface LineageProduct {
  readonly id: string; readonly label: string; readonly datasetIds: readonly string[];
  readonly inputs: readonly string[]; readonly parents: readonly string[];
  readonly inputEvidence?: readonly ProductInputEvidence[];
  /** Whether source capture lineage may credit a displayed view; never an observation-quality claim. */
  readonly observationAttribution: 'source-lineage' | 'none';
  readonly interpretation?: { readonly kind?: string; readonly sourceKind?: string };
  readonly limitations?: readonly string[];
}
/** Which manifest sources each prepared product of an object reads: a view of the object's source records, built in memory
 * by the catalogue compiler and never written. */
export interface ObjectLineage {
  readonly objectId: string;
  /** Repository path of the object's source manifest, relative to its package. */
  readonly manifestPath: string;
  readonly sources: readonly LineageSource[]; readonly products: readonly LineageProduct[];
}

/** Read one manifest entry (input, document or intermediate). `defaults` fill what a document may leave unrecorded. */
export function lineageSource(raw: unknown, defaults: { id?: string; credit?: string; dependencies?: readonly string[] } = {}): LineageSource {
  const value = sourceObject(raw);
  const text = (key: string) => value[key] === undefined ? undefined : sourceText(value[key]);
  const id = text('id') ?? defaults.id, credit = text('credit') ?? defaults.credit;
  if (id === undefined || credit === undefined) throw new TypeError(`Source record needs an id and a credit: ${String(value.path)}.`);
  const license = text('license'), redistribution = text('redistribution'), datasetId = text('datasetId');
  return Object.freeze({ id, path: sourcePath(value.path), credit,
    dependencies: Object.freeze([...(defaults.dependencies ?? sourceArray(value.dependencies ?? [], sourceText))]),
    ...(license === undefined ? {} : { license }), ...(redistribution === undefined ? {} : { redistribution }),
    ...(datasetId === undefined ? {} : { datasetId }),
    ...(value.capture === undefined ? {} : { capture: parseCapture(value.capture) }),
    ...(value.sourceBinding === undefined ? {} : { sourceBinding: parseSourceBinding(value.sourceBinding) }) });
}

/** Check that every product and dependency names a known source, product and dataset, without cycles. */
export function checkLineage(lineage: ObjectLineage, datasetIds?: ReadonlySet<string>): ObjectLineage {
  const unique = (values: readonly string[], label: string) => {
    if (new Set(values).size !== values.length) throw new TypeError(`Duplicate ${label} in ${lineage.objectId}.`);
  };
  unique(lineage.sources.map(source => source.id), 'lineage source');
  unique(lineage.products.map(product => product.id), 'lineage product');
  const sources = new Map(lineage.sources.map(source => [source.id, source])), products = new Map(lineage.products.map(product => [product.id, product]));
  for (const source of lineage.sources) for (const id of source.dependencies)
    if (!sources.has(id)) throw new TypeError(`Unknown source dependency: ${lineage.objectId}/${source.id} -> ${id}.`);
  for (const product of lineage.products) {
    for (const id of product.inputs) if (!sources.has(id)) throw new TypeError(`Unknown product input: ${lineage.objectId}/${product.id} -> ${id}.`);
    for (const id of product.parents) if (!products.has(id)) throw new TypeError(`Unknown product parent: ${lineage.objectId}/${product.id} -> ${id}.`);
    for (const id of product.datasetIds) if (datasetIds && !datasetIds.has(id)) throw new TypeError(`Unknown prepared dataset: ${lineage.objectId}/${id}.`);
    for (const evidence of product.inputEvidence ?? []) if (!product.inputs.includes(evidence.sourceId))
      throw new TypeError(`Input evidence names an unread source: ${lineage.objectId}/${product.id}/${evidence.sourceId}.`);
  }
  const acyclic = (ids: Iterable<string>, next: (id: string) => readonly string[], label: string) => {
    const done = new Set<string>();
    const visit = (id: string, stack: ReadonlySet<string>): void => {
      if (stack.has(id)) throw new TypeError(`Cyclic ${label} in ${lineage.objectId}: ${id}.`);
      if (done.has(id)) return;
      for (const child of next(id)) visit(child, new Set([...stack, id]));
      done.add(id);
    };
    for (const id of ids) visit(id, new Set());
  };
  acyclic(sources.keys(), id => sources.get(id)!.dependencies, 'source dependency');
  acyclic(products.keys(), id => products.get(id)!.parents, 'product parent');
  return lineage;
}

/** A source can reach a product through other prepared products (e.g. a companion volume's borrowed dataset). */
export function productSourceIds(lineage: ObjectLineage, productId: string, acceptProduct: (product: LineageProduct) => boolean = () => true): string[] {
  const products = new Map(lineage.products.map(product => [product.id, product]));
  const sources = new Map(lineage.sources.map(source => [source.id, source]));
  const ids = new Set<string>();
  const addSource = (id: string): void => {
    if (ids.has(id)) return;
    ids.add(id);
    const source = sources.get(id);
    if (!source) throw new TypeError(`Unknown lineage source: ${id}.`);
    source.dependencies.forEach(addSource);
  };
  const visit = (id: string): void => {
    const product = products.get(id);
    if (!product) throw new TypeError(`Unknown lineage product: ${id}.`);
    if (!acceptProduct(product)) return;
    product.inputs.forEach(addSource);
    product.parents.forEach(visit);
  };
  visit(productId);
  return [...ids];
}
