import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm, statfs } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileSize, writeProductRecord } from '@cssearth/telescope-core/node';
import { explorationDownloadSize, explorationFreeBytes, explorationPickStatuses, explorationServices } from './explore-services.mts';
import { main, type CliIo, type CliServices } from '../cli.mts';
import { exploreScreen } from './explore.mts';
import { FakeTerminal } from './fake-terminal.mts';
import type { FamilyOperation } from '../family-handler.mts';
import { exploreChoice, exploreSession } from './fixtures/explore.mts';

test('ALMA size reads only whole-delivery #this tar entries and unknown remains unknown', async () => {
  const choice = { ...exploreChoice, display: { ...exploreChoice.display, advertisedKilobytes: null } };
  const xml = `<VOTABLE><RESOURCE><TABLE>${['access_url', 'semantics', 'content_length'].map(name => `<FIELD name="${name}"/>`).join('')}<DATA><TABLEDATA>
    <TR><TD>https://almascience.org/a.tar</TD><TD>#this</TD><TD>1024</TD></TR>
    <TR><TD>https://almascience.org/b.tar</TD><TD>#this</TD><TD>2048</TD></TR>
    <TR><TD>https://almascience.org/a.jpg</TD><TD>#preview</TD><TD>9999</TD></TR>
    </TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>`;
  let calls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    calls++; assert.equal(String(input), 'https://almascience.org/datalink/sync?ID=uid%3A%2F%2FA%2FB%2FC');
    assert.ok(init?.signal); return new Response(xml);
  };
  assert.equal(await explorationDownloadSize(choice, new AbortController().signal, fetcher), 3072);
  assert.equal(await explorationDownloadSize(exploreChoice, new AbortController().signal, fetcher), 1024000); assert.equal(calls, 1);
  assert.equal(await explorationDownloadSize(choice, new AbortController().signal, async () => { throw new Error('archive down'); }), null);
  assert.equal(await explorationDownloadSize(choice, new AbortController().signal, async () => new Response(xml.replace('<TD>1024</TD>', '<TD></TD>'))), null);
});

test('free space uses the target volume before a child folder exists', async () => {
  const { bavail, bsize } = await statfs(tmpdir()), expected = bavail * bsize;
  const actual = await explorationFreeBytes(resolve(tmpdir(), 'telescope-missing/child'));
  assert.ok(Math.abs(actual - expected) < 100 * 1024 ** 2);
});

test('markers require a verified delivery or real retained bytes, and never count extraction aliases twice', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'explore-status-'));
  try {
    const work = resolve(root, '.work/pick-1/acquisition.partial'), pick = resolve(root, 'pick-2');
    await mkdir(work, { recursive: true }); await mkdir(pick);
    await writeFile(resolve(work, 'request.json'), '{}');
    const session = { ...exploreSession(), directory: root };
    assert.equal((await explorationPickStatuses(session)).size, 0);
    await writeFile(resolve(work, 'detector.raw.download.partial'), '123');
    assert.deepEqual((await explorationPickStatuses(session)).get(1), { state: 'partial', bytes: 3 });
    await rm(resolve(work, 'detector.raw.download.partial'));
    await writeFile(resolve(work, 'archive.tar.download.partial'), '12345');
    await writeFile(resolve(work, 'science.fits'), '12345');
    assert.deepEqual((await explorationPickStatuses(session)).get(1), { state: 'partial', bytes: 5 });
    const science = resolve(pick, 'science.fits'), record = resolve(pick, 'product.json');
    await writeFile(science, 'science');
    await writeProductRecord(record, { telescope: 'Fixture', stage: 'fixture', inputs: [], parameters: {}, software: [] }, [{ path: 'science.fits', file: science }]);
    const resultPath = resolve(pick, 'result.json');
    await writeFile(resultPath, JSON.stringify({ schema: 'cssearth-telescope-delivery@3', product: 'science.fits', record: 'product.json', receipt: 'product.json',
      facts: { target: 'star', verified: true }, context: { kind: 'exploration', target: 'star', discovery: { schema: 'cssearth-telescope-exploration@1', reference: { kind: 'indexed-observation', observation: 'one' } }, assessment: { status: 'not-requested' } },
      files: await Promise.all(['science.fits', 'product.json'].map(async path => ({ path, ...await fileSize(resolve(pick, path)) }))) }));
    assert.deepEqual((await explorationPickStatuses(session)).get(2), { state: 'done', bytes: 7, resultPath });
    await writeFile(science, 'changed bytes');
    await assert.rejects(explorationPickStatuses(session), /records 7/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('make → quit → open → same output reopens verified native and family outputs without exporting again', async () => {
  for (const family of [false, true]) {
    const root = await mkdtemp(resolve(tmpdir(), 'explore-made-'));
    const directory = resolve(root, 'run'), pick = resolve(directory, 'pick-1'), resultPath = resolve(pick, 'result.json');
    let exports = 0;
    const opened: string[] = [], terminal = new FakeTerminal(100, 24);
    const until = async (text: string) => {
      const deadline = Date.now() + 3000;
      while (!terminal.screen.join('\n').includes(text)) {
        if (Date.now() > deadline) assert.fail(`Screen did not show ${text}`);
        await new Promise<void>(resolve => setImmediate(resolve));
      }
    };
    const unused = async (): Promise<never> => { throw new Error('Unexpected service'); };
    const operation: FamilyOperation = { id: 'spectrum-export', handlerId: 'fixture', componentId: 'spectrum', label: 'Table', available: true, reason: 'Fixture',
      owner: { module: 'fixture', export: 'fixture' }, fixedArguments: {}, parameters: [], limitations: [] };
    const publish = async (destination: string, name: string) => {
      exports++; await mkdir(destination, { recursive: true });
      const file = resolve(destination, name); await writeFile(file, 'made output');
      const receipt = resolve(destination, 'output.product.json');
      await writeProductRecord(receipt, { telescope: 'Fixture', stage: 'fixture', inputs: [], parameters: {}, software: [] }, [{ path: name, file }]);
      return { file, receipt };
    };
    const api: CliServices = {
      saveExploration: unused, getSession: unused, importLocalArtifact: unused, projectOutput: unused, exportSphere: unused, exportSpatialObject: unused,
      familyCoverageLedger: () => [],
      listArtifactOutputs: async () => ({ artifact: 'delivery', source: resultPath,
        outputs: family ? [] : [{ kind: 'image', available: true, reason: 'Fixture', hdu: 0, parameters: [] }],
        familyOperations: family ? [operation] : [],
      }),
      exportOutput: async (_source, _selection, destination) => {
        const { file, receipt } = await publish(destination, 'figure.png');
        return { directory: destination, figure: file, values: file, data: file, receipt, sourceContext: undefined };
      },
      executeFamilyOperation: async (_source, _selection, destination) => {
        const { file, receipt } = await publish(destination, 'spectrum.csv');
        return { directory: destination, product: file, record: receipt, operation };
      },
    };
    const stdout: string[] = [], stderr: string[] = [];
    const io: CliIo = { stdinIsTTY: true, stdoutIsTTY: true, stderrIsTTY: true, terminal, write: text => stdout.push(text), error: text => stderr.push(text), question: unused, close: () => {} };
    try {
      await mkdir(pick, { recursive: true }); const science = resolve(pick, 'science.fits'); await writeFile(science, 'science');
      await writeProductRecord(resolve(pick, 'product.json'), { telescope: 'Fixture', stage: 'fixture', inputs: [], parameters: {}, software: [] }, [{ path: 'science.fits', file: science }]);
      await writeFile(resultPath, JSON.stringify({ schema: 'cssearth-telescope-delivery@3', product: 'science.fits', record: 'product.json', receipt: 'product.json', facts: { target: 'star', verified: true },
        context: { kind: 'exploration', target: 'star', discovery: { schema: 'cssearth-telescope-exploration@1', reference: { kind: 'indexed-observation', observation: 'one' } }, assessment: { status: 'not-requested' } },
        files: await Promise.all(['science.fits', 'product.json'].map(async path => ({ path, ...await fileSize(resolve(pick, path)) }))) }));
      const saved = { ...exploreSession(), directory }; await writeFile(resolve(directory, 'explore.json'), JSON.stringify(saved));
      const services = { ...explorationServices(root, ['star'], directory, api, io, {}), open: (file: string) => { opened.push(file); } };
      const first = exploreScreen(undefined, services, terminal, false, saved);
      await until('Start (UTC)'); await terminal.press({ name: 'return' }, { name: 'return' }); await until('What do you want to make?');
      await until(family ? 'CSV of wavelength' : 'PNG with a scale bar'); await terminal.press({ name: 'return' });
      await until('· opened'); await terminal.press({ text: 'q' }); assert.equal((await first).code, 0);
      assert.equal(exports, 1);
      const reopened = main(['open', root], root, io.write, io, { ...api, exploration: services });
      await until('Your runs'); await terminal.press({ name: 'return' }); await until('Start (UTC)');
      await terminal.press({ name: 'return' }, { name: 'return' }); await until('What do you want to make?');
      await until(family ? '✓ spectrum.csv' : '✓ figure.png');
      await terminal.press({ name: 'return' }); await until('· opened');
      assert.equal(exports, 1); assert.equal(opened.length, 2); assert.equal(opened[0], opened[1]);
      assert.doesNotMatch(terminal.screen.join('\n'), /plane:/u);
      await terminal.press({ text: 'q' }); assert.equal(await reopened, 0, stderr.join(''));
      await writeFile(opened[0]!, 'tampered'); await assert.rejects(services.outputs(resultPath, 1), /recorded size/u);
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});
