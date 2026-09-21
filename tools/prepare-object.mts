#!/usr/bin/env node
/** Prepare one authored object end to end, in the only order that works, and name the step that failed.
 *
 *   node tools/prepare-object.mts <object-id> [--from <step>] [--presentation-only]
 *
 * --presentation-only reuses the object's published heavy outputs (imagery, pages, places, texture levels) and prepares the
 * presentation from them, stopping after the prepare step; the lane refuses when its recipe sources or recomputed plan differ
 * from the published run.
 *
 * Each step is an existing tool run for this object only. Nothing here decides science: it orders the tools, rebuilds what a
 * step would read stale, and never runs a repository-wide provenance pass (that one upgrades records of unrelated objects
 * whose sources happen to be on this checkout). Resume after a fix with `--from <step>`. */
import { spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { staleBuilds } from './check-stale-builds.mts';

export interface PreparationOptions { readonly presentationOnly?: boolean }
export interface PreparationStep { readonly name: string; readonly purpose: string; readonly commands: (id: string, options?: PreparationOptions) => Promise<readonly (readonly string[])[]> }

const node = (...args: string[]) => ['node', ...args];
const exists = (path: string) => access(path).then(() => true, () => false);

/** The chain, in order. A step's purpose says what the next one needs from it. */
export const PREPARATION_STEPS: readonly PreparationStep[] = Object.freeze<PreparationStep[]>([
  { name: 'builds', purpose: 'rebuild every package or bundle a later step would read stale', commands: async () =>
    (await staleBuilds()).filter(build => build.name !== 'solar geometry').map(build => build.command.split(' ')) },
  { name: 'catalogue', purpose: 'register the object; a never-prepared package is discoverable as shape only', commands: async () => [node('tools/prepare-catalog.mts')] },
  { name: 'title', purpose: 'draw the title mark from the content display name', commands: async id => [node('tools/prepare-planet-title-sources.mts', id)] },
  { name: 'geometry', purpose: 'place a body with an astronomy record in the solar geometry the scene frame reads', commands: async id =>
    await exists(resolve('packages/astronomy/data/bodies', `${id}.json`)) ? [node('tools/prepare-solar-geometry.mts')] : [] },
  { name: 'prepare', purpose: 'prepare lenses, scene and presentation; refresh derived legend labels and the world frame', commands: async (id, { presentationOnly = false } = {}) =>
    [node('tools/objects/dist/prepare-authored.js', id, '--write', ...(presentationOnly ? ['--presentation-only'] : []))] },
  { name: 'discovery', purpose: 'recompute discovery now that prepared lenses exist', commands: async () => [node('tools/prepare-catalog.mts')] },
  { name: 'sources', purpose: 'write the catalogued source records the manifest cites', commands: async id => [node('tools/author-source-records.mts', id)] },
  { name: 'page', purpose: 'pin the prepared page data into the descriptor', commands: async id => [node('tools/prepare-object-json.mts', id)] },
  { name: 'text', purpose: 'prepare the reader text within its budgets', commands: async id => [node('tools/prepare-text.mts', id)] },
  { name: 'markers', purpose: 'draw the navigation markers', commands: async id => [node('tools/prepare-navigation.mts', id)] },
  { name: 'world', purpose: 'place the object in the world context', commands: async () => [['pnpm', 'prepare:world-context']] },
  { name: 'provenance', purpose: 'record provenance for this object and rebuild the shared sources catalogue', commands: async id => [node('tools/prepare-provenance.mts', id)] },
]);

export async function prepareObject(id: string, { from, presentationOnly = false }: { from?: string; presentationOnly?: boolean } = {}) {
  if (!/^[a-z][a-z0-9-]*$/u.test(id) || !await exists(resolve('src/objects', id, 'object.json'))) throw new TypeError(`No object package: src/objects/${id}/object.json.`);
  const start = from === undefined ? 0 : PREPARATION_STEPS.findIndex(step => step.name === from);
  if (start < 0) throw new TypeError(`Unknown step ${from}; steps are ${PREPARATION_STEPS.map(step => step.name).join(', ')}.`);
  // A presentation-only run changes nothing the later steps read, and they read raw imagery a checkout may not have;
  // its prepare step already pins the page data and publishes the set.
  const steps = PREPARATION_STEPS.slice(start, presentationOnly ? PREPARATION_STEPS.findIndex(step => step.name === 'prepare') + 1 : undefined);
  for (const step of steps) {
    const commands = await step.commands(id, { presentationOnly });
    console.log(`\n[${step.name}] ${step.purpose}${commands.length ? '' : ' (nothing to do)'}`);
    for (const [command, ...args] of commands) {
      const run = spawnSync(command!, args, { stdio: 'inherit' });
      if (run.status !== 0) {
        console.error(`\nStep "${step.name}" failed running: ${[command, ...args].join(' ')}\nFix it, then resume: node tools/prepare-object.mts ${id} --from ${step.name}`);
        return false;
      }
    }
  }
  console.log(`\n${id}: prepared. Check it in the browser, run its unit tests, and review git status before committing.`);
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), fromIndex = args.indexOf('--from');
  const from = fromIndex >= 0 ? args[fromIndex + 1] : undefined;
  const presentationOnly = args.includes('--presentation-only');
  const ids = args.filter((argument, index) => argument !== '--from' && argument !== '--presentation-only' && (fromIndex < 0 || index !== fromIndex + 1));
  if (ids.length !== 1) throw new TypeError(`Usage: prepare-object <object-id> [--from <step>] [--presentation-only]; steps: ${PREPARATION_STEPS.map(step => step.name).join(', ')}.`);
  if (!await prepareObject(ids[0]!, { ...(from === undefined ? {} : { from }), presentationOnly })) process.exitCode = 1;
}
