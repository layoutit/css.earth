import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const exec = promisify(execFile);

// Exercise the real CLI in an isolated output tree. The source loader is
// replaced with a small receipt stub: its scientific validation has its own
// tests, while these checks protect the generator's all-or-nothing contract.
async function fixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-scene-generator-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tools = resolve(root, 'packages/astronomy/tools');
  const data = resolve(root, 'packages/astronomy/src/data');
  await mkdir(tools, { recursive: true });
  await mkdir(data, { recursive: true });
  const script = resolve(tools, 'generate-scene-satellites.mts');
  await copyFile(new URL('../packages/astronomy/tools/generate-scene-satellites.mts', import.meta.url), script);
  await writeFile(resolve(tools, 'body-epoch-ephemeris.mts'), `
export async function loadBodyEpochEphemeris({bodyId, centerBodyId, epochJdTt}) {
  if (bodyId === process.env.CSSEARTH_TEST_FAIL_BODY) throw new Error('Rejected source receipt');
  return {centerBodyId, epochJdTt, positionKm: [1, 2, 3], velocityKmPerDay: [4, 5, 6],
    provenance: {model: 'test receipt', sourcePath: bodyId, validation: {fixture: true}}};
}
`);
  const output = resolve(data, 'sceneSatelliteStates.data.ts');
  const sentinel = 'Existing complete record stays intact until every source validates.\n';
  await writeFile(output, sentinel);
  return { script, output, sentinel };
}

test('scene-state generator rejects partial selection before replacing any output', async t => {
  const { script, output, sentinel } = await fixture(t);
  await assert.rejects(exec(process.execPath, [script, '--object=hiiaka']), /regenerate all source-state/);
  assert.equal(await readFile(output, 'utf8'), sentinel);
});

test('scene-state generator writes all six records only after every source validates', async t => {
  const { script, output, sentinel } = await fixture(t);
  await assert.rejects(exec(process.execPath, [script], {
    env: { ...process.env, CSSEARTH_TEST_FAIL_BODY: 'sn263-gamma' },
  }), /Rejected source receipt/);
  assert.equal(await readFile(output, 'utf8'), sentinel);
  await exec(process.execPath, [script]);
  const text = await readFile(output, 'utf8');
  const records = JSON.parse(text.split('export const SCENE_SATELLITE_STATES = ')[1].split(' as const satisfies')[0]);
  assert.deepEqual(Object.keys(records), ['hiiaka', 'menoetius', 'squannit', 'romulus', 'sn263-beta', 'sn263-gamma']);
  assert.deepEqual(Object.values(records).map(record => record.centerBodyId),
    ['haumea', 'patroclus', 'moshup', 'sylvia', 'asteroid-2001-sn263', 'asteroid-2001-sn263']);
  assert.ok(Object.values(records).every(record => record.epochJdTt === 2461286.5));
  assert.ok(Object.values(records).every(record => !Object.hasOwn(record.provenance, 'validation')));
});
