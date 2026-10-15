import '../test-support/index.mts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileSize, sciencePackage, writeProductRecord } from '@cssearth/telescope-core/node';
import { exportOutput, listOutputs, type OutputRequest } from '../delivery/outputs.mts';
import { image, header } from '../previews/test-support.mts';
import { explorationServices } from './explore-services.mts';
import { cubeBand, cubePeakAperture } from './cube-output.mts';
import { FakeTerminal } from './fake-terminal.mts';
import { exploreScreen } from './explore.mts';
import { exploreChoice, exploreSession } from './fixtures/explore.mts';
import type { CliServices } from '../cli-services.mts';
import type { CliIo } from '../cli-io.mts';

test('peak selection without qualified bin edges performs no extraction', async t => {
  const extract = t.mock.fn(sciencePackage);
  const input = { file: 'cube.fits', directory: '.', files: [], producing: { parameters: {} } };
  await assert.rejects(cubePeakAperture(input, { kind: 'spectrum', available: true, reason: 'Fixture', shape: [3, 5, 5],
    spectral: { axis: 0, centersMicrometres: [3, 2, 1], source: 'synthetic tabulated centers' } }, extract), /The cube has no qualified wavelength bin edges/u);
  assert.equal(extract.mock.callCount(), 0);
});

const scienceTest = sourceTest();
scienceTest('a qualified synthetic cube makes the approved outputs with no parameter entry', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'tui-cube-')), file = resolve(root, 'cube.fits'), result = resolve(root, 'result.json');
  const values = Array.from({ length: 75 }, (_, i) => i % 25 === 13 ? 10 + Math.floor(i / 25) : i % 25 === 6 ? 1000 : 1);
  const flags = Array.from({ length: 75 }, (_, i) => i % 25 === 6 ? 1 : 0);
  const dq = image([5, 5, 3], flags, [], 16);
  const mask = Buffer.concat([header([['XTENSION', 'IMAGE'], ['BITPIX', 16], ['NAXIS', 3], ['NAXIS1', 5], ['NAXIS2', 5], ['NAXIS3', 3], ['PCOUNT', 0], ['GCOUNT', 1], ['EXTNAME', 'DQ']]), dq.subarray(2880)]);
  try {
    await writeFile(file, Buffer.concat([image([5, 5, 3], values, [['CTYPE3', 'WAVE'], ['CUNIT3', 'um'], ['CRVAL3', 3], ['CDELT3', -1], ['CRPIX3', 1], ['BUNIT', 'K']]), mask]));
    const record = resolve(root, 'input.product.json');
    await writeProductRecord(record, { telescope: 'Fixture', stage: 'fixture', inputs: [], parameters: {}, software: [] }, [{ path: 'cube.fits', file }]);
    await writeFile(result, JSON.stringify({ schema: 'cssearth-telescope-delivery@3', product: 'cube.fits', record: 'input.product.json', receipt: 'input.product.json', facts: { target: 'star', verified: true },
      context: { kind: 'exploration', target: 'star', discovery: { schema: 'cssearth-telescope-exploration@1', reference: { kind: 'indexed-observation', observation: 'one' } }, assessment: { status: 'not-requested' } },
      files: [{ path: 'cube.fits', ...await fileSize(file) }, { path: 'input.product.json', ...await fileSize(record) }] }));
    const inspected = await listOutputs(result), band = inspected.outputs.find(output => output.kind === 'band-image' && output.available)!;
    assert.ok(band); assert.ok(Math.abs(cubeBand(band)[0] - .5) < 1e-12); assert.equal(cubeBand(band)[1], 3.5);
    const { delivery } = await import('../delivery/outputs.mts');
    const retained = await delivery(result);
    const extract = t.mock.fn(sciencePackage);
    assert.deepEqual(await cubePeakAperture(retained, band, extract), [3, 2, 4, 3], 'flagged brighter pixel cannot own the aperture');
    assert.equal(extract.mock.callCount(), 1, 'peak selection extracts the full band once');
    const request = extract.mock.calls[0]!.arguments[0];
    assert.ok(request.operation === 'extract'); assert.equal(request.kind, 'band-image');
    assert.deepEqual(request.band, cubeBand(band));
    const selections: OutputRequest[] = [], made: Awaited<ReturnType<typeof exportOutput>>[] = [], terminal = new FakeTerminal(120, 40);
    const unused = async (): Promise<never> => { throw new Error('Unexpected service'); };
    const api: CliServices = { saveExploration: unused, getSession: unused, importLocalArtifact: unused, projectOutput: unused, exportSphere: unused, exportSpatialObject: unused,
      executeFamilyOperation: unused, familyCoverageLedger: () => [], listArtifactOutputs: async () => ({ artifact: 'delivery', ...inspected }),
      exportOutput: async (source, selection, destination) => { selections.push(selection); const output = await exportOutput(source, selection, destination); made.push(output); return output; } };
    const io: CliIo = { stdinIsTTY: true, stdoutIsTTY: true, stderrIsTTY: true, terminal, write: () => assert.fail('stdout screen bytes'), error: unused, question: unused, close: () => {} };
    const legacy = resolve(root, 'made', `${inspected.outputs.indexOf(band) + 1}-band-image`);
    await mkdir(legacy, { recursive: true }); await writeFile(resolve(legacy, 'figure.png'), 'old custom band');
    await writeProductRecord(resolve(legacy, 'output.product.json'), { telescope: 'Fixture', stage: 'fixture', inputs: [], parameters: { band: [1, 2] }, software: [] }, [{ path: 'figure.png', file: resolve(legacy, 'figure.png') }]);
    const services = explorationServices(root, ['star'], root, api, io, {}), menu = await services.outputs(result, 1);
    assert.equal(menu.find(output => output.name === 'Moment map')?.description, 'PNG of the summed emission');
    assert.equal(menu.find(output => output.name === 'Spectrum at peak')?.description, 'PNG and CSV through the brightest pixel');
    assert.deepEqual(menu.find(output => output.name === 'Moment map')?.parameters, []);
    assert.deepEqual(menu.find(output => output.name === 'Spectrum at peak')?.parameters, []);
    assert.equal(menu.find(output => output.name === 'Moment map')?.file, undefined, 'an old custom band is not the default moment map');
    assert.deepEqual(menu.map(output => output.name), ['Moment map', 'Spectrum at peak', 'Data']);
    assert.ok(menu.every(output => !output.parameters?.length));
    assert.equal(menu.filter(output => output.name === 'Spectrum at peak').length, 1);
    assert.ok(!menu.some(output => output.name === 'Plot' || output.name === 'feature-map'));
    const saved = { ...exploreSession(), directory: root, choices: [exploreChoice] };
    const screen = exploreScreen(undefined, { ...services, statuses: async () => new Map([[1, { state: 'done' as const, bytes: 5760, resultPath: result }]]),
      size: async () => 5760, free: async () => 1e9 }, terminal, true, saved);
    const until = async (text: string) => {
      const deadline = Date.now() + 15_000;
      while (!terminal.screen.join('\n').includes(text)) { if (Date.now() > deadline) assert.fail(`Missing screen: ${text}\n${terminal.screen.join('\n')}`); await new Promise<void>(done => setImmediate(done)); }
    };
    await until('Start (UTC)'); await terminal.press({ name: 'return' }, { name: 'return' }); await until('Moment map');
    const momentIndex = menu.findIndex(output => output.name === 'Moment map'), peakIndex = menu.findIndex(output => output.name === 'Spectrum at peak');
    for (let i = 0; i < momentIndex; i++) await terminal.press({ name: 'down' });
    await terminal.press({ name: 'return' }); await until('Moment map        PNG of the summed emission  ✓ figure.png');
    for (let i = momentIndex; i < peakIndex; i++) await terminal.press({ name: 'down' });
    await terminal.press({ name: 'return' });
    const deadline = Date.now() + 15_000;
    while (made.length < 2) { if (Date.now() > deadline) assert.fail(terminal.screen.join('\n')); await new Promise<void>(done => setImmediate(done)); }
    await until('What do you want to make?');
    assert.doesNotMatch(terminal.screen.join('\n'), /plane:|pixel:|aperture:|band:|background:|uncertainty:/u);
    await terminal.press({ text: 'q' }); assert.equal((await screen).code, 0);
    assert.deepEqual(selections, [{ kind: 'band-image', hdu: 0, band: cubeBand(band), uncertainty: 'omit' },
      { kind: 'aperture-spectrum', hdu: 0, aperture: [3, 2, 4, 3], background: 'none', uncertainty: 'omit' }]);
    for (const output of made) {
      assert.equal((await readFile(output.figure)).subarray(1, 4).toString(), 'PNG');
      assert.match(await readFile(output.values, 'utf8'), /value/u);
      assert.equal(JSON.parse(await readFile(output.receipt, 'utf8')).parameters.measurement.uncertaintyPolicy, 'omit');
    }
    const reopened = await services.outputs(result, 1);
    for (const [index, name] of ['Moment map', 'Spectrum at peak'].entries()) {
      assert.equal(await reopened.find(output => output.name === name)!.run(new Map()), made[index]!.figure);
    }
    assert.equal(selections.length, 2, 'reopening defaults reuses their verified outputs');
    const unavailable = { ...api, listArtifactOutputs: async () => ({ artifact: 'delivery', ...inspected, outputs: inspected.outputs.map(output =>
      ['band-image', 'aperture-spectrum'].includes(output.kind) ? { ...output, available: false, reason: 'Recorded unavailable reason.' } : output) }) };
    const disabled = await explorationServices(root, ['star'], root, unavailable, io, {}).outputs(result, 1);
    assert.ok(!disabled.some(output => output.name === 'Moment map'));
    assert.equal(disabled.filter(output => output.name === 'Spectrum at peak').length, 1);
    const withoutEdges = { ...api, listArtifactOutputs: async () => ({ artifact: 'delivery', ...inspected, outputs: inspected.outputs.map(output => {
      if (!output.spectral) return output;
      const { binEdgesMicrometres: _edges, ...spectral } = output.spectral;
      return { ...output, spectral, ...(['band-image', 'feature-map'].includes(output.kind) ? { available: false,
        reason: 'Qualified bin edges are required; tabulated centers alone cannot establish band integration.' } : {}) };
    }) }) };
    assert.deepEqual((await explorationServices(root, ['star'], root, withoutEdges, io, {}).outputs(result, 1)).map(output => output.name), ['Data']);
    // A single-pixel spectrum also works when the peak is on an edge.
    await writeFile(file, image([5, 5, 3], Array.from({ length: 75 }, (_, i) => i % 25 === 0 ? 100 : 1), [['CTYPE3', 'WAVE'], ['CUNIT3', 'um'], ['CRVAL3', 3], ['CDELT3', -1], ['CRPIX3', 1], ['BUNIT', 'K']]));
    assert.deepEqual(await cubePeakAperture(retained, band), [0, 0, 1, 1]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
