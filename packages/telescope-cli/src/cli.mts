import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { HELP, SHORT_HELP, VERSION } from './help.mts';

async function workspace(start: string, explicit: boolean): Promise<string> {
  let root = resolve(start);
  for (;;) {
    try {
      await access(resolve(root, 'tools/objects/telescopes/cli.mts'));
      await access(resolve(root, 'tools/cli/run-typed-module.mjs'));
      const pkg: unknown = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
      if (pkg && typeof pkg === 'object' && 'scripts' in pkg && pkg.scripts && typeof pkg.scripts === 'object' &&
          'telescope' in pkg.scripts && typeof pkg.scripts.telescope === 'string') return root;
    } catch { /* Try the parent directory unless the caller named an exact workspace. */ }
    const parent = dirname(root);
    if (explicit || parent === root) throw new Error('No css.earth science workspace found. Use --workspace PATH or CSSEARTH_WORKSPACE. See @cssearth/telescope/README.md for setup.');
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
    const child = spawn(process.execPath, [resolve(root, 'tools/cli/run-typed-module.mjs'), resolve(root, 'tools/objects/telescopes/cli.mts'), ...args], { stdio: 'inherit', env: {
      ...process.env,
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
