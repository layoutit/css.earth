import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileSize, writeProductRecord } from '@cssearth/telescope-core/node';
import { listSavedRuns, readSavedExploration } from './saved-runs.mts';
import { explorationPickStatuses } from './explore-services.mts';
import { exploreSession } from './fixtures/explore.mts';

test('runs sort by saved date, with per-run counts from the same verified files as explore', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'saved-runs-'));
  try {
    assert.deepEqual(await listSavedRuns(resolve(root, 'absent')), []);
    const older = resolve(root, 'a-older'), newer = resolve(root, 'z-newer'), other = resolve(root, 'unrelated');
    await mkdir(older); await mkdir(newer); await mkdir(other);
    await writeFile(resolve(root, 'not-a-run'), 'text');
    await writeFile(resolve(other, 'query.json'), '{}');
    await writeFile(resolve(older, 'explore.json'), JSON.stringify({ ...exploreSession(), createdAt: '2026-10-13T00:00:00Z' }));
    await writeFile(resolve(newer, 'explore.json'), JSON.stringify({ ...exploreSession(), createdAt: '2026-10-15T00:00:00Z' }));
    const pick = resolve(newer, 'pick-1'), work = resolve(newer, '.work/pick-2/acquisition.partial');
    await mkdir(pick); await mkdir(work, { recursive: true });
    await writeFile(resolve(work, 'science.fits.download.partial'), '123');
    await writeFile(resolve(pick, 'science.fits'), 'science');
    await writeProductRecord(resolve(pick, 'product.json'), { telescope: 'fixture', stage: 'fixture', inputs: [], parameters: {}, software: [] },
      [{ path: 'science.fits', file: resolve(pick, 'science.fits') }]);
    await writeFile(resolve(pick, 'result.json'), JSON.stringify({ schema: 'cssearth-telescope-delivery@3', product: 'science.fits', record: 'product.json', receipt: 'product.json',
      facts: { target: 'star', verified: true }, context: { kind: 'exploration', target: 'star', discovery: { schema: 'cssearth-telescope-exploration@1', reference: { kind: 'indexed-observation', observation: 'one' } }, assessment: { status: 'not-requested' } },
      files: await Promise.all(['science.fits', 'product.json'].map(async path => ({ path, ...await fileSize(resolve(pick, path)) }))) }));
    const made = resolve(pick, 'made/1-image');
    await mkdir(made, { recursive: true });
    await mkdir(resolve(pick, 'made/2-empty'));
    await mkdir(resolve(pick, 'made/3-image.partial'));
    await writeFile(resolve(pick, 'made/3-image.partial/figure.png'), 'unfinished');
    await writeFile(resolve(made, 'figure.png'), 'png'); await writeFile(resolve(made, 'values.csv'), 'csv');
    await writeProductRecord(resolve(made, 'output.product.json'), { telescope: 'fixture', stage: 'fixture', inputs: [], parameters: {}, software: [] },
      ['figure.png', 'values.csv'].map(path => ({ path, file: resolve(made, path) })));
    const runs = await listSavedRuns(root);
    assert.deepEqual(runs, [
      { run: newer, target: 'Star', at: '2026-10-15T00:00:00Z', observations: 2, downloaded: 1, partial: 1, made: 1 },
      { run: older, target: 'Star', at: '2026-10-13T00:00:00Z', observations: 2, downloaded: 0, partial: 0, made: 0 },
    ]);
    const statuses = await explorationPickStatuses(await readSavedExploration(newer));
    assert.equal(statuses.get(1)?.state, 'done'); assert.equal(statuses.get(2)?.state, 'partial');
    await rm(resolve(work, 'science.fits.download.partial'));
    assert.equal((await listSavedRuns(root))[0]!.partial, 0, 'a removed part immediately stops counting');
    await writeFile(resolve(pick, 'science.fits'), 'changed bytes');
    await assert.rejects(listSavedRuns(root), /output|record/u, 'corrupt delivery is never called downloaded');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('saved screen data is decoded without trusting malformed dates, picks, references or display values', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'saved-run-read-'));
  try {
    const session = exploreSession(), path = resolve(root, 'explore.json');
    await writeFile(path, JSON.stringify(session));
    const saved = await readSavedExploration(root);
    assert.equal(saved.directory, root); assert.equal(saved.answer.targetResolution.canonical?.name, 'Star');
    assert.deepEqual(saved.choices[0]!.display, session.choices[0]!.display);
    for (const bad of [
      { ...session, schema: 'unknown' }, { ...session, createdAt: 'bad' }, { ...session, arguments: [1] },
      { ...session, answer: { ...session.answer, targetResolution: { status: 'resolved' } } },
      { ...session, choices: [{ ...session.choices[0], pick: 2 }] },
      { ...session, choices: [{ ...session.choices[0], reference: { kind: 'unknown' } }] },
      { ...session, choices: [{ ...session.choices[0], display: { ...session.choices[0]!.display, instrument: 12 } }] },
    ]) {
      await writeFile(path, JSON.stringify(bad));
      await assert.rejects(readSavedExploration(root), /explore\.json/u);
    }
    const field = { ...session, target: undefined, arguments: ['--icrs-circle', '12,-4,0.1'], choices: [],
      answer: { ...session.answer, targetResolution: { status: 'position' }, outcome: { selection: 'none', coverage: 'bounded' } } };
    const fieldDirectory = resolve(root, 'field'); await mkdir(fieldDirectory);
    await writeFile(resolve(fieldDirectory, 'explore.json'), JSON.stringify(field));
    assert.deepEqual((await readSavedExploration(fieldDirectory)).answer.request.footprint, { frame: 'icrs', shape: 'circle', raDegrees: 12, decDegrees: -4, radiusDegrees: 0.1 });
    assert.equal((await listSavedRuns(root))[0]!.target, 'Field');
  } finally { await rm(root, { recursive: true, force: true }); }
});
