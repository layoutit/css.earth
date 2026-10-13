/** Install the package's one skill without changing host configuration. */
import { constants, copyFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { CLI_PACKAGE_ROOT } from '../paths.mts';

export const RECEIPT = '.telescope-install.json';
const OWNER = '@cssearth/telescope';
export function skillDestinations(home = homedir(), env: NodeJS.ProcessEnv = process.env) {
  return {
    claude: join(env.CLAUDE_CONFIG_DIR || join(home, '.claude'), 'skills'),
    codex: join(env.CODEX_HOME || join(home, '.codex'), 'skills'),
    agents: join(home, '.agents', 'skills'), grok: join(home, '.agents', 'skills'),
    agy: join(home, '.gemini', 'antigravity-cli', 'skills'),
    antigravity: join(home, '.gemini', 'config', 'skills'),
    cursor: join(home, '.cursor', 'skills'),
    opencode: join(env.XDG_CONFIG_HOME || join(home, '.config'), 'opencode', 'skills'),
  };
}
export interface SkillOptions {
  readonly command: 'skill'; readonly action: 'install' | 'uninstall'; readonly destination: string;
  readonly copy: boolean; readonly json: boolean; readonly verbose: boolean;
}
export function parseSkillArguments(args: readonly string[], home = homedir(), env: NodeJS.ProcessEnv = process.env): SkillOptions {
  const action = args[1];
  if (action !== 'install' && action !== 'uninstall') throw new TypeError('Use telescope skill install|uninstall (--provider NAME | --dest DIRECTORY) [--copy] [--json].');
  let destination: string | undefined;
  const seen = new Set<string>();
  for (let i = 2; i < args.length; i++) {
    const arg = args[i]!;
    if (seen.has(arg)) throw new TypeError(`Repeated skill option ${arg}.`);
    seen.add(arg);
    if (arg === '--copy' || arg === '--json' || arg === '--verbose') continue;
    if (arg !== '--provider' && arg !== '--dest') throw new TypeError(`Unknown skill option ${arg}.`);
    if (destination !== undefined) throw new TypeError('Choose exactly one --provider or --dest.');
    const value = args[++i];
    if (!value || value.startsWith('-')) throw new TypeError(`Missing value for ${arg}.`);
    if (arg === '--dest') destination = resolve(value);
    else {
      const roots = skillDestinations(home, env);
      const entry = Object.entries(roots).find(([name]) => name === value);
      if (!entry) throw new TypeError(`Unknown provider ${value}. Providers: ${Object.keys(roots).join(', ')}.`);
      destination = resolve(entry[1]);
    }
  }
  if (!destination) throw new TypeError('Choose --provider NAME or --dest DIRECTORY explicitly.');
  return { command: 'skill', action, destination, copy: seen.has('--copy'), json: seen.has('--json'), verbose: seen.has('--verbose') };
}
function stat(path: string) {
  try { return lstatSync(path); }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined; throw error; }
}
/** Resolve even a missing destination through its nearest existing ancestor. */
function canonical(path: string): string {
  if (stat(path)) return realpathSync(path);
  const parent = dirname(path);
  if (parent === path) throw new Error(`Cannot resolve destination ${path}.`);
  return join(canonical(parent), relative(parent, path));
}
function inside(parent: string, path: string): boolean {
  const part = relative(parent, path);
  return part === '' || (!isAbsolute(part) && part !== '..' && !part.startsWith(`..${sep}`));
}
/** npx always uses an expendable cache; ordinary node_modules installs have an installation owner. */
function temporarySource(source: string): boolean {
  const parts = source.split(sep);
  if (parts.includes('_npx')) return true;
  if (parts.includes('node_modules')) return false;
  return [tmpdir(), '/tmp', '/var/tmp'].some(root => inside(canonical(root), source));
}
/** A vanished package cannot supply a receipt; its recorded link still identifies the skill owner. */
function packageSkillPath(path: string): boolean {
  return [join('node_modules', '@cssearth', 'telescope', 'skills', 'telescope'), join('packages', 'telescope-cli', 'skills', 'telescope')]
    .some(suffix => path.endsWith(`${sep}${suffix}`));
}
function dangling(path: string): boolean {
  try { realpathSync(path); return false; }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return true; throw error; }
}
/** Exact bytes and directory membership, including empty folders; no source digest is needed. */
function snapshot(directory: string): Record<string, string | null> {
  const files = new Map<string, string | null>();
  const visit = (prefix: string) => {
    for (const entry of readdirSync(join(directory, prefix), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (name === RECEIPT) continue;
      if (entry.isDirectory()) { files.set(`${name}/`, null); visit(name); }
      else if (entry.isFile()) files.set(name, readFileSync(join(directory, name)).toString('base64'));
      else throw new Error(`Refusing a skill containing a link or special file: ${name}.`);
    }
  };
  visit('');
  return Object.fromEntries(files);
}
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function sameFiles(actual: Record<string, string | null>, expected: unknown): boolean {
  return record(expected) && Object.keys(actual).length === Object.keys(expected).length &&
    Object.entries(actual).every(([name, bytes]) => Object.hasOwn(expected, name) && expected[name] === bytes);
}
function ownedCopy(target: string): Record<string, unknown> {
  const receiptPath = join(target, RECEIPT);
  if (!stat(receiptPath)?.isFile()) throw new Error(`Refusing unrelated directory: ${target}.`);
  let receipt: unknown;
  try { receipt = JSON.parse(readFileSync(receiptPath, 'utf8')); }
  catch { throw new Error(`Invalid ownership receipt: ${target}.`); }
  if (!record(receipt) || receipt.owner !== OWNER || receipt.version !== 1 || receipt.skill !== 'telescope' || receipt.mode !== 'copy' || !sameFiles(snapshot(target), receipt.files))
    throw new Error(`Refusing unrelated or modified copy: ${target}.`);
  return receipt;
}
export interface SkillResult { readonly status: 'installed' | 'already-installed' | 'removed' | 'absent'; readonly target: string; readonly mode: 'link' | 'copy'; }
export function manageSkill(options: Pick<SkillOptions, 'action' | 'destination' | 'copy'>, packageRoot = CLI_PACKAGE_ROOT): SkillResult {
  const source = realpathSync(join(packageRoot, 'skills', 'telescope'));
  if (!stat(join(source, 'SKILL.md'))?.isFile()) throw new Error('The package has no telescope SKILL.md. Reinstall the package.');
  const destination = canonical(resolve(options.destination)), target = join(destination, 'telescope');
  if (inside(source, destination) || inside(target, source)) throw new TypeError('The destination overlaps the packaged skill.');
  const existing = stat(target);
  let mode: 'link' | 'copy' = options.copy ? 'copy' : 'link';
  if (existing?.isSymbolicLink()) {
    const recordedSource = resolve(dirname(target), readlinkSync(target));
    const vanishedPackage = options.action === 'uninstall' && packageSkillPath(recordedSource) && dangling(target);
    if (recordedSource !== source && !vanishedPackage) throw new Error(`Refusing unrelated link: ${target}.`);
    mode = 'link';
  } else if (existing) {
    if (!existing.isDirectory()) throw new Error(`Refusing unrelated file: ${target}.`);
    const receipt = ownedCopy(target);
    if (options.action === 'install' && !sameFiles(snapshot(source), receipt.files)) throw new Error(`Installed copy differs from this package: ${target}. Uninstall first.`);
    mode = 'copy';
  }
  if (options.action === 'uninstall') {
    if (existing) { if (mode === 'link') unlinkSync(target); else rmSync(target, { recursive: true }); }
    return { status: existing ? 'removed' : 'absent', target, mode };
  }
  if (!options.copy && temporarySource(source)) throw new Error('Refusing to link a skill from a temporary or npx-cache package; run with --copy, or install the package first.');
  if (existing) {
    if (mode !== (options.copy ? 'copy' : 'link')) throw new Error(`Existing installation uses ${mode} mode. Uninstall first to change mode.`);
    return { status: 'already-installed', target, mode };
  }
  const files = snapshot(source);
  mkdirSync(destination, { recursive: true });
  if (mode === 'link') symlinkSync(source, target, 'dir');
  else {
    mkdirSync(target);
    try {
      for (const name of Object.keys(files)) {
        if (name.endsWith('/')) mkdirSync(join(target, name));
        else copyFileSync(join(source, name), join(target, name), constants.COPYFILE_EXCL);
      }
      writeFileSync(join(target, RECEIPT), `${JSON.stringify({ owner: OWNER, version: 1, skill: 'telescope', mode: 'copy', files }, null, 2)}\n`, { flag: 'wx' });
    } catch (error) { rmSync(target, { recursive: true }); throw error; }
  }
  return { status: 'installed', target, mode };
}
