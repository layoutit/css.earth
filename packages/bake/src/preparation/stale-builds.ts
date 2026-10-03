/** Say which build a preparation run would read stale, before the run fails with an unrelated-looking error (a validator
 * refusal from an old objects package, a missing module after main moved). A build is stale when a source it compiles is
 * newer than its output, or its output is missing. Modification times are enough for a local preflight; CI builds fresh.
 *
 * Its bootstrap closure imports only Node built-ins: `packages/bake/cli/check-stale-builds.mts` loads this file from source, so the check still
 * runs, and `--run` still rebuilds, when this package's own build is missing or stale. */
import { readWorkspaceGraph, workspaceOrder, hasBuild, buildOutput } from './workspace-graph.ts';
import { spawn } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

/** Whether any file changed (its contents or its entry) after `time`, or is missing. */
export async function anyChangedAfter(paths: readonly string[], time: number) {
  for (const path of paths) { const info = await stat(path).catch(() => null); if (!info || Math.max(info.mtimeMs, info.ctimeMs) > time) return true; }
  return false;
}

/** `inputs` names the bundler's metafile: every file the last build read counts as a source, so an import from outside the
 * declared directories (src/platform, a site module) still marks the bundle stale. `base` is the directory tsup ran from,
 * which the metafile's input paths are relative to. */
export interface BuildRule { readonly name: string; readonly command: string; readonly sources: readonly string[]; readonly output: string; readonly inputs?: string; readonly base?: string }

/** The builds preparation tools import. Sources are directories scanned for TypeScript, JSON body records or generator scripts.
 * A package's rule follows the rules of the workspace packages it depends on (its package.json `dependencies`), since --run
 * rebuilds in this order: `@cssearth/bake` declares types from the engine, objects and catalogue builds. */
const BUILD_METADATA: readonly (Partial<BuildRule> & Pick<BuildRule, 'name'> & { bundledWorkspace?: boolean })[] = [
  { name: '@cssearth/astronomy', sources: ['packages/astronomy/src', 'packages/astronomy/data/bodies', 'packages/astronomy/cli'] },
  // Declaration stubs are written after tsc succeeds; a failed declaration build must read stale.
  { name: '@cssearth/bake', output: 'packages/bake/dist/volume.d.ts', inputs: 'packages/bake/dist/metafile-esm.json', base: 'packages/bake' },
  { name: '@cssearth/renderer', inputs: 'packages/renderer/dist/metafile-esm.json', base: 'packages/renderer' },
  { name: '@cssearth/volume-viewer', sources: ['packages/volume-viewer/src', 'packages/bake/src'], output: 'packages/volume-viewer/dist/scene/compiler-viewer.js' },
  { name: '@cssearth/telescope-cli', output: 'packages/telescope-cli/dist/telescope.mjs', bundledWorkspace: true },
];

export function buildRules(root: string): readonly BuildRule[] {
  const graph = readWorkspaceGraph(root);
  return workspaceOrder(graph).filter(hasBuild).map(pkg => {
    const override: Partial<BuildRule> & { bundledWorkspace?: boolean } = BUILD_METADATA.find(rule => rule.name === pkg.name) ?? {};
    const { bundledWorkspace, ...metadata } = override;
    return { name: pkg.name, command: `pnpm --filter ${pkg.name} build`, output: metadata.output ?? buildOutput(pkg), ...metadata,
      sources: [...metadata.sources ?? [pkg.directory + '/src'], pkg.directory + '/package.json', pkg.directory + '/tsup.config.ts',
        ...bundledWorkspace ? workspaceOrder(graph, [pkg.name]).filter(dependency => dependency.name !== pkg.name).map(dependency => dependency.directory + '/src') : []] };
  });
}

export const BUILD_RULES = Object.freeze(buildRules(process.cwd()));

const SOURCE = /\.(?:ts|mts|json)$/u, SKIP = new Set(['dist', 'node_modules']);

async function newest(path: string): Promise<number> {
  const info = await stat(path).catch(() => null);
  if (!info) return 0;
  if (!info.isDirectory()) return SOURCE.test(path) && !/\.test\.m?ts$/u.test(path) ? info.mtimeMs : 0;
  let latest = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    latest = Math.max(latest, await newest(resolve(path, entry.name)));
  }
  return latest;
}

/** Repository files the rule's last build read, from the esbuild metafile tsup writes beside the output. Packages resolved
 * from node_modules are left to their own rules. */
async function metafileInputs(root: string, rule: BuildRule): Promise<string[] | null> {
  if (!rule.inputs) return [];
  const text = await readFile(resolve(root, rule.inputs), 'utf8').catch(() => null);
  if (text === null) return null;
  const parsed: unknown = JSON.parse(text);
  const inputs = typeof parsed === 'object' && parsed !== null && 'inputs' in parsed ? parsed.inputs : null;
  if (typeof inputs !== 'object' || inputs === null) throw new TypeError(`${rule.inputs}: esbuild metafile has no inputs.`);
  // tsup runs esbuild from the rule's package directory, so its input paths are relative to that directory.
  const base = resolve(root, rule.base ?? '.');
  return Object.keys(inputs).map(path => relative(root, resolve(base, path))).filter(path => !path.startsWith('..') && !path.includes('node_modules'));
}

export async function staleBuilds(root = process.cwd(), rules: readonly BuildRule[] = BUILD_RULES) {
  const stale: { name: string; command: string; reason: string }[] = [];
  for (const rule of rules) {
    const output = await stat(resolve(root, rule.output)).catch(() => null);
    if (!output) { stale.push({ name: rule.name, command: rule.command, reason: `${rule.output} is missing` }); continue; }
    let source = 0, newestPath = '';
    for (const path of rule.sources) { const time = await newest(resolve(root, path)); if (time > source) { source = time; newestPath = path; } }
    const inputs = await metafileInputs(root, rule);
    if (!inputs) { stale.push({ name: rule.name, command: rule.command, reason: `${rule.inputs} is missing` }); continue; }
    for (const path of inputs) {
      const time = (await stat(resolve(root, path)).catch(() => null))?.mtimeMs ?? Infinity;
      if (time > source) { source = time; newestPath = path; }
    }
    if (source > output.mtimeMs) stale.push({ name: rule.name, command: rule.command, reason: `${newestPath} changed after ${relative(root, resolve(root, rule.output))} was built` });
  }
  return stale;
}

/** Rebuild only what is stale, in rule order, so a dependent build never runs before its dependency. */
/** Run one build command through the shell with the caller's terminal, so a long build streams its output and no output
 * size can fail it; resolves when it exits 0 and rejects with its exit status otherwise. */
export function runBuildCommand(command: string, cwd = process.cwd()): Promise<void> {
  return new Promise((done, fail) => {
    const child = spawn(command, { cwd, shell: true, stdio: 'inherit' });
    child.once('error', fail);
    child.once('exit', (code, signal) => code === 0 ? done() : fail(new Error(`${command} exited with ${signal ?? `status ${code}`}`)));
  });
}

export async function rebuildStale(root = process.cwd(), rules: readonly BuildRule[] = BUILD_RULES,
  run: (command: string) => Promise<void> = command => runBuildCommand(command, root)) {
  const stale = await staleBuilds(root, rules);
  for (const build of stale) {
    console.log(`rebuilding ${build.name}: ${build.reason}`);
    await run(build.command);
  }
  return stale;
}
