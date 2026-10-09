/** The object commands an agent runs through `labs/nebula/run.mts`: `edit`, `diff`, `save`, `discard`, `bake` and
 * `verify`, each on one `src/objects/<id>`. They call the same shared functions as the lab's buttons, and write their
 * progress to the object's `.local/lab/progress.jsonl`, which the open lab shows live. */
import { configuredPlateObjects } from '../../../server/workflows/plates/bake.ts';
import { bakeObject, objectPath } from '../../../server/workflows/plates/object-bake.ts';
import { withProgress } from '../../../server/workflows/plates/progress.ts';
import { verifyObject } from '../../../server/workflows/plates/verify.ts';
import { discardWorkingCopy, editWorkingCopy, readRecipeState, readSetArgument, saveWorkingCopy, type RecipeChange } from '../../../server/workflows/plates/working-copy.ts';

const root = process.cwd();
function objectArgument(usage: string, args: string[]): string {
  const id = args[0];
  if (!id || id.startsWith('-')) throw new TypeError(`Usage: ${usage}`);
  if (!configuredPlateObjects(root).includes(objectPath(id))) throw new TypeError(`${id} is not a configured lab object (src/objects/${id} with the plates workflow).`);
  return id;
}
const listed = (changes: readonly RecipeChange[]) => changes.map(change => `  ${change.path}: ${change.from} → ${change.to}`).join('\n');
const result = (summary: string) => (changes: RecipeChange[]) => ({ changes: changes.length, summary });

export async function edit(args: string[]) {
  const usage = 'edit <id> --set <path>=<value> [--set <path>=<value> …]';
  const id = objectArgument(usage, args), edits: { path: string; value: number }[] = [];
  for (let index = 1; index < args.length; index++) {
    const arg = args[index]!;
    if (arg === '--set' && args[index + 1]) edits.push(readSetArgument(args[++index]!));
    else if (arg.startsWith('--set=')) edits.push(readSetArgument(arg.slice(6)));
    else throw new TypeError(`Usage: ${usage}; got ${JSON.stringify(arg)}.`);
  }
  if (!edits.length) throw new TypeError(`Usage: ${usage}`);
  const state = await withProgress(root, id, 'edit', async stage => { stage('Writing the working copy', .5); return editWorkingCopy(root, id, edits); },
    value => result('working copy')(value.changes));
  console.log(`${id}: ${state.changes.length} unsaved change${state.changes.length === 1 ? '' : 's'}\n${listed(state.changes)}`);
}
export async function diff(args: string[]) {
  const id = objectArgument('diff <id>', args), state = await readRecipeState(root, id);
  console.log(state.changes.length ? `${id}: ${state.changes.length} unsaved change${state.changes.length === 1 ? '' : 's'} (recipe → working copy)\n${listed(state.changes)}` : `${id}: no unsaved changes`);
}
export async function save(args: string[]) {
  const id = objectArgument('save <id>', args);
  const changes = await withProgress(root, id, 'save', async stage => { stage('Writing source/recipe.json', .5); return saveWorkingCopy(root, id); }, result('saved'));
  console.log(changes.length ? `${id}: saved ${changes.length} change${changes.length === 1 ? '' : 's'} to source/recipe.json\n${listed(changes)}` : `${id}: nothing to save`);
}
export async function discard(args: string[]) {
  const id = objectArgument('discard <id>', args);
  const changes = await withProgress(root, id, 'discard', async stage => { stage('Removing the working copy', .5); return discardWorkingCopy(root, id); }, result('discarded'));
  console.log(changes.length ? `${id}: discarded ${changes.length} change${changes.length === 1 ? '' : 's'}` : `${id}: nothing to discard`);
}
export async function bake(args: string[]) {
  const usage = 'bake <id> [--draft]';
  const id = objectArgument(usage, args), extra = args.slice(1);
  if (extra.some(arg => arg !== '--draft')) throw new TypeError(`Usage: ${usage}`);
  const quality = extra.includes('--draft') ? 'draft' : 'full', controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  let last = '';
  const receipt = await bakeObject(root, id, quality, controller.signal, (message, fraction) => {
    const line = `${String(Math.round(fraction * 100)).padStart(3)}% ${message}`;
    if (line !== last) { last = line; console.log(line); }
  });
  console.log(`${id}: ${quality} baked in ${receipt.seconds} s into ${receipt.directory} · ${receipt.leaves} leaves, ${receipt.resources} files`);
}
export async function verify(args: string[]) {
  const id = objectArgument('verify <id>', args);
  const report = await withProgress(root, id, 'verify', async stage => { stage('Checking the bank, inventory and git', .3); return verifyObject(root, id); },
    value => ({ ok: value.ok, failed: value.checks.filter(check => !check.ok).map(check => check.name) }));
  for (const check of report.checks) console.log(`${check.ok ? '✓' : '✗'} ${check.name.padEnd(12)} ${check.message}`);
  console.log(`${id}: ${report.ok ? 'verified' : 'FAILED'}`);
  if (!report.ok) process.exitCode = 1;
}
