import { cliWorkspaceArguments } from './cli/cli-workspace.mts';
import { existsSync, readdirSync } from 'node:fs';
import { delimiter, dirname, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { helpCommand } from './help.mts';
import { VERSION } from './version.mts';
import { writeHelp } from './help-output.mts';
import { CLI_PACKAGE_ROOT } from './paths.mts';

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


try {
  const { args, workspace: root } = cliWorkspaceArguments(process.argv.slice(2));
  const help = helpCommand(args);
  if (help !== undefined) process.exitCode = await writeHelp(help, {
    stdinIsTTY: process.stdin.isTTY === true, stdoutIsTTY: process.stdout.isTTY === true, stderrIsTTY: process.stderr.isTTY === true,
    write: text => { process.stdout.write(text); }, error: text => { process.stderr.write(text); },
    question: async () => undefined, close: () => {},
  }, args.includes('--json'));
  else if (args.length === 1 && args[0] === '--version') process.stdout.write(`${VERSION}\n`);
  else {
    const node = typedNode();
    if (root) process.stderr.write(`telescope: using checkout sources at ${root}\n`);
    const child = spawn(node, [root ? resolve(root, IMPLEMENTATION) : resolve(CLI_PACKAGE_ROOT, existsSync(resolve(CLI_PACKAGE_ROOT, 'src/cli.mts')) ? 'src/cli.mts' : 'dist/cli.mjs'), ...args], { stdio: 'inherit', env: {
      ...process.env, ...(root ? { CSSEARTH_WORKSPACE: root } : {}), ...(node === process.execPath ? {} : { PATH: `${dirname(node)}${delimiter}${process.env.PATH ?? ''}` }),
      CSSEARTH_TELESCOPE_STDIN_TTY: process.stdin.isTTY ? '1' : '0',
      CSSEARTH_TELESCOPE_STDOUT_TTY: process.stdout.isTTY ? '1' : '0',
      CSSEARTH_TELESCOPE_STDERR_TTY: process.stderr.isTTY ? '1' : '0',
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
