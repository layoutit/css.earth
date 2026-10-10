/** A published simulation as a dataset of a planet still shown as a neutral shape (simulation-dataset.mts), offline: TRAPPIST-1f's
 * package, Zenodo's record of the ExoCAM release as served on 2026-10-03 (fixtures/telescope-simulations), and the
 * reference library's small NetCDF fixture standing in for the released file, served by range as Zenodo serves one. No dataset
 * is committed by this test. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { loadNetcdfLonLatField } from '@cssearth/bake/objects/raster';
import { WORKSPACE } from '@cssearth/telescope/node';
import type { Archive } from '../archives/archives.mts';
import { rebuildExistingDatasets } from '../planets/planet-datasets.mts';
import { installSimulationDataset, memberFormat, parseSimulationEntries, restoreSimulationField, restoreSimulationMember, roundedRange, simulationPaths, simulationRecipe, simulationRelease, simulationSurvey, surveyQuestions } from './simulation-dataset.mts';

const id = 'trappist-1f', o = `src/objects/${id}`;
const fixture = resolve(WORKSPACE, 'packages/bake/src/objects/raster/netcdf/fixtures/field-cdf2.nc');
const served = async () => JSON.parse(await readFile(resolve(import.meta.dirname, '../../fixtures/telescope-simulations/zenodo-trappist-1e.json'), 'utf8')) as { hits: { hits: Record<string, unknown>[] } };
/** The ExoCAM record with the fixture standing in for its file: the same record, one file of the fixture's name and size. */
const record = async (change: (record: Record<string, any>) => void = () => {}) => {
  const exocam = structuredClone((await served()).hits.hits[0]!) as Record<string, any>;
  // The stand-in names the test's planet, as a release must name the body it is shown on.
  exocam.metadata.description += ' TRAPPIST-1f';
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
  time: 'the mean state the release holds', detected: false, undetected: 'an atmosphere', observed: { text: 'JWST has neither shown nor excluded one (Glidden et al. 2025).', url: 'https://arxiv.org/abs/2509.05407' }, others: { text: 'Three other models of the same case differ from it.', url: 'https://arxiv.org/abs/2109.11459' } };
const entryOf = (change: Record<string, unknown> = {}) => parseSimulationEntries([{ ...written, ...change }]).get(id)![0]!;
/** Zenodo answering range requests for the released file, counting them; `status` and `body` stand in for a server that fails. */
const serving = (body: Buffer, asked: string[] = [], status?: number) => (async (_url: unknown, init?: RequestInit) => {
  const range = /^bytes=(\d+)-(\d+)$/u.exec(new Headers(init?.headers).get('range') ?? '');
  assert.ok(range, 'the release is only ever asked for by range');
  asked.push(range[0]);
  const from = Number(range[1]), to = Math.min(Number(range[2]), body.length - 1);
  return new Response(new Uint8Array(body.subarray(from, to + 1)), { status: status ?? 206, headers: { 'content-range': `bytes ${from}-${to}/${body.length}` } });
}) as typeof fetch;
/** The fixture's two kept parts: everything up to the end of its coordinate variables, and TS at time 1. */
const HEAD = { offset: 0, length: 1212 }, FIELD = { offset: 2040, length: 128 }, RANGES = { head: HEAD, field: FIELD };
const PACKAGE = ['object.json', 'text.json', 'source/preparation/raster.json', 'source/preparation/geometry.json', 'source/preparation/acquisition.json', 'source/content/object.json', 'source/manifest.json'];

test('an entry says everything a person settles by reading the paper, and nothing is defaulted', () => {
  const entry = entryOf();
  assert.deepEqual(simulationPaths(entry), { head: 'science/wolf-2022/field-cdf2.head.dat', field: 'science/wolf-2022/field-cdf2.TS-time1.dat' });
  assert.deepEqual(simulationRecipe(entry), { format: 'netcdf-lonlat-field', path: 'science/wolf-2022/field-cdf2.head.dat', field: 'science/wolf-2022/field-cdf2.TS-time1.dat', variable: 'TS',
    coordinates: { longitude: 'lon', latitude: 'lat' }, select: { time: 1 }, sourceUnits: 'K', longitudeZeroAt: 180, coordinateToleranceDegrees: 0.005 });
  assert.equal(simulationPaths(entryOf({ variable: 'T', select: { time: 0, lev: 1 } })).field, 'science/wolf-2022/field-cdf2.T-time0-lev1.dat');
  const refused = (change: Record<string, unknown>, message: RegExp) => assert.throws(() => entryOf(change), message);
  refused({ scenario: undefined }, /trappist-1f\.simulations\[0\]\.scenario/u);
  refused({ scenario: 'an Earth-like atmosphere.' }, /scenario is the rest of the sentence "The run assumes \.\.\."; leave out its final period/u);
  refused({ time: undefined }, /trappist-1f\.simulations\[0\]\.time/u);
  refused({ time: 'one instant.' }, /time is the rest of the sentence "The map is \.\.\."; leave out its final period/u);
  refused({ variable: 'T S' }, /variable T S: a NetCDF name of letters, digits and underscores/u);
  refused({ observed: { text: 'Nothing is seen', url: 'https://arxiv.org/abs/2509.05407' } }, /observed\.text is a whole sentence/u);
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
  const entry = entryOf(), asked: string[] = [], names = ['TRAPPIST-1f'];
  const release = await simulationRelease(archive(await record(), asked), id, names, entry);
  assert.deepEqual(asked, ['https://zenodo.org/api/records/5532765']);
  assert.deepEqual(release, { doi: '10.5281/zenodo.5532765', recordUrl: 'https://zenodo.org/records/5532765', title: 'ExoCAM: A 3D Climate Model for Exoplanet Atmospheres :: Model data and supplementary figures and analysis',
    license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }, fileUrl: 'https://zenodo.org/records/5532765/files/field-cdf2.nc?download=1', bytes: 2424 });
  const refused = async (change: (record: Record<string, any>) => void, message: RegExp, who = names) => assert.rejects(async () => simulationRelease(archive(await record(change)), id, who, entry), message);
  await refused(exocam => { delete exocam.metadata.license; }, /trappist-1f, dataset climate-model: Zenodo record 10\.5281\/zenodo\.5532765 states no license; a simulation is shown only under a license known to allow reuse \(field record\)/u);
  await refused(exocam => { exocam.metadata.license = { id: 'cc-by-nc-nd-4.0' }; }, /states the license cc-by-nc-nd-4\.0/u);
  await refused(() => {}, /does not name Kepler-186 f in its title or description; a model of a class of objects is not a model of this one \(field record\)/u, ['Kepler-186 f']);
  await refused(exocam => { exocam.files = exocam.files.slice(1); }, /lists no file field-cdf2\.nc \(field file\); it lists ExoCAM_thai_hab1_L51_n68equiv\.cam\.h0\.avg\.nc, /u);
});

test('the dataset is labelled as a model with its scenario, its range is the file\'s, and it takes the default from a neutral shape only', async () => {
  const files = new Map<string, string | Buffer>(await Promise.all(PACKAGE.map(async path => [`${o}/${path}`, await readFile(resolve(WORKSPACE, o, path), 'utf8')] as const)));
  const before = (path: string) => JSON.parse(String(files.get(`${o}/${path}`))) as Record<string, any>, defaultDataset = before('source/content/object.json').datasets.defaultDataset;
  const entry = entryOf(), release = await simulationRelease(archive(await record()), id, ['TRAPPIST-1f'], entry);
  const { field: _kept, ...whole } = simulationRecipe(entry), field = await loadNetcdfLonLatField(resolve(fixture, '..'), { ...whole, path: 'field-cdf2.nc' });
  assert.equal(defaultDataset, 'shape', 'TRAPPIST-1f opens on its neutral shape');
  assert.deepEqual(installSimulationDataset(files, id, 'TRAPPIST-1f', entry, release, field.report, RANGES), { minimum: 300, maximum: 340, promoted: true });
  const after = (path: string) => JSON.parse(String(files.get(`${o}/${path}`))) as Record<string, any>;
  const surface = after('source/preparation/raster.json').surfaces.at(-1);
  assert.deepEqual([surface.id, surface.source, surface.falseColor, surface.science.format, surface.science.variable, surface.science.select, surface.science.longitudeZeroAt],
    ['climate-model', 'science/wolf-2022/field-cdf2.head.dat', true, 'netcdf-lonlat-field', 'TS', { time: 1 }, 180]);
  assert.deepEqual([surface.science.path, surface.science.field], ['science/wolf-2022/field-cdf2.head.dat', 'science/wolf-2022/field-cdf2.TS-time1.dat']);
  assert.deepEqual([surface.science.minimum, surface.science.maximum, surface.science.labels, surface.science.units, surface.science.displaySampling], [300, 340, ['300', '320', '340'], 'K', 'nearest']);
  assert.equal(after('object.json').properties.recipe.surfaces[0].datasets.at(-1).id, 'climate-model');
  const content = after('source/content/object.json'), control = content.datasets.controls.at(-1);
  assert.equal(content.datasets.defaultDataset, 'climate-model', 'a simulation is a better dataset than a gray sphere: the page opens on it');
  assert.equal(control.qualification, 'Simulation · ExoCAM · Wolf et al. (2022) · False color');
  assert.deepEqual([control.legend.title, control.legend.meta, control.legend.labels, control.noData], ['Surface temperature', 'K', ['300', '320', '340'], true]);
  assert.equal(control.notes, 'Surface temperature of TRAPPIST-1f in the ExoCAM simulation of Wolf et al. (2022): a model, not a measurement. The run assumes the atmosphere and ocean of the THAI "Hab 1" case, on a planet that keeps one face to its star. ' +
    'The map is the mean state the release holds. Nobody has detected an atmosphere on TRAPPIST-1f. JWST has neither shown nor excluded one (Glidden et al. 2025). Three other models of the same case differ from it. Gray caps: no released grid samples beyond 67.5° north or south. ' +
    'The false color runs from 300 to 340 K; it is not what an eye would see. With shadows on, the star\'s light darkens the night half.');
  assert.deepEqual(after('text.json').datasets['climate-model'], { title: 'ExoCAM simulation', detail: 'Published simulation',
    summary: 'Surface temperature in a published model, in false color. One scenario, not a measurement; gray caps lack samples.' });
  // The two kept parts are declared with their ranges, exact bytes of the release, and restored by range.
  const [input, grid] = after('source/manifest.json').inputs.slice(-2), url = 'https://zenodo.org/records/5532765/files/field-cdf2.nc?download=1';
  assert.deepEqual([input.id, input.path, input.range, input.origin, input.productId, input.version, input.license, input.licenseEvidence, input.consumers],
    ['trappist-1f-climate-model-simulation', 'science/wolf-2022/field-cdf2.TS-time1.dat', FIELD, url, 'field-cdf2.nc', '10.5281/zenodo.5532765', 'CC BY 4.0',
      ['https://zenodo.org/records/5532765', 'https://creativecommons.org/licenses/by/4.0/'], ['climate-model-simulation']]);
  assert.equal(input.acquisition, 'One range request to Zenodo record 10.5281/zenodo.5532765: the bytes of TS at time index 1 in field-cdf2.nc, where the file\'s header puts them. The 2.4 kB file is never fetched whole. A model output, not an observation.');
  assert.deepEqual([grid.id, grid.path, grid.range, grid.origin, grid.consumers], ['trappist-1f-climate-model-simulation-grid', 'science/wolf-2022/field-cdf2.head.dat', HEAD, url, ['climate-model-simulation']]);
  assert.equal(grid.acquisition, 'One range request to Zenodo record 10.5281/zenodo.5532765: the first 1,212 bytes of field-cdf2.nc, its header and its coordinate variables.');
  assert.deepEqual(after('source/preparation/acquisition.json').operations.slice(-2), [{ kind: 'download', groups: ['restore', 'refresh'], path: 'science/wolf-2022/field-cdf2.TS-time1.dat', url },
    { kind: 'download', groups: ['restore', 'refresh'], path: 'science/wolf-2022/field-cdf2.head.dat', url }]);
  // Installed again, it replaces itself. A range the entry gives must hold the file's values.
  const count = after('source/preparation/raster.json').surfaces.length;
  installSimulationDataset(files, id, 'TRAPPIST-1f', entry, release, field.report, RANGES);
  assert.equal(after('source/preparation/raster.json').surfaces.length, count);
  assert.equal(after('source/manifest.json').inputs.filter((existing: { id: string }) => existing.id === input.id).length, 1);
  assert.throws(() => installSimulationDataset(files, id, 'TRAPPIST-1f', entryOf({ range: [310, 400] }), release, field.report, RANGES),
    /trappist-1f, dataset climate-model: TS in field-cdf2\.nc runs from 300 to 337 K, outside the range 310 to 400 the entry gives \(field range\)/u);
  assert.deepEqual(installSimulationDataset(files, id, 'TRAPPIST-1f', entryOf({ range: [180, 340] }), release, field.report, RANGES), { minimum: 180, maximum: 340, promoted: false });
  // A second field of the same file shares the file's one header record and is named among its consumers.
  const second = { dataset: 'cloud-model', label: 'Model clouds', select: { time: 0 } }, elsewhere = { file: 'other.nc', path: 'science/wolf-2022/other.nc' };
  const consumers = (path: string) => (after('source/manifest.json').inputs as { id: string; path: string; consumers: string[] }[]).filter(existing => existing.path === path).map(existing => [existing.id, existing.consumers]);
  const steps = (path: string) => after('source/preparation/acquisition.json').operations.filter((step: { path: string }) => step.path === path).length;
  assert.throws(() => installSimulationDataset(files, id, 'TRAPPIST-1f', entryOf({ dataset: 'cloud-model', label: 'Model clouds' }), release, field.report, RANGES),
    /dataset cloud-model: trappist-1f-climate-model-simulation already draws science\/wolf-2022\/field-cdf2\.TS-time1\.dat; one field is one dataset/u);
  installSimulationDataset(files, id, 'TRAPPIST-1f', entryOf(second), release, field.report, RANGES);
  assert.deepEqual(consumers(grid.path), [[grid.id, ['climate-model-simulation', 'cloud-model-simulation']]]);
  assert.equal(steps(grid.path), 1);
  // Installed again, the first keeps the others among the header's consumers.
  installSimulationDataset(files, id, 'TRAPPIST-1f', entryOf({ range: [180, 340] }), release, field.report, RANGES);
  assert.deepEqual(consumers(grid.path), [[grid.id, ['climate-model-simulation', 'cloud-model-simulation']]]);
  // The header is declared under the first dataset's name: that one cannot move to another file while a second reads it.
  assert.throws(() => installSimulationDataset(files, id, 'TRAPPIST-1f', entryOf(elsewhere), release, field.report, RANGES),
    /dataset climate-model: science\/wolf-2022\/field-cdf2\.head\.dat is declared under this dataset's name and cloud-model-simulation still reads it, so this dataset cannot move to another file/u);
  // The second may: it leaves the old header's consumers, and takes its own header and steps along.
  installSimulationDataset(files, id, 'TRAPPIST-1f', entryOf({ ...second, ...elsewhere }), release, field.report, RANGES);
  assert.deepEqual(consumers(grid.path), [[grid.id, ['climate-model-simulation']]]);
  assert.deepEqual(consumers('science/wolf-2022/other.head.dat'), [['trappist-1f-cloud-model-simulation-grid', ['cloud-model-simulation']]]);
  assert.deepEqual([steps('science/wolf-2022/field-cdf2.TS-time0.dat'), steps('science/wolf-2022/other.TS-time0.dat'), steps('science/wolf-2022/other.head.dat')], [0, 1, 1]);
  // Alone on its file again, the first moves with its records: none of the old file stays, and no id is written twice.
  installSimulationDataset(files, id, 'TRAPPIST-1f', entryOf({ ...elsewhere, file: 'third.nc', path: 'science/wolf-2022/third.nc' }), release, field.report, RANGES);
  assert.deepEqual([consumers(grid.path), steps(grid.path), steps(input.path)], [[], 0, 0]);
  const ids = (after('source/manifest.json').inputs as { id: string }[]).map(existing => existing.id);
  assert.equal(new Set(ids).size, ids.length);
  installSimulationDataset(files, id, 'TRAPPIST-1f', entryOf({ range: [180, 340] }), release, field.report, RANGES);
  // A planet that opens on a measured map keeps it: the simulation is added beside it.
  const measured = 'hd-189733b', m = `src/objects/${measured}`;
  const mapped = new Map<string, string | Buffer>(await Promise.all(PACKAGE.map(async path => [`${m}/${path}`, await readFile(resolve(WORKSPACE, m, path), 'utf8')] as const)));
  const opensOn = () => (JSON.parse(String(mapped.get(`${m}/source/content/object.json`))) as { datasets: { defaultDataset: string } }).datasets.defaultDataset;
  const measuredDefault = opensOn();
  assert.equal(installSimulationDataset(mapped, measured, 'HD 189733 b', entry, release, field.report, RANGES).promoted, false);
  assert.equal(opensOn(), measuredDefault, 'a measured map outranks a simulation');
});

test('two range requests bring the header with the coordinates and the selected grid, and the release is never fetched whole', async () => {
  const sourceRoot = await mkdtemp(resolve(tmpdir(), 'simulation-file-')), bytes = await readFile(fixture), entry = entryOf(), paths = simulationPaths(entry);
  try {
    const release = await simulationRelease(archive(await record()), id, ['TRAPPIST-1f'], entry), asked: string[] = [];
    assert.deepEqual(await restoreSimulationField(sourceRoot, id, entry, release, serving(bytes, asked)), { ...RANGES, fetched: 1340 });
    // The header first, since it says where the parts lie; then each part, to the byte.
    assert.deepEqual(asked, ['bytes=0-2423', 'bytes=0-1211', 'bytes=2040-2167']);
    assert.deepEqual(await readFile(resolve(sourceRoot, paths.head)), bytes.subarray(0, 1212));
    assert.deepEqual(await readFile(resolve(sourceRoot, paths.field)), bytes.subarray(2040, 2168));
    const map = await loadNetcdfLonLatField(sourceRoot, simulationRecipe(entry), new Map([[paths.head, HEAD], [paths.field, FIELD]]));
    assert.equal(map.sample(0, -67.5), 304, 'TS at time 1, with the star overhead at the grid\'s 180 degrees');
    assert.equal((await restoreSimulationField(sourceRoot, id, entry, release, serving(bytes))).fetched, 0, 'parts already there at their length are not asked for again');
    await writeFile(resolve(sourceRoot, paths.field), bytes.subarray(0, 100));
    await assert.rejects(restoreSimulationField(sourceRoot, id, entry, release, serving(bytes)), /field-cdf2\.TS-time1\.dat has 100 bytes and the release puts 128 there; remove it to fetch the range again/u);
    const refused = (change: Record<string, unknown>, message: RegExp, server = serving(bytes)) => assert.rejects(restoreSimulationField(sourceRoot, id, entryOf(change), release, server), message);
    await refused({}, /trappist-1f, dataset climate-model: field-cdf2\.nc: Zenodo returned HTTP 404 for bytes 0 to 2423 of https:\/\/zenodo\.org\/records\/5532765\/files\/field-cdf2\.nc/u, serving(bytes, [], 404));
    // A server that ignores the range and sends the whole file is refused before a byte is kept.
    await refused({}, /answered 200 instead of 206 Partial Content/u, (async () => new Response(new Uint8Array(bytes), { status: 200 })) as typeof fetch);
    await refused({ variable: 'TSKIN' }, /field-cdf2\.nc has no variable TSKIN \(field variable\); it has lat, lon, /u);
    await refused({ select: {} }, /select gives no index along time; TS varies along time, lat, lon \(field select\)/u);
    await refused({ select: { time: 2 } }, /select\.time is 2; time has 2 entries, counted from 0 \(field select\)/u);
    await refused({ coordinates: { longitude: 'lon', latitude: 'time' } }, /the latitude variable time is stored in records, not among the file's first bytes \(field coordinates\.latitude\)/u);
    await refused({ variable: 'TSD', select: {} }, /TSD varies along latd, lon; its grid is kept as one run of bytes, which needs its longitude and latitude last \(field variable\)/u);
  } finally { await rm(sourceRoot, { recursive: true, force: true }); }
});

test('a NetCDF-4 model file inside a ZIP release is kept whole, and its field can be read at one pressure', async () => {
  // The reference library's NetCDF-4 fixture stands in for the model file, zipped as a release zips one.
  const netcdf4 = resolve(fixture, '../field-nc4.nc'), member = { file: 'release.zip', member: 'run/field-nc4.nc', path: 'science/wolf-2022/field-nc4.nc', variable: 'T', select: { time: 0 },
    isobar: { along: 'lev', pressure: 'P', pressureUnits: 'Pa', at: 150 }, quantity: 'Temperature at 1.5 millibar' };
  const entry = entryOf(member);
  assert.deepEqual(simulationRecipe(entry), { format: 'netcdf-lonlat-field', path: 'science/wolf-2022/field-nc4.nc', variable: 'T', coordinates: { longitude: 'lon', latitude: 'lat' }, select: { time: 0 },
    isobar: { along: 'lev', pressure: 'P', pressureUnits: 'Pa', at: 150 }, sourceUnits: 'K', longitudeZeroAt: 180, coordinateToleranceDegrees: 0.005 });
  assert.throws(() => entryOf({ ...member, file: 'field-nc4.nc' }), /member run\/field-nc4\.nc: the path of the model file inside field-nc4\.nc, which must then be a ZIP archive/u);
  assert.throws(() => entryOf({ ...member, member: '../field-nc4.nc' }), /the path of the model file inside release\.zip/u);
  assert.throws(() => entryOf({ isobar: member.isobar }), /isobar reads every level of the model, which the two kept parts of a classic release do not hold/u);
  const scratch = await mkdtemp(resolve(tmpdir(), 'simulation-member-')), sourceRoot = resolve(scratch, 'source'), archives = resolve('.local/source-archives');
  const cached = async () => new Set(await readdir(archives).catch(() => []));
  const before = await cached();
  try {
    await cp(netcdf4, resolve(scratch, 'run/field-nc4.nc'));
    execFileSync('zip', ['-q', 'release.zip', 'run/field-nc4.nc'], { cwd: scratch });
    const zip = await readFile(resolve(scratch, 'release.zip')), asked: string[] = [];
    const release = await simulationRelease(archive(await record(exocam => { exocam.files = [{ key: 'release.zip', size: zip.length }, ...exocam.files]; })), id, ['TRAPPIST-1f'], entry);
    const files = new Map<string, string | Buffer>(await Promise.all(PACKAGE.map(async path => [`${o}/${path}`, await readFile(resolve(WORKSPACE, o, path), 'utf8')] as const)));
    const zenodo = (async (url: unknown) => { asked.push(String(url)); return new Response(new Uint8Array(zip)); }) as typeof fetch;
    // The archive is fetched once and the member taken out of it by the step the package then declares.
    assert.equal(await restoreSimulationMember(files, id, sourceRoot, entry, release, zenodo), zip.length);
    assert.deepEqual(asked, [release.fileUrl]);
    assert.deepEqual(await readFile(resolve(sourceRoot, entry.path)), await readFile(netcdf4));
    assert.equal(await restoreSimulationMember(files, id, sourceRoot, entry, release, (async () => { throw new Error('a file already there is kept'); }) as typeof fetch), 0);
    const field = await loadNetcdfLonLatField(sourceRoot, simulationRecipe(entry), new Map());
    // T = 1000 + 10 i + j on the first level and 100 K less on the second; 150 Pa lies between them where the first holds 1000 Pa.
    assert.ok(Math.abs(field.sample(22.5 - 180, -67.5)! - (1000 - 100 * Math.log(0.15) / Math.log(0.1))) < 1e-9);
    assert.throws(() => installSimulationDataset(files, id, 'TRAPPIST-1f', entry, release, field.report, RANGES), /a classic release is installed with the ranges of its two kept parts, a ZIP member without/u);
    installSimulationDataset(files, id, 'TRAPPIST-1f', entry, release, field.report);
    const after = (path: string) => JSON.parse(String(files.get(`${o}/${path}`))) as Record<string, any>, surface = after('source/preparation/raster.json').surfaces.at(-1);
    assert.deepEqual([surface.source, surface.science.path, surface.science.field, surface.science.isobar], ['science/wolf-2022/field-nc4.nc', 'science/wolf-2022/field-nc4.nc', undefined, member.isobar]);
    const input = after('source/manifest.json').inputs.at(-1);
    assert.deepEqual([input.id, input.path, input.range, input.origin, input.productId], ['trappist-1f-climate-model-simulation', 'science/wolf-2022/field-nc4.nc', undefined, release.fileUrl, 'run/field-nc4.nc']);
    assert.equal(input.acquisition, `Restored through source/preparation/acquisition.json from Zenodo record 10.5281/zenodo.5532765: the member run/field-nc4.nc of release.zip (${(zip.length / 1000).toFixed(1)} kB), unchanged and whole, because a NetCDF-4 file spreads its structure through itself. A model output, not an observation.`);
    assert.equal(input.redistribution, 'Not redistributed in git; restored from Zenodo. CC BY 4.0 with attribution.');
    assert.deepEqual(after('source/preparation/acquisition.json').operations.at(-1), { kind: 'zip-member', groups: ['restore', 'refresh'], path: 'science/wolf-2022/field-nc4.nc', url: release.fileUrl, member: 'run/field-nc4.nc' });
    // A second dataset of the same member cites the member's one record, now titled as the file; a classic member says why it is whole.
    installSimulationDataset(files, id, 'TRAPPIST-1f', entryOf({ ...member, dataset: 'cloud-model', label: 'Model clouds' }), release, field.report, undefined, 'classic');
    const wholes = after('source/manifest.json').inputs.filter((existing: { path: string }) => existing.path === input.path);
    assert.deepEqual(wholes.map((existing: { id: string; consumers: string[] }) => [existing.id, existing.consumers]), [[input.id, ['climate-model-simulation', 'cloud-model-simulation']]]);
    assert.equal(wholes[0].title, `ExoCAM simulation of TRAPPIST-1f, run/field-nc4.nc: ${release.title}`);
    assert.match(wholes[0].acquisition, /unchanged and whole, because a member is taken out of a ZIP archive whole\. A model output/u);
    assert.deepEqual(after('source/content/object.json').datasets.controls.slice(-2).map((control: { source: { id: string } }) => control.source.id), [input.id, input.id]);
    assert.equal(after('source/preparation/acquisition.json').operations.filter((step: { path: string }) => step.path === input.path).length, 1);
    // The whole file is declared under the first dataset's name: that one cannot move while the second reads it; the second can.
    const moved = { ...member, member: 'run/other-nc4.nc', path: 'science/wolf-2022/other-nc4.nc' };
    assert.throws(() => installSimulationDataset(files, id, 'TRAPPIST-1f', entryOf(moved), release, field.report),
      /dataset climate-model: science\/wolf-2022\/field-nc4\.nc is declared under this dataset's name and cloud-model-simulation still reads it/u);
    installSimulationDataset(files, id, 'TRAPPIST-1f', entryOf({ ...moved, dataset: 'cloud-model', label: 'Model clouds' }), release, field.report);
    const records = (after('source/manifest.json').inputs as { id: string; path: string; consumers: string[] }[]).filter(existing => /-nc4\.nc$/u.test(existing.path)).map(existing => [existing.id, existing.path, existing.consumers]);
    assert.deepEqual(records, [[input.id, input.path, ['climate-model-simulation']], ['trappist-1f-cloud-model-simulation', moved.path, ['cloud-model-simulation']]]);
    assert.equal(after('source/content/object.json').datasets.controls.at(-1).source.id, 'trappist-1f-cloud-model-simulation');
    assert.deepEqual([await memberFormat(netcdf4), await memberFormat(fixture)], ['netcdf-4', 'classic']);
  } finally {
    for (const name of await cached()) if (!before.has(name)) await rm(resolve(archives, name), { force: true });
    await rm(scratch, { recursive: true, force: true });
  }
});

test('new-object --simulation writes the package of a body already in the tree, and refuses what the file does not hold', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'simulation-tree-'));
  try {
    for (const path of PACKAGE) await cp(resolve(WORKSPACE, o, path), resolve(root, o, path), { recursive: true });
    await cp(resolve(WORKSPACE, 'packages/astronomy/data/bodies', `${id}.json`), resolve(root, 'packages/astronomy/data/bodies', `${id}.json`));
    const zenodo = serving(await readFile(fixture)), progress: string[] = [];
    const lines = await rebuildExistingDatasets(root, [id], 'simulation', archive(await record()), line => { progress.push(line); }, new Map(), new Map(), parseSimulationEntries([written]), zenodo);
    assert.equal(progress[0], 'trappist-1f: 1,340 bytes of field-cdf2.nc fetched from Zenodo record 10.5281/zenodo.5532765');
    assert.deepEqual(lines, ['trappist-1f: climate-model dataset from the ExoCAM simulation of Wolf et al. (2022), 300-340 K, CC BY 4.0; the page now opens on it']);
    const page = JSON.parse(await readFile(resolve(root, o, 'source/content/object.json'), 'utf8')) as { datasets: { defaultDataset: string } };
    assert.equal(page.datasets.defaultDataset, 'climate-model');
    const marker = (JSON.parse(await readFile(resolve(root, o, 'source/manifest.json'), 'utf8')) as { generatedIntermediates: { path: string; recipe?: { inputs?: string[] } }[] }).generatedIntermediates.find(entry => entry.path === 'presentation/context.png');
    assert.ok(marker?.recipe?.inputs?.includes('trappist-1f-climate-model-simulation'), 'the marker is drawn from the default dataset, now the simulation');
    const raster = JSON.parse(await readFile(resolve(root, o, 'source/preparation/raster.json'), 'utf8')) as { surfaces: { id: string }[] };
    assert.equal(raster.surfaces.at(-1)!.id, 'climate-model');
    // The entry is checked against the file before anything is written: wrong units, a missing variable, an unstated time.
    const again = (change: Record<string, unknown>) => rebuildExistingDatasets(root, [id], 'simulation', archive(null), () => {}, new Map(), new Map(), parseSimulationEntries([{ ...written, dataset: 'second', ...change }]), zenodo);
    const refusing = async (change: Record<string, unknown>, message: RegExp) => assert.rejects(async () => rebuildExistingDatasets(root, [id], 'simulation', archive(await record()), () => {}, new Map(), new Map(), parseSimulationEntries([{ ...written, dataset: 'second', ...change }]), zenodo), message);
    await refusing({ units: 'degC' }, /science\/wolf-2022\/field-cdf2\.head\.dat, sourceUnits is "degC", and the file gives TS the units "K"/u);
    await refusing({ variable: 'TSKIN' }, /field-cdf2\.nc has no variable TSKIN/u);
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
  // A question holds 32 spellings, the size Zenodo answers: sixteen of these planets; a full page asks for the next, 2.1 seconds later.
  const many = Array.from({ length: 17 }, (_, index) => `Planet-${index + 1} b`), full = { hits: { hits: Array.from({ length: 25 }, () => body.hits.hits[3]!) } };
  let calls = 0;
  const questions: string[] = [];
  const paged: Archive = { ...archive(null), text: async url => { questions.push(url); return JSON.stringify(calls++ === 0 ? full : { hits: { hits: [] } }); } };
  assert.equal((await simulationSurvey(paged, many, async ms => { waits.push(ms); })).requests, 3);
  assert.deepEqual(waits, [2100, 2100]);
  // The first sixteen planets twice, a page apart, then the seventeenth alone.
  assert.deepEqual(questions.map(url => [(decodeURIComponent(url).match(/Planet-\d+b/gu) ?? []).length, new URL(url).searchParams.get('page')]), [[16, '1'], [16, '2'], [1, '1']]);
  // A name written more ways takes more of a question: four spellings for a catalogue number, eight for a planet of a lettered star.
  assert.deepEqual(surveyQuestions(['HD 1 b', 'HD 2 b', 'HD 3 b', 'HD 4 b', 'HD 5 b', 'HD 6 b', 'HD 7 b', 'HD 8 b', 'HD 9 b']).map(question => question.length), [8, 1]);
  assert.deepEqual(surveyQuestions(['HD 135344 Ab', 'HD 93963 A b', 'HD 93963 A c', 'HD 202772 A b', 'HD 1 b']).map(question => question.length), [4, 1]);
  const failing: Archive = { ...archive(null), text: async () => { throw new Error('HTTP 429 from https://zenodo.org/api/records'); } };
  const failed = await simulationSurvey(failing, ['TRAPPIST-1 e']);
  assert.equal(failed.failure, 'Zenodo could not be asked for published simulations of every planet (HTTP 429 from https://zenodo.org/api/records); ask with telescope simulations OBJECT.');
  assert.equal(failed.note(['TRAPPIST-1 e']), '');
});
