/** A published eclipse map as a dataset (published-map-dataset.mts), offline: TRAPPIST-1f's package, still a neutral shape,
 * stands in for a planet whose paper released its map; Zenodo's answers are a record reduced to what the checks read. The
 * bake's own reader is not run here: a map the test builds is passed in, as the route passes the reader's on. */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { WORKSPACE } from '@cssearth/telescope/node';
import type { Archive } from '../archives/archives.mts';
import { installPublishedMapDataset, mapRelease, parsePublishedMapEntries, publishedMapRecipe, publishedMapReport, restorePublishedMap } from './published-map-dataset.mts';

const id = 'trappist-1f', o = `src/objects/${id}`;
const written = { id, dataset: 'temperature', label: 'JWST', record: '10.5281/zenodo.12571830', file: 'maps.npy', path: 'science/valentine-2024/maps.npy', values: ['tmap'],
  instrument: 'JWST MIRI', band: '5 to 12 µm', credit: 'Valentine et al. (2024)', url: 'https://arxiv.org/abs/2410.08148', observed: 'one eclipse on 14 March 2023',
  shown: { west: -110, east: 110, where: 'Figure 5 caption' }, hotspot: { degreesEast: 18.7, minus: 3.8, plus: 11.1, where: 'Section 4.3' } };
const entryOf = (change: Record<string, unknown> = {}) => parsePublishedMapEntries([{ ...written, ...change }]).get(id)![0]!;
const PACKAGE = ['object.json', 'text.json', 'source/preparation/raster.json', 'source/preparation/geometry.json', 'source/preparation/acquisition.json', 'source/content/object.json', 'source/manifest.json'];
const record = (change: Record<string, unknown> = {}) => JSON.stringify({ id: 12571830, doi: '10.5281/zenodo.12571830',
  metadata: { title: 'Non-Uniform Dayside Emission for TRAPPIST-1f', description: '', creators: [{ name: 'Valentine, Daniel' }], license: { id: 'cc-by-4.0' }, publication_date: '2024-08-21', ...change },
  files: [{ key: 'maps.npy', size: 9 }, { key: 'ThERESA.zip', size: 4118999 }] });
const zenodo = (answer: string, file = Buffer.from('map bytes'), asked: string[] = []): Archive => ({ exists: async () => false,
  text: async url => { asked.push(url); return answer; }, bytes: async url => { asked.push(url); return file; } });
/** A map whose hottest column is the one nearest `hot` degrees east, shown between `west` and `east`. */
const mapWith = (hot: number, west = -110, east = 110) => ({ width: 240, height: 4,
  sample: (longitude: number, latitude: number) => longitude < west || longitude > east ? null : 2165 - Math.abs(longitude - hot) * 14 - Math.abs(latitude) });

test('an entry holds the released file, how it is saved, the longitudes the paper shows and the hot spot it prints', () => {
  assert.deepEqual(publishedMapRecipe(entryOf()), { format: 'npy-dictionary-map', path: 'science/valentine-2024/maps.npy', sampling: 'bilinear', units: 'K', values: ['tmap'], gridLayout: 'pixel-centres', shownLongitudes: [-110, 110] });
  // A bare pickle inside the release's ZIP, the whole sphere shown.
  const zipped = entryOf({ file: 'ThERESA.zip', member: 'ThERESA/tmap.pkl', path: 'science/valentine-2024/tmap.pkl', container: 'pickle', values: [], shown: undefined });
  assert.deepEqual(publishedMapRecipe(zipped), { format: 'npy-dictionary-map', path: 'science/valentine-2024/tmap.pkl', sampling: 'bilinear', units: 'K', values: [], gridLayout: 'pixel-centres', container: 'pickle' });
  const refused = (change: Record<string, unknown>, message: RegExp) => assert.throws(() => entryOf(change), message);
  refused({ record: 'zenodo.12571830' }, /a Zenodo DOI, 10\.5281\/zenodo\.<number>/u);
  refused({ member: 'tmap.pkl' }, /member names the map inside a \.zip file, and only there \(file maps\.npy\)/u);
  refused({ file: 'ThERESA.zip' }, /member names the map inside a \.zip file/u);
  refused({ container: 'tar' }, /container is "pickle" or left out/u);
  refused({ path: 'tmap.pkl' }, /the map file lives at science\/<paper>\/<name>/u);
  refused({ shown: { west: 110, east: -110, where: '' } }, /shown runs from west to east within -180 to 180 degrees/u);
  refused({ hotspot: { degreesEast: 18.7, minus: -3.8, plus: 11.1, where: '' } }, /the printed longitude in degrees east with its positive one-sigma errors/u);
  refused({ grid: 'gaussian' }, /unknown fields grid/u);
});

test('the release must allow reuse, name the planet and list the file; the file is fetched once', async () => {
  const names = ['TRAPPIST-1f', 'TRAPPIST-1 f'], entry = entryOf(), asked: string[] = [];
  const release = await mapRelease(zenodo(record(), undefined, asked), id, names, entry);
  assert.deepEqual([asked, release.fileUrl, release.license.name, release.bytes], [['https://zenodo.org/api/records/12571830'], 'https://zenodo.org/records/12571830/files/maps.npy?download=1', 'CC BY 4.0', 9]);
  await assert.rejects(mapRelease(zenodo(record({ license: { id: 'cc-by-nd-4.0' } })), id, names, entry), /trappist-1f, dataset temperature: Zenodo record 10\.5281\/zenodo\.12571830 states the license cc-by-nd-4\.0; a released map is shown only under a license known to allow reuse \(field record\)/u);
  await assert.rejects(mapRelease(zenodo(record({ title: 'Dayside emission of hot Jupiters' })), id, names, entry), /does not name TRAPPIST-1f in its title or description \(field record\)/u);
  await assert.rejects(mapRelease(zenodo(record()), id, names, entryOf({ file: 'tmap.npy', path: 'science/valentine-2024/tmap.npy' })), /lists no file tmap\.npy \(field file\); it lists maps\.npy, ThERESA\.zip/u);
  const sourceRoot = await mkdtemp(resolve(tmpdir(), 'published-map-'));
  try {
    assert.equal(await restorePublishedMap(sourceRoot, entry, release, zenodo('', Buffer.from('map bytes'), asked)), 9);
    assert.equal(String(await readFile(resolve(sourceRoot, 'science/valentine-2024/maps.npy'))), 'map bytes');
    assert.equal(await restorePublishedMap(sourceRoot, entry, release, zenodo('', Buffer.from('other'), asked)), 0, 'a file already there is not asked for again');
    assert.equal(asked.length, 2);
  } finally { await rm(sourceRoot, { recursive: true, force: true }); }
});

test('the paper\'s printed hot spot is the check: a map read mirrored or shifted is refused', () => {
  const entry = entryOf(), where = 'trappist-1f, dataset temperature';
  const report = publishedMapReport(mapWith(18.7), entry, where);
  assert.deepEqual([report.hotspotDegreesEast, Math.round(report.maximum), report.blankColumns], [18.75, 2142, 94]);
  // Mirrored east for west, the hottest cell lands 18.75 degrees west: outside twice the printed interval, 11.1 to 40.9.
  assert.throws(() => publishedMapReport(mapWith(-18.7), entry, where), /trappist-1f, dataset temperature: the map's hottest cell is -18\.8° east, outside twice the printed interval around 18\.7° \(Section 4\.3\); the file is not read as the paper drew it \(fields values, container, hotspot\)/u);
  assert.throws(() => publishedMapReport(mapWith(60), entry, where), /hottest cell is 59\.3° east/u);
  assert.throws(() => publishedMapReport({ width: 8, height: 2, sample: () => null }, entry, where), /holds no finite cell inside the longitudes shown \(field values\)/u);
});

test('the dataset says whose map it is, where the hot spot sits and what is blank, and takes the default from a neutral shape', async () => {
  const files = new Map<string, string | Buffer>(await Promise.all(PACKAGE.map(async path => [`${o}/${path}`, await readFile(resolve(WORKSPACE, o, path), 'utf8')] as const)));
  const after = (path: string) => JSON.parse(String(files.get(`${o}/${path}`))) as Record<string, any>;
  const entry = entryOf({ file: 'ThERESA.zip', member: 'ThERESA/tmap.pkl', path: 'science/valentine-2024/tmap.pkl', container: 'pickle', values: [] });
  const release = await mapRelease(zenodo(record()), id, ['TRAPPIST-1f'], entry), report = { minimum: 548.95, maximum: 2165.49, hotspotDegreesEast: 18.75, blankColumns: 92 };
  assert.equal(after('source/content/object.json').datasets.defaultDataset, 'shape', 'TRAPPIST-1f opens on its neutral shape');
  assert.deepEqual(installPublishedMapDataset(files, id, 'TRAPPIST-1f', entry, release, report), { minimum: 500, maximum: 2200, promoted: true });
  const surface = after('source/preparation/raster.json').surfaces.at(-1);
  assert.deepEqual([surface.id, surface.source, surface.science.format, surface.science.container, surface.science.shownLongitudes, surface.science.minimum, surface.science.maximum, surface.science.labels],
    ['temperature', 'science/valentine-2024/tmap.pkl', 'npy-dictionary-map', 'pickle', [-110, 110], 500, 2200, ['500', '1350', '2200']]);
  assert.equal(surface.science.description, 'Brightness temperature at 5 to 12 µm, fitted to one eclipse on 14 March 2023. Only large patterns are real; longitudes the paper does not show are left blank.');
  const content = after('source/content/object.json'), control = content.datasets.controls.at(-1);
  assert.equal(content.datasets.defaultDataset, 'temperature', 'a measured map is a better dataset than a gray sphere');
  assert.equal(control.qualification, 'Published map · Valentine et al. (2024) · JWST MIRI 5 to 12 µm, one eclipse on 14 March 2023');
  assert.match(control.notes, /^Brightness temperature at 5 to 12 µm of TRAPPIST-1f, the map Valentine et al\. \(2024\) fitted to one eclipse on 14 March 2023 and released\. Only large patterns are real\. The hot spot sits 19° east of noon, 15° to 30° within the paper's uncertainty\. The paper shows the map from 110° west to 110° east; the rest was not facing the telescope and is left blank\./u);
  assert.deepEqual(after('text.json').datasets.temperature, { title: 'JWST MIRI map', detail: 'Measured temperature',
    summary: "Heat at 5 to 12 µm, from one eclipse on 14 March 2023. The hot spot is 19° east of noon; the far side is blank." });
  assert.throws(() => installPublishedMapDataset(files, id, 'TRAPPIST-1f', entryOf({ observed: 'the ingress and the egress of one eclipse observed on 14 March 2023' }), release, report),
    /trappist-1f, dataset temperature: the summary is 1\d\d characters, over the 125 a dataset summary may have; shorten the fields band or observed/u);
  // One input, the member of the release's ZIP, restored by the acquisition plan's own step and checked against the paper.
  const input = after('source/manifest.json').inputs.at(-1);
  assert.deepEqual([input.id, input.path, input.productId, input.version, input.license, input.consumers, input.sourceBinding.kind],
    ['trappist-1f-temperature-map', 'science/valentine-2024/tmap.pkl', 'ThERESA/tmap.pkl', '10.5281/zenodo.12571830', 'CC BY 4.0', ['trappist-1f-temperature-published-map'], 'catalogued']);
  assert.match(input.acquisition, /The member ThERESA\/tmap\.pkl of ThERESA\.zip \(4\.1 MB\), unchanged\. The hot-spot longitude the paper prints \(18\.7°, Section 4\.3 of https:\/\/arxiv\.org\/abs\/2410\.08148\) is the check/u);
  assert.deepEqual(after('source/preparation/acquisition.json').operations.at(-1),
    { kind: 'zip-member', groups: ['restore', 'refresh'], path: 'science/valentine-2024/tmap.pkl', url: 'https://zenodo.org/records/12571830/files/ThERESA.zip?download=1', member: 'ThERESA/tmap.pkl' });
  // Installed again, it replaces itself.
  const count = after('source/preparation/raster.json').surfaces.length;
  assert.equal(installPublishedMapDataset(files, id, 'TRAPPIST-1f', entry, release, report).promoted, false);
  assert.equal(after('source/preparation/raster.json').surfaces.length, count);
  assert.equal(after('source/manifest.json').inputs.filter((item: { id: string }) => item.id === 'trappist-1f-temperature-map').length, 1);
});
