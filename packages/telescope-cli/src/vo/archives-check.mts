/** Asks every archive `telescope explore` asks, for one star that most of them hold, and fails when one does not answer. On
 * 2026-10-06 this would have shown the Keck archive "unavailable": it had begun marking empty answers as cut short, and no
 * test asks a live archive. It is a command and not a test, so no check depends on an archive being up:
 *
 *   node packages/telescope-cli/src/vo/archives-check.mts ["HD 189733"]
 */
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { WORKSPACE } from '@cssearth/telescope/node';

const target = process.argv[2] ?? 'HD 189733', started = Date.now();
const directory = await mkdtemp(resolve(WORKSPACE, 'output/archives-check-'));
try {
  const run = spawnSync(process.execPath, ['packages/telescope-cli/run-typed-module.mjs', 'packages/telescope-cli/src/cli.mts', 'explore', target, '--json', '--out', resolve(directory, 'exploration')],
    { cwd: WORKSPACE, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (run.status !== 0) throw new Error(`telescope explore ${target} failed (status ${run.status}): ${run.stderr.slice(-2000)}`);
  const answer = requireRecord(requireRecord(JSON.parse(run.stdout), 'exploration').answer, 'exploration answer');
  const services = requireArray(answer.services, 'services').map(raw => requireRecord(raw, 'service')).map(service => ({
    name: requireString(service.label ?? service.service, 'service name'), state: requireString(service.state, 'service state'), reason: requireString(service.reason, 'service reason') }));
  for (const service of services) console.log(`${service.state.padEnd(15)} ${service.name}${service.state === 'unavailable' ? `\n                ${service.reason.slice(0, 400)}` : ''}`);
  const failed = services.filter(service => service.state === 'unavailable');
  console.log(`${services.length - failed.length} of ${services.length} archives answered for ${target} in ${Math.round((Date.now() - started) / 1000)} s.`);
  process.exitCode = failed.length ? 1 : 0;
} finally { await rm(directory, { recursive: true, force: true }); }
