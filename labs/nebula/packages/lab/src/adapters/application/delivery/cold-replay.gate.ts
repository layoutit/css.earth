import { nebulaBakeBackend } from '@cssearth/bake/nebula';
/** Explicit expensive gate (not default unit-test discovery):
 * node labs/nebula/packages/lab/src/adapters/application/delivery/run-cold-replay.mts --timeout-seconds 1800
 * Optional --objects m42,helix,m45,m8,m1 selects a bounded subset; every selected object's datasets run.
 * Each child has a hard deadline, isolated cwd/root, and only declared compact inputs/profile.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { replayCompactCompiler, readCompactCompiler, replayCompactSampled } from '@cssearth/bake/volume/node';
import { readCompilerBakeResult } from '@cssearth/objects';
import { assertReplayScene, verifyReplayFiles } from './cold-replay-parity.ts';

const ids = ['m42', 'helix', 'm45', 'm8', 'm1'];
const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const record = (v: unknown): Record<string, unknown> => { assert.ok(isRecord(v)); return v; };
const pin = (v: unknown): { path: string } => {
  const p = record(v);
  assert.ok(typeof p.path === 'string' && !p.path.startsWith('/') && !p.path.split('/').includes('..'), `Invalid compact input path: ${JSON.stringify(v)}`);
  return { path: p.path };
};
async function worker(id: string, source: string): Promise<void> {
  assert.ok(ids.includes(id));
  const root = process.cwd();
  async function copy(path: string): Promise<Buffer> {
    const bytes = await readFile(resolve(source, path));
    await mkdir(dirname(resolve(root, path)), { recursive: true });
    await writeFile(resolve(root, path), bytes);
    return bytes;
  }
  const path = `src/objects/${id}/source/${id === 'm1' ? 'compact/model.json.gz' : 'bake-inputs.json.gz'}`;
  const delivery: unknown = JSON.parse(await readFile(resolve(source, `src/objects/${id}/source/delivery.json`), 'utf8'));
  const acceptedInput = pin(record(delivery).compactInputs);
  assert.equal(acceptedInput.path, path);
  const bytes = await copy(path);
  const value: unknown = JSON.parse(gunzipSync(bytes).toString());
  const model = record(value), expected = readCompilerBakeResult(model.scene);
  if (expected.starSprites) await copy(expected.starSprites.profile.path);
  if (id === 'm1') {
    assert.ok(Array.isArray(model.datasets));
    for (const item of [model.particles, ...model.datasets.map(dataset => record(dataset).points)]) {
      await copy(pin(item).path);
    }
  } else assert.equal(readCompactCompiler(value).objectId, id);
  console.log(`START ${id}: ${expected.datasets.length} datasets; isolated compact inputs ready`);
  const inputPin = { path };
  const result = id === 'm1'
    ? await replayCompactSampled(root, inputPin, 'prepared', nebulaBakeBackend)
    : await replayCompactCompiler(root, inputPin, 'prepared', nebulaBakeBackend);
  assertReplayScene(result.scene, expected);
  const resources = await verifyReplayFiles(root, result.scene);
  console.log(`PASS ${id}: ${expected.datasets.length} datasets, ${resources} resources; field/stars/frame/bytes unchanged`);
}
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === '--worker') {
    assert.ok(args[1] && args[2]); await worker(args[1], args[2]); return;
  }
  let selected = ids, seconds = 1800;
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] === '--objects') selected = (args[i + 1] ?? '').split(',');
    else if (args[i] === '--timeout-seconds') seconds = Number(args[i + 1]);
    else throw new Error(`Unknown argument: ${args[i]}`);
  }
  assert.ok(selected.length > 0 && selected.every(id => ids.includes(id)) && new Set(selected).size === selected.length);
  assert.ok(Number.isSafeInteger(seconds) && seconds >= 1 && seconds <= 7200);
  const source = process.cwd(), script = fileURLToPath(import.meta.url);
  for (const id of selected) {
    const root = await mkdtemp(resolve(tmpdir(), `nebula-cold-${id}-`));
    try {
      await new Promise<void>((done, reject) => {
        const child = spawn(process.execPath, [script, '--worker', id, source], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
        let evidence = '';
        child.stdout.on('data', (chunk: Buffer) => {
          process.stdout.write(chunk); evidence = (evidence + chunk.toString()).slice(-4096);
        });
        let expired = false;
        const deadline = setTimeout(() => { expired = true; child.kill('SIGKILL'); }, seconds * 1000);
        const heartbeat = setInterval(() => console.log(`RUNNING ${id}; deadline ${seconds}s`), 30_000);
        const clear = () => { clearTimeout(deadline); clearInterval(heartbeat); };
        child.once('error', error => { clear(); reject(error); });
        child.once('exit', (code, signal) => {
          clear();
          if (code === 0 && evidence.includes(`PASS ${id}:`)) done();
          else reject(new Error(`${id}: ${expired ? 'deadline exceeded' : `exit ${code}, signal ${signal}`}`));
        });
      });
    } finally { await rm(root, { recursive: true, force: true }); }
  }
  console.log(`COLD_REPLAY_PASS ${selected.join(',')}`);
}
await main();
