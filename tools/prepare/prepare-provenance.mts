import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SCENE_OBJECTS } from '../../site/objects.mts';
import { validateObjectProvenance } from '../../src/platform/object-provenance.mts';
import type { ProvenanceDocument } from '../../src/platform/object-provenance.mts';
import { prepareObjectProvenance } from '../objects/provenance.mts';
import { prepareFacilities } from './prepare-facilities.mts';
import { writePreparedSet } from '../prepared/write-prepared-set.mts';
import type { PreparedOutput } from '../prepared/write-prepared-set.mts';
import { RUNTIME_ASSET_ORIGIN } from '../assets/source-mirror.mts';

/**
 * Each body's `prepared/provenance.json` is a build output: the source chain of its manifest, recipes and prepared
 * inventory, laid out for the credit panels and the sources catalogue. It is generated here and never committed.
 * Bytes are checked where they move, at download and at restore, not while this view is written.
 */
export async function objectProvenanceOutputs(ids: readonly string[] | null = null, { root = process.cwd() } = {}) {
  const selected = SCENE_OBJECTS.filter(object => !ids || ids.includes(object.id));
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

/** The part of a catalogue compilation this module reads. */
type CompileCatalogue = (options: Parameters<typeof prepareFacilities>[0]) => Promise<{
  readonly outputs: readonly PreparedOutput[]; readonly catalogueOutputs: readonly PreparedOutput[];
  readonly preparedSources: { readonly usage: { readonly edges: readonly { readonly consumerKind: string; readonly objectId?: string }[] } };
}>;
const compileCatalogue: CompileCatalogue = prepareFacilities;

export async function recoverObjectProvenance(ids: readonly string[] | null = null, { root = process.cwd(), catalogue = true, compile = compileCatalogue, write = writePreparedSet }:
  { root?: string; catalogue?: boolean; compile?: CompileCatalogue; write?: typeof writePreparedSet } = {}) {
  const { documents, outputs } = await objectProvenanceOutputs(ids, { root });
  // A run for named objects writes their records and the shared catalogue, nothing else. The other packages enter the
  // catalogue as installed, the way dev:prepare and deploy compile it. Rebuilding them from their authoring inputs here
  // rewrote the inventories of 16 unrelated volume and context packages (M31, LMC and others) whose local files had drifted.
  // Invalid identities, capture pairs, lens IDs or artwork leave the entire previous prepared set in place.
  const compiled = catalogue ? await compile({ root, publish: false, provenance: documents, mirrorOrigin: RUNTIME_ASSET_ORIGIN,
    ...(ids ? { packageMode: 'published' as const } : {}) }) : null;
  await write([...outputs, ...(compiled ? ids ? compiled.catalogueOutputs : compiled.outputs : [])]);
  return [...documents.values()].map(document => ({ id: document.objectId, products: document.products.length, sources: document.sources.length,
    unresolved: document.coverage.unresolved,
    ...(compiled ? { citedFacts: compiled.preparedSources.usage.edges.filter(edge => edge.consumerKind === 'object-fact' && edge.objectId === document.objectId).length } : {}),
  }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), ids = args.filter(arg => arg !== '--objects-only');
  const results = await recoverObjectProvenance(ids.length ? ids : null, { catalogue: !args.includes('--objects-only') });
  if (args.includes('--objects-only')) console.log(JSON.stringify({ objects: results.length }));
  else for (const result of results) console.log(JSON.stringify(result));
}
