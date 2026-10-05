/** The lane's performance stage: verdicts, fail-closed behavior and the order of its stages. */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { performanceStage, performanceSummary, performanceVerdict } from './performance-stage.mts';

test('a declared refactor is strict and fails closed; an ordinary pull request only reports', () => {
  for (const mode of ['pure-move', 'semantic'] as const) {
    assert.equal(performanceVerdict(mode, 0, 0, false), 0);
    assert.equal(performanceVerdict(mode, 1, 0, false), 1);
    assert.equal(performanceVerdict(mode, 1, 0, true), 0, 'the owner label reports without failing');
    assert.equal(performanceVerdict(mode, 2, 0, true), 2);
    assert.equal(performanceVerdict(mode, 0, 1, false), 2);
    assert.equal(performanceVerdict(mode, undefined, 0, true), 2);
  }
  for (const [compare, failures] of [[1, 0], [2, 0], [undefined, 0], [0, 1]] as const) assert.equal(performanceVerdict('report', compare, failures, false), 0);
});
test('the stage measures both builds, then compares, and records the verdict', async () => {
  const out = await mkdtemp(join(tmpdir(), 'performance-stage-'));
  try {
    const calls: string[] = [];
    const run = async (name: string) => { calls.push(name); return { exitCode: name === 'compare' ? 1 : 0, output: `# ${name}` }; };
    const report = await performanceStage('/tools', '/base', '/head', out, 'semantic', false, run);
    assert.deepEqual(calls, ['measure-base', 'measure-head', 'compare']);
    assert.equal(report.exitCode, 1);
    assert.match(performanceSummary(report), /Exit: 1\./u);
    assert.equal(JSON.parse(await readFile(join(out, 'performance.json'), 'utf8')).exitCode, 1);
    const approved = await performanceStage('/tools', '/base', '/head', out, 'semantic', true, run);
    assert.equal(approved.exitCode, 0);
    assert.match(performanceSummary(approved), /approved by the owner label/u);
  } finally { await rm(out, { recursive: true, force: true }); }
});
test('a measurement that cannot run fails the stage and skips the comparison', async () => {
  const out = await mkdtemp(join(tmpdir(), 'performance-stage-'));
  try {
    const calls: string[] = [];
    const report = await performanceStage('/tools', '/base', '/head', out, 'semantic', true, async name => { calls.push(name); return { exitCode: name === 'measure-head' ? 3 : 0, output: 'boom' }; });
    assert.deepEqual(calls, ['measure-base', 'measure-head']);
    assert.equal(report.exitCode, 2);
    assert.match(report.summary, /could not run/u);
    const ordinary = await performanceStage('/tools', '/base', '/head', out, 'report', false, async name => ({ exitCode: name === 'compare' ? 1 : 0, output: 'increase' }));
    assert.equal(ordinary.exitCode, 0);
    assert.match(performanceSummary(ordinary), /Reported only/u);
  } finally { await rm(out, { recursive: true, force: true }); }
});

test('cached base skips measurement and produces the same stable report', async () => {
  const out = await mkdtemp(join(tmpdir(), 'performance-cached-'));
  try {
    const calls: string[] = [];
    const run = async (name: string) => { calls.push(name); return { exitCode: 0, output: name === 'compare' ? 'stable comparison' : 'measured' }; };
    await performanceStage('/tools', '/base', '/head', out, 'semantic', false, run);
    const fresh = await readFile(join(out, 'performance.json')); calls.length = 0;
    await performanceStage('/tools', '/base', '/head', out, 'semantic', false, run, true);
    assert.deepEqual(calls, ['measure-head', 'compare']);
    assert.deepEqual(await readFile(join(out, 'performance.json')), fresh);
  } finally { await rm(out, { recursive: true, force: true }); }
});
