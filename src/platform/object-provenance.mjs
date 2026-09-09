/** Portable, prepared source-to-product lineage. No file access or UI inference. */
export const OBJECT_PROVENANCE_SCHEMA = 'cssearth-object-provenance@1';
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const unique = (values, label) => {
  if (new Set(values).size !== values.length) throw new TypeError(`Duplicate provenance ${label}.`);
};
const selectedOperation = (parameters, pointer) => {
  if (pointer === '') return parameters;
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) return undefined;
  return pointer.slice(1).split('/').reduce((value, key) =>
    value?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], parameters);
};

export function validateObjectProvenance(value, objectId = value?.objectId) {
  if (value?.schema !== OBJECT_PROVENANCE_SCHEMA || value.objectId !== objectId || !nonempty(objectId)
      || !['recovered', 'prepared'].includes(value.basis)
      || !digest(value.manifest?.sha256) || !digest(value.generator?.sha256) || !digest(value.generator?.bindingsSha256)
      || !Array.isArray(value.sources) || !Array.isArray(value.recipes) || !Array.isArray(value.products)
      || value.coverage?.scope !== 'object-datasets-and-bound-rendering-products'
      || !Array.isArray(value.coverage?.unresolved)) throw new TypeError('Invalid object provenance document.');
  unique(value.sources.map(source => source.id), 'source');
  unique(value.recipes.map(recipe => recipe.id), 'recipe');
  unique(value.products.map(product => product.id), 'product');
  for (const source of value.sources) {
    if (![source.id, source.path, source.origin, source.credit, source.acquisition].every(nonempty)
        || !digest(source.sha256) || !Number.isSafeInteger(source.bytes) || source.bytes < 0)
      throw new TypeError(`Invalid provenance source: ${source.id}.`);
    if (source.capture) {
      const ids = source.capture.spacecraftIds;
      if (!Array.isArray(ids) || !ids.length || ids.some(id => !/^[a-z][a-z0-9-]*$/u.test(id))
          || !nonempty(source.capture.evidence)) throw new TypeError(`Invalid source capture: ${source.id}.`);
      unique(ids, 'capture spacecraft');
    }
  }
  for (const recipe of value.recipes) {
    if (![recipe.id, recipe.path].every(nonempty) || !digest(recipe.sha256) || !recipe.parameters) throw new TypeError('Invalid provenance recipe.');
  }
  const sources = new Set(value.sources.map(source => source.id)), recipes = new Set(value.recipes.map(recipe => recipe.id));
  const sourceById = new Map(value.sources.map(source => [source.id, source]));
  const visitSource = (id, stack = new Set()) => {
    if (stack.has(id)) throw new TypeError('Cyclic provenance source dependency.');
    const source = sourceById.get(id);
    if (!Array.isArray(source.dependencies) || source.dependencies.some(id => !sources.has(id)))
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
        || !Array.isArray(product.recipeDependencies) || !product.recipeDependencies.includes(product.recipe)
        || product.recipeDependencies.some(id => !recipes.has(id))
        || selectedOperation(value.recipes.find(recipe => recipe.id === product.recipe)?.parameters, product.selector) === undefined
        || !Array.isArray(product.inputs) || product.inputs.some(id => !sources.has(id))
        || !Array.isArray(product.parents) || product.parents.some(id => !products.has(id))
        || !Array.isArray(product.outputs) || product.outputs.length === 0)
      throw new TypeError(`Unbound provenance product: ${product.id}.`);
    unique(product.inputs, 'product input');
    unique(product.parents, 'product parent');
    for (const output of product.outputs) {
      if (!nonempty(output.url) || !digest(output.sha256) || !Number.isSafeInteger(output.bytes) || output.bytes < 0)
        throw new TypeError(`Unpinned provenance output: ${product.id}.`);
      if (value.basis === 'prepared' && output.verification !== 'bytes-verified')
        throw new TypeError('Prepared provenance contains unverified output bytes.');
    }
  }
  const visit = (id, stack = new Set()) => {
    if (stack.has(id)) throw new TypeError('Cyclic object provenance.');
    for (const parent of products.get(id).parents) visit(parent, new Set([...stack, id]));
  };
  products.forEach(product => visit(product.id));
  return value;
}

/** A source can reach a product through other prepared products (e.g. a preview). */
export function productSourceIds(document, productId) {
  const products = new Map(document.products.map(product => [product.id, product]));
  const sources = new Map(document.sources.map(source => [source.id, source]));
  const ids = new Set();
  const addSource = id => {
    if (ids.has(id)) return;
    ids.add(id);
    sources.get(id).dependencies.forEach(addSource);
  };
  const visit = id => {
    const product = products.get(id);
    if (!product) throw new TypeError(`Unknown provenance product: ${id}.`);
    product.inputs.forEach(addSource);
    product.parents.forEach(visit);
  };
  visit(productId);
  return [...ids];
}
