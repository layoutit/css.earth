/** Clone a revision and restore local build inputs without preparation or downloads. */
import { spawn, type ChildProcess } from 'node:child_process';
import { constants } from 'node:fs';
import { cp, lstat, realpath, rm, mkdir, symlink } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { publicRoot } from './public-root.mts';

export function terminate(child: ChildProcess, signal: NodeJS.Signals = 'SIGTERM'): void {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  try { if (process.platform === 'win32') child.kill(signal); else process.kill(-child.pid, signal); }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) throw error; }
}

export async function command(program: string, args: string[], cwd: string): Promise<string> {
  return new Promise((accept, reject) => {
    const child = spawn(program, args, { cwd, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    const stop = () => terminate(child);
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
    const cleanup = () => { process.off('SIGTERM', stop); process.off('SIGINT', stop); };
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.once('error', error => { cleanup(); reject(error); });
    child.once('exit', code => { cleanup(); if (code === 0) accept(stdout); else reject(new Error(`${program} exited ${String(code)}: ${stderr.slice(-4000)}`)); });
  });
}

/** Only dependencies and downloaded inputs cross revisions; generated outputs are rebuilt. */
export function restoreInput(path: string): boolean {
  return /^(?:node_modules|packages\/[^/]+\/node_modules)(?:\/|$)/u.test(path) ||
    /^src\/objects\/[^/]+\/prepared(?:\/|$)/u.test(path) ||
    /^(?:site\/)?public\/(?!features(?:\/|$)|shell(?:\/|$)|scenes(?:\/|$))/u.test(path);
}
/** A source path under the source's public directory, at the same place under the revision's. */
export function inLayout(path: string, sourcePublic: string, revisionPublic: string): string {
  return path === sourcePublic || path.startsWith(`${sourcePublic}/`) ? revisionPublic + path.slice(sourcePublic.length) : path;
}
export async function cloneRestore(source: string, destination: string, revision = 'HEAD'): Promise<{ revision: string; restored: number }> {
  const root = await realpath(source), target = resolve(destination);
  if (dirname(target) !== dirname(root) || !target.startsWith(`${root}-`)) throw new Error('Destination must be a new sibling named after the source with a suffix.');
  try { await lstat(target); throw new Error('Destination already exists.'); }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  const commit = (await command('git', ['rev-parse', '--verify', `${revision}^{commit}`], root)).trim();
  try {
    await command('git', ['clone', '--quiet', '--no-hardlinks', '--no-checkout', '--local', root, target], root);
    await command('git', ['checkout', '--quiet', '--detach', commit], target);
    const ignored = (await command('git', ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z'], root)).split('\0').filter(Boolean);
    // Read both layouts before copying: a restored public input would otherwise create the source's public directory in
    // a revision from the other layout, and that revision would then be read in the wrong one.
    const sourcePublic = publicRoot(root), revisionPublic = publicRoot(target);
    let restored = 0;
    for (const path of ignored) {
      if (!restoreInput(path)) continue;
      const from = resolve(root, path), to = resolve(target, inLayout(path, sourcePublic, revisionPublic));
      if (!from.startsWith(root + sep) || relative(target, to).startsWith('..')) throw new Error(`Invalid restored path: ${path}`);
      // COPYFILE_FICLONE attempts a reflink and falls back to an ordinary file copy.
      await cp(from, to, { recursive: true, verbatimSymlinks: true, mode: constants.COPYFILE_FICLONE });
      restored++;
    }
    // Shared downloaded public inputs are read only by the comparison. Never copied into a clone.
    const targetPublic = resolve(target, revisionPublic);
    await mkdir(targetPublic, { recursive: true });
    await symlink(resolve(root, sourcePublic, 'scenes'), resolve(targetPublic, 'scenes'));
    return { revision: commit, restored };
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { source: { type: 'string' }, destination: { type: 'string' }, revision: { type: 'string', default: 'HEAD' } } });
  if (!values.source || !values.destination) throw new Error('Usage: clone-restore.mts --source <restored checkout> --destination <new sibling> [--revision HEAD]');
  console.log(JSON.stringify(await cloneRestore(values.source, values.destination, values.revision)));
}
