/** The lane's performance stage: verdicts, fail-closed behavior and the order of its stages. */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { performanceStage, performanceSummary, performanceVerdict } from './performance-stage.mts';

test('an increase fails, equality passes, the owner label reports without failing, a broken stage fails closed', () => {
  assert.equal(performanceVerdict(0, 0, false), 0);
  assert.equal(performanceVerdict(1, 0, false), 1);
  assert.equal(performanceVerdict(1, 0, true), 0);
  assert.equal(performanceVerdict(2, 0, true), 2);
  assert.equal(performanceVerdict(0, 1, false), 2);
  assert.equal(performanceVerdict(undefined, 0, true), 2);
});
test('the stage measures both builds, then compares, and records the verdict', async () => {
  const out = await mkdtemp(join(tmpdir(), 'performance-stage-'));
  try {
    const calls: string[] = [];
    const run = async (name: string) => { calls.push(name); return { exitCode: name === 'compare' ? 1 : 0, output: `# ${name}` }; };
    const report = await performanceStage('/tools', '/base', '/head', out, false, run);
    assert.deepEqual(calls, ['measure-base', 'measure-head', 'compare']);
    assert.equal(report.exitCode, 1);
    assert.match(performanceSummary(report), /Exit: 1\./u);
    assert.equal(JSON.parse(await readFile(join(out, 'performance.json'), 'utf8')).exitCode, 1);
    const approved = await performanceStage('/tools', '/base', '/head', out, true, run);
    assert.equal(approved.exitCode, 0);
    assert.match(performanceSummary(approved), /approved by the owner label/u);
  } finally { await rm(out, { recursive: true, force: true }); }
});
test('a measurement that cannot run fails the stage and skips the comparison', async () => {
  const out = await mkdtemp(join(tmpdir(), 'performance-stage-'));
  try {
    const calls: string[] = [];
    const report = await performanceStage('/tools', '/base', '/head', out, true, async name => { calls.push(name); return { exitCode: name === 'measure-head' ? 3 : 0, output: 'boom' }; });
    assert.deepEqual(calls, ['measure-base', 'measure-head']);
    assert.equal(report.exitCode, 2);
    assert.match(report.summary, /could not run/u);
  } finally { await rm(out, { recursive: true, force: true }); }
});
