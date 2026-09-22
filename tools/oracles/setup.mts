#!/usr/bin/env node
/**
 * Create the pinned Python oracle environment: `.local/oracles/venv` with the
 * exact versions in tools/oracles/requirements.txt. Oracle scripts run through
 * that interpreter and write fixtures under tests/oracles/; the fixtures name
 * the tool versions and the sha256 of every input they read.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

if (process.argv[2] === 'sbmt') {
  const result = spawnSync(process.execPath, [resolve(import.meta.dirname, 'sbmt/setup.mts')], { stdio: 'inherit', timeout: 900_000 });
  if (result.error || result.status !== 0) throw new Error(`SBMT setup failed: ${result.error?.message ?? result.status}`);
  process.exit(0);
}
if (process.argv.length > 2) throw new Error('Usage: node tools/oracles/setup.mts [sbmt]');

const root = resolve(import.meta.dirname, '../..'), venv = resolve(root, '.local/oracles/venv');
const requirements = resolve(root, 'tools/oracles/requirements.txt');
const python = process.env.ORACLE_PYTHON ?? (['/opt/homebrew/bin/python3.12', '/usr/local/bin/python3.12'].find(existsSync) ?? 'python3');
const run = (command: string, args: readonly string[]) => {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited with ${result.status ?? result.signal}`);
};
if (!existsSync(resolve(venv, 'bin/python'))) run(python, ['-m', 'venv', venv]);
run(resolve(venv, 'bin/python'), ['-m', 'pip', 'install', '--quiet', '--upgrade', 'pip']);
run(resolve(venv, 'bin/python'), ['-m', 'pip', 'install', '--quiet', '--require-virtualenv', '-r', requirements]);
const versions = spawnSync(resolve(venv, 'bin/python'), ['-c', 'import spiceypy, pds4_tools, pvl, astropy, numpy; print(f"spiceypy {spiceypy.__version__} ({spiceypy.tkvrsn(\'TOOLKIT\')}), pds4_tools {pds4_tools.__version__}, pvl {pvl.__version__}, astropy {astropy.__version__}, numpy {numpy.__version__}")'], { encoding: 'utf8' });
if (versions.status !== 0) throw new Error(versions.stderr);
console.log(`Oracle environment ready at ${venv}: ${versions.stdout.trim()}`);
