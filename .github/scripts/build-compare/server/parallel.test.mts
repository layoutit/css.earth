/** Every target settles, failures stay visible, socket/temp isolation survives concurrency. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parallel, recordingConcurrency, recordingIsolation } from './parallel.mts';
import { hostPort } from '../../server-answers/host-port.mts';
test('every target finishes and failure stays visible without exceeding the finite bound', async () => {
  let active = 0, peak = 0; const finished: string[] = [];
  const result = await parallel(['preview', 'cloudflare', 'third', 'fourth'], recordingConcurrency, async target => {
    active++; peak = Math.max(active, peak);
    try { await new Promise(accept => setTimeout(accept, 15)); finished.push(target); if (target === 'cloudflare') throw new Error('positive failure evidence'); }
    finally { active--; }
  });
  assert.equal(peak, 3); assert.equal(finished.length, 4);
  assert.equal(result[1]?.status, 'rejected'); assert.equal(result.filter(value => value.status === 'fulfilled').length, 3);
  await assert.rejects(parallel([], 0, async () => {}), /Invalid/u);
});
async function portContract(port: typeof hostPort) {
  assert.equal(port('preview'), 0, 'preview requires OS-assigned port');
  assert.equal(port('cloudflare'), undefined, 'Cloudflare host is IPC-only');
}
test('hosts use ephemeral preview ports, an IPC-only Worker host and distinct recording directories for simultaneous recordings', async () => {
  await portContract(hostPort);
  const root = await mkdtemp(join(tmpdir(), 'recording-isolation-'));
  try {
    const isolated = await Promise.all(['preview', 'cloudflare'].map(target => recordingIsolation(root, target)));
    try {
      assert.equal(new Set(isolated.map(value => value.directory)).size, 2);
      for (const value of isolated) { assert.equal(value.env.TMPDIR, value.directory); assert.equal(value.env.TEMP, value.directory); assert.match(value.env.NODE_OPTIONS ?? '', /512/u); }
      const host = await readFile(new URL('../../server-answers/host.mts', import.meta.url), 'utf8');
      assert.ok(host.includes("port: hostPort(target ?? '')"));
    } finally { await Promise.all(isolated.map(value => value.close())); }
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('sharing a listening port turns the exact host port contract red', async () => {
  const root = await mkdtemp(join(tmpdir(), 'host-port-mutant-'));
  try {
    const source = await readFile(new URL('../../server-answers/host-port.mts', import.meta.url), 'utf8');
    assert.ok(source.includes("target === 'preview' ? 0 : undefined"));
    const path = join(root, 'mutant.mts'); await writeFile(path, source.replace("target === 'preview' ? 0 : undefined", '4321'));
    const mutant = await import(pathToFileURL(path).href);
    await assert.rejects(portContract(mutant.hostPort), assert.AssertionError);
  } finally { await rm(root, { recursive: true, force: true }); }
});
