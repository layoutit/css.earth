import { existsSync, readdirSync } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { delimiter, dirname, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { HELP, SHORT_HELP, VERSION } from './help.mts';

/** The command's implementation in the checkout: this package's own sources, run with the checkout's installed packages. */
const IMPLEMENTATION = 'packages/telescope-cli/src/cli.mts';
const typed = (version: string) => { const [major = 0, minor = 0] = version.split('.').map(Number); return major === 22 ? minor >= 18 : major >= 24; };
/** A Node that runs TypeScript sources without a loader: this one, or else `CSSEARTH_NODE` or the newest suitable nvm install. */
function typedNode(): string {
  if (typed(process.versions.node)) return process.execPath;
  const nvm = process.env.NVM_DIR ?? (process.env.HOME ? resolve(process.env.HOME, '.nvm') : undefined), candidates: string[] = [];
  if (process.env.CSSEARTH_NODE) candidates.push(process.env.CSSEARTH_NODE);
  if (nvm && existsSync(resolve(nvm, 'versions/node'))) for (const version of readdirSync(resolve(nvm, 'versions/node'))) candidates.push(resolve(nvm, 'versions/node', version, 'bin/node'));
  const found = candidates.filter(path => existsSync(path)).map(path => ({ path, version: spawnSync(path, ['--version'], { encoding: 'utf8' }).stdout.trim().replace(/^v/u, '') }))
    .filter(entry => typed(entry.version)).sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0];
  if (!found) throw new Error(`This command requires Node 22.18.x or Node 24+; the current runtime is Node ${process.versions.node}. Set CSSEARTH_NODE to a compatible Node executable.`);
  return found.path;
}

async function workspace(start: string, explicit: boolean): Promise<string> {
  let root = resolve(start);
  for (;;) {
    try {
      await access(resolve(root, IMPLEMENTATION));
      const pkg: unknown = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
      if (pkg && typeof pkg === 'object' && 'scripts' in pkg && pkg.scripts && typeof pkg.scripts === 'object' &&
          'telescope' in pkg.scripts && typeof pkg.scripts.telescope === 'string') return root;
    } catch { /* Try the parent directory unless the caller named an exact workspace. */ }
    const parent = dirname(root);
    if (explicit || parent === root) throw new Error('No css.earth science workspace found. Use --workspace PATH or CSSEARTH_WORKSPACE. See @cssearth/telescope-cli/README.md for setup.');
    root = parent;
  }
}
try {
  const args = process.argv.slice(2), locations = args.flatMap((arg, index) => arg === '--workspace' ? [index] : []);
  if (locations.length > 1) throw new Error('Give --workspace only once.');
  const at = locations[0], location = at === undefined ? process.env.CSSEARTH_WORKSPACE : args[at + 1];
  if (at !== undefined) {
    if (!location || location.startsWith('-')) throw new Error('--workspace requires a path.');
    args.splice(at, 2);
  }
  if (!args.length) process.stdout.write(SHORT_HELP);
  else if (args[0] === 'help' || args.includes('--help') || args.includes('-h')) process.stdout.write(HELP);
  else if (args.length === 1 && args[0] === '--version') process.stdout.write(`${VERSION}\n`);
  else {
    const root = await workspace(location ?? process.cwd(), Boolean(location));
    const node = typedNode();
    const child = spawn(node, [resolve(root, IMPLEMENTATION), ...args], { stdio: 'inherit', env: {
      ...process.env, ...(node === process.execPath ? {} : { PATH: `${dirname(node)}${delimiter}${process.env.PATH ?? ''}` }),
      CSSEARTH_TELESCOPE_STDIN_TTY: process.stdin.isTTY ? '1' : '0',
      CSSEARTH_TELESCOPE_STDOUT_TTY: process.stdout.isTTY ? '1' : '0',
    } });
    const forward = (signal: NodeJS.Signals) => child.kill(signal);
    process.on('SIGINT', forward); process.on('SIGTERM', forward);
    process.exitCode = await new Promise<number>((accept, reject) => {
      child.once('error', reject); child.once('exit', (code, signal) => accept(code ?? (signal === 'SIGINT' ? 130 : 143)));
    });
    process.off('SIGINT', forward); process.off('SIGTERM', forward);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify({ error: message, exitCode: 2 })}\n`);
  process.stderr.write(`${message}\n`); process.exitCode = 2;
}
