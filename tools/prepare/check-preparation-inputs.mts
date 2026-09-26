/** Check what the preparation chain's later steps read, before its long bake, so a bad input fails in seconds.
 *
 *   node tools/prepare/cli/check-preparation-inputs.mts <object-id>...
 *
 * - Reader text. The text step runs after the bake and refuses a block over its budget; Aspasia's 134-character summary
 *   (budget 125) failed there after the bake had finished. Each named object's `text.json` is checked against the same
 *   budgets first.
 * - The Sun's files. The world and pins steps build on the Sun, and pins records every file under its `prepared/` in
 *   its inventory, so a stale local file would be pinned and published as the Sun's new state (11 were stale in one
 *   run). Each file that differs from the Sun's inventory is restored from R2 by hash, as `pnpm setup:assets` does,
 *   except the files the world step writes itself, and its page data is derived when missing. A run that prepares the
 *   Sun skips this. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sha256 } from '@cssearth/core/node';
import { hasErrorCode } from '@cssearth/core';
import { parseObjectText, textBudgetErrors } from '../../site/object-text.mts';
import type { TextFinding } from '../../site/object-text.mts';
import { inventoryAssets } from '../assets/runtime-assets.mts';
import type { InventoryAsset } from '../../src/platform/runtime-asset-closure.mts';
import { installRuntimeAssets } from '../assets/setup.mts';

const root = resolve(import.meta.dirname, '../..');
const readOptional = (path: string) => readFile(path).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });

/** Budget findings for each named object's authored reader text. Catalogue objects keep none and are skipped. */
export async function textBudgetFindings(ids: readonly string[], projectRoot = root): Promise<TextFinding[]> {
  const findings: TextFinding[] = [];
  for (const id of ids) {
    const path = resolve(projectRoot, 'src/objects', id, 'text.json'), bytes = await readOptional(path);
    if (bytes === null) continue;
    try { findings.push(...textBudgetErrors(parseObjectText(JSON.parse(bytes.toString('utf8')), id))); }
    catch (error) { findings.push({ objectId: id, slot: 'text.json', rule: 'schema', detail: error instanceof Error ? error.message : String(error) }); }
  }
  return findings;
}

/** The Sun's files that the world step rewrites before pins reads them (tools/objects/prepare-spatial-context.ts). */
export const worldStepOutput = ({ location, filename }: InventoryAsset) =>
  location === 'prepared' && /^(?:world-context(?:-summary)?\.json|world-orbits\/|system-views\/)/u.test(filename);

/** Restore from R2 each inventoried file of `id` whose local copy is missing or differs from its inventory, leaving the
 * ones `keep` names. Returns the restored files as `<location>/<filename>`. */
export async function restoreDriftedFiles(id: string, { projectRoot = root, keep = (_asset: InventoryAsset) => false, fetcher = fetch }:
  { projectRoot?: string; keep?: (asset: InventoryAsset) => boolean; fetcher?: typeof fetch } = {}) {
  const drifted = [];
  for (const asset of await inventoryAssets(projectRoot, [id])) {
    if (keep(asset)) continue;
    const bytes = await readOptional(asset.file);
    if (bytes === null || bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) drifted.push(asset);
  }
  if (drifted.length) await installRuntimeAssets(drifted, { fetcher });
  return drifted.map(asset => `${asset.location}/${asset.filename}`);
}
