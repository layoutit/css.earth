import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import test, { type TestContext } from 'node:test';

const exec = promisify(execFile);

// Exercise the real CLI in an isolated output tree. The source loader is
// replaced with a small receipt stub: its scientific validation has its own
// tests, while these checks protect the generator's all-or-nothing contract.
async function fixture(t: TestContext) {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-scene-generator-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tools = resolve(root, 'packages/astronomy/tools');
  const data = resolve(root, 'packages/astronomy/data/bodies');
  await mkdir(tools, { recursive: true });
  await mkdir(data, { recursive: true });
  const script = resolve(tools, 'generate-scene-satellites.mts');
  await copyFile(new URL('../../packages/astronomy/tools/generate-scene-satellites.mts', import.meta.url), script);
  await writeFile(resolve(tools, 'body-epoch-ephemeris.mts'), `
export async function loadBodyEpochEphemeris({bodyId, centerBodyId, epochJdTt}) {
  if (bodyId === process.env.CSSEARTH_TEST_FAIL_BODY) throw new Error('Rejected source receipt');
  return {centerBodyId, epochJdTt, positionKm: [1, 2, 3], velocityKmPerDay: [4, 5, 6],
    provenance: {model: 'test receipt', sourcePath: bodyId, validation: {fixture: true}}};
}
`);
  await writeFile(resolve(tools, 'body-records.mts'), `
import { readFile, readdir, writeFile } from 'node:fs/promises';
const directory = new URL('../../data/bodies/', import.meta.url);
export async function readBodyRecords() { return Promise.all((await readdir(directory)).sort().map(file => readFile(new URL(file, directory), 'utf8').then(JSON.parse))); }
export async function writeBodyRecord(record) { await writeFile(new URL(record.id + '.json', directory), JSON.stringify(record)); }
export async function prepareBodyRecords() {}
`);
  const ids = ['hiiaka', 'menoetius', 'squannit', 'romulus', 'sn263-beta', 'sn263-gamma'];
  const before = new Map();
  for (const id of ids) {
    const record = JSON.parse(await readFile(new URL(`../../packages/astronomy/data/bodies/${id}.json`, import.meta.url), 'utf8'));
    const text = JSON.stringify({ id, acquisition: record.acquisition, sceneSatellite: { sentinel: true } });
    before.set(id, text);
    await writeFile(resolve(data, id + '.json'), text);
  }
  const read = (id: string) => readFile(resolve(data, id + '.json'), 'utf8');
  return { script, ids, before, read };
}

test('scene-state generator writes only the selected body', async t => {
  const { script, ids, before, read } = await fixture(t);
  await exec(process.execPath, [script, '--object=hiiaka']);
  for (const id of ids) {
    const text = await read(id);
    if (id === 'hiiaka') assert.deepEqual(JSON.parse(text).sceneSatellite.positionKm, [1, 2, 3]);
    else assert.equal(text, before.get(id), id);
  }
  await assert.rejects(exec(process.execPath, [script, '--object=unknown-body']), /Unknown source-state satellite/);
});

test('scene-state generator validates every selected source before writing any record', async t => {
  const { script, ids, before, read } = await fixture(t);
  await assert.rejects(exec(process.execPath, [script], {
    env: { ...process.env, CSSEARTH_TEST_FAIL_BODY: 'sn263-gamma' },
  }), /Rejected source receipt/);
  for (const id of ids) assert.equal(await read(id), before.get(id), id);
  await exec(process.execPath, [script]);
  const records = await Promise.all(ids.map(async id => JSON.parse(await read(id)).sceneSatellite));
  assert.deepEqual(records.map(record => record.centerBodyId),
    ['haumea', 'patroclus', 'moshup', 'sylvia', 'asteroid-2001-sn263', 'asteroid-2001-sn263']);
  assert.ok(records.every(record => record.epochJdTt === 2461286.5));
  assert.ok(records.every(record => !Object.hasOwn(record.provenance, 'validation')));
});
