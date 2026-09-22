import { parsePreparationEvidence } from './preparation-evidence.mts';
import type { PreparationEvidence } from './preparation-evidence.mts';
import { validateInputEvidence } from './product-input-evidence.mts';
import type { ProductInputEvidence } from './product-input-evidence.mts';
import { isArray } from './is-array.mts';
import { parseCapture } from './exploration-catalog.mts';
import type { Capture } from './exploration-catalog.mts';
import { parseSourceBinding } from './source-catalog.mts';
import type { SourceBinding } from './source-catalog.mts';
export type ProvenanceJson = null | boolean | number | string | readonly ProvenanceJson[] | { readonly [key: string]: ProvenanceJson };
export interface ProvenanceOperation { readonly url?: string; readonly [key: string]: ProvenanceJson | undefined; }
export interface ProvenanceSource {
  readonly id: string; readonly kind?: string; readonly path: string; readonly origin: string;
  readonly credit: string; readonly acquisition: string;
  /** Measured from the bytes when the file is present; a download that is not restored records none. */
  readonly sha256?: string; readonly bytes?: number;
  readonly dependencies: readonly string[]; readonly verification: string; readonly license?: string;
  readonly redistribution?: string; readonly sourceUrl?: string;
  readonly displayCredit?: string; readonly title?: string; readonly label?: string; readonly attributionGroup?: { readonly id: string };
  /** Set when the input is a dataset's own source rather than a file supporting it. */
  readonly lensId?: string;
  readonly capture?: Capture;
  readonly sourceBinding?: SourceBinding;
  readonly acquisitionOperation?: ProvenanceOperation | null;
  readonly verificationOperations?: readonly ProvenanceOperation[];
}
export interface ProvenanceRecipe { readonly id: string; readonly path: string; readonly sha256: string; readonly parameters: ProvenanceJson; }
export interface ProvenanceOutput { readonly url: string; readonly sha256: string; readonly bytes: number; readonly verification: string; }
export interface ProvenanceProduct {
  readonly inputEvidence?: readonly ProductInputEvidence[];
  /** Whether source capture lineage may credit a displayed view; never an observation-quality claim. */
  readonly observationAttribution?: 'source-lineage' | 'none';
  readonly id: string; readonly label: string; readonly process: string; readonly recipe: string; readonly selector: string;
  readonly recipeDependencies: readonly string[]; readonly inputs: readonly string[]; readonly parents: readonly string[];
  readonly interpretation?: { readonly kind?: string; readonly sourceKind?: string };
  readonly outputs: readonly ProvenanceOutput[]; readonly limitations?: readonly string[]; readonly lensIds?: readonly string[];
}
export interface ProvenanceDocument {
  readonly lastPreparation?: PreparationEvidence;
  readonly schema: string; readonly objectId: string; readonly basis: string;
  readonly manifest: { readonly path: string };
  readonly generator: { readonly path: string };
  readonly sources: readonly ProvenanceSource[]; readonly recipes: readonly ProvenanceRecipe[]; readonly products: readonly ProvenanceProduct[];
  readonly coverage: { readonly scope: string; readonly unresolved: readonly ProvenanceJson[] };
}
/** Portable, prepared source-to-product lineage. No file access or UI inference. */
export const OBJECT_PROVENANCE_SCHEMA = 'cssearth-object-provenance@3';
const digest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const unique = (values: readonly unknown[], label: string) => {
  if (new Set(values).size !== values.length) throw new TypeError(`Duplicate provenance ${label}.`);
};
const selectedOperation = (parameters: ProvenanceJson | undefined, pointer: string): ProvenanceJson | undefined => {
  if (pointer === '') return parameters;
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) return undefined;
  let value = parameters;
  for (const encoded of pointer.slice(1).split('/')) {
    const key = encoded.replaceAll('~1', '/').replaceAll('~0', '~');
    if (value === null || typeof value !== 'object') return undefined;
    value = Object.getOwnPropertyDescriptor(value, key)?.value;
  }
  return value;
};

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !isArray(value);
const strings = (value: unknown): value is readonly string[] => isArray(value) && value.every(entry => typeof entry === 'string');
const optionalString = (value: unknown) => value === undefined || typeof value === 'string';
function json(value: unknown, ancestors = new Set<object>()): value is ProvenanceJson {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value) || (!isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))) return false;
  ancestors.add(value);
  const valid = Object.values(value as Record<string, unknown>).every(entry => json(entry, ancestors));
  ancestors.delete(value);
  return valid;
}
function operation(value: unknown): value is ProvenanceOperation {
  return record(value) && optionalString(value.url) && Object.values(value).every(entry => entry === undefined || json(entry));
}
function sourceShape(value: unknown): value is ProvenanceSource {
  return record(value) && ['id','path','origin','credit','acquisition','verification'].every(key => typeof value[key] === 'string')
    && optionalString(value.sha256) && (value.bytes === undefined || typeof value.bytes === 'number') && strings(value.dependencies)
    && ['kind','license','redistribution','sourceUrl','displayCredit','title','label','lensId'].every(key => optionalString(value[key]))
    && (value.attributionGroup === undefined || record(value.attributionGroup) && typeof value.attributionGroup.id === 'string')
    && (value.capture === undefined || validCapture(value.capture))
    && (value.sourceBinding === undefined || validSourceBinding(value.sourceBinding))
    && (value.acquisitionOperation == null || operation(value.acquisitionOperation))
    && (value.verificationOperations === undefined || isArray(value.verificationOperations) && value.verificationOperations.every(operation));
}
function validCapture(value: unknown): value is Capture {
  try { parseCapture(value); return true; } catch { return false; }
}
function validSourceBinding(value: unknown): value is SourceBinding {
  try { parseSourceBinding(value); return true; } catch { return false; }
}
function recipeShape(value: unknown): value is ProvenanceRecipe {
  return record(value) && ['id','path','sha256'].every(key => typeof value[key] === 'string') && json(value.parameters);
}
function outputShape(value: unknown): value is ProvenanceOutput {
  return record(value) && ['url','sha256','verification'].every(key => typeof value[key] === 'string') && typeof value.bytes === 'number';
}
function productShape(value: unknown): value is ProvenanceProduct {
  return record(value) && ['id','label','process','recipe','selector'].every(key => typeof value[key] === 'string')
    && (value.observationAttribution === undefined || value.observationAttribution === 'source-lineage' || value.observationAttribution === 'none')
    && ['recipeDependencies','inputs','parents'].every(key => strings(value[key]))
    && ['limitations','lensIds'].every(key => value[key] === undefined || strings(value[key]))
    && (value.interpretation === undefined || record(value.interpretation) && optionalString(value.interpretation.kind) && optionalString(value.interpretation.sourceKind))
    && isArray(value.outputs) && value.outputs.every(outputShape);
}
function documentShape(value: unknown): value is ProvenanceDocument {
  return record(value) && ['schema','objectId','basis'].every(key => typeof value[key] === 'string')
    && record(value.manifest) && typeof value.manifest.path === 'string'
    && record(value.generator) && typeof value.generator.path === 'string'
    && isArray(value.sources) && value.sources.every(sourceShape)
    && isArray(value.recipes) && value.recipes.every(recipeShape)
    && isArray(value.products) && value.products.every(productShape)
    && record(value.coverage) && typeof value.coverage.scope === 'string'
    && isArray(value.coverage.unresolved) && value.coverage.unresolved.every(entry => json(entry));
}

export function validateObjectProvenance(input: unknown, objectId?: string): ProvenanceDocument {
  if (!documentShape(input)) throw new TypeError('Invalid object provenance document.');
  const value = input;
  objectId ??= value.objectId;
  if (value?.schema !== OBJECT_PROVENANCE_SCHEMA || value.objectId !== objectId || !nonempty(objectId)
      || !['recovered', 'prepared'].includes(value.basis)
      || !isArray(value.sources) || !isArray(value.recipes) || !isArray(value.products)
      || value.coverage?.scope !== 'object-datasets-and-bound-rendering-products'
      || !isArray(value.coverage?.unresolved)) throw new TypeError('Invalid object provenance document.');
  if (value.lastPreparation !== undefined && parsePreparationEvidence(value.lastPreparation).objectId !== objectId) throw new TypeError('Preparation evidence belongs to a different object.');
  unique(value.sources.map(source => source.id), 'source');
  unique(value.recipes.map(recipe => recipe.id), 'recipe');
  unique(value.products.map(product => product.id), 'product');
  for (const source of value.sources) {
    if (source.kind === 'source-input' && source.sourceBinding === undefined) throw new TypeError(`Unbound canonical source input: ${source.id}.`);
    if (![source.id, source.path, source.origin, source.credit, source.acquisition].every(nonempty)
        || (source.sha256 !== undefined && !digest(source.sha256)) || (source.bytes !== undefined && (!Number.isSafeInteger(source.bytes) || source.bytes < 0)))
      throw new TypeError(`Invalid provenance source: ${source.id}.`);
    if (source.capture) parseCapture(source.capture);
  }
  for (const recipe of value.recipes) {
    if (![recipe.id, recipe.path].every(nonempty) || !digest(recipe.sha256) || !recipe.parameters) throw new TypeError('Invalid provenance recipe.');
  }
  const sources = new Set(value.sources.map(source => source.id)), recipes = new Set(value.recipes.map(recipe => recipe.id));
  const sourceById = new Map(value.sources.map(source => [source.id, source]));
  const visitSource = (id: string, stack = new Set<string>()): void => {
    if (stack.has(id)) throw new TypeError('Cyclic provenance source dependency.');
    const source = sourceById.get(id);
    if (!source || !isArray(source.dependencies) || source.dependencies.some((id: string) => !sources.has(id)))
      throw new TypeError('Unbound provenance source dependency.');
    unique(source.dependencies, 'source dependency');
    for (const dependency of source.dependencies) visitSource(dependency, new Set([...stack, id]));
  };
  sources.forEach(id => visitSource(id));
  if (value.basis === 'prepared' && value.sources.some(source => source.verification !== 'bytes-verified'))
    throw new TypeError('Prepared provenance contains unverified source bytes.');
  const products = new Map(value.products.map(product => [product.id, product]));
  for (const product of value.products) {
    if (![product.id, product.label, product.process].every(nonempty) || !recipes.has(product.recipe)
        || !isArray(product.recipeDependencies) || !product.recipeDependencies.includes(product.recipe)
        || product.recipeDependencies.some((id: string) => !recipes.has(id))
        || selectedOperation(value.recipes.find(recipe => recipe.id === product.recipe)?.parameters, product.selector) === undefined
        || !isArray(product.inputs) || product.inputs.some((id: string) => !sources.has(id))
        || !isArray(product.parents) || product.parents.some((id: string) => !products.has(id))
        || !isArray(product.outputs) || product.outputs.length === 0)
      throw new TypeError(`Unbound provenance product: ${product.id}.`);
    unique(product.inputs, 'product input');
    validateInputEvidence(product);
    unique(product.parents, 'product parent');
    for (const output of product.outputs) {
      if (!nonempty(output.url) || !digest(output.sha256) || !Number.isSafeInteger(output.bytes) || output.bytes < 0)
        throw new TypeError(`Unpinned provenance output: ${product.id}.`);
      if (value.basis === 'prepared' && output.verification !== 'bytes-verified')
        throw new TypeError('Prepared provenance contains unverified output bytes.');
    }
  }
  const visit = (id: string, stack = new Set<string>()): void => {
    if (stack.has(id)) throw new TypeError('Cyclic object provenance.');
    for (const parent of products.get(id)!.parents) visit(parent, new Set([...stack, id]));
  };
  products.forEach(product => visit(product.id));
  return value;
}

/** A source can reach a product through other prepared products (e.g. a preview). */
export function productSourceIds(document: ProvenanceDocument, productId: string, acceptProduct: (product: ProvenanceProduct) => boolean = () => true): string[] {
  const products = new Map(document.products.map(product => [product.id, product]));
  const sources = new Map(document.sources.map(source => [source.id, source]));
  const ids = new Set<string>();
  const addSource = (id: string): void => {
    if (ids.has(id)) return;
    ids.add(id);
    const source = sources.get(id);
    if (!source) throw new TypeError(`Unknown provenance source: ${id}.`);
    source.dependencies.forEach(addSource);
  };
  const visit = (id: string): void => {
    const product = products.get(id);
    if (!product) throw new TypeError(`Unknown provenance product: ${id}.`);
    if (!acceptProduct(product)) return;
    product.inputs.forEach(addSource);
    product.parents.forEach(visit);
  };
  visit(productId);
  return [...ids];
}
