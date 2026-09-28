import { resolve } from 'node:path';
import { validateObjectProvenance } from '@cssearth/objects/provenance';
import type { ProvenanceDocument } from '@cssearth/objects/provenance';
import { prepareObjectProvenance } from './object-provenance.ts';
import { writePreparedSet } from '../../delivery/index.ts';
import type { PreparedOutput } from '../../delivery/index.ts';
import { RUNTIME_ASSET_ORIGIN } from '../sources/index.ts';
import { readPreparedObjects } from '@cssearth/objects/node';

/**
 * Each body's `prepared/provenance.json` is a build output: the source chain of its manifest, recipes and prepared
 * inventory, laid out for the credit panels and the sources catalogue. It is generated here and never committed.
 * Bytes are checked where they move, at download and at restore, not while this view is written.
 */
/** `checkout` is the checkout whose prepared catalogue lists the scene objects; `root` is where their packages are read. */
export async function objectProvenanceOutputs(ids: readonly string[] | null = null, { root = process.cwd(), checkout = process.cwd() } = {}) {
  const selected = readPreparedObjects(checkout).sceneObjects.filter(object => !ids || ids.includes(object.id));
  if (ids && selected.length !== new Set(ids).size) throw new TypeError('Unknown object requested for provenance.');
  const documents = new Map<string, ProvenanceDocument>(), outputs: { path: string; text: string }[] = [];
  for (const object of selected) {
    const objectDirectory = resolve(root, 'src/objects', object.id);
    const document = validateObjectProvenance(await prepareObjectProvenance({ objectDirectory, publicDirectory: resolve(root, 'public/scenes', object.id), basis: 'recovered', verify: false, write: false }), object.id);
    documents.set(object.id, document);
    outputs.push({ path: resolve(objectDirectory, 'prepared/provenance.json'), text: JSON.stringify(document, null, 2) + '\n' });
  }
  return { documents, outputs };
}

/** The part of the application's catalogue compilation (its facilities and sources catalogue) this module reads. The
 * application passes it in; a run with `catalogue: false` needs none. */
export type CompileCatalogue = (options: { root: string; publish: false; provenance: ReadonlyMap<string, ProvenanceDocument>; mirrorOrigin: string | null;
  packageMode?: 'published' }) => Promise<{
  readonly outputs: readonly PreparedOutput[]; readonly catalogueOutputs: readonly PreparedOutput[];
  readonly preparedSources: { readonly usage: { readonly edges: readonly { readonly consumerKind: string; readonly objectId?: string }[] } };
}>;

export async function recoverObjectProvenance(ids: readonly string[] | null = null, { root = process.cwd(), checkout = process.cwd(), catalogue = true, compile, write = writePreparedSet }:
  { root?: string; checkout?: string; catalogue?: boolean; compile?: CompileCatalogue; write?: typeof writePreparedSet } = {}) {
  if (catalogue && !compile) throw new TypeError('A provenance run that rebuilds the catalogue needs the application\'s catalogue compilation.');
  const { documents, outputs } = await objectProvenanceOutputs(ids, { root, checkout });
  // A run for named objects writes their records and the shared catalogue, nothing else. The other packages enter the
  // catalogue as installed, the way dev:prepare and deploy compile it. Rebuilding them from their authoring inputs here
  // rewrote the inventories of 16 unrelated volume and context packages (M31, LMC and others) whose local files had drifted.
  // Invalid identities, capture pairs, lens IDs or artwork leave the entire previous prepared set in place.
  const compiled = catalogue && compile ? await compile({ root, publish: false, provenance: documents, mirrorOrigin: RUNTIME_ASSET_ORIGIN,
    ...(ids ? { packageMode: 'published' as const } : {}) }) : null;
  await write([...outputs, ...(compiled ? ids ? compiled.catalogueOutputs : compiled.outputs : [])]);
  return [...documents.values()].map(document => ({ id: document.objectId, products: document.products.length, sources: document.sources.length,
    unresolved: document.coverage.unresolved,
    ...(compiled ? { citedFacts: compiled.preparedSources.usage.edges.filter(edge => edge.consumerKind === 'object-fact' && edge.objectId === document.objectId).length } : {}),
  }));
}
