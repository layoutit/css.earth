import { validateDatasetText } from "./dataset-content.mjs";

const external = value => {
  if (typeof value !== 'string' || /[\s{}]/u.test(value)) return undefined;
  try { return ['https:', 'http:'].includes(new URL(value).protocol) ? value : undefined; }
  catch { return undefined; }
};
const imageUrl = value => {
  const href = external(value);
  if (!href) return undefined;
  const url = new URL(href);
  return /\.(?:jpe?g|png|webp|gif|tiff?|fits?)(?:$|\/)/iu.test(url.pathname)
    || /^image\//iu.test(url.searchParams.get('FORMAT') ?? url.searchParams.get('format') ?? '') ? href : undefined;
};
const sourceImage = source => [source.acquisitionOperation?.url, source.origin, source.sourceUrl].map(imageUrl).find(Boolean);

/** Build-time caption from the dataset's bound input, never another dataset's image. */
export function datasetCaption(provenance, lens) {
  const { title } = validateDatasetText(lens);
  const fallback = { title };
  const product = provenance?.products.find(product => product.id === lens.id || product.lensIds?.includes(lens.id));
  if (!product) return fallback;
  let recipe = provenance.recipes.find(recipe => recipe.id === product.recipe)?.parameters;
  for (const key of product.selector === '' ? [] : product.selector.slice(1).split('/')) {
    recipe = recipe?.[key.replaceAll('~1', '/').replaceAll('~0', '~')];
  }
  // The preparation recipe identifies the main map separately from coverage or lighting inputs.
  const path = typeof recipe === 'string' ? recipe : recipe?.facetField?.path ?? recipe?.source ?? recipe?.mapFile ?? recipe?.path;
  const inputs = product.inputs.map(id => provenance.sources.find(source => source.id === id)).filter(Boolean);
  const primary = inputs.find(source => source.path === path) ?? (inputs.length === 1 ? inputs[0] : undefined);
  if (!primary || primary.kind !== 'source-input') return fallback;
  return {
    title,
    href: sourceImage(primary) ?? external(primary.sourceUrl),
  };
}
