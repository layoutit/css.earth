import { isRecord as coreIsRecord } from '@cssearth/core';
import { OBSERVED_STELLAR_CATALOGUE_SCHEMA } from '@cssearth/objects';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';

import {readFieldCatalogueTsv,mergeFieldCatalogue} from '@cssearth/nebula-reconstruction/stars/field-catalogue';
export {readFieldCatalogueTsv,mergeFieldCatalogue,type ObservedFieldStar} from '@cssearth/nebula-reconstruction/stars/field-catalogue';
const record = coreIsRecord;
const text = (v: unknown, label: string): string => { if (typeof v !== 'string' || !v) throw new TypeError(`Missing ${label}.`); return v; };
/** Reproduce a bounded cone from its evidence file; a checked-in catalogue must be reproduced exactly. */
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
    const path = resolve(root, text(pin.path, 'cache path'));
    if (relative(root, path).startsWith('..')) throw new TypeError('Cache must remain in repository.');
    let bytes: Buffer;
    try { bytes = await readFile(path); } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
      const response = await fetch(text(pin.url, 'source URL'), { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`Catalogue download failed: ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      readFieldCatalogueTsv(bytes.toString(), kind);
      await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes);
    }
    sourceText.push(bytes.toString());
  }
  const prepared = mergeFieldCatalogue(sourceText[0]!, sourceText[1]!);
  const result = { schema: OBSERVED_STELLAR_CATALOGUE_SCHEMA, id: catalogueId, frame: 'ICRS', coordinateEpochJulianYear: 2000, stars: prepared.stars };
  const bytes = JSON.stringify(result, null, 2) + '\n';
  // The checked-in catalogue is the record: a replay that writes different rows stops instead of replacing it.
  const existing = await readFile(output, 'utf8').catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
  if (existing !== null && existing !== bytes) throw new Error(`Catalogue replay did not reproduce ${relative(root, output)}.`);
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, bytes);
  return { cataloguePath: relative(root, output), stars: result.stars.length, skipped: prepared.skipped.length };
}
