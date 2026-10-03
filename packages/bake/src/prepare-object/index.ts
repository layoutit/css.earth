/** `@cssearth/bake/prepare-object` (Node only): prepare authored objects end to end, in the only order that works, and
 * name the step that failed. `packages/bake/cli/prepare-object.mts <object-id>... [--from <step>] [--to <step>]
 * [--reuse-images]` is its command.
 *
 * The prepare step already redraws only the lighting and atmosphere banks when nothing else changed (prepare-authored.ts,
 * redrawOnlyDecision). --reuse-images forces that: it keeps the object's published images (and, for Earth, its pages, places
 * and texture levels) and rebuilds
 * the scene, presentation and content from the tracked recipes, stopping after the prepare step. It needs no raw downloads;
 * the paged-ellipsoid and raster lanes support it, and it refuses when the published image set would change.
 *
 * Each step is an existing tool. Nothing here decides science: it orders the tools, rebuilds what a step would read stale, and
 * rebuilds the shared sources catalogue from the installed packages, never from other objects' authoring inputs. Resume after a
 * fix with `--from <step>`.
 *
 * With several objects each step runs once: a shared step (the builds, the catalogue, the world context) once in all, a tool
 * that takes the id list (page data, reader text, markers) once with every id, and the authored preparation, the
 * only CPU-bound step, PREPARATIONS_AT_ONCE objects at a time. Measured on 57 objects (2026-09-24): one call per object and
 * per tool spent about 20 s of start-up on each, an hour in all; this order takes minutes. */
import { execFile, spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface PreparationOptions { readonly reuseImages?: boolean }
/** `once`: the command does not name an object. `ids`: the tool takes every id in one call. `each`: one command per object,
 * run PREPARATIONS_AT_ONCE at a time when `parallel`. */
export interface PreparationStep {
  readonly name: string; readonly purpose: string; readonly scope: 'once' | 'ids' | 'each'; readonly parallel?: boolean;
  readonly commands: (ids: readonly string[], options?: PreparationOptions) => Promise<readonly (readonly string[])[]>;
}

/** Authored preparations running at once. A shape-only planet peaks at 3 GB with its lighting rows in flight and fills the
 * thread pool (`@cssearth/bake/thread-pool`); three fit a 36 GB machine beside the dev server, and more only share the cores. */
export const PREPARATIONS_AT_ONCE = 3;

const node = (...args: string[]) => ['node', ...args];
/** The running site the arrival billboards are photographed from: `pnpm dev` by default, another with CSSEARTH_BILLBOARD_ORIGIN. */
export const billboardOrigin = () => process.env.CSSEARTH_BILLBOARD_ORIGIN ?? 'http://127.0.0.1:4210';
const exists = (path: string) => access(path).then(() => true, () => false);

/** The chain, in order. A step's purpose says what the next one needs from it. */
export const PREPARATION_STEPS: readonly PreparationStep[] = Object.freeze<PreparationStep[]>([
  // The check loads from source and imports only Node built-ins, so it runs, and rebuilds, while the bake itself is unbuilt;
  // it refuses a stale install before building anything.
  { name: 'builds', purpose: 'rebuild every package or bundle a later step would read stale', scope: 'once', commands: async () =>
    [node('packages/bake/cli/check-stale-builds.mts', '--run')] },
  { name: 'inputs', purpose: "check the reader text budgets and restore the Sun's stale files before the long bake", scope: 'ids', commands: async ids =>
    [node('site/build/prepare/check-preparation-inputs.mts', ...ids)] },
  { name: 'catalogue', purpose: 'register the object; a never-prepared package is discoverable as shape only', scope: 'once', commands: async () => [node('site/build/prepare/prepare-catalog.mts')] },
  { name: 'geometry', purpose: 'place a body with an astronomy record in the solar geometry the scene frame reads', scope: 'once', commands: async ids =>
    (await Promise.all(ids.map(id => exists(resolve('packages/astronomy/data/bodies', `${id}.json`))))).some(Boolean) ? [node('packages/bake/cli/prepare-solar-geometry.mts')] : [] },
  { name: 'prepare', purpose: 'prepare datasets, scene and presentation; refresh derived legend labels and the world frame', scope: 'each', parallel: true, commands: async ([id], { reuseImages = false } = {}) =>
    [node('site/build/prepare/prepare-authored.ts', id!, '--write', ...(reuseImages ? ['--reuse-images'] : []))] },
  { name: 'discovery', purpose: 'recompute discovery now that prepared datasets exist', scope: 'once', commands: async () => [node('site/build/prepare/prepare-catalog.mts')] },
  { name: 'sources', purpose: 'write the catalogued source records the manifest cites', scope: 'each', commands: async ([id]) => [node('site/build/prepare/author-source-records.mts', id!)] },
  { name: 'page', purpose: 'pin the prepared page data into the descriptor', scope: 'ids', commands: async ids => [node('site/build/prepare/prepare-object-json.mts', ...ids)] },
  { name: 'audit', purpose: 'check the prepared presentation against its descriptor', scope: 'each', commands: async ([id]) => [node('packages/bake/cli/check-prepared-presentation.mts', '--object', id!)] },
  { name: 'text', purpose: 'prepare the reader text within its budgets', scope: 'ids', commands: async ids => [node('site/build/prepare/prepare-text.mts', ...ids)] },
  { name: 'markers', purpose: 'draw the navigation markers', scope: 'ids', commands: async ids => [node('packages/bake/cli/prepare-navigation.mts', ...ids)] },
  // Every body arrives through its billboard: without one the camera flies in onto a mesh still loading. The renderer photographs the
  // delivered body in the running site and skips a body whose prepared runtime has not changed; the catalogue then carries the arrival
  // view the world files read.
  { name: 'billboard', purpose: 'photograph the arrival billboard from the running site, then refresh the catalogue with it', scope: 'ids', commands: async ids => {
    const origin = billboardOrigin();
    // A dev server's first request compiles the page: it took over 5 s right after a restart (2026-09-27), so wait up to a minute.
    if (!await fetch(origin, { signal: AbortSignal.timeout(60_000) }).then(response => response.ok, () => false)) throw new Error(`No site answers at ${origin}: start it with pnpm dev (or set CSSEARTH_BILLBOARD_ORIGIN), then resume from the billboard step.`);
    // A dev server started before these objects existed answers 404 for their pages, and each then waits out the renderer's 30 s
    // before failing: 154 new stars lost an hour that way (2026-10-01). Ask for the first and last page before photographing any.
    for (const id of new Set([ids[0], ids.at(-1)])) {
      if (id === undefined) continue;
      const status = await fetch(new URL(`/${id}/`, origin), { signal: AbortSignal.timeout(120_000) }).then(response => response.status, () => 0);
      if (status === 404) throw new Error(`The site at ${origin} does not know ${id} (404 for /${id}/): it was started before the object existed. Restart it, then resume from the billboard step.`);
    }
    return [node('packages/bake/cli/prepare-arrival-billboard.mts', ...ids, '--origin', origin), node('site/build/prepare/prepare-catalog.mts')];
  } },
  { name: 'world', purpose: 'place the object in the world context', scope: 'once', commands: async () => [['pnpm', 'prepare:world-context']] },
  { name: 'catalogues', purpose: 'rebuild the shared sources and facilities catalogues from the object\'s source records', scope: 'once', commands: async () => [node('site/build/prepare/prepare-facilities.mts', '--catalog-only')] },
  // The world context is written under the Sun's prepared/ and into the package of each object that holds bodies; without this
  // their inventories still pin the bytes from before the object existed.
  // The catalogue carries every descriptor as the pins leave it (prepared-registry.ts preparedCatalogueModule).
  { name: 'pins', purpose: "pin the regenerated world files into the Sun's inventory and into each object's that holds them", scope: 'once', commands: async () => [node('site/build/prepare/prepare-object-json.mts', 'sun'), node('site/build/prepare/pin-world-files.mts'), node('site/build/prepare/prepare-catalog.mts')] },
]);

export type Progress = (line: string) => void;

/** Prepare `ids` through the chain from `from` to `to` (inclusive; the whole chain by default). Returns false after naming
 * the failed step and the command that resumes. */
export async function prepareObjects(ids: readonly string[], { from, to, reuseImages = false, atOnce = PREPARATIONS_AT_ONCE, progress = line => console.log(line) }:
  { from?: string; to?: string; reuseImages?: boolean; atOnce?: number; progress?: Progress } = {}) {
  if (!ids.length || new Set(ids).size !== ids.length) throw new TypeError('prepare-object: name each object once.');
  for (const id of ids) if (!/^[a-z][a-z0-9-]*$/u.test(id) || !await exists(resolve('src/objects', id, 'object.json'))) throw new TypeError(`No object package: src/objects/${id}/object.json.`);
  const index = (name: string | undefined, fallback: number) => { if (name === undefined) return fallback; const at = PREPARATION_STEPS.findIndex(step => step.name === name); if (at < 0) throw new TypeError(`Unknown step ${name}; steps are ${PREPARATION_STEPS.map(step => step.name).join(', ')}.`); return at; };
  // A reuse-images run changes nothing the later steps read, and they read raw imagery a checkout may not have;
  // its prepare step already pins the page data and publishes the set.
  const start = index(from, 0), end = reuseImages ? index('prepare', 0) : index(to, PREPARATION_STEPS.length - 1);
  const steps = PREPARATION_STEPS.slice(start, end + 1), started = Date.now(), elapsed = () => `${Math.round((Date.now() - started) / 1000)}s`;
  const resume = (step: PreparationStep) => `node packages/bake/cli/prepare-object.mts ${ids.join(' ')} --from ${step.name}${to ? ` --to ${to}` : ''}`;
  for (const step of steps) {
    if (step.scope === 'each') {
      const queue = ids.map((id, at) => [id, at] as const), failures: string[] = [];
      progress(`\n[${step.name}] ${step.purpose} (${elapsed()})`);
      await Promise.all(Array.from({ length: step.parallel ? Math.min(atOnce, ids.length) : 1 }, async () => {
        for (let next = queue.shift(); next && !failures.length; next = queue.shift()) {
          const [id, at] = next;
          progress(`  [${at + 1}/${ids.length}] ${id} (${elapsed()})`);
          for (const [command, ...args] of await step.commands([id], { reuseImages })) {
            const failure = await new Promise<string | null>(done => execFile(command!, args, { maxBuffer: 64 * 1024 * 1024 }, (error, _stdout, stderr) =>
              done(error ? `${[command, ...args].join(' ')}\n${stderr.toString().split('\n').filter(line => line.trim() && !line.startsWith('    at')).slice(-6).join('\n')}` : null)));
            if (failure) { failures.push(failure); break; }
          }
        }
      }));
      if (failures.length) { console.error(`\nStep "${step.name}" failed running: ${failures[0]}\nFix it, then resume: ${resume(step)}`); return false; }
      continue;
    }
    // A step may refuse while it plans, before running anything (the billboard step with no site answering).
    const commands = await step.commands(ids, { reuseImages }).catch((error: unknown) => error instanceof Error ? error : new Error(String(error)));
    if (commands instanceof Error) { console.error(`\nStep "${step.name}" refused: ${commands.message}\nFix it, then resume: ${resume(step)}`); return false; }
    progress(`\n[${step.name}] ${step.purpose}${commands.length ? '' : ' (nothing to do)'} (${elapsed()})`);
    for (const [command, ...args] of commands) {
      const run = spawnSync(command!, args, { stdio: 'inherit' });
      if (run.status !== 0) { console.error(`\nStep "${step.name}" failed running: ${[command, ...args].join(' ')}\nFix it, then resume: ${resume(step)}`); return false; }
    }
  }
  progress(`\n${ids.length === 1 ? ids[0] : `${ids.length} objects`}: prepared in ${elapsed()}. Check in the browser, run the unit tests, review git status before committing, and publish: node packages/bake/cli/publish-runtime-assets.mts ${[...ids, ...(end >= index('pins', 0) ? ['sun'] : [])].map(id => `--object=${id}`).join(' ')}`);
  return true;
}

/** One object, as before. */
export const prepareObject = (id: string, options: { from?: string; reuseImages?: boolean } = {}) => prepareObjects([id], options);
