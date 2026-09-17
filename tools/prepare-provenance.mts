import { preparationEvidenceApplies } from './preparation-evidence.mts';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { SCENE_OBJECTS } from '../site/objects.mts';
import { validateObjectProvenance } from '../src/platform/object-provenance.mts';
import type { ProvenanceDocument } from '../src/platform/object-provenance.mts';
import { hasErrorCode } from './source-values.mts';
import { prepareObjectProvenance } from './objects/provenance.mts';
import { sourceObject } from '../src/platform/source-catalog.mts';
import { prepareFacilities } from './prepare-facilities.mts';
import { writePreparedSet } from './write-prepared-set.mts';

// A fresh run stays a fresh run when its pinned lineage still matches. A changed
// source/recipe/output/binding requires a new record and loses that run claim.
export function provenanceIdentity(document: ProvenanceDocument) {
  // The verifier's own identity is metadata: a rule or compiler edit that yields the same material keeps the record.
  const { basis, lastPreparation, generator, ...identity } = document;
  return JSON.stringify({ ...identity,
    sources: identity.sources.map(({ verification, ...source }) => source),
    products: identity.products.map(product => ({ ...product,
      outputs: product.outputs.map(({ verification, ...output }) => output) })),
  });
}

export type ProvenanceOutcome = 'retained' | 'verified' | 'recovered' | 'unverifiable';
export interface ReconciledProvenance { document: ProvenanceDocument; outcome: ProvenanceOutcome; reason?: string }

/**
 * Bring one body's record up to date without ever weakening it. A prepared record with an unchanged identity is kept.
 * Anything else is byte-verified and recorded as prepared: a changed identity, or a record that was only recovered.
 * When a pinned file is not on disk or its bytes differ, a prepared record stays as it is and the body is reported;
 * a recovered record is refreshed as recovered, and `recover` allows that for a prepared record too.
 */
export async function reconcileObjectProvenance({ objectDirectory, publicDirectory, recover = false }:
  { objectDirectory: string; publicDirectory: string; recover?: boolean }): Promise<ReconciledProvenance> {
  const existing = await readFile(resolve(objectDirectory, 'prepared/provenance.json'), 'utf8').then(text => {
    const raw: unknown = JSON.parse(text);
    if (sourceObject(raw).schema !== 'cssearth-object-provenance@3') return null;
    return validateObjectProvenance(raw);
  }).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
  const recovered = validateObjectProvenance(await prepareObjectProvenance({ objectDirectory, publicDirectory, basis: 'recovered', verify: false, write: false }));
  const unchanged = existing !== null && provenanceIdentity(existing) === provenanceIdentity(recovered);
  if (unchanged && existing.basis === 'prepared') return { document: existing, outcome: 'retained' };
  try {
    return { document: validateObjectProvenance(await prepareObjectProvenance({ objectDirectory, publicDirectory, basis: 'prepared', verify: true, write: false })), outcome: 'verified' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const reason = hasErrorCode(error, 'ENOENT') ? `missing ${relative(objectDirectory, String((error as NodeJS.ErrnoException).path ?? ''))}`
      : /identity mismatch/u.test(message) ? message.replace(/^Provenance identity mismatch: /u, 'bytes differ at ').replace(/\.$/u, '') : null;
    if (reason === null) throw error;
    if (existing?.basis === 'prepared' && !recover) return { document: existing, outcome: 'unverifiable', reason };
    return { document: unchanged ? existing : recovered, outcome: 'recovered', reason };
  }
}

export async function recoverObjectProvenance(ids: readonly string[] | null = null, { root = process.cwd(), recover = false } = {}) {
  const selected = SCENE_OBJECTS.filter(object => !ids || ids.includes(object.id));
  if (ids && selected.length !== new Set(ids).size) throw new TypeError('Unknown object requested for provenance.');
  const results = [];
  const outputs: { path: string; text: string }[] = [];
  const documents = new Map<string, ProvenanceDocument>();
  const unverifiable: string[] = [], unverified: string[] = [];
  for (const object of selected) {
    const objectDirectory = resolve(root, 'src/objects', object.id);
    const { document, outcome, reason } = await reconcileObjectProvenance({ objectDirectory, publicDirectory: resolve(root, 'public/scenes', object.id), recover });
    if (outcome === 'unverifiable') unverifiable.push(`${object.id} (${reason})`);
    else if (reason) unverified.push(`${object.id} (${reason})`);
    documents.set(object.id, document);
    outputs.push({ path: resolve(objectDirectory, 'prepared/provenance.json'), text: JSON.stringify(document, null, 2) + '\n' });
    results.push({ id: object.id, outcome, products: document.products.length, sources: document.sources.length,
      unresolved: document.coverage.unresolved, lastPreparation: document.lastPreparation ? (preparationEvidenceApplies(document) ? 'material-matches' : 'material-changed') : 'not-recorded' });
  }
  // A prepared record is never replaced by a weaker one. Stop before the catalogue, which would only repeat the problem.
  if (unverifiable.length) throw new Error(`These bodies changed but cannot be verified on this checkout; prepare them where their sources are, or pass --recover to record them as recovered: ${unverifiable.join(', ')}.`);
  if (unverified.length) console.error(`Recovered records that cannot be verified here: ${unverified.join(', ')}.`);
  // Invalid identities, capture pairs, lens IDs or artwork leave the entire
  // previous prepared set in place. Consumers also verify the closure pins.
  const catalogue = await prepareFacilities({ root, publish: false, provenance: documents });
  await writePreparedSet([...outputs, ...catalogue.outputs]);
  return results.map(result => ({ ...result,
    citedFacts: catalogue.preparedSources.usage.edges.filter(edge => edge.consumerKind === 'object-fact' && edge.objectId === result.id).length,
  }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), ids = args.filter(arg => arg !== '--recover');
  for (const result of await recoverObjectProvenance(ids.length ? ids : null, { recover: args.includes('--recover') })) console.log(JSON.stringify(result));
}
