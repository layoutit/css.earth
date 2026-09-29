import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { base, fileBytes, runtimeLock, verifyFiles } from './runtime.mts';
import { requireString, requireFiniteNumber } from '@cssearth/core';
import { restoreInputs } from './restore.mts';

const { lock, files, bridgeFiles } = await runtimeLock();
if (`${process.platform}-${process.arch}` !== lock.platform) throw new Error(`SBMT setup currently qualifies ${lock.platform} only.`);
await mkdir(base, { recursive: true });
function run(command: string, args: string[], timeout: number) {
  const result = spawnSync(command, args, { stdio: 'inherit', timeout });
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message ?? result.status}`);
}
const archive = resolve(base, requireString(lock.package));
if (!existsSync(archive)) run('curl', ['--fail', '--location', '--max-time', '600', '--output', archive, requireString(lock.url)], 610_000);
const actual = await fileBytes(archive), expected = requireFiniteNumber(lock.bytes);
if (actual.bytes !== expected) throw new Error(`SBMT package ${archive} holds ${actual.bytes} bytes; runtime.lock.json records ${expected}.`);
if (!existsSync(resolve(base, 'distribution'))) run('pkgutil', ['--expand-full', archive, resolve(base, 'distribution')], 120_000);
await verifyFiles(base, files);
const bridge = resolve(base, 'bridge'); await mkdir(bridge, { recursive: true });
for (const name of ['package.json', 'package-lock.json']) await copyFile(resolve(import.meta.dirname, name), resolve(bridge, name));
run('npm', ['ci', '--prefix', bridge, '--ignore-scripts', '--no-audit', '--no-fund'], 120_000);
await verifyFiles(base, bridgeFiles);
await restoreInputs();
console.log('SBMT ready. Regenerate with node packages/core/src/node/oracle/run.mts sbmt/projection (one bounded, headless process at a time).');
