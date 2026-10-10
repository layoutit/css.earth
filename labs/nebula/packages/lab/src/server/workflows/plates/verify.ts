/** `verify <id>` and the lab's ready-to-ship readout: one set of checks the CLI and the lab server both run. */
import { readInventory, verifyInventory } from '@cssearth/objects/node';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { platesDirectory } from '../../../features/plates/plates-paths.ts';
import { hostOf, verifyPlateBank } from './bake.ts';
import { readRecipeState } from './working-copy.ts';

export interface Check { name: 'bank' | 'inventory' | 'git' | 'working-copy' | 'draft'; ok: boolean; message: string }
const failure = (error: unknown) => error instanceof Error ? error.message.split('\n')[0]!.slice(0, 300) : String(error);

/** Whether the inventory lists exactly the files on disk at their recorded sizes and addresses. */
async function inventoryCheck(root: string, id: string): Promise<Check> {
  const object = `src/objects/${id}`;
  try {
    const value = await readInventory(id, resolve(root, object));
    if (!value) throw new Error('No inventory.');
    await verifyInventory({ objectId: id, inventory: value, preparedRoot: resolve(root, object, 'prepared'), publicRoot: resolve(root, 'site/public/scenes', id), closure: false });
    return { name: 'inventory', ok: true, message: `${value.assets.length} inventoried files match the checkout` };
  } catch (error) { return { name: 'inventory', ok: false, message: failure(error) }; }
}
/** What git says changed among the files a bake or a Save writes. */
async function gitChanges(root: string, id: string) {
  const object = `src/objects/${id}`, host = hostOf(root, object);
  const paths = [`${object}/source/recipe.json`, `${object}/object.json`, `${object}/inventory.json`, `src/objects/${host}/inventory.json`];
  const { stdout } = await promisify(execFile)('git', ['status', '--porcelain', '--', ...paths], { cwd: root });
  return { host, recipe: paths[0]!, changed: stdout.split('\n').filter(Boolean).map(line => line.slice(3)) };
}

/** The lab panel's readout. */
export async function plateStatus(root: string, object: string) {
  const id = object.replace(/^src\/objects\//, ''), git = await gitChanges(root, id), inventory = await inventoryCheck(root, id);
  return { object, host: git.host, recipeChanged: git.changed.includes(git.recipe), changed: git.changed, inventory: { ok: inventory.ok, message: inventory.message } };
}

/** Every check for one object. `ok` is false when the bank or the inventory fails; git changes and unsaved edits are
 * reported, not failures. */
export async function verifyObject(root: string, id: string): Promise<{ object: string; ok: boolean; checks: Check[] }> {
  const object = `src/objects/${id}`, checks: Check[] = [];
  try { const counts = await verifyPlateBank(resolve(root, object)); checks.push({ name: 'bank', ok: true, message: `${counts.leaves} leaves, ${counts.resources} files, ${(counts.bytes / 1048576).toFixed(1)} MB` }); }
  catch (error) { checks.push({ name: 'bank', ok: false, message: failure(error) }); }
  checks.push(await inventoryCheck(root, id));
  const git = await gitChanges(root, id);
  checks.push({ name: 'git', ok: true, message: git.changed.length ? `changed: ${git.changed.join(', ')}` : 'no change against git' });
  const state = await readRecipeState(root, id);
  checks.push({ name: 'working-copy', ok: true, message: state.changes.length ? `${state.changes.length} unsaved change${state.changes.length === 1 ? '' : 's'}` : 'no unsaved changes' });
  const draft = resolve(root, platesDirectory(object));
  if (existsSync(draft)) {
    try { const counts = await verifyPlateBank(draft); checks.push({ name: 'draft', ok: true, message: `${counts.leaves} leaves, ${counts.resources} files` }); }
    catch (error) { checks.push({ name: 'draft', ok: false, message: failure(error) }); }
  }
  return { object: id, ok: checks.every(check => check.ok), checks };
}
