import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { OBJECTS } from '../site/objects.mjs';
import { prepareObjectProvenance } from './objects/provenance.mjs';

// A fresh run stays a fresh run when its pinned lineage still matches. A changed
// source/recipe/output/binding requires a new record and loses that run claim.
export function provenanceIdentity(document) {
  const { basis, ...identity } = document;
  return JSON.stringify({ ...identity,
    sources: identity.sources.map(({ verification, ...source }) => source),
    products: identity.products.map(product => ({ ...product,
      outputs: product.outputs.map(({ verification, ...output }) => output) })),
  });
}

export async function recoverObjectProvenance(ids = null, { root = process.cwd(), verify = false } = {}) {
  const selected = OBJECTS.filter(object => !ids || ids.includes(object.id));
  if (ids && selected.length !== new Set(ids).size) throw new TypeError('Unknown object requested for provenance.');
  const results = [];
  for (const object of selected) {
    const document = await prepareObjectProvenance({ objectDirectory: resolve(root, 'src/planets', object.id),
      publicDirectory: resolve(root, 'public/scenes', object.id), basis: 'recovered', verify, write: false });
    const path = resolve(root, 'src/planets', object.id, 'prepared/provenance.json');
    const existing = await readFile(path, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!existing || provenanceIdentity(existing) !== provenanceIdentity(document))
      await writeFile(path, JSON.stringify(document, null, 2) + '\n');
    results.push({ id: object.id, products: document.products.length, sources: document.sources.length,
      unresolved: document.coverage.unresolved });
  }
  return results;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), ids = args.filter(arg => arg !== '--verify');
  for (const result of await recoverObjectProvenance(ids.length ? ids : null, { verify: args.includes('--verify') })) console.log(JSON.stringify(result));
}
