import { productSourceIds, validateObjectProvenance } from '../src/platform/object-provenance.mjs';

const external = url => {
  if (typeof url !== 'string' || /[\s{}]/u.test(url)) return false;
  try { return ['https:', 'http:'].includes(new URL(url).protocol); } catch { return false; }
};

/** Presentation only: dependency and source decisions belong to preparation. */
export function objectSources(provenance) {
  if (!provenance) return [];
  const document = validateObjectProvenance(provenance);
  const uses = new Map();
  for (const product of document.products) {
    for (const id of productSourceIds(document, product.id)) {
      const labels = uses.get(id) ?? new Set();
      if (!product.parents.length) labels.add(product.label);
      uses.set(id, labels);
    }
  }
  const groups = new Map();
  for (const source of document.sources.filter(source => source.kind === 'source-input' && uses.has(source.id))) {
    const credit = source.displayCredit ?? source.credit;
    // This only groups attribution in the card. The underlying source identities,
    // product links, licenses and multi-input dependencies remain distinct.
    const key = `${source.attributionGroup?.id ?? credit}|${credit}`;
    const href = [source.sourceUrl, source.origin, source.acquisitionOperation?.url,
      ...(source.verificationOperations ?? []).map(operation => operation.url)].find(external);
    // The internal record keeps authored specifications and intermediate files.
    // This card is the external sources list, so it does not expose local JSON.
    if (!href) continue;
    const link = { id: source.id, href,
      label: source.title ?? source.label ?? source.path.split('/').at(-1) };
    const group = groups.get(key);
    if (group) {
      group.sourceIds.push(source.id);
      group.links.push(link);
      group.usedFor = [...new Set([...group.usedFor, ...uses.get(source.id)])];
    } else groups.set(key, {
      id: key, sourceIds: [source.id], links: [link],
      description: credit,
      usedFor: [...uses.get(source.id)], role: 'provenance',
    });
  }
  return [...groups.values()];
}
