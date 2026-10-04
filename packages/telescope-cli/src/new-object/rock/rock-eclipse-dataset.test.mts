/** A bare-rock model from a published eclipse depth (rock-eclipse-dataset.mts), offline: TRAPPIST-1f's package, still a neutral
 * shape, stands in for a planet whose paper found a bare rock; the SVO's answers are a filter and a model spectrum reduced to
 * the lines the checks read. The bake's own reader is not run here: its report is passed in, as the route passes it on. */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { WORKSPACE } from '@cssearth/telescope/node';
import type { Archive } from '../archives/archives.mts';
import { checkDayside, depthRecord, hostAtmosphere, installRockEclipseDataset, parseRockEclipseEntries, restoreRockInputs, rockInputs, rockRecipe, throughputRelease } from './rock-eclipse-dataset.mts';

const id = 'trappist-1f', o = `src/objects/${id}`;
const written = { id, dataset: 'temperature', label: 'Rock model', path: 'science/allen-2025/dayside-15um.json', url: 'https://arxiv.org/abs/2508.14210', credit: 'Allen et al. (2025)',
  observed: 'two JWST MIRI F1500W eclipses of the Hot Rocks Survey', depth: { low: 274, high: 350, cell: '312 +/- 38 ppm, the two eclipses combined', where: 'abstract' },
  filter: 'JWST/MIRI.F1500W', band: '15 µm', star: { teffK: 2600, logg: 5.0, fid: 137 }, verdict: 'consistent with the thermal emission from a bare rock surface' };
const entryOf = (change: Record<string, unknown> = {}) => parseRockEclipseEntries([{ ...written, ...change }]).get(id)![0]!;
const PACKAGE = ['object.json', 'text.json', 'source/preparation/raster.json', 'source/preparation/geometry.json', 'source/preparation/acquisition.json', 'source/content/object.json', 'source/manifest.json'];
/** The SVO's two answers, as far as the checks read them. */
const model = (teff: number, logg: number, meta = 0) => Buffer.from(`<VOTABLE><PARAM name="teff"  utype="" unit="K" value="${teff}" datatype="float"/><PARAM name="logg"  utype="" value="${logg}" datatype="float"/><PARAM name="meta"  utype="" value="${meta}" datatype="float"/></VOTABLE>`);
const filter = Buffer.from('<VOTABLE><PARAM name="filterID" value="JWST/MIRI.F1500W"/></VOTABLE>');
const svo = (star: Buffer, asked: string[] = []): Archive => ({ text: async () => { throw new Error('Unexpected text request'); }, exists: async () => false,
  bytes: async url => { asked.push(url); return url.includes('fps.php') ? filter : star; } });

test('an entry holds the measured depth, the band, the star\'s model and the paper\'s verdict, and only a bare-rock verdict is taken', () => {
  const entry = entryOf();
  assert.deepEqual(rockInputs(entry), { filter: { path: 'science/svo/JWST_MIRI.F1500W.xml', url: 'https://svo2.cab.inta-csic.es/theory/fps/fps.php?ID=JWST/MIRI.F1500W' },
    star: { path: 'science/bt-settl-cifist/bt-settl-cifist-2600-5.0-0.0.xml', url: 'https://svo2.cab.inta-csic.es/theory/newov2/ssap.php?model=bt-settl-cifist&fid=137' } });
  assert.deepEqual(rockRecipe(id, 'trappist-1', entry), { format: 'bare-rock-eclipse', path: 'science/allen-2025/dayside-15um.json', sampling: 'bilinear', units: 'K', planet: id, host: 'trappist-1',
    band: { encoding: 'svo-filter', path: 'science/svo/JWST_MIRI.F1500W.xml' }, star: { encoding: 'svo-model-spectrum', path: 'science/bt-settl-cifist/bt-settl-cifist-2600-5.0-0.0.xml' } });
  const refused = (change: Record<string, unknown>, message: RegExp) => assert.throws(() => entryOf(change), message);
  // A hotter or shallower day side than a rock's is a measurement the model would contradict.
  refused({ verdict: 'anomalously hot' }, /verdict must be the paper's finding of a bare rock or of no atmosphere; a rock model contradicts any other measurement/u);
  refused({ verdict: 'consistent with a bare rock.' }, /leave out its final period/u);
  refused({ depth: { low: 350, high: 274, cell: '', where: '' } }, /depth is the one-sigma range in ppm, 0 < low < high/u);
  refused({ star: { teffK: 2650, logg: 5, fid: 137 } }, /star is a BT-Settl CIFIST grid point/u);
  refused({ filter: 'F1500W' }, /an SVO filter id, FACILITY\/INSTRUMENT\.BAND/u);
  refused({ path: 'dayside.json' }, /a record lives at science\/<paper>\/<name>\.json/u);
  refused({ albedo: 0.1 }, /unknown fields albedo/u);
});

test('the filter curve and the model spectrum come from the SVO once, and the spectrum must be the grid point nearest the star', async () => {
  // LHS 1140's package cites 3,096 K and log g 5.04: the 3100 K, log g 5.0 grid point, SVO file 172.
  const sourceRoot = await mkdtemp(resolve(tmpdir(), 'rock-inputs-')), entry = entryOf({ star: { teffK: 3100, logg: 5.0, fid: 172 } }), host = { id: 'lhs-1140', ...await hostAtmosphere(WORKSPACE, 'lhs-1140') };
  try {
    assert.deepEqual([host.teffK, host.logg], [3096, 5.04]);
    const asked: string[] = [];
    assert.equal(await restoreRockInputs(sourceRoot, id, host, entry, svo(model(3100, 5), asked)), filter.length + model(3100, 5).length);
    assert.deepEqual(asked, ['https://svo2.cab.inta-csic.es/theory/fps/fps.php?ID=JWST/MIRI.F1500W', 'https://svo2.cab.inta-csic.es/theory/newov2/ssap.php?model=bt-settl-cifist&fid=172']);
    assert.deepEqual(await readFile(resolve(sourceRoot, 'science/svo/JWST_MIRI.F1500W.xml')), filter);
    assert.equal(await restoreRockInputs(sourceRoot, id, host, entry, svo(model(3100, 5), asked)), 0, 'files already there are not asked for again');
    assert.equal(asked.length, 2);
    // Another star's grid point, a file that states another grid point than the entry, and an answer for another filter.
    await assert.rejects(restoreRockInputs(sourceRoot, id, host, entryOf({ star: { teffK: 3400, logg: 5, fid: 193 } }), svo(model(3400, 5))),
      /trappist-1f, dataset temperature: the model spectrum at 3400 K, log g 5 is not the grid point nearest lhs-1140's cited 3096 K, log g 5\.04 \(field star\)/u);
    const empty = await mkdtemp(resolve(tmpdir(), 'rock-inputs-'));
    try {
      await assert.rejects(restoreRockInputs(empty, id, host, entry, svo(model(3200, 5))), /SVO file 172 states Teff 3200 K, log g 5, \[M\/H\] 0, not the 3100 K, log g 5, \[M\/H\] 0 the entry names \(field star\.fid\)/u);
    } finally { await rm(empty, { recursive: true, force: true }); }
    const other = await mkdtemp(resolve(tmpdir(), 'rock-inputs-'));
    try {
      await assert.rejects(restoreRockInputs(other, id, host, entryOf({ filter: 'Spitzer/IRAC.I2', star: { teffK: 3100, logg: 5.0, fid: 172 } }), svo(model(3100, 5))), /the SVO's answer for Spitzer\/IRAC\.I2 does not name that filter \(field filter\)/u);
    } finally { await rm(other, { recursive: true, force: true }); }
  } finally { await rm(sourceRoot, { recursive: true, force: true }); }
});

test('the dataset says it is a model set by one measurement, draws the rock the reader found and takes the default from a neutral shape', async () => {
  const files = new Map<string, string | Buffer>(await Promise.all(PACKAGE.map(async path => [`${o}/${path}`, await readFile(resolve(WORKSPACE, o, path), 'utf8')] as const)));
  const after = (path: string) => JSON.parse(String(files.get(`${o}/${path}`))) as Record<string, any>, entry = entryOf();
  assert.equal(after('source/content/object.json').datasets.defaultDataset, 'shape', 'TRAPPIST-1f opens on its neutral shape');
  const installed = installRockEclipseDataset(files, id, 'TRAPPIST-1f', 'trappist-1', entry, { substellarK: 1287.4, substellarRangeK: [1180.2, 1391.6] });
  assert.deepEqual(installed, { minimum: 50, maximum: 1400, underStar: 1287, promoted: true });
  assert.deepEqual(after('source/science/allen-2025/dayside-15um.json').eclipseDepthPpm, { low: 274, high: 350 });
  assert.match(after('source/science/allen-2025/dayside-15um.json').source, /^Allen et al\. \(2025\): two JWST MIRI F1500W eclipses of the Hot Rocks Survey\. Eclipse depth 312 \+\/- 38 ppm, the two eclipses combined \(abstract\); the range is its one-sigma interval\. The paper finds the day side consistent with the thermal emission from a bare rock surface\. https:\/\/arxiv\.org\/abs\/2508\.14210$/u);
  const surface = after('source/preparation/raster.json').surfaces.at(-1);
  assert.deepEqual([surface.id, surface.source, surface.science.format, surface.science.planet, surface.science.host, surface.science.minimum, surface.science.maximum, surface.science.labels],
    ['temperature', 'science/allen-2025/dayside-15um.json', 'bare-rock-eclipse', id, 'trappist-1', 50, 1400, ['≤ 50', '725', '1400']]);
  const content = after('source/content/object.json'), control = content.datasets.controls.at(-1);
  assert.equal(content.datasets.defaultDataset, 'temperature', 'the rock model is a better dataset than a gray sphere');
  assert.equal(control.qualification, 'A model set by one measurement: the 15 µm eclipse depth of Allen et al. (2025), two JWST MIRI F1500W eclipses of the Hot Rocks Survey');
  assert.match(control.notes, /^A model, not a map\. Only TRAPPIST-1f's dayside brightness is measured: an eclipse depth of 274 to 350 ppm at 15 µm \(Allen et al\. \(2025\)\), which the paper finds consistent with the thermal emission from a bare rock surface\. A bare rock with that depth is 1,180 to 1,392 K under the star and dark at night; whether the night side is dark is not measured\./u);
  assert.deepEqual(after('text.json').datasets.temperature, { title: 'Bare rock from its eclipse depth', detail: 'A model from one measurement',
    summary: 'A model, not a map: a bare rock as bright at 15 µm as the measured day side. About 1,290 K under the star, dark at night.' });
  // Three inputs: the transcribed depth, and the two files the SVO restores.
  const inputs = after('source/manifest.json').inputs.slice(-3);
  assert.deepEqual(inputs.map((input: { id: string; path: string }) => [input.id, input.path]), [['trappist-1f-temperature-eclipse-depth', 'science/allen-2025/dayside-15um.json'],
    ['trappist-1f-jwst-miri-f1500w-filter', 'science/svo/JWST_MIRI.F1500W.xml'], ['trappist-1f-bt-settl-cifist-2600', 'science/bt-settl-cifist/bt-settl-cifist-2600-5.0-0.0.xml']]);
  assert.ok(inputs.every((input: { consumers: string[] }) => input.consumers[0] === 'trappist-1f-bare-rock-model'));
  // The depth is this planet's own record; the two SVO files serve many planets and are bound locally, as TRAPPIST-1 c's are.
  assert.deepEqual(inputs.map((input: { sourceBinding: { kind: string } }) => input.sourceBinding.kind), ['catalogued', 'local', 'local']);
  assert.deepEqual(after('source/preparation/acquisition.json').operations.slice(-2).map((step: { path: string; url: string }) => [step.path, step.url]),
    [['science/svo/JWST_MIRI.F1500W.xml', 'https://svo2.cab.inta-csic.es/theory/fps/fps.php?ID=JWST/MIRI.F1500W'], ['science/bt-settl-cifist/bt-settl-cifist-2600-5.0-0.0.xml', 'https://svo2.cab.inta-csic.es/theory/newov2/ssap.php?model=bt-settl-cifist&fid=137']]);
  // Installed again, it replaces itself.
  const count = after('source/preparation/raster.json').surfaces.length;
  assert.equal(installRockEclipseDataset(files, id, 'TRAPPIST-1f', 'trappist-1', entry, { substellarK: 1287.4, substellarRangeK: [1180.2, 1391.6] }).promoted, false);
  assert.equal(after('source/preparation/raster.json').surfaces.length, count);
  assert.equal(after('source/manifest.json').inputs.filter((input: { id: string }) => input.id.startsWith('trappist-1f-') && /eclipse-depth|filter|bt-settl/u.test(input.id)).length, 3);
});

test('a depth summed over a spectrograph takes a released throughput table as its band, checked at its release', async () => {
  const table = { record: '10.5281/zenodo.12571830', file: 'ThERESA.zip', member: 'ThERESA/miri_throughput.dat', path: 'science/valentine-2024/miri_throughput.dat', minimumMicrons: 5, maximumMicrons: 12, instrument: 'JWST MIRI LRS', credit: 'Valentine et al. (2024)' };
  const entry = entryOf({ filter: undefined, throughput: table, band: '5 to 12 µm', path: 'science/xue-2024/dayside-5-12um.json' });
  assert.deepEqual(rockInputs(entry).filter, { path: 'science/valentine-2024/miri_throughput.dat', url: 'https://zenodo.org/records/12571830/files/ThERESA.zip?download=1', member: 'ThERESA/miri_throughput.dat' });
  assert.deepEqual(rockRecipe(id, 'trappist-1', entry).band, { encoding: 'throughput-columns', path: 'science/valentine-2024/miri_throughput.dat', minimumMicrons: 5, maximumMicrons: 12 });
  assert.throws(() => entryOf({ throughput: table }), /names the band once: an SVO filter id \(field filter\) or a released throughput table \(field throughput\)/u);
  assert.throws(() => entryOf({ filter: undefined }), /names the band once/u);
  assert.throws(() => entryOf({ filter: undefined, throughput: { ...table, member: undefined } }), /throughput\.member names the table inside a \.zip file, and only there/u);
  assert.throws(() => entryOf({ filter: undefined, throughput: { ...table, maximumMicrons: 4 } }), /sums from minimumMicrons to a larger maximumMicrons/u);
  assert.equal(entryOf({ verdict: 'likely best explained by an airless planet' }).verdict, 'likely best explained by an airless planet');
  // The release must allow reuse and list the file.
  const record = (license: string) => JSON.stringify({ id: 12571830, doi: '10.5281/zenodo.12571830', metadata: { title: 'Non-Uniform Dayside Emission for WASP-17b', creators: [{ name: 'Valentine, Daniel' }], license: { id: license } }, files: [{ key: 'ThERESA.zip', size: 4118999 }] });
  const zenodo = (answer: string): Archive => ({ text: async () => answer, bytes: async () => { throw new Error('Unexpected bytes request'); }, exists: async () => false });
  const release = await throughputRelease(zenodo(record('cc-by-4.0')), 'trappist-1f, dataset temperature', table);
  assert.deepEqual([release.license.name, release.fileUrl], ['CC BY 4.0', 'https://zenodo.org/records/12571830/files/ThERESA.zip?download=1']);
  await assert.rejects(throughputRelease(zenodo(record('cc-by-nd-4.0')), 'trappist-1f, dataset temperature', table), /a throughput table is used only under a license known to allow reuse \(field throughput\.record\)/u);
  await assert.rejects(throughputRelease(zenodo(record('cc-by-4.0')), 'trappist-1f, dataset temperature', { ...table, file: 'other.zip' }), /lists no file other\.zip \(field throughput\.file\)/u);
  // Installed, the table is the package's own pinned copy, restored as a member of the release's ZIP.
  const files = new Map<string, string | Buffer>(await Promise.all(PACKAGE.map(async path => [`${o}/${path}`, await readFile(resolve(WORKSPACE, o, path), 'utf8')] as const)));
  const after = (path: string) => JSON.parse(String(files.get(`${o}/${path}`))) as Record<string, any>;
  assert.throws(() => installRockEclipseDataset(files, id, 'TRAPPIST-1f', 'trappist-1', entry, { substellarK: 800, substellarRangeK: [780, 820] }), /a throughput table is installed with its checked release/u);
  installRockEclipseDataset(files, id, 'TRAPPIST-1f', 'trappist-1', entry, { substellarK: 800, substellarRangeK: [780, 820] }, release);
  const band = after('source/manifest.json').inputs.at(-2);
  assert.deepEqual([band.id, band.path, band.productId, band.version, band.license, band.sourceBinding.kind],
    ['trappist-1f-jwst-miri-lrs-throughput', 'science/valentine-2024/miri_throughput.dat', 'ThERESA/miri_throughput.dat', '10.5281/zenodo.12571830', 'CC BY 4.0', 'local']);
  assert.deepEqual(after('source/preparation/acquisition.json').operations.at(-2),
    { kind: 'zip-member', groups: ['restore', 'refresh'], path: 'science/valentine-2024/miri_throughput.dat', url: 'https://zenodo.org/records/12571830/files/ThERESA.zip?download=1', member: 'ThERESA/miri_throughput.dat' });
  assert.equal(after('source/preparation/raster.json').surfaces.at(-1).science.band.encoding, 'throughput-columns');
});

test('the depth is read with the radius ratio its paper fitted, and the paper\'s printed day side is the check', () => {
  const entry = entryOf({ radiusRatio: { value: 0.04943, cell: '0.04943 +/- 0.00015', where: 'Table 1, R_P/R_*' }, dayside: { kelvin: 709, minus: 31, plus: 31, where: 'abstract' } });
  const record = depthRecord(id, entry);
  assert.deepEqual([record.schema, record.radiusRatio, record.eclipseDepthPpm], ['cssearth-eclipse-depth@1', 0.04943, { low: 274, high: 350 }]);
  assert.match(record.source, /Radius ratio 0\.04943 \+\/- 0\.00015 \(Table 1, R_P\/R_\*\), fitted with the depth\. The paper finds the day side/u);
  assert.equal('radiusRatio' in depthRecord(id, entryOf()), false, 'a paper that prints no ratio leaves the bodies\' own');
  // Inside two sigma the line says how far; outside, the entry is refused with the fields that could be wrong.
  assert.equal(checkDayside('trappist-1f, dataset temperature', entry, 665.4), ', uniform day side 665 K (paper 709 +31/-31, -1.4 sigma)');
  assert.equal(checkDayside('trappist-1f, dataset temperature', entryOf(), 665.4), '', 'an entry without the printed day side is not checked');
  assert.throws(() => checkDayside('trappist-1f, dataset temperature', entry, 640),
    /trappist-1f, dataset temperature: the uniform day side that shows the depth is 640 K, 2\.2 sigma from the 709 K the paper prints \(abstract\); the depth, band, star or radius ratio is not read as the paper read it \(fields depth, filter or throughput, star, radiusRatio\)/u);
  assert.throws(() => entryOf({ radiusRatio: { value: 1.2, cell: '', where: '' } }), /radiusRatio\.value is the planet's radius in stellar radii, between 0 and 1/u);
  assert.throws(() => entryOf({ dayside: { kelvin: 709, minus: 0, plus: 31, where: '' } }), /dayside is the printed temperature in K with its positive one-sigma errors/u);
});
