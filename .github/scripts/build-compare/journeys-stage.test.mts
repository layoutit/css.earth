/** The lane's browser journey stage: verdicts, ordering and failure handling. */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { journeysStage, journeysSummary, journeysVerdict } from './journeys-stage.mts';

test('a declared refactor needs every run and an identical recording; an ordinary pull request only reports', () => {
  for (const mode of ['pure-move', 'semantic'] as const) {
    assert.equal(journeysVerdict(mode, 0, 0), 0);
    assert.equal(journeysVerdict(mode, 0, 1), 1);
    assert.equal(journeysVerdict(mode, 1, 0), 2);
    assert.equal(journeysVerdict(mode, 1, 1), 2);
  }
  for (const [failures, differences] of [[0, 1], [1, 0], [2, 3]] as const) assert.equal(journeysVerdict('report', failures, differences), 0);
});
test('each profile records both sides, then compares them', async () => {
  const out = await mkdtemp(join(tmpdir(), 'journeys-stage-'));
  try {
    const calls: string[] = [];
    const run = async (name: string) => { calls.push(name); return { exitCode: name.startsWith('compare-webkit') ? 1 : 0, output: `# ${name}` }; };
    const report = await journeysStage('/harness', '/base', '/head', out, 'semantic', ['chromium-desktop', 'webkit-desktop'], run);
    assert.deepEqual(calls.filter(name => name.startsWith('compare')), ['compare-chromium-desktop', 'compare-webkit-desktop']);
    assert.ok(calls.indexOf('compare-chromium-desktop') > calls.indexOf('head-chromium-desktop'));
    assert.ok(calls.indexOf('base-webkit-desktop') > calls.indexOf('compare-chromium-desktop'), 'profiles run one after another');
    assert.equal(report.exitCode, 1);
    assert.match(journeysSummary(report), /Exit: 1\./u);
    assert.equal(JSON.parse(await readFile(join(out, 'journeys.json'), 'utf8')).exitCode, 1);
  } finally { await rm(out, { recursive: true, force: true }); }
});
test('a run that cannot finish fails a declared refactor and skips its comparison', async () => {
  const out = await mkdtemp(join(tmpdir(), 'journeys-stage-'));
  try {
    const calls: string[] = [];
    const run = async (name: string) => { calls.push(name); return { exitCode: name === 'head-chromium-desktop' ? 3 : 0, output: 'boom' }; };
    const report = await journeysStage('/harness', '/base', '/head', out, 'semantic', ['chromium-desktop'], run);
    assert.equal(report.exitCode, 2);
    assert.equal(calls.includes('compare-chromium-desktop'), false);
    assert.match(journeysSummary(report), /Could not complete/u);
    const ordinary = await journeysStage('/harness', '/base', '/head', out, 'report', ['chromium-desktop'], run);
    assert.equal(ordinary.exitCode, 0);
    assert.match(journeysSummary(ordinary), /Reported only/u);
  } finally { await rm(out, { recursive: true, force: true }); }
});
