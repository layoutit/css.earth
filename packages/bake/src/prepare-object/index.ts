/** `@cssearth/bake/prepare-object` (Node only): prepare authored objects end to end, in the only order that works, and
 * name the step that failed. `packages/bake/cli/prepare-object.mts <object-id>... [--from <step>] [--to <step>]
 * [--reuse-images | --add-datasets]` is its command.
 *
 * The prepare step already redraws only the lighting and atmosphere banks when nothing else changed (prepare-authored.ts,
 * redrawOnlyDecision). --reuse-images forces that: it keeps the object's published images (and, for Earth, its pages, places
 * and texture levels) and rebuilds
 * the scene, presentation and content from the tracked recipes, stopping after the prepare step. It needs no raw downloads;
 * the paged-ellipsoid and raster lanes support it, and it refuses when the published image set would change.
 * --add-datasets is that run for a paged globe that gained surface datasets (Earth's ENSO days, refresh-earth-enso.mts): it
 * prepares only the new datasets' images from their own imagery, keeps every other published image, the material banks
 * included, then audits the presentation and prepares the reader text.
 *
 * Each step is an existing tool. Nothing here decides science: it orders the tools, rebuilds what a step would read stale, and
 * rebuilds the shared sources catalogue from the installed packages, never from other objects' authoring inputs. Resume after a
 * fix with `--from <step>`.
 *
 * With several objects each step runs once: a shared step (the builds, the catalogue, the world context) once in all, a tool
 * that takes the id list (page data, reader text, markers) once with every id, and the authored preparation, the
 * only CPU-bound step, PREPARATIONS_AT_ONCE objects at a time. Measured on 57 objects (2026-09-24): one call per object and
 * per tool spent about 20 s of start-up on each, an hour in all; this order takes minutes. */
import { spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isRecord, requireRecord, requireString } from '@cssearth/core';
import { projectRoot } from '@cssearth/core/node';

export interface PreparationOptions { readonly reuseImages?: boolean; readonly addDatasets?: boolean; readonly root?: string }
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

/** What the prepared world context holds, from the root object's `prepared/world-index.json` and `world.json`: its `bodies`
 * (the index's order, each with a row in a world file) and every id it `knows` (those, the objects with a file of bodies
 * and the focus). Null while no world is prepared, or when its files do not read: the placement step then prepares it, where a
 * refusal would leave only the world pass by hand. `@cssearth/objects` is loaded here, after the builds step rebuilt it. */
async function preparedWorld(root: string): Promise<{ readonly bodies: ReadonlySet<string>; readonly knows: ReadonlySet<string> } | null> {
  const { OBJECT_TREE_ROOT, parsePreparedWorldIndex } = await import('@cssearth/objects');
  const read = async (name: string): Promise<unknown> => JSON.parse(await readFile(resolve(root, 'src/objects', OBJECT_TREE_ROOT, 'prepared', name), 'utf8'));
  try {
    const [index, summary] = await Promise.all([read('world-index.json'), read('world.json')]);
    const { order, files } = parsePreparedWorldIndex(index);
    const focus = requireString(requireRecord(requireRecord(summary, 'world summary').focus, 'world summary focus').id, 'world summary focus id');
    return { bodies: new Set(order), knows: new Set([...order, ...files, focus]) };
  } catch { return null; }
}

/** The chain, in order. A step's purpose says what the next one needs from it. */
export const PREPARATION_STEPS: readonly PreparationStep[] = Object.freeze<PreparationStep[]>([
  // The check loads from source and imports only Node built-ins, so it runs, and rebuilds, while the bake itself is unbuilt;
  // it refuses a stale install before building anything.
  { name: 'builds', purpose: 'rebuild every package or bundle a later step would read stale', scope: 'once', commands: async () =>
    [node('packages/bake/cli/check-stale-builds.mts', '--run')] },
  { name: 'inputs', purpose: "check the reader text budgets and restore the Sun's stale files before the long bake", scope: 'ids', commands: async ids =>
    [node('site/build/prepare/check-preparation-inputs.mts', ...ids)] },
  { name: 'catalogue', purpose: 'register the object; a never-prepared package is discoverable as shape only', scope: 'once', commands: async () => [node('site/build/prepare/catalog/prepare-catalog.mts')] },
  { name: 'geometry', purpose: 'place a body with an astronomy record in the solar geometry the scene frame reads', scope: 'once', commands: async (ids, { root = projectRoot(import.meta.url) } = {}) =>
    (await Promise.all(ids.map(id => exists(resolve(root, 'packages/astronomy/data/bodies', `${id}.json`))))).some(Boolean) ? [node('packages/bake/cli/prepare-solar-geometry.mts')] : [] },
  { name: 'prepare', purpose: 'prepare datasets, scene and presentation; refresh derived legend labels and the world frame', scope: 'each', parallel: true, commands: async ([id], { reuseImages = false, addDatasets = false } = {}) =>
    [node('site/build/prepare/authored/prepare-authored.ts', id!, '--write', ...(reuseImages || addDatasets ? ['--reuse-images'] : []), ...(addDatasets ? ['--add-datasets'] : []))] },
  { name: 'discovery', purpose: 'recompute discovery now that prepared datasets exist', scope: 'once', commands: async () => [node('site/build/prepare/catalog/prepare-catalog.mts')] },
  { name: 'sources', purpose: 'write the catalogued source records the manifest cites', scope: 'each', commands: async ([id]) => [node('site/build/prepare/catalog/author-source-records.mts', id!)] },
  { name: 'page', purpose: 'pin the prepared page data into the descriptor', scope: 'ids', commands: async ids => [node('site/build/prepare/authored/prepare-object-json.mts', ...ids)] },
  { name: 'audit', purpose: 'check the prepared presentation against its descriptor', scope: 'each', commands: async ([id]) => [node('packages/bake/cli/check-prepared-presentation.mts', '--object', id!)] },
  { name: 'text', purpose: 'prepare the reader text within its budgets', scope: 'ids', commands: async ids => [node('site/build/prepare/authored/prepare-text.mts', ...ids)] },
  { name: 'markers', purpose: 'draw the navigation markers', scope: 'ids', commands: async ids => [node('packages/bake/cli/prepare-navigation.mts', ...ids)] },
  // A page selects its body in the prepared world context and never becomes ready when the context does not hold it, so a new body
  // cannot be photographed before the world is placed: 17 new bodies each waited out the renderer's 30 s (2026-10-10). The world is
  // placed here for such a body, without the arrival view its photograph gives the catalogue; the world step places it again with it.
  // A body the context holds keeps its one pass at the world step. A pass took 11 s for 4,501 bodies (2026-10-09).
  { name: 'placement', purpose: 'place a body the world context does not hold yet, so its page loads for the photograph', scope: 'once', commands: async (ids, { root = projectRoot(import.meta.url) } = {}) => {
    const world = await preparedWorld(root);
    return world && ids.every(id => world.knows.has(id)) ? [] : [['pnpm', 'prepare:world-context']];
  } },
  // Every body arrives through its billboard: without one the camera flies in onto a mesh still loading. The renderer photographs the
  // delivered body in the running site and skips a body whose prepared runtime has not changed; the catalogue then carries the arrival
  // view the world files read.
  { name: 'billboard', purpose: 'photograph the arrival billboard from the running site, then refresh the catalogue with it', scope: 'ids', commands: async (ids, { root = projectRoot(import.meta.url) } = {}) => {
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
    // The site reads the world index once, when it starts (site/directory/world-context-plan.mts), and names a body's world files
    // from it in the body's entry (`world`, site/pages/objects/[id]/entry.json.ts). A site started before the placement step placed
    // a body names none for it, and never serves a world file the placement added: TrES-2 b's row went into its new system's file,
    // which that site does not list (2026-10-09). Every body's entry is asked for, so an object the site does not know is caught
    // here too when it is neither the first nor the last id.
    const bodies = (await preparedWorld(root))?.bodies;
    for (const id of ids) {
      if (!bodies?.has(id)) continue;
      const response = await fetch(new URL(`/objects/${id}/entry.json`, origin), { signal: AbortSignal.timeout(120_000) }).catch(() => null);
      if (response?.status === 404) throw new Error(`The site at ${origin} does not know ${id} (404 for /objects/${id}/entry.json): it was started before the object existed. Restart it, then resume from the billboard step.`);
      const entry: unknown = response?.ok ? await response.json().catch(() => null) : null;
      if (isRecord(entry) && !Object.hasOwn(entry, 'world')) throw new Error(`The site at ${origin} read the world context before ${id} was placed in it (/objects/${id}/entry.json names no world file), so it cannot serve the world files placed since. Restart it, then resume from the billboard step.`);
    }
    return [node('packages/bake/cli/prepare-arrival-billboard.mts', ...ids, '--origin', origin), node('site/build/prepare/catalog/prepare-catalog.mts')];
  } },
  { name: 'world', purpose: 'place the object in the world context, with the arrival view the catalogue now carries', scope: 'once', commands: async () => [['pnpm', 'prepare:world-context']] },
  // A star or planet that gains orbiting bodies hosts a system, an object of its own whose page its members link to; its package is read
  // from the world's orbit graph, so it follows the world step. Every system is rewritten: unchanged ones come out the same, in a second.
  // The systems step moves each host inside its system in the object tree, and the world files follow the tree, so the world is placed again.
  { name: 'systems', purpose: 'write the package of every system, so a new host has its system page, and place the world by the tree they change', scope: 'once', commands: async () => [node('site/build/prepare/system-packages.mts'), ['pnpm', 'prepare:world-context']] },
  { name: 'catalogues', purpose: 'rebuild the shared sources and facilities catalogues from the object\'s source records', scope: 'once', commands: async () => [node('site/build/prepare/catalog/prepare-facilities.mts', '--catalog-only')] },
  // The world context is written under the Sun's prepared/ and into the package of each object that holds bodies; without this
  // their inventories still pin the bytes from before the object existed.
  // The catalogue carries every descriptor as the pins leave it (prepared-registry.ts preparedCatalogueModule).
  { name: 'pins', purpose: "pin the regenerated world files into the Sun's inventory and into each object's that holds them", scope: 'once', commands: async () => [node('site/build/prepare/authored/prepare-object-json.mts', 'sun'), node('site/build/prepare/world/pin-world-files.mts'), node('site/build/prepare/catalog/prepare-catalog.mts')] },
]);

/** The steps of an add-datasets run. It changes one object's datasets, which the reader text and the presentation audit
 * have not seen and no world file reads: it skips the inputs step, whose check wants every other object's prepared files
 * installed for the catalogue and world files the full chain rebuilds, and everything after the text. */
export const ADD_DATASETS_STEPS: readonly string[] = Object.freeze(['builds', 'catalogue', 'geometry', 'prepare', 'audit', 'text']);

export type Progress = (line: string) => void;

const terminationSignals = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT'] as const;
const activeCommands = new Set<() => void>();
let parentSignal: NodeJS.Signals | undefined;
const forwardParentSignal = (received: NodeJS.Signals) => {
  parentSignal ??= received;
  for (const stop of activeCommands) stop();
};
const parentSignalHandlers = terminationSignals.map(received => [received, () => forwardParentSignal(received)] as const);
const stopOnDisconnect = () => { for (const stop of activeCommands) stop(); };

/** Each command owns a background process group, including inherited-stdio commands: terminal stdin reads can receive
 * SIGTTIN, so preparation steps must not prompt interactively. Abort, parent signals and IPC disconnection give the whole
 * group SIGTERM for cleanup, then SIGKILL after two seconds. Process exit alone cannot wait and kills immediately. */
async function runPreparationCommand(command: string, args: readonly string[], root: string, signal: AbortSignal | undefined, capture: boolean): Promise<string | null> {
  if (signal?.aborted || parentSignal) return 'Preparation aborted.';
  return new Promise(done => {
    const child = spawn(command, args, { cwd: root, detached: true, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
    let stderr = '', error: Error | undefined, closed = false, status: number | null = null;
    let stopping = false, groupFinished = false, interrupted = false, settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    const recordError = (failure: unknown) => { error ??= failure instanceof Error ? failure : new Error(String(failure)); };
    const signalGroup = (sent: NodeJS.Signals | 0): boolean => {
      if (child.pid === undefined || groupFinished) return false;
      try { process.kill(-child.pid, sent); return true; }
      catch (failure) {
        if (!(failure instanceof Error && 'code' in failure && failure.code === 'ESRCH')) recordError(failure);
        return false;
      }
    };
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (poll) clearInterval(poll);
      signal?.removeEventListener('abort', abort);
      process.off('exit', exit);
      activeCommands.delete(abort);
      if (!activeCommands.size) {
        for (const [received, handler] of parentSignalHandlers) process.off(received, handler);
        process.off('disconnect', stopOnDisconnect);
      }
    };
    const finish = (cannotTerminate = false) => {
      if (settled || (!closed && !cannotTerminate) || !groupFinished) return;
      if (cannotTerminate) {
        child.stdout?.destroy(); child.stderr?.destroy(); child.unref();
        error = new Error(`Could not terminate preparation process group ${child.pid}: ${error?.message ?? 'signaling failed'}`);
      }
      settled = true; cleanup();
      done(status === 0 && !interrupted && !signal?.aborted && !error ? null : `${[command, ...args].join(' ')}\n${error?.message ?? stderr.split('\n').filter(line => line.trim() && !line.startsWith('    at')).slice(-6).join('\n')}`);
      if (!activeCommands.size && parentSignal) {
        const received = parentSignal; parentSignal = undefined;
        try { process.kill(process.pid, received); } catch (failure) { recordError(failure); }
      }
    };
    const finishGroup = () => { groupFinished = true; if (timer) clearTimeout(timer); if (poll) clearInterval(poll); finish(); };
    const stop = () => {
      if (stopping || groupFinished) return;
      stopping = true;
      if (child.pid === undefined) { finishGroup(); return; }
      if (!signalGroup('SIGTERM') && !error) { finishGroup(); return; }
      timer = setTimeout(() => {
        const killed = signalGroup('SIGKILL');
        if (!killed && error) { groupFinished = true; finish(true); }
        else finishGroup();
      }, 2000);
      poll = setInterval(() => { if (!signalGroup(0) && !error) finishGroup(); }, 25);
    };
    const abort = () => { interrupted = true; stop(); };
    const exit = () => { signalGroup('SIGKILL'); };
    if (!activeCommands.size) {
      for (const [received, handler] of parentSignalHandlers) process.on(received, handler);
      process.prependListener('disconnect', stopOnDisconnect);
    }
    activeCommands.add(abort);
    signal?.addEventListener('abort', abort, { once: true });
    process.on('exit', exit);
    child.stdout?.resume();
    child.stderr?.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-64 * 1024 * 1024); });
    child.once('error', failure => {
      recordError(failure);
      if (child.pid === undefined) { closed = true; finishGroup(); }
      else stop();
    });
    // Descendants may keep output pipes open after their leader exits.
    child.once('exit', stop);
    child.once('close', code => { closed = true; status = code; stop(); finish(); });
    if (signal?.aborted || parentSignal) abort();
  });
}

/** Prepare `ids` through the chain from `from` to `to` (inclusive; the whole chain by default). Returns false after naming
 * the failed step and the command that resumes. */
export async function prepareObjects(ids: readonly string[], { from, to, reuseImages = false, addDatasets = false, root = projectRoot(import.meta.url), atOnce = PREPARATIONS_AT_ONCE, signal, progress = line => console.log(line) }:
  { from?: string; to?: string; reuseImages?: boolean; addDatasets?: boolean; root?: string; atOnce?: number; signal?: AbortSignal; progress?: Progress } = {}) {
  root = resolve(root);
  if (!ids.length || new Set(ids).size !== ids.length) throw new TypeError('prepare-object: name each object once.');
  for (const id of ids) if (!/^[a-z][a-z0-9-]*$/u.test(id) || !await exists(resolve(root, 'src/objects', id, 'object.json'))) throw new TypeError(`No object package: src/objects/${id}/object.json.`);
  const index = (name: string | undefined, fallback: number) => { if (name === undefined) return fallback; const at = PREPARATION_STEPS.findIndex(step => step.name === name); if (at < 0) throw new TypeError(`Unknown step ${name}; steps are ${PREPARATION_STEPS.map(step => step.name).join(', ')}.`); return at; };
  // A reuse-images run changes nothing the later steps read, and they read raw imagery a checkout may not have;
  // its prepare step already pins the page data and publishes the set.
  const start = index(from, 0), end = reuseImages || addDatasets ? index('prepare', 0) : index(to, PREPARATION_STEPS.length - 1);
  const chain = addDatasets ? PREPARATION_STEPS.filter(step => ADD_DATASETS_STEPS.includes(step.name)) : PREPARATION_STEPS.slice(0, end + 1);
  const steps = chain.filter(step => PREPARATION_STEPS.indexOf(step) >= start), started = Date.now(), elapsed = () => `${Math.round((Date.now() - started) / 1000)}s`;
  const resume = (step: PreparationStep) => `node packages/bake/cli/prepare-object.mts ${ids.join(' ')} --from ${step.name}${to ? ` --to ${to}` : ''}${addDatasets ? ' --add-datasets' : ''}`;
  for (const step of steps) {
    if (signal?.aborted) return false;
    if (step.scope === 'each') {
      const queue = ids.map((id, at) => [id, at] as const), failures: string[] = [];
      progress(`\n[${step.name}] ${step.purpose} (${elapsed()})`);
      await Promise.all(Array.from({ length: step.parallel ? Math.min(atOnce, ids.length) : 1 }, async () => {
        for (let next = queue.shift(); next && !failures.length; next = queue.shift()) {
          const [id, at] = next;
          progress(`  [${at + 1}/${ids.length}] ${id} (${elapsed()})`);
          for (const [command, ...args] of await step.commands([id], { reuseImages, addDatasets, root })) {
            const failure = await runPreparationCommand(command!, args, root, signal, true);
            if (failure) { failures.push(failure); break; }
          }
        }
      }));
      if (failures.length) { console.error(`\nStep "${step.name}" failed running: ${failures[0]}\nFix it, then resume: ${resume(step)}`); return false; }
      continue;
    }
    // A step may refuse while it plans, before running anything (the billboard step with no site answering).
    const commands = await step.commands(ids, { reuseImages, addDatasets, root }).catch((error: unknown) => error instanceof Error ? error : new Error(String(error)));
    if (commands instanceof Error) { console.error(`\nStep "${step.name}" refused: ${commands.message}\nFix it, then resume: ${resume(step)}`); return false; }
    progress(`\n[${step.name}] ${step.purpose}${commands.length ? '' : ' (nothing to do)'} (${elapsed()})`);
    for (const [command, ...args] of commands) {
      const failure = await runPreparationCommand(command!, args, root, signal, false);
      if (failure) { console.error(`\nStep "${step.name}" failed running: ${failure}\nFix it, then resume: ${resume(step)}`); return false; }
    }
  }
  progress(`\n${ids.length === 1 ? ids[0] : `${ids.length} objects`}: prepared in ${elapsed()}. Check in the browser, run the unit tests, review git status before committing, and publish: node packages/bake/cli/publish-runtime-assets.mts ${[...ids, ...(end >= index('pins', 0) ? ['sun'] : [])].map(id => `--object=${id}`).join(' ')}`);
  return true;
}

/** One object, as before. */
export const prepareObject = (id: string, options: { from?: string; reuseImages?: boolean; addDatasets?: boolean; root?: string; signal?: AbortSignal } = {}) => prepareObjects([id], options);
