/** Package data, user-owned state and the optional css.earth checkout are separate roots. */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export const PACKAGE_ROOT = dirname(createRequire(import.meta.url).resolve('@cssearth/telescope-core/package.json'));
/** Read-only descriptors, requirements locks, licences and notices shipped by the library. */
export const TOOLCHAINS = resolve(PACKAGE_ROOT, 'toolchains');

export { telescopeUserRoot } from './user-root.ts';
import { telescopeUserRoot } from './user-root.ts';
/** Archive answers, MAST/Astroquery caches, installed toolchains, markers and scratch belong here. */
export const USER_ROOT = telescopeUserRoot();
export const SCRATCH_ROOT = resolve(USER_ROOT, 'scratch');
/** Anonymous scratch has one user-owned parent; delivery staging stays beside the explicit output for atomic renames. */
export async function telescopeScratch(prefix: string): Promise<string> {
  if (!/^[a-z0-9-]+$/u.test(prefix)) throw new TypeError('Invalid telescope scratch prefix.');
  await mkdir(SCRATCH_ROOT, { recursive: true });
  return mkdtemp(resolve(SCRATCH_ROOT, prefix));
}
export const WORKSPACE_REQUIRED = 'this command needs a css.earth checkout: pass --workspace';
const inside = (root: string, path: string) => { const part = relative(root, path); return part === '' || (!isAbsolute(part) && part !== '..' && !part.startsWith(`..${sep}`)); };

/** A checkout is admitted by its own command and package identities, never by an installed library's location. */
export function isTelescopeWorkspace(root: string): boolean {
  try {
    const pkg: unknown = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    return Boolean(pkg && typeof pkg === 'object' && 'scripts' in pkg && pkg.scripts && typeof pkg.scripts === 'object'
      && 'telescope' in pkg.scripts && typeof pkg.scripts.telescope === 'string'
      && existsSync(resolve(root, 'packages/telescope-cli/src/cli.mts')) && existsSync(resolve(root, 'src/objects')));
  } catch { return false; }
}

/** Automatic admission is restricted to a source entry launched from inside its own checkout. */
export function telescopeWorkspace(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd(), entry = process.argv[1]): string | undefined {
  if (env.CSSEARTH_WORKSPACE !== undefined) {
    const root = resolve(env.CSSEARTH_WORKSPACE);
    if (!env.CSSEARTH_WORKSPACE.trim() || !isTelescopeWorkspace(root)) throw new TypeError(`${WORKSPACE_REQUIRED} PATH (invalid CSSEARTH_WORKSPACE).`);
    return root;
  }
  if (!entry) return undefined;
  const source = resolve(cwd, entry);
  for (let root = resolve(cwd);;) {
    if (isTelescopeWorkspace(root) && inside(resolve(root, 'packages'), source) && /[/\\](?:src|authoring|cli)[/\\]/u.test(relative(root, source))) return root;
    const parent = dirname(root); if (parent === root) return undefined; root = parent;
  }
}

/** Consume the global option before command parsing. A flag takes precedence over the environment. */
export function workspaceArguments(args: readonly string[], env: NodeJS.ProcessEnv = process.env): { args: string[]; workspace: string | undefined } {
  const remaining = [...args], locations = remaining.flatMap((arg, index) => arg === '--workspace' ? [index] : []);
  if (locations.length > 1) throw new TypeError('Give --workspace only once.');
  const at = locations[0];
  if (at === undefined) return { args: remaining, workspace: telescopeWorkspace(env) };
  const value = remaining[at + 1];
  if (!value || value.startsWith('-')) throw new TypeError('--workspace requires a path.');
  remaining.splice(at, 2);
  return { args: remaining, workspace: telescopeWorkspace({ ...env, CSSEARTH_WORKSPACE: value }) };
}
/** Optional site-data root. Consumers must call requireWorkspace before checkout-only work. */
function initialWorkspace(): string | undefined {
  try { return workspaceArguments(process.argv.slice(2)).workspace; }
  catch { return undefined; } // The command parser reports invalid global options inside its normal error boundary.
}
export let WORKSPACE = initialWorkspace();
export function configureWorkspace(args: readonly string[]): string[] {
  const selected = workspaceArguments(args); WORKSPACE = selected.workspace;
  return selected.args;
}
export function requireWorkspace(root = WORKSPACE, operation = 'This command writes css.earth site records or bakes prepared assets.'): string {
  if (root === undefined) throw new TypeError(`${operation} ${WORKSPACE_REQUIRED} PATH, set CSSEARTH_WORKSPACE, or run the checkout's own sources. For standalone HTML, use telescope export RESULT --output html.`);
  return root;
}

/** Python and installer caches/temp files use the same user root; a lane may add its own user-root HOME. */
export function telescopePythonEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const home = resolve(USER_ROOT, 'python-home'), cache = resolve(USER_ROOT, 'python-cache'), config = resolve(USER_ROOT, 'python-config');
  for (const path of [home, cache, config, SCRATCH_ROOT]) mkdirSync(path, { recursive: true });
  return { ...process.env, HOME: home, USERPROFILE: home, XDG_CACHE_HOME: cache, XDG_CONFIG_HOME: config,
    MPLCONFIGDIR: resolve(cache, 'matplotlib'), TMPDIR: SCRATCH_ROOT, TMP: SCRATCH_ROOT, TEMP: SCRATCH_ROOT, ...overrides };
}
