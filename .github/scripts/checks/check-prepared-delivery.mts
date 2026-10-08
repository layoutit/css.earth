// Entry script: node .github/scripts/checks/check-prepared-delivery.mts
/**
 * An inventory lists a prepared record only if something reads it after the bake that wrote it. The delivery ledger
 * (packages/objects/src/node/prepared-delivery.ts) names those records and the working records a checkout keeps to
 * itself. This check refuses an inventory row for a working record, or for a top-level record the ledger does not name:
 * the copies of the runtime's parts that every body once hosted (1,490 MB of 6,134, 2026-10-08) do not come back.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
// The ledger imports nothing, so this check runs before any package is built.
import { deliveredPreparedRecord, isWorkingPreparedFile, preparedDeliveryContext } from '../../../packages/objects/src/node/prepared-delivery.ts';

const record = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** The prepared rows of one object's inventory that must not be listed, each as `<id>/prepared/<filename>: <reason>`. */
export function refusedPreparedRows(id: string, inventory: unknown, descriptor: unknown): string[] {
  const context = preparedDeliveryContext(descriptor), assets = record(inventory).assets;
  return (Array.isArray(assets) ? assets : []).flatMap(asset => {
    const { location, filename } = record(asset);
    if (location !== 'prepared' || typeof filename !== 'string' || filename.includes('/') || !filename.endsWith('.json')) return [];
    if (isWorkingPreparedFile(filename, context)) return [`${id}/prepared/${filename}: a working record`];
    return deliveredPreparedRecord(filename, context) ? [] : [`${id}/prepared/${filename}: not named in the delivery ledger`];
  });
}

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) {
  const objects = resolve(import.meta.dirname, '../../../src/objects');
  const read = (path: string): unknown => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; } };
  let inventories = 0;
  const refused = readdirSync(objects).flatMap(id => {
    const inventory = read(resolve(objects, id, 'inventory.json'));
    if (inventory === null) return [];
    inventories++;
    return refusedPreparedRows(id, inventory, read(resolve(objects, id, 'object.json')));
  });
  if (refused.length) {
    console.error(`${refused.length} inventory row(s) list a prepared record that nothing reads after its bake. Write the inventory with the ` +
      `current tools (they leave working records out), or name the record with its reader in packages/objects/src/node/prepared-delivery.ts:\n` +
      refused.slice(0, 100).join('\n') + (refused.length > 100 ? `\n… and ${refused.length - 100} more` : ''));
    process.exit(1);
  }
  console.log(`${inventories} inventories list only delivered prepared records.`);
}
