import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { OBJECTS } from '../site/objects.mts';
import { validateObjectProvenance } from '../src/platform/object-provenance.mts';
import type { ProvenanceDocument } from '../src/platform/object-provenance.mts';
import { hasErrorCode } from './source-values.mts';
import { prepareObjectProvenance } from './objects/provenance.mts';
import { sourceObject } from '../src/platform/source-catalog.mts';
import { prepareSpacecraft } from './prepare-spacecraft.mts';
import { writePreparedSet } from './write-prepared-set.mts';

// A fresh run stays a fresh run when its pinned lineage still matches. A changed
// source/recipe/output/binding requires a new record and loses that run claim.
export function provenanceIdentity(document: ProvenanceDocument) {
  const { basis, ...identity } = document;
  return JSON.stringify({ ...identity,
    sources: identity.sources.map(({ verification, ...source }) => source),
    products: identity.products.map(product => ({ ...product,
      outputs: product.outputs.map(({ verification, ...output }) => output) })),
  });
}

export async function recoverObjectProvenance(ids: readonly string[] | null = null, { root = process.cwd(), verify = false } = {}) {
  const selected = OBJECTS.filter(object => !ids || ids.includes(object.id));
  if (ids && selected.length !== new Set(ids).size) throw new TypeError('Unknown object requested for provenance.');
  const results = [];
  const outputs: { path: string; text: string }[] = [];
  const documents = new Map<string, ProvenanceDocument>();
  for (const object of selected) {
    const document = validateObjectProvenance(await prepareObjectProvenance({ objectDirectory: resolve(root, 'src/planets', object.id),
      publicDirectory: resolve(root, 'public/scenes', object.id), basis: 'recovered', verify, write: false }));
    const path = resolve(root, 'src/planets', object.id, 'prepared/provenance.json');
    const existing = await readFile(path, 'utf8').then(text => {
      const raw: unknown = JSON.parse(text);
      if (sourceObject(raw).schema !== 'cssearth-object-provenance@3') return null;
      return validateObjectProvenance(raw);
    }).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
    const retained = existing && provenanceIdentity(existing) === provenanceIdentity(document) ? existing : document;
    documents.set(object.id, retained);
    outputs.push({ path, text: JSON.stringify(retained, null, 2) + '\n' });
    results.push({ id: object.id, products: document.products.length, sources: document.sources.length,
      unresolved: document.coverage.unresolved });
  }
  // Invalid identities, capture pairs, lens IDs or artwork leave the entire
  // previous prepared set in place. Consumers also verify the closure pins.
  const catalogue = await prepareSpacecraft({ root, publish: false, provenance: documents });
  await writePreparedSet([...outputs, ...catalogue.outputs]);
  return results.map(result => ({ ...result,
    citedFacts: catalogue.preparedSources.usage.edges.filter(edge => edge.consumerKind === 'object-fact' && edge.objectId === result.id).length,
    uncitedFacts: catalogue.factsheets.uncited.filter(fact => fact.objectId === result.id).map(fact => fact.factId),
  }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), ids = args.filter(arg => arg !== '--verify');
  for (const result of await recoverObjectProvenance(ids.length ? ids : null, { verify: args.includes('--verify') })) console.log(JSON.stringify(result));
}
