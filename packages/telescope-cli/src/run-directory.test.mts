import './test-support/index.mts';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test, { mock } from 'node:test';
import { withAcquisitionDirectory, acquisitionDirectory, MAST_CACHE, mastFile, USER_ROOT, writeProductRecord, requestTransferConsent } from '@cssearth/telescope-core/node';
import { saveExploration, getSession, type SessionServices } from './session.mts';
import { loadQualifiedObservations, rememberQualification } from './qualification/qualified-observations.mts';
import { inspectFits } from './qualification/qualify-source.mts';
import { listArtifactOutputs } from './delivery/artifact-outputs.mts';
import { main, type CliServices, type CliIo } from './cli.mts';
import { parseCli } from './cli-arguments.mts';
import { assertWritableDirectory } from './run-directory.mts';
import { loadVoInputs } from './vo/bridge.mts';
import { SERVICES } from './vo/discovery.mts';
import { explorationAnswer } from './exploration.mts';
import { displayPath } from './cli-format.mts';
import type { ExplorationAnswer, ExplorationChoice } from './exploration.mts';

function capture() {
  const stdout: string[] = [], stderr: string[] = [];
  const io: CliIo = { stdinIsTTY: false, stdoutIsTTY: false, write: text => stdout.push(text), error: text => stderr.push(text), question: async () => { throw new Error('Unexpected prompt'); }, close: () => {} };
  return { io, stdout, stderr };
}
test('explore, get, outputs and every export default to cwd; one verified MAST science file and run-owned JSON', async () => {
  const work = await mkdtemp(resolve(tmpdir(), 'telescope-cwd-')), before = process.cwd(), cwd = resolve(work, 'project');
  await mkdir(cwd);
  const science = await readFile(new URL('./vo/fixtures/telescope-vo/eso-circle.fits', import.meta.url));
  const fetcher = mock.method(globalThis, 'fetch', async () => new Response(science, { headers: { 'Content-Length': String(science.length) } }));
  const initialUser = await readdir(USER_ROOT, { recursive: true });
  let downloads = 0;
  const api: SessionServices = {
    load: async () => { throw new Error('No scientific query'); },
    explore: async (_root, request): Promise<ExplorationAnswer> => {
      const products = await loadQualifiedObservations(cwd, 'betelgeuse'), product = products[0];
      const choices: ExplorationChoice[] = request.target ? [{ pick: 1, key: 'fixture', target: 'betelgeuse', telescope: 'mast', mode: 'native-image', observation: 'fixture', program: 'fixture',
        state: product ? 'ready' : 'qualify', ...(product ? { product } : { configuration: { kind: 'source-product', id: 'fixture' } as const }),
        reference: { kind: 'indexed-observation', telescope: 'mast', mode: 'native-image', observation: 'fixture', programme: 'fixture' },
        display: { instrument: 'Fixture', observationTime: { startIso: null, endIso: null }, productKind: 'image', wavelengthsMicrometres: [], advertisedKilobytes: science.length / 1000, metadataBasis: 'indexed' },
        familyEvidence: { schema: 'cssearth-observation-family-evidence@1', families: ['F01'], status: 'mapped', sourceTerm: 'image', vocabulary: 'IVOA product-type', vocabularyVersion: '1.1', owner: { kind: 'archive-adapter', id: 'fixture', evidence: 'fixture' } },
        reason: 'Fixture bytes', limitations: [] }] : [];
      return { schema: 'cssearth-telescope-exploration@1', request, ...(request.target ? { target: 'betelgeuse' } : {}),
        targetResolution: request.target ? { status: 'resolved', requested: request.target, canonical: { id: 'betelgeuse', name: 'Betelgeuse' }, matchedBy: 'name' } : { status: 'position', region: request.footprint! },
        outcome: { selection: choices.length ? 'available' : 'none', coverage: 'bounded' }, choices, unresolved: [], unsupported: [], issues: [], services: [], coverage: [] };
    },
    qualify: async () => {
      const directory = acquisitionDirectory()!;
      assert.ok(directory.startsWith(resolve(process.cwd(), 'telescope-runs') + '/') || directory.startsWith(resolve(work, 'chosen') + '/') || directory.startsWith(resolve(await realpath(work), 'chosen') + '/'));
      const path = await mastFile({ name: 'science.fits', uri: 'mast:fixture', bytes: science.length }, MAST_CACHE);
      downloads++;
      assert.equal(path, resolve(directory, 'science.fits'));
      inspectFits(await readFile(path), {}, 'image');
      const record = resolve(directory, 'qualified.product.json'), receipt = resolve(directory, 'qualification.json');
      await writeFile(receipt, '{}');
      await writeProductRecord(record, { telescope: 'mast', stage: 'fixture', inputs: [], parameters: {}, software: [] }, [{ path: 'science.fits', file: path }, { path: 'qualification.json', file: receipt }], []);
      await rememberQualification(cwd, { target: 'betelgeuse', telescope: 'mast', mode: 'native-image', observation: 'fixture', program: 'fixture', product: path, receipt, productRecord: record, outputRoot: directory,
        facts: { target: 'betelgeuse', verified: true, kind: 'image', result: 'telescope-product' } });
    },
  };
  try {
    process.chdir(cwd);
    const saved = await saveExploration(cwd, ['Betelgeuse'], undefined, api);
    assert.match(saved.directory, new RegExp(`^${process.cwd()}/telescope-runs/betelgeuse-[0-9]+-`));
    const pick = resolve(saved.directory, 'pick-1');
    await mkdir(pick); await writeFile(resolve(pick, 'science.fits'), science.subarray(0, 40));
    const result = await getSession(cwd, saved.directory, 1, () => {}, api);
    assert.equal(result.product, resolve(pick, 'science.fits'));
    assert.equal((await stat(result.product)).size, science.length);
    const delivered = await readFile(result.resultPath, 'utf8'),delivery = JSON.parse(delivered);
    for(const badRoot of ['..','/tmp']) {
      await writeFile(result.resultPath,JSON.stringify({...delivery,outputRoot:badRoot}));
      await assert.rejects(listArtifactOutputs(result.resultPath),/escapes/u);
    }
    await writeFile(result.resultPath,delivered);
    assert.equal(delivery.product, 'science.fits'); assert.equal(delivery.outputRoot, '.');
    assert.equal(delivery.files.filter((file: { path: string }) => file.path.endsWith('.fits')).length, 1);
    assert.equal((await getSession(cwd, saved.directory, 1, () => {}, api)).reused, true);
    assert.equal(downloads, 1); assert.equal(fetcher.mock.callCount(), 1);
    const outputs = capture();
    assert.equal(await main(['outputs', result.resultPath, '--json'], cwd, outputs.io.write, outputs.io), 0, outputs.stderr.join(''));
    const summary = JSON.parse(outputs.stdout.join(''));
    assert.equal(summary.savedPath, resolve(await realpath(saved.directory), 'outputs.json'));
    assert.deepEqual((await readdir(resolve(process.cwd(), 'telescope-runs'))).sort(), [saved.directory.split('/').at(-1)]);
    assert.deepEqual(JSON.parse(await readFile(summary.savedPath, 'utf8')), await withAcquisitionDirectory(dirname(summary.savedPath),()=>listArtifactOutputs(result.resultPath)));
    const repeatOutputs = capture();
    assert.equal(await main(['outputs', result.resultPath, '--json'], cwd, repeatOutputs.io.write, repeatOutputs.io), 0);
    assert.equal(JSON.parse(repeatOutputs.stdout.join('')).savedPath, summary.savedPath);
    const humanOutputs = capture();
    assert.equal(await main(['outputs', result.resultPath], cwd, humanOutputs.io.write, humanOutputs.io), 0);
    assert.ok(humanOutputs.stdout.join('').includes(`Inspection: ${displayPath(summary.savedPath)}\n`));
    const selectedInspection = resolve(saved.directory, 'inspection'); await mkdir(selectedInspection);
    const selected = capture();
    assert.equal(await main(['outputs', result.resultPath, '--out', selectedInspection, '--json'], cwd, selected.io.write, selected.io), 0, selected.stderr.join(''));
    assert.equal(JSON.parse(selected.stdout.join('')).savedPath, resolve(await realpath(selectedInspection), 'outputs.json'));
    for (const invalid of [resolve(cwd, 'new-run'), cwd]) {
      const rejected = capture();
      assert.notEqual(await main(['outputs', result.resultPath, '--out', invalid, '--json'], cwd, rejected.io.write, rejected.io), 0);
    }
    assert.deepEqual(await readdir(cwd), ['telescope-runs'], 'Inspection never creates a new run or outside folder');
    const exported = capture();
    assert.equal(await main(['export', result.resultPath, '--output', 'image', '--hdu', '0', '--json'], cwd, exported.io.write, exported.io), 0, exported.stderr.join(''));
    const output = JSON.parse(exported.stdout.join(''));
    assert.ok(output.receipt.startsWith(resolve(process.cwd(), 'telescope-runs/betelgeuse-')));
    assert.ok((await stat(output.receipt)).size > 0);
    const html=capture();assert.equal(await main(['export',output.receipt,'--output','html','--json'],cwd,html.io.write,html.io),0,html.stderr.join(''));
    const page=JSON.parse(html.stdout.join(''));assert.ok(page.receipt.startsWith(resolve(process.cwd(),'telescope-runs/betelgeuse-')));assert.match(await readFile(page.html,'utf8'),/<!doctype html>/iu);
    for (const kind of ['html', 'sphere', 'points', 'volume', 'volume-dataset-bank']) {
      const parsed = parseCli(['export', result.resultPath, '--output', kind]);
      assert.ok('directory' in parsed && parsed.directory?.startsWith(resolve(process.cwd(), 'telescope-runs') + '/'), kind);
    }
    const field = await saveExploration(cwd, ['--icrs-circle', '12.5,-4.25,0.1'], undefined, api);
    assert.match(field.directory, /\/telescope-runs\/field-12\.5--4\.25-[0-9]+-/u);
    assert.equal(displayPath(result.product), `./telescope-runs/${saved.directory.split('/').at(-1)}/pick-1/science.fits`);
    assert.deepEqual(await readdir(USER_ROOT, { recursive: true }), initialUser, 'No central science, records or run folders');
    const overridden = resolve(work, 'chosen');
    const outResult = await getSession(cwd, saved.directory, 1, () => {}, api, { out: overridden });
    assert.ok(outResult.product.startsWith((await realpath(overridden)) + '/pick-1/'));
  } finally { process.chdir(before); fetcher.mock.restore(); await rm(work, { recursive: true, force: true }); }
});
test('unwritable cwd fails with one line before explore or fetch can perform network work; --out bypasses it', async () => {
  const work = await mkdtemp(resolve(tmpdir(), 'telescope-readonly-')), before = process.cwd(), writable = resolve(work, 'chosen');
  let network = 0;
  const fetcher = mock.method(globalThis, 'fetch', async () => { network++; throw new Error('Must not reach network'); });
  const fail = async (): Promise<never> => { throw new Error('Network work started'); };
  const services: CliServices = { saveExploration: async () => { network++; return fail(); }, getSession: fail, importLocalArtifact: fail,
    listArtifactOutputs: fail, exportOutput: fail, projectOutput: fail, exportSphere: fail, exportSpatialObject: fail, executeFamilyOperation: fail, familyCoverageLedger: () => [] };
  try {
    process.chdir(work); await chmod(work, 0o555);
    const message = `Can't write here (${process.cwd()}). Run from a folder you can write to, or pass --out DIR.\n`;
    for (const args of [['explore', 'betelgeuse'], ['fetch', 'explore.json', '--pick', '1'], ['get', 'run', '--pick', '1'], ['outputs', 'result.json'], ['export', 'result.json', '--output', 'image', '--hdu', '0']]) {
      const screen = capture();
      assert.equal(await main(args, undefined, screen.io.write, screen.io, services), 1);
      assert.equal(screen.stderr.join(''), message); assert.deepEqual(screen.stdout, []);
    }
    assert.equal(network, 0);
    const explicit = await mkdtemp(resolve(tmpdir(), 'telescope-writable-'));
    try {
      await assertWritableDirectory(resolve(explicit, 'new'));
      const screen=capture();assert.equal(await main(['explore','betelgeuse','--out',resolve(explicit,'run')],undefined,screen.io.write,screen.io,services),1);
      assert.match(screen.stderr.join(''),/Network work started/u);assert.equal(network,1,'An explicit writable output reaches the archive owner');
    } finally { await rm(explicit, { recursive: true }); }
    await assert.rejects(assertWritableDirectory(writable));
  } finally { await chmod(work, 0o755); process.chdir(before); fetcher.mock.restore(); await rm(work, { recursive: true, force: true }); }
});

for (const catchesCancellation of [false, true]) test(`implicit setup refusal publishes no exploration or run (provider catches: ${catchesCancellation})`, async () => {
  const work = await mkdtemp(resolve(tmpdir(), 'explore-refusal-')), before = process.cwd();
  const stdout: string[] = [], stderr: string[] = [];
  let prompts = 0;
  const io: CliIo = { stdinIsTTY: true, stdoutIsTTY: true, write: text => stdout.push(text), error: text => stderr.push(text),
    question: async prompt => { assert.equal(prompt, 'Continue? [Y/n] '); prompts++; return 'n'; }, close: () => {} };
  const api: SessionServices = { load: async () => { throw new Error('unused'); }, qualify: async () => { throw new Error('unused'); },
    explore: async (root, request) => {
      const setup = async (): Promise<never> => {
        await requestTransferConsent({ kind: 'toolchain', name: 'astroquery', packages: ['Python', 'Astroquery'], bytes: null, destination: resolve(USER_ROOT, 'toolchains/astroquery') });
        throw new Error('Setup should have been refused');
      };
      let vo;
      if (catchesCancellation) { try { await setup(); } catch { /* Publication still owns cancellation. */ } }
      else vo = await loadVoInputs(root, request, [{ id: 'eris', name: 'Eris', aliases: [] }], undefined, setup, {}, undefined, undefined, SERVICES[0]!.service);
      return explorationAnswer(request, { ledgers: [], capabilities: [], targetCatalogue: [{ id: 'eris', name: 'Eris', aliases: [] }], targetAssociations: [], bodyMaps: [], ...(vo ? { vo } : {}) });
    } };
  const unavailable = async (): Promise<never> => { throw new Error('unused'); };
  const services: CliServices = { saveExploration: (root, args, directory, _api, progress) => saveExploration(root, args, directory, api, progress),
    getSession: unavailable, importLocalArtifact: unavailable, listArtifactOutputs: unavailable, exportOutput: unavailable, projectOutput: unavailable,
    exportSphere: unavailable, exportSpatialObject: unavailable, executeFamilyOperation: unavailable, familyCoverageLedger: () => [] };
  try {
    process.chdir(work);
    assert.equal(await main(['explore', 'eris'], work, io.write, io, services), 1);
    assert.equal(prompts, 1); assert.deepEqual(stdout, []); assert.match(stderr.join(''), /Download cancelled/u);
    assert.deepEqual(await readdir(work), [], 'Refusal must not create telescope-runs or explore.json');
  } finally { process.chdir(before); await rm(work, { recursive: true, force: true }); }
});
