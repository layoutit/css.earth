import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';

import {readFieldCatalogueTsv,mergeFieldCatalogue} from '@cssearth/nebula-reconstruction/stars/field-catalogue';
export {readFieldCatalogueTsv,mergeFieldCatalogue,type ObservedFieldStar} from '@cssearth/nebula-reconstruction/stars/field-catalogue';
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, label: string): string => { if (typeof v !== 'string' || !v) throw new TypeError(`Missing ${label}.`); return v; };
/** Reproduce a bounded cone from its evidence file; raw-response headers may change, scientific rows may not. */
export async function acquireFieldCatalogue(root: string, evidencePath: string) {
  const evidence: unknown = JSON.parse(await readFile(resolve(root, evidencePath), 'utf8'));
  if (!record(evidence) || evidence.schema !== 'cssearth-stellar-source-evidence@1' || !record(evidence.catalogue) || !Array.isArray(evidence.inputs))
    throw new TypeError('Invalid stellar source evidence.');
  const catalogueId = text(evidence.id, 'catalogue identity');
  const output = resolve(root, text(evidence.catalogue.path, 'catalogue path'));
  if (relative(root, output).startsWith('..')) throw new TypeError('Catalogue output must remain in repository.');
  const sourceText: string[] = [];
  for (const kind of ['hipparcos', 'tycho2'] as const) {
    const pin: unknown = evidence.inputs.find((v: unknown) => record(v) && v.kind === kind);
    if (!record(pin)) throw new TypeError(`Missing ${kind} source.`);
    const path = resolve(root, text(pin.path, 'cache path')), expected = text(pin.dataSha256, 'scientific-row hash');
    if (relative(root, path).startsWith('..')) throw new TypeError('Cache must remain in repository.');
    let bytes: Buffer;
    try { bytes = await readFile(path); } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
      const response = await fetch(text(pin.url, 'source URL'), { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`Catalogue download failed: ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (readFieldCatalogueTsv(bytes.toString(), kind).dataSha256 !== expected) throw new Error('Downloaded scientific catalogue changed.');
      await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes);
    }
    if (readFieldCatalogueTsv(bytes.toString(), kind).dataSha256 !== expected) throw new Error('Cached scientific catalogue changed.');
    sourceText.push(bytes.toString());
  }
  const prepared = mergeFieldCatalogue(sourceText[0]!, sourceText[1]!);
  const result = { schema: 'cssearth-observed-stellar-catalogue@1', id: catalogueId, frame: 'ICRS', coordinateEpochJulianYear: 2000, stars: prepared.stars };
  const bytes = JSON.stringify(result, null, 2) + '\n';
  if (sha(bytes) !== text(evidence.catalogue.sha256, 'prepared catalogue hash')) throw new Error('Catalogue replay did not reproduce pinned output.');
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, bytes);
  return { cataloguePath: relative(root, output), stars: result.stars.length, skipped: prepared.skipped.length, sha256: sha(bytes) };
}
