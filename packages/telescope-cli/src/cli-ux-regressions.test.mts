import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test, { mock } from 'node:test';
import * as gaia from './stars/gaia-cone.mts';
import { fetchGeminiSource } from './archive-adapters/gemini-source.mts';
import { CADC_TAP } from './archives/gemini/cadc.mts';
import type { CliIo } from './cli.mts';

const gaiaRows = Array.from({ length: 100 }, (_, index) => ({
  source_id: String(1000000000000 + index), ra: '10', dec: '20', phot_g_mean_mag: '12',
}));
const geminiRow = { observationID: 'GN-1-001', type: 'OBJECT', intent: 'science', instrument_name: 'NIRI', target_name: 'HR8799',
  uri: 'gemini:GEMINI/N20200101S0001.fits', contentLength: '2880', energy_bandpassName: 'K', time_exposure: '30',
  time_bounds_lower: '58849', dataRelease: '2021-01-01T00:00:00.000' };
let writtenCone: string | undefined, requests = 0, recover = false;
mock.module('./stars/gaia-cone.mts', { namedExports: { ...gaia,
  gaiaCone: async (request: gaia.GaiaConeRequest, options: Parameters<typeof gaia.gaiaCone>[1]) => {
    const result = await gaia.gaiaCone(request, { ...options, rows: async () => gaiaRows });
    writtenCone = await readFile(options!.out!, 'utf8');
    return result;
  },
} });
mock.module('./archive-adapters/gemini-source.mts', { namedExports: {
  fetchGeminiSource: async (path: string, pick: number, directory: string, _query: unknown, _fetcher: unknown, resume: boolean) =>
    fetchGeminiSource(path, pick, directory, async () => [geminiRow], async () => {
      requests++;
      return recover ? new Response(Buffer.from('SIMPLE  ='.padEnd(2880)), { headers: { 'content-type': 'image/fits' } })
        : new Response('unavailable', { status: 503 });
    }, resume),
} });
const { main } = await import('./cli.mts');

function capture() {
  const stdout: string[] = [], stderr: string[] = [];
  const io: CliIo = { stdinIsTTY: false, stdoutIsTTY: false, write: text => stdout.push(text),
    error: text => stderr.push(text), question: async () => { throw new Error('Unexpected prompt'); }, close: () => {} };
  return { io, stdout, stderr };
}

test('gaia-cone --json --out cone.json summarizes a large record without rewriting the saved file', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'gaia-cli-summary-')), out = resolve(directory, 'cone.json');
  try {
    const screen = capture();
    assert.equal(await main(['gaia-cone', '10,20,1', '--json', '--out', out], undefined, screen.io.write, screen.io), 0);
    assert.ok(writtenCone && writtenCone.length > 8000, 'Fixture must exercise the summary path');
    const summary = JSON.parse(screen.stdout.join(''));
    assert.equal(summary.schema, 'cssearth-telescope-gaia-cone-summary@1');
    assert.equal(summary.savedPath, out); assert.equal(summary.starsCount, 100);
    assert.equal(await readFile(out, 'utf8'), writtenCone, 'Summary must preserve the already-written record');
    assert.deepEqual(await readdir(directory), ['cone.json'], 'Summary must not write a second record');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('exhausted fetch prints the command-specific --resume recovery and retains raw diagnostics', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'fetch-cli-recovery-')), before = process.cwd();
  let destination: string;
  process.chdir(root);
  try {
    const pin = 'example.org-20260929000000000', evidenceDirectory = resolve(root, 'archive-source-evidence');
    await mkdir(evidenceDirectory);
    await writeFile(resolve(evidenceDirectory, `${pin}.json`), JSON.stringify({ source: CADC_TAP, request: 'fixture', rows: [geminiRow] }));
    const source = { name: 'N20200101S0001.fits', uri: geminiRow.uri, bytes: 2880, targetName: 'HR8799', telescope: 'Gemini North',
      instrument: 'NIRI', observation: geminiRow.observationID, dataRelease: geminiRow.dataRelease, evidence: pin };
    const exploration = resolve(root, 'explore.json');
    await writeFile(exploration, JSON.stringify({ schema: 'cssearth-telescope-exploration@1', target: 'hr-8799', answer: {
      target: 'hr-8799', request: { target: 'hr-8799', transferLimits: { scienceBytes: 4096 } },
      services: [{ service: CADC_TAP, sources: [source] }],
    } }));
    const screen = capture(); requests = 0;
    assert.equal(await main(['fetch', exploration, '--archive', 'gemini', '--pick', '1', '--json'],
      undefined, screen.io.write, screen.io), 1);
    const resume = screen.stderr.find(line => line.startsWith('Download interrupted at '))!;
    const command = resume.split('Resume with: ')[1]!.trim();
    const words = command.split(' ');
    assert.deepEqual(words.slice(0, 2), ['telescope', 'fetch']);
    destination = resolve(words[words.indexOf('--out') + 1]!);
    assert.ok(destination.startsWith(resolve(process.cwd(), 'telescope-runs/hr-8799-')));
    assert.ok(words.includes('--resume'));
    assert.match(screen.stderr[0]!, /Download: 1 MB from Gemini → .*telescope-runs\/hr-8799-/u);
    assert.equal(requests, 3, 'The actual transport must exhaust its attempt budget');
    assert.match(screen.stderr.find(line => line.startsWith('Download interrupted at '))!, /^Download interrupted at .* after 3 attempts\. Resume with: telescope fetch .* --out \.\/telescope-runs\/hr-8799-.* --resume --json\n$/u);
    assert.doesNotMatch(screen.stderr.find(line => line.startsWith('Download interrupted at '))!, /Run the same command again to retry|HTTP 503/u);
    const failure = JSON.parse(await readFile(`${destination}.partial/transfer-failure.json`, 'utf8'));
    assert.match(failure.rawError, /HTTP 503/u);
    await assert.rejects(readFile(destination), { code: 'ENOENT' }, 'Failure diagnostics must not create the final output');
    const summary = JSON.parse(screen.stdout.join(''));
    assert.match(summary.error, /--resume/u);
    assert.match(JSON.parse(await readFile(summary.savedPath, 'utf8')).rawMessage, /HTTP 503/u);
    assert.equal(summary.savedPath,resolve(`${destination}.partial`,'failure.json'));
    const repeat = capture();
    assert.equal(await main(['fetch', exploration, '--archive', 'gemini', '--pick', '1', '--out', destination],
      undefined, repeat.io.write, repeat.io), 1);
    assert.match(repeat.stderr.join(''), /Partial transfer exists.*--resume/u);
    recover = true;
    const resumed = capture();
    assert.equal(await main(words.slice(1),
      undefined, resumed.io.write, resumed.io), 0, resumed.stderr.join(''));
    assert.equal((await readFile(resolve(destination, source.name))).length, 2880);
    for (const name of ['failure.json', 'transfer-failure.json', 'transfer-progress.json', 'transfer-progress.json.tmp'])
      await assert.rejects(readFile(resolve(destination, name)), { code: 'ENOENT' });
    assert.deepEqual(JSON.parse(resumed.stdout.join('')).download,{bytes:2880,archive:'Gemini',destination});
  } finally { process.chdir(before); recover = false; await rm(root, { recursive: true, force: true }); }
});
