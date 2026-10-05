import { parseObjectText } from '@cssearth/objects';
/** Check what the preparation chain's later steps read, before its long bake, so a bad input fails in seconds.
 *
 *   node site/build/prepare/check-preparation-inputs.mts <object-id>...
 *
 * - Reader text. The text step runs after the bake and refuses a block over its budget; Aspasia's 134-character summary
 *   (budget 125) failed there after the bake had finished. Each named object's `text.json` is checked against the same
 *   budgets first.
 * - The Sun's files. The world and pins steps build on the Sun, and pins records every file under its `prepared/` in
 *   its inventory, so a stale local file would be pinned and published as the Sun's new state (11 were stale in one
 *   run). Each file that differs from the Sun's inventory is restored from R2 by hash, as `pnpm setup:assets` does,
 *   except the files the world step writes itself, and its page data is derived when missing. A run that prepares the
 *   Sun skips this. */
import { access, readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from '@cssearth/core/node';
import { hasErrorCode } from '@cssearth/core';
import { textBudgetErrors } from '../../content/object-text.mts';
import type { TextFinding } from '../../content/object-text.mts';
import { inventoryAssets } from '@cssearth/bake/delivery';
import type { InventoryAsset } from '@cssearth/objects/node';
import { installRuntimeAssets } from '@cssearth/bake/asset-publication';

const root = resolve(import.meta.dirname, '../../..');
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

/** The files the world step rewrites before pins reads them (site/build/prepare/prepare-spatial-context.ts): the Sun's
 * full context, the root object's summary and index, and each object's members, places, system views, orbit banks and
 * the dots of the plain stars inside it. */
export const worldStepOutput = ({ location, filename }: InventoryAsset) =>
  location === 'prepared' && /^(?:world-context\.json$|world\.json$|world-index\.json$|orbits\/|views\/|members\.json$|places\.json$|plain-stars(?:-far)?\.bin$)/u.test(filename);

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

/** Every other object's baked `prepared/` files that are missing or the wrong size. The catalogue and discovery steps read them, and
 * the world and pins steps rebuild the Sun's world files from what they say: on 2026-09-27 a bake in a fresh worktree, before
 * `pnpm setup:assets`, rebuilt them with the imagery flag of 725 bodies off. Sizes only; `restoreDriftedFiles` owns the hashes. */
export async function missingPreparedFiles(ids: readonly string[], { projectRoot = root }: { projectRoot?: string } = {}) {
  const objects = [];
  for (const entry of await readdir(resolve(projectRoot, 'src/objects'), { withFileTypes: true })) {
    if (entry.isDirectory() && !ids.includes(entry.name) && await access(resolve(projectRoot, 'src/objects', entry.name, 'inventory.json')).then(() => true, () => false)) objects.push(entry.name);
  }
  const missing: string[] = [];
  for (const asset of await inventoryAssets(projectRoot, objects, { location: 'prepared' })) {
    // The world files are the bake's own output: its world and pins steps rebuild them, as restoreDriftedFiles leaves them too.
    if (worldStepOutput(asset)) continue;
    const size = await stat(asset.file).then(found => found.size, (error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return -1; throw error; });
    if (size !== asset.bytes) missing.push(`${asset.id}/prepared/${asset.filename}`);
  }
  return missing;
}

// Entry script: node site/build/prepare/check-preparation-inputs.mts <object-id>....
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const ids = process.argv.slice(2);
  if (!ids.length) throw new TypeError('Usage: check-preparation-inputs <object-id>...');
  const findings = await textBudgetFindings(ids), missing = await missingPreparedFiles(ids);
  if (missing.length) {
    console.error(`${missing.length} prepared file(s) of other objects are missing or the wrong size (${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ', …' : ''}). `
      + 'The bake rebuilds the catalogue and the world files from them, so it stops here. Restore them first: pnpm setup:assets, then pnpm prepare:object-json.');
    process.exitCode = 1;
  } else if (findings.length) {
    console.error(`Reader text breaks its budgets; fix it before the bake, or the text step refuses it after:\n${findings
      .map(({ objectId, slot, rule, detail }) => `  src/objects/${objectId}/text.json ${slot}: ${rule}, ${detail}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log('Reader text is within its budgets.');
    if (!ids.includes('sun')) {
      const restored = await restoreDriftedFiles('sun', { keep: worldStepOutput });
      if (restored.length) console.log(`Restored ${restored.length} Sun file(s) that differed from its inventory, before the world and pins steps build on them: ${restored.join(', ')}.`);
    }
  }
}
