#!/usr/bin/env node
/**
 * Create the pinned Python oracle environment: `.local/oracles/venv` with the
 * exact versions in packages/core/src/node/oracle/requirements.txt. Oracle scripts run through
 * that interpreter and write fixtures beside their owning packages; the fixtures name
 * the tool versions and the path and size of every input they read.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readOracleSetupManifest } from './manifest.mts';
import { projectRoot } from '../project-root.ts';

const root = projectRoot(import.meta.url);

const requested = process.argv[2];
if (requested) {
  const command = readOracleSetupManifest(root).setup[requested];
  if (process.argv.length !== 3 || !command) throw new Error('Unknown oracle setup; owners register setup commands in their manifests.');
  const result = spawnSync(process.execPath, [resolve(root, command)], { cwd: root, stdio: 'inherit', timeout: 900_000 });
  if (result.error || result.status !== 0) throw new Error(`Oracle setup failed: ${result.error?.message ?? result.status}`);
  process.exit(0);
}

const venv = resolve(root, '.local/oracles/venv');
const requirements = resolve(import.meta.dirname, 'requirements.txt');
const python = process.env.ORACLE_PYTHON ?? (['/opt/homebrew/bin/python3.12', '/usr/local/bin/python3.12'].find(existsSync) ?? 'python3');
const run = (command: string, args: readonly string[]) => {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited with ${result.status ?? result.signal}`);
};
if (!existsSync(resolve(venv, 'bin/python'))) run(python, ['-m', 'venv', venv]);
run(resolve(venv, 'bin/python'), ['-m', 'pip', 'install', '--quiet', '--upgrade', 'pip']);
run(resolve(venv, 'bin/python'), ['-m', 'pip', 'install', '--quiet', '--require-virtualenv', '-r', requirements]);
const versions = spawnSync(resolve(venv, 'bin/python'), ['-c', 'import spiceypy, pds4_tools, pvl, astropy, numpy; print(f"spiceypy {spiceypy.__version__} ({spiceypy.tkvrsn(\'TOOLKIT\')}), pds4_tools {pds4_tools.__version__}, pvl {pvl.__version__}, astropy {astropy.__version__}, numpy {numpy.__version__}")'], { cwd: root, encoding: 'utf8' });
if (versions.status !== 0) throw new Error(versions.stderr);
console.log(`Oracle environment ready at ${venv}: ${versions.stdout.trim()}`);
