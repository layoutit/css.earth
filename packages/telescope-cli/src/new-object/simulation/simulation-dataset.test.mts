/** A published simulation as a dataset beside a body's default dataset (simulation-dataset.mts), offline: TRAPPIST-1e's
 * hand-made package, Zenodo's record of the ExoCAM release as served on 2026-10-03 (fixtures/telescope-simulations), and the
 * reference library's small NetCDF fixture standing in for the released file. No dataset is committed by this test. */
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { loadNetcdfLonLatField } from '@cssearth/bake/objects/raster';
import { WORKSPACE } from '@cssearth/telescope/node';
import type { Archive } from '../archives/archives.mts';
import { rebuildExistingDatasets } from '../planet-datasets.mts';
import { installSimulationDataset, parseSimulationEntries, restoreSimulationFile, roundedRange, simulationRecipe, simulationRelease, simulationSurvey } from './simulation-dataset.mts';

const id = 'trappist-1e', o = `src/objects/${id}`;
const fixture = resolve(WORKSPACE, 'packages/bake/src/objects/raster/netcdf/fixtures/field-cdf2.nc');
const served = async () => JSON.parse(await readFile(resolve(import.meta.dirname, '../../fixtures/telescope-simulations/zenodo-trappist-1e.json'), 'utf8')) as { hits: { hits: Record<string, unknown>[] } };
/** The ExoCAM record with the fixture standing in for its file: the same record, one file of the fixture's name and size. */
const record = async (change: (record: Record<string, any>) => void = () => {}) => {
  const exocam = structuredClone((await served()).hits.hits[0]!) as Record<string, any>;
  exocam.files = [{ key: 'field-cdf2.nc', size: (await stat(fixture)).size }, ...exocam.files];
  change(exocam);
  return exocam;
};
const archive = (answer: unknown, asked: string[] = []): Archive => ({
  text: async url => { asked.push(url); return JSON.stringify(answer); },
  bytes: async () => { throw new Error('Unexpected download'); }, exists: async () => false,
});
const written = { id, dataset: 'climate-model', label: 'Climate model', quantity: 'Surface temperature', record: '10.5281/zenodo.5532765', file: 'field-cdf2.nc',
  path: 'science/wolf-2022/field-cdf2.nc', variable: 'TS', coordinates: { longitude: 'lon', latitude: 'lat' }, select: { time: 1 }, units: 'K', longitudeZeroAt: 180,
  model: 'ExoCAM', credit: 'Wolf et al. (2022)', url: 'https://arxiv.org/abs/2201.09797', scenario: 'the atmosphere and ocean of the THAI "Hab 1" case, on a planet that keeps one face to its star',
  detected: false, undetected: 'an atmosphere', others: { text: 'Three other models of the same case differ from it.', url: 'https://arxiv.org/abs/2109.11459' } };
const entryOf = (change: Record<string, unknown> = {}) => parseSimulationEntries([{ ...written, ...change }]).get(id)![0]!;
const PACKAGE = ['object.json', 'text.json', 'source/preparation/raster.json', 'source/preparation/geometry.json', 'source/preparation/acquisition.json', 'source/content/object.json', 'source/manifest.json'];

test('an entry says everything a person settles by reading the paper, and nothing is defaulted', () => {
  const entry = entryOf();
  assert.deepEqual(simulationRecipe(entry), { format: 'netcdf-lonlat-field', path: 'science/wolf-2022/field-cdf2.nc', variable: 'TS', coordinates: { longitude: 'lon', latitude: 'lat' },
    select: { time: 1 }, sourceUnits: 'K', longitudeZeroAt: 180, coordinateToleranceDegrees: 0.005 });
  const refused = (change: Record<string, unknown>, message: RegExp) => assert.throws(() => entryOf(change), message);
  refused({ scenario: undefined }, /trappist-1e\.simulations\[0\]\.scenario/u);
  refused({ scenario: 'an Earth-like atmosphere.' }, /scenario is the rest of the sentence "The run assumes \.\.\."; leave out its final period/u);
  refused({ detected: undefined }, /detected must say, true or false, whether what the scenario assumes has been detected/u);
  refused({ undetected: undefined }, /undetected must name what nobody has detected/u);
  refused({ detected: true }, /nothing is undetected when detected is true/u);
  refused({ record: 'https://zenodo.org/records/5532765' }, /a release is named by its Zenodo DOI/u);
  refused({ path: 'field.nc' }, /a released field lives at science\/<paper>\/<name>\.nc/u);
  refused({ select: { time: 1.5 } }, /select\.time must be a whole index counted from 0/u);
  refused({ range: [300, 200] }, /range is \[minimum, maximum\], the first below the second/u);
  refused({ others: { text: 'They differ', url: 'https://arxiv.org/abs/2109.11459' } }, /others\.text is a whole sentence/u);
  refused({ hottest: 180 }, /unknown fields hottest/u);
  assert.deepEqual(roundedRange(204.55, 295.21), [200, 300]);
  assert.deepEqual(roundedRange(0.012, 0.31), [0, 0.4]);
  assert.throws(() => roundedRange(5, 5), /one value, 5, has no range/u);
});

test('the release is checked on Zenodo: a license that allows reuse, a record that names the object, and the file', async () => {
  const entry = entryOf(), asked: string[] = [], names = ['TRAPPIST-1e'];
  const release = await simulationRelease(archive(await record(), asked), id, names, entry);
  assert.deepEqual(asked, ['https://zenodo.org/api/records/5532765']);
  assert.deepEqual(release, { doi: '10.5281/zenodo.5532765', recordUrl: 'https://zenodo.org/records/5532765', title: 'ExoCAM: A 3D Climate Model for Exoplanet Atmospheres :: Model data and supplementary figures and analysis',
    license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }, fileUrl: 'https://zenodo.org/records/5532765/files/field-cdf2.nc?download=1', bytes: 2424 });
  const refused = async (change: (record: Record<string, any>) => void, message: RegExp, who = names) => assert.rejects(async () => simulationRelease(archive(await record(change)), id, who, entry), message);
  await refused(exocam => { delete exocam.metadata.license; }, /trappist-1e, dataset climate-model: Zenodo record 10\.5281\/zenodo\.5532765 states no license; a simulation is shown only under a license known to allow reuse \(field record\)/u);
  await refused(exocam => { exocam.metadata.license = { id: 'cc-by-nc-nd-4.0' }; }, /states the license cc-by-nc-nd-4\.0/u);
  await refused(() => {}, /does not name Kepler-186 f in its title or description; a model of a class of objects is not a model of this one \(field record\)/u, ['Kepler-186 f']);
  await refused(exocam => { exocam.files = exocam.files.slice(1); }, /lists no file field-cdf2\.nc \(field file\); it lists ExoCAM_thai_hab1_L51_n68equiv\.cam\.h0\.avg\.nc, /u);
});

test('the dataset is added beside the default one, labelled as a model with its scenario, and its range is the file\'s', async () => {
  const files = new Map<string, string | Buffer>(await Promise.all(PACKAGE.map(async path => [`${o}/${path}`, await readFile(resolve(WORKSPACE, o, path), 'utf8')] as const)));
  const before = (path: string) => JSON.parse(String(files.get(`${o}/${path}`))) as Record<string, any>, defaultDataset = before('source/content/object.json').datasets.defaultDataset;
  const entry = entryOf(), release = await simulationRelease(archive(await record()), id, ['TRAPPIST-1e'], entry);
  const field = await loadNetcdfLonLatField(dirname(fixture), { ...simulationRecipe(entry), path: 'field-cdf2.nc' });
  assert.deepEqual(installSimulationDataset(files, id, 'TRAPPIST-1e', entry, release, field.report), { minimum: 300, maximum: 340 });
  const after = (path: string) => JSON.parse(String(files.get(`${o}/${path}`))) as Record<string, any>;
  const surface = after('source/preparation/raster.json').surfaces.at(-1);
  assert.deepEqual([surface.id, surface.source, surface.falseColor, surface.science.format, surface.science.variable, surface.science.select, surface.science.longitudeZeroAt],
    ['climate-model', 'science/wolf-2022/field-cdf2.nc', true, 'netcdf-lonlat-field', 'TS', { time: 1 }, 180]);
  assert.deepEqual([surface.science.minimum, surface.science.maximum, surface.science.labels, surface.science.units, surface.science.displaySampling], [300, 340, ['300', '320', '340'], 'K', 'nearest']);
  assert.equal(after('object.json').properties.recipe.surfaces[0].datasets.at(-1).id, 'climate-model');
  const content = after('source/content/object.json'), control = content.datasets.controls.at(-1);
  assert.equal(content.datasets.defaultDataset, defaultDataset, 'the default dataset stays the default');
  assert.equal(control.qualification, 'Simulation · ExoCAM · Wolf et al. (2022) · False color');
  assert.deepEqual([control.legend.title, control.legend.meta, control.legend.labels, control.noData], ['Surface temperature', 'K', ['300', '320', '340'], true]);
  assert.equal(control.notes, 'Surface temperature of TRAPPIST-1e in the ExoCAM simulation of Wolf et al. (2022): a model, not a measurement. The run assumes the atmosphere and ocean of the THAI "Hab 1" case, on a planet that keeps one face to its star. ' +
    'Nobody has detected an atmosphere on TRAPPIST-1e. Three other models of the same case differ from it. Gray caps: no released grid samples beyond 67.5° north or south. ' +
    'The false color runs from 300 to 340 K; it is not what an eye would see. With shadows on, the star\'s light darkens the night half.');
  assert.deepEqual(after('text.json').datasets['climate-model'], { title: 'ExoCAM simulation', detail: 'Published simulation',
    summary: 'Surface temperature in a published model, in false color. It shows one scenario, not a measurement. Gray caps lack released samples.' });
  const input = after('source/manifest.json').inputs.at(-1);
  assert.deepEqual([input.id, input.path, input.origin, input.productId, input.version, input.license, input.licenseEvidence, input.consumers],
    ['trappist-1e-climate-model-simulation', 'science/wolf-2022/field-cdf2.nc', 'https://zenodo.org/records/5532765/files/field-cdf2.nc?download=1', 'field-cdf2.nc', '10.5281/zenodo.5532765', 'CC BY 4.0',
      ['https://zenodo.org/records/5532765', 'https://creativecommons.org/licenses/by/4.0/'], ['climate-model-simulation']]);
  assert.deepEqual(after('source/preparation/acquisition.json').operations.at(-1), { kind: 'download', groups: ['restore', 'refresh'], path: 'science/wolf-2022/field-cdf2.nc', url: 'https://zenodo.org/records/5532765/files/field-cdf2.nc?download=1' });
  // Installed again, it replaces itself. A range the entry gives must hold the file's values.
  const count = after('source/preparation/raster.json').surfaces.length;
  installSimulationDataset(files, id, 'TRAPPIST-1e', entry, release, field.report);
  assert.equal(after('source/preparation/raster.json').surfaces.length, count);
  assert.equal(after('source/manifest.json').inputs.filter((existing: { id: string }) => existing.id === input.id).length, 1);
  assert.throws(() => installSimulationDataset(files, id, 'TRAPPIST-1e', entryOf({ range: [310, 400] }), release, field.report),
    /trappist-1e, dataset climate-model: TS in field-cdf2\.nc runs from 300 to 337 K, outside the range 310 to 400 the entry gives \(field range\)/u);
  assert.deepEqual(installSimulationDataset(files, id, 'TRAPPIST-1e', entryOf({ range: [180, 340] }), release, field.report), { minimum: 180, maximum: 340 });
});

test('the released file is streamed into the source directory once and held to the size Zenodo lists', async () => {
  const sourceRoot = await mkdtemp(resolve(tmpdir(), 'simulation-file-')), bytes = await readFile(fixture), entry = entryOf();
  try {
    const release = await simulationRelease(archive(await record()), id, ['TRAPPIST-1e'], entry);
    const answering = (body: Buffer, status = 200) => (async () => new Response(new Uint8Array(body), { status })) as typeof fetch;
    await assert.rejects(restoreSimulationFile(sourceRoot, id, entry, release, answering(Buffer.alloc(0), 404)), /trappist-1e, dataset climate-model: Zenodo returned HTTP 404 for https:\/\/zenodo\.org\/records\/5532765\/files\/field-cdf2\.nc/u);
    await assert.rejects(restoreSimulationFile(sourceRoot, id, entry, release, answering(Buffer.concat([bytes, bytes]))), /size drifted/u);
    assert.equal(await restoreSimulationFile(sourceRoot, id, entry, release, answering(bytes)), 'downloaded');
    assert.deepEqual(await readFile(resolve(sourceRoot, entry.path)), bytes);
    assert.equal(await restoreSimulationFile(sourceRoot, id, entry, release, answering(Buffer.alloc(0), 500)), 'present', 'a file already there at the listed size is not asked for again');
    await writeFile(resolve(sourceRoot, entry.path), bytes.subarray(0, 100));
    await assert.rejects(restoreSimulationFile(sourceRoot, id, entry, release, answering(bytes)), /has 100 bytes and Zenodo lists 2424 for field-cdf2\.nc; remove it to download the release again/u);
  } finally { await rm(sourceRoot, { recursive: true, force: true }); }
});

test('new-object --simulation writes the package of a body already in the tree, and refuses what the file does not hold', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'simulation-tree-'));
  try {
    for (const path of PACKAGE) await cp(resolve(WORKSPACE, o, path), resolve(root, o, path), { recursive: true });
    await cp(resolve(WORKSPACE, 'packages/astronomy/data/bodies', `${id}.json`), resolve(root, 'packages/astronomy/data/bodies', `${id}.json`));
    await mkdir(resolve(root, o, 'source/science/wolf-2022'), { recursive: true });
    await cp(fixture, resolve(root, o, 'source/science/wolf-2022/field-cdf2.nc'));
    const lines = await rebuildExistingDatasets(root, [id], 'simulation', archive(await record()), () => {}, new Map(), new Map(), parseSimulationEntries([written]));
    assert.deepEqual(lines, ['trappist-1e: climate-model dataset from the ExoCAM simulation of Wolf et al. (2022), 300-340 K, CC BY 4.0']);
    const raster = JSON.parse(await readFile(resolve(root, o, 'source/preparation/raster.json'), 'utf8')) as { surfaces: { id: string }[] };
    assert.equal(raster.surfaces.at(-1)!.id, 'climate-model');
    // The entry is checked against the file before anything is written: wrong units, a missing variable, an unstated time.
    const again = (change: Record<string, unknown>) => rebuildExistingDatasets(root, [id], 'simulation', archive(null), () => {}, new Map(), new Map(), parseSimulationEntries([{ ...written, dataset: 'second', ...change }]));
    const refusing = async (change: Record<string, unknown>, message: RegExp) => assert.rejects(async () => rebuildExistingDatasets(root, [id], 'simulation', archive(await record()), () => {}, new Map(), new Map(), parseSimulationEntries([{ ...written, dataset: 'second', ...change }])), message);
    await refusing({ units: 'degC' }, /science\/wolf-2022\/field-cdf2\.nc, sourceUnits is "degC", and the file gives TS the units "K"/u);
    await refusing({ variable: 'TSKIN' }, /science\/wolf-2022\/field-cdf2\.nc has no variable TSKIN/u);
    await refusing({ select: {} }, /select gives no index along time/u);
    await assert.rejects(again({}), /Zenodo record 5532765/u, 'an answer that is no record is refused');
    assert.equal((JSON.parse(await readFile(resolve(root, o, 'source/preparation/raster.json'), 'utf8')) as { surfaces: unknown[] }).surfaces.length, raster.surfaces.length, 'a refused entry writes nothing');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a draft run asks Zenodo once for all its planets, paces its requests and says so when it cannot ask', async () => {
  const asked: string[] = [], waits: number[] = [], body = await served();
  const survey = await simulationSurvey(archive(body, asked), ['TRAPPIST-1 e', 'TRAPPIST-1 f', 'TRAPPIST-1 e'], async ms => { waits.push(ms); });
  assert.equal(asked.length, 1);
  assert.match(asked[0]!, /q=%22TRAPPIST-1e%22\+OR\+%22TRAPPIST-1\+e%22\+OR\+%22TRAPPIST-1f%22\+OR\+%22TRAPPIST-1\+f%22&type=dataset&size=25&sort=bestmatch&page=1$/u);
  assert.equal(survey.note(['TRAPPIST-1 e', 'TRAPPIST-1 f']), '; published simulations on Zenodo, to read before any is shown: TRAPPIST-1 e 10.5281/zenodo.5532765, 10.5281/zenodo.7752337, 10.5281/zenodo.10209661');
  assert.equal(survey.note(['TRAPPIST-1 f']), '');
  assert.equal(survey.failure, undefined);
  // Forty names go in one request; a full page asks for the next, 2.1 seconds later.
  const many = Array.from({ length: 41 }, (_, index) => `Planet-${index + 1} b`), full = { hits: { hits: Array.from({ length: 25 }, () => body.hits.hits[3]!) } };
  let calls = 0;
  const paged: Archive = { ...archive(null), text: async () => JSON.stringify(calls++ === 0 ? full : { hits: { hits: [] } }) };
  assert.equal((await simulationSurvey(paged, many, async ms => { waits.push(ms); })).requests, 3);
  assert.deepEqual(waits, [2100, 2100]);
  const failing: Archive = { ...archive(null), text: async () => { throw new Error('HTTP 429 from https://zenodo.org/api/records'); } };
  const failed = await simulationSurvey(failing, ['TRAPPIST-1 e']);
  assert.equal(failed.failure, 'Zenodo could not be asked for published simulations of every planet (HTTP 429 from https://zenodo.org/api/records); ask with telescope simulations OBJECT.');
  assert.equal(failed.note(['TRAPPIST-1 e']), '');
});
