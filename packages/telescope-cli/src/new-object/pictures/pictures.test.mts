import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { sourceTest } from '@cssearth/objects/node/source-test';
import type { Archive } from '../archives/archives.mts';
import { TODO } from '../scaffold.mts';
import { esaPictureAddress, parseEsaPage, skyTags, type EsaPage, type SkyTags } from './esa-image.mts';
import { colorsPhrase, parsePictures, pictureFiles } from './picture-bank.mts';
import { draftsFromEsa, runPictures } from './pictures.mts';
import { locateStar, registerPicture, taggedPixel } from './registration.mts';

const test = sourceTest();
const WEBB = 'https://esawebb.org/images/weic0000a/';
// The two layouts ESA's sites give a picture's page: Webb's names the shown color in a hidden span, Hubble's in the class alone.
const row = (band: string, wavelength: string, instrument: string) => `<tr><td>${band}</td><td>${wavelength}</td><td>\n  Some Space Telescope\n <br/><span class="band_instrument">${instrument}</span></td></tr>`;
const page = (title: string, credit: string, rows: string) => `<html><head><title>${title} | ESA/Webb</title><script>var Size = 'no';</script></head><body><strong>Credit:</strong>\n<div class="credit"><p>${credit}</p></div>
<table><tr><td>Release date:</td><td>21 August 2023, 16:00</td></tr><tr><td>Size:</td><td>40 x 30 px</td></tr></table>
<div class="object-info"><h3 id="c">Colours & filters</h3><table class="table"><tr><th>Band</th><th>Wavelength</th><th>Telescope</th></tr>${rows}</table></div></body></html>`;
const WEBB_PAGE = page('A nebula (MIRI image)', 'ESA/Webb, NASA, CSA, A. Person', row('<span class="band_Blue">\n Infrared\n <span class="visually-hidden"> (Blue)</span></span><br /><span class="band_instrument">PAH</span>', '7.7 &mu;m', 'MIRI') + row('<span class="band_Red"> Infrared <span class="visually-hidden"> (Red)</span></span>', '18 &mu;m', 'MIRI'));

test('a picture\'s page gives its title, credit, date, size and colors, on either site\'s markup', () => {
  const webb = parseEsaPage(WEBB, WEBB_PAGE);
  assert.deepEqual({ ...webb, colors: undefined }, { id: 'weic0000a', telescope: 'Webb', page: WEBB, download: 'https://cdn.esawebb.org/archives/images/large/weic0000a.jpg', rights: 'https://esawebb.org/copyright/',
    title: 'A nebula (MIRI image)', credit: 'ESA/Webb, NASA, CSA, A. Person', released: '21 August 2023', original: [40, 30], colors: undefined });
  assert.deepEqual(webb.colors, [{ band: 'Infrared', shown: 'Blue', line: 'PAH', wavelength: '7.7 µm', instrument: 'MIRI' }, { band: 'Infrared', shown: 'Red', wavelength: '18 µm', instrument: 'MIRI' }]);
  const hubble = parseEsaPage('https://esahubble.org/images/heic0000a', page('A nebula', '<span class="caps">NASA, ESA, and</span> A. O&rsquo;Person (A University).', row('<span class="band_Green">Optical</span><br /><span class="band_instrument">OIII</span>', '502 nm', 'WFC3')));
  assert.deepEqual([hubble.telescope, hubble.page, hubble.credit.startsWith('NASA, ESA, and A. O'), hubble.credit.endsWith('(A University)')], ['Hubble', 'https://esahubble.org/images/heic0000a/', true, true]);
  assert.deepEqual(hubble.colors, [{ band: 'Optical', shown: 'Green', line: 'OIII', wavelength: '502 nm', instrument: 'WFC3' }]);
  assert.equal(colorsPhrase(['7.7 µm', '12 µm', '18 µm']), '7.7, 12 and 18 µm');
  assert.equal(colorsPhrase(['502 nm', '1.6 µm']), '502 nm and 1.6 µm');
});

test('a page that lacks a field, or an address that is no picture\'s page, is refused by name', () => {
  assert.throws(() => esaPictureAddress('https://esawebb.org/news/weic2320/'), /not a picture's page/u);
  assert.throws(() => parseEsaPage(WEBB, WEBB_PAGE.replace('class="credit"', 'class="other"')), /weic0000a\/: the page has no credit/u);
  assert.throws(() => parseEsaPage(WEBB, WEBB_PAGE.replace('40 x 30 px', 'large')), /no "Size: W x H px"/u);
  assert.throws(() => parseEsaPage(WEBB, WEBB_PAGE.replace(/<h3[\s\S]*<\/div>/u, '</div>')), /no "Colours & filters" table/u);
});

// ESA/Webb weic2320c, the Ring Nebula in the mid infrared: the sky tags its JPEG carries.
const RING_TAGS: SkyTags = { scaleDeg: 0.000030865735733094474, rotationDeg: -132.91999999999948, reference: [283.39639957968876, 33.029010843598876], referencePixel: [628.5, 507.5] };
const list = (values: readonly number[]) => `<rdf:Seq>${values.map(value => `\n <rdf:li>${value}</rdf:li>`).join('')}\n</rdf:Seq>`;
const xmp = (tags: SkyTags, [width, height]: readonly [number, number]) => `<avm:Spatial.ReferenceValue>${list(tags.reference)}</avm:Spatial.ReferenceValue><avm:Spatial.ReferenceDimension>${list([width, height])}</avm:Spatial.ReferenceDimension>` +
  `<avm:Spatial.ReferencePixel>${list(tags.referencePixel)}</avm:Spatial.ReferencePixel><avm:Spatial.Scale>${list([-tags.scaleDeg, tags.scaleDeg])}</avm:Spatial.Scale><avm:Spatial.Rotation>${tags.rotationDeg}</avm:Spatial.Rotation>`;

test('a JPEG\'s sky tags are read for the file as it is, and a smaller copy takes its original\'s', () => {
  const bytes = Buffer.from(xmp(RING_TAGS, [1257, 1015]), 'latin1');
  assert.deepEqual(skyTags(bytes, 1257, 1015, 'ring.jpg'), RING_TAGS);
  const half = skyTags(Buffer.from(xmp(RING_TAGS, [2514, 2030]), 'latin1'), 1257, 1015, 'ring.jpg');
  assert.deepEqual([half.scaleDeg, half.referencePixel], [RING_TAGS.scaleDeg * 2, [314.25, 253.75]]);
  assert.deepEqual(skyTags(Buffer.from('<x avm:Spatial.ReferenceDimension="10 8" avm:Spatial.ReferencePixel="5 4" avm:Spatial.ReferenceValue="1 2" avm:Spatial.Scale="-0.5 0.5" avm:Spatial.Rotation="3"/>'), 10, 8, 'x.jpg'),
    { scaleDeg: 0.5, rotationDeg: 3, reference: [1, 2], referencePixel: [5, 4] });
  assert.throws(() => skyTags(bytes, 1257, 900, 'ring.jpg'), /ring\.jpg is 1257 x 900 px; its sky tags describe 1257 x 1015/u);
  assert.throws(() => skyTags(Buffer.from('no tags'), 10, 10, 'bare.jpg'), /bare\.jpg carries no avm:Spatial\.ReferenceDimension/u);
});

const RING = { centerRaDeg: 283.39624524513, centerDecDeg: 33.02914523473, distancePc: 790.014153719229 };

test('a picture is registered by its tags and one pixel: the Ring Nebula\'s mid-infrared recipe', () => {
  const made = registerPicture(RING_TAGS, [1257, 1015], [627.5, 513.5], RING);
  assert.deepEqual(made.observation, { centerRaDeg: 283.396433, centerDecDeg: 33.0290199, fieldOfViewDeg: [0.03879823, 0.03132872], northClockwiseDeg: 132.92 });
  assert.deepEqual(made.plane, { inclinationDeg: 0.001, lineOfNodesPaDeg: 218.521, thicknessKpc: 2.67e-7, supportRadiusKpc: 0.00021295, supportTaperFraction: 0.9 });
  // The tags' own pixel for the star's place is within half a pixel of the star the picture shows; and the reference pixel is its own place.
  const tagged = taggedPixel(RING_TAGS, 1015, RING);
  assert.ok(Math.hypot(tagged[0] - 627.5, tagged[1] - 513.5) < 0.5, tagged.join(', '));
  assert.deepEqual(taggedPixel(RING_TAGS, 1015, { centerRaDeg: RING_TAGS.reference[0], centerDecDeg: RING_TAGS.reference[1] }), [627.5, 507.5]);
  assert.throws(() => registerPicture(RING_TAGS, [1257, 1015], [1300.2, 400], RING), /The picture, 1257 x 1015 px, does not hold the place it is to stand at: pixel 1300\.2, 400\.0/u);
});

/** A dark picture with one soft source: `peak` levels at its middle, and every pixel within `core` pixels of it saturated. */
function sourceAt(width: number, height: number, [x, y]: readonly [number, number], peak: number, core = 0) {
  const rgb = new Uint8Array(3 * width * height).fill(20);
  for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) { const from = Math.hypot(px - x, py - y), level = from <= core ? 255 : Math.min(255, 20 + peak * Math.exp(-from * from / 8)); rgb.fill(Math.round(level), 3 * (py * width + px), 3 * (py * width + px) + 3); }
  return rgb;
}

test('the star a picture shows is its saturated patch, or else its strongest peak, near where the tags put it', () => {
  const patch = locateStar(sourceAt(80, 60, [41, 29], 200, 3), 80, 60, 0.1, [38, 27]);
  assert.deepEqual(patch?.pixel, [41, 29]); assert.match(patch!.found, /largest patch of saturated pixels within 1 arcsec of where the tags put it, 29 px/u);
  const peak = locateStar(sourceAt(80, 60, [41.3, 29.6], 120), 80, 60, 0.1, [38, 27]);
  assert.ok(peak && Math.hypot(peak.pixel[0] - 41.3, peak.pixel[1] - 29.6) < 0.2, String(peak?.pixel)); assert.match(peak.found, /peak within 3 arcsec of where the tags put it/u);
  assert.equal(locateStar(new Uint8Array(3 * 80 * 60).fill(20), 80, 60, 0.1, [38, 27]), undefined);
  // A saturated star farther than an arcsecond from the place is another star.
  assert.equal(locateStar(sourceAt(80, 60, [70, 50], 200, 3), 80, 60, 0.02, [20, 20]), undefined);
});

const ENTRY = { host: 'm57', image: 'https://esawebb.org/images/weic2320c/', bank: 'm57-miri-layers', like: 'm57-layers', dataset: { id: 'mid-infrared', label: 'Webb · mid infrared', title: 'A title', summary: 'A summary.', description: 'A description.' } };

test('a spec entry a draft left unfinished, or one with a wrong id, is refused by its field', () => {
  assert.equal(parsePictures({ pictures: [ENTRY] })[0]!.bank, 'm57-miri-layers');
  assert.throws(() => parsePictures({ pictures: [{ ...ENTRY, dataset: { ...ENTRY.dataset, summary: `${TODO}: one sentence` } }] }), /pictures\[0\]\.dataset\.summary is still to write/u);
  assert.throws(() => parsePictures({ pictures: [{ ...ENTRY, geometry: { shape: { basis: `${TODO}: why` } } }] }), /pictures\[0\]\.geometry\.shape\.basis is still to write/u);
  assert.throws(() => parsePictures({ pictures: [{ ...ENTRY, bank: 'M57 layers' }] }), /pictures\[0\]\.bank "M57 layers" is not an object id/u);
  assert.throws(() => parsePictures({ pictures: [{ ...ENTRY, star: [1] }] }), /pictures\[0\]\.star must be two numbers/u);
  assert.throws(() => parsePictures({ pictures: [ENTRY, ENTRY] }), /Picture banks repeat: m57-miri-layers/u);
});

test('the generator makes the recipe and manifest the Ring Nebula\'s mid-infrared bank ships, from what differs from the Hubble bank', async () => {
  const json = async (path: string) => JSON.parse(await readFile(new URL(`../../../../../${path}`, import.meta.url), 'utf8')) as Record<string, any>;
  const at = 'src/objects/m57-miri-layers', shipped = await json(`${at}/source/recipe.json`), like = { recipe: await json('src/objects/m57-layers/source/recipe.json'), manifest: await json('src/objects/m57-layers/source/manifest.json'),
    presentation: await json('src/objects/m57-layers/source/presentation.json'), provenance: await json('src/objects/m57-layers/source/provenance.json') };
  // The entry says what this picture's colors take on the Hubble dataset's shell: the shell's source and reasoning, and the ring's and the lobe's speeds.
  const [entry] = parsePictures({ pictures: [{ ...ENTRY, star: [627.5, 513.5], facePixels: 1257, geometry: { shape: { basis: shipped.geometry.shape.basis, ring: { expansionKmS: shipped.geometry.shape.ring.expansionKmS }, lobe: { expansionKmS: shipped.geometry.shape.lobe.expansionKmS } } } }] });
  const ring: EsaPage = { ...esaPictureAddress(ENTRY.image), title: 'Webb captures detailed beauty of Ring Nebula (MIRI image)', credit: 'ESA/Webb, NASA, CSA, M. Barlow, N. Cox, R. Wesson', released: '21 August 2023', original: [1257, 1015],
    colors: [{ band: 'Infrared', shown: 'Blue', wavelength: '7.7 µm', instrument: 'MIRI' }] };
  const made = pictureFiles(entry!, { page: ring, tags: RING_TAGS, dimensions: [1257, 1015], tagged: taggedPixel(RING_TAGS, 1015, RING), like, host: { content: await json('src/objects/m57/source/content/object.json'), text: await json('src/objects/m57/text.json') }, checked: '2026-10-04' });
  const file = (path: string) => JSON.parse(String(made.files.get(path))) as Record<string, any>;
  assert.deepEqual(file(`${at}/source/recipe.json`), shipped);
  assert.deepEqual(file(`${at}/source/manifest.json`), await json(`${at}/source/manifest.json`));
  assert.deepEqual(file('src/objects/m57/source/content/object.json'), await json('src/objects/m57/source/content/object.json'));
  assert.deepEqual(made.carried, []);
});

/** A checkout holding one page and the layer bank it shows, and an archive that serves one picture's page and JPEG. */
async function checkout() {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-pictures-')), put = async (path: string, value: unknown) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`); };
  const like = 'src/objects/nebula-layers';
  await put(`${like}/source/recipe.json`, { schema: 'cssearth-image-layer-recipe@1', id: 'nebula-layers', source: { path: 'starless.jpg' }, observation: {}, target: { centerRaDeg: 10, centerDecDeg: 20, distancePc: 1000 },
    geometry: { kind: 'inclined-disk', inclinationDeg: 1, unit: 'pc', shape: { source: 'publication-a', basis: 'The Hubble basis.', ring: { semiMajorArcsec: 1, expansionKmS: [1, 2, 3] }, old: true } }, bake: { maxFacePixels: 1024, flat: true }, provenance: { path: 'provenance.json' } });
  await put(`${like}/source/manifest.json`, { schema: 'cssearth-volume-source-manifest@2', pathBase: 'repository', inputs: [{ id: 'optical', path: `${like}/source/starless.jpg`, generator: 'a script' }, { id: 'speeds', path: `${like}/source/speeds.dat`, origin: 'https://example.test/speeds.dat' }],
    documents: [{ id: 'recipe', path: `${like}/source/recipe.json` }], generatedIntermediates: [] });
  await put(`${like}/source/presentation.json`, { schema: 'cssearth-volume-presentation-source@2', objectId: 'nebula-layers', name: 'A Nebula', datasets: [{ id: 'optical' }] });
  await put(`${like}/source/provenance.json`, { displayModel: 'On the shell\'s two walls.' });
  await put(`${like}/source/speeds.dat`, '1 2 3\n');
  await put('.gitignore', `node_modules\n${like}/source/speeds.dat\noutput\n`);
  await put('src/objects/nebula/source/content/object.json', { datasets: { defaultDataset: 'optical', controls: [{ id: 'optical', volume: { objectId: 'nebula-layers', datasetId: 'optical', surface: 'optical' } }] } });
  await put('src/objects/nebula/text.json', { datasets: { optical: { title: 'Hubble' } } });
  await put('src/sources/publication-a.json', { id: 'publication-a' });
  // 0.36 arcsec a pixel, north up, the tags' reference at the page's place: a saturated star stands 2.5 px right of where they put it.
  const tags: SkyTags = { scaleDeg: 0.0001, rotationDeg: 0, reference: [10, 20], referencePixel: [20.5, 15.5] };
  const jpeg = Buffer.concat([await sharp(Buffer.from(sourceAt(40, 30, [22, 15], 200, 1.5)), { raw: { width: 40, height: 30, channels: 3 } }).jpeg({ quality: 100, chromaSubsampling: '4:4:4' }).toBuffer(), Buffer.from(xmp(tags, [40, 30]), 'latin1')]);
  const asked: string[] = [], archive: Archive = { text: async url => { asked.push(url); if (url !== WEBB) throw new Error(`no ${url}`); return WEBB_PAGE; }, bytes: async url => { asked.push(url); return jpeg; }, exists: async () => true };
  return { root, archive, asked, context: { root, archive, progress: () => {} }, read: async (path: string) => readFile(join(root, path), 'utf8'), json: async (path: string) => JSON.parse(await readFile(join(root, path), 'utf8')) as Record<string, any>, put };
}

test('a draft names the page\'s bank and the star, a run writes the bank and the page\'s dataset, and a second run keeps what a person wrote', async () => {
  const { root, context, asked, read, json, put } = await checkout();
  try {
    const draft = await draftsFromEsa([`nebula=${WEBB}`, 'nowhere'], context), [drafted] = draft.pictures as Record<string, any>[];
    assert.deepEqual({ ...drafted, dataset: { ...drafted!.dataset, title: '', summary: '', description: '' } }, { host: 'nebula', image: WEBB, bank: 'nebula-miri-layers', like: 'nebula-layers',
      dataset: { id: 'mid-infrared', label: 'Webb · mid infrared', title: '', summary: '', description: '' }, colors: ['7.7 µm', '18 µm'], star: [22, 15], starFound: 'the largest patch of saturated pixels within 1 arcsec of where the tags put it, 9 px', geometry: {}, sources: [], ledger: [] });
    assert.match(draft.report[0]!, /weic0000a on nebula, like nebula-layers: A nebula \(MIRI image\); 40 x 30 px, MIRI at 7\.7 and 18 µm\. The star: the largest patch of saturated pixels within 1 arcsec of where the tags put it, 9 px, at 22\.0, 15\.0, 0\.92 arcsec from where the tags put the page's place/u);
    assert.match(draft.report[1]!, /nowhere: not drafted: nowhere: name a page and its picture as HOST=/u);
    await put('spec.json', draft);
    await assert.rejects(runPictures(join(root, 'spec.json'), context), /pictures\[0\]\.dataset\.title is still to write/u);
    // A person writes the sentences and what this picture's light takes on the like bank's walls.
    const entry = { ...drafted, dataset: { ...drafted!.dataset, title: 'A Nebula in the mid infrared', summary: 'One sentence.', description: 'What it shows.' }, geometry: { shape: { basis: 'The mid-infrared basis.', ring: { expansionKmS: [4, 5, 6] }, old: null } },
      sources: [{ catalogueId: 'publication-a', url: 'https://example.test/a', label: 'A et al. (2020)', locator: 'Sect. 2', checked: '2026-01-02' }], ledger: [{ id: 'speeds', subject: 'Speeds', status: 'included', finding: 'Chosen.', evidence: ['https://example.test/a'] }] };
    await put('spec.json', { pictures: [entry] });
    const [first] = await runPictures(join(root, 'spec.json'), context), at = 'src/objects/nebula-miri-layers';
    assert.deepEqual({ ...first, files: 0 }, { id: 'nebula-miri-layers', host: 'nebula', dataset: 'mid-infrared', files: 0, todo: [`write ${at}/README.md`, 'name the nebula-miri-layers bank in src/objects/nebula/README.md'] });
    assert.equal(asked.filter(url => url.endsWith('.jpg')).length, 1, 'the picture is read once, for the draft');
    const recipe = await json(`${at}/source/recipe.json`);
    assert.deepEqual(recipe.source, { path: 'source.jpg', dimensions: [40, 30], originalDimensions: [40, 30], publisherUrl: WEBB, downloadUrl: 'https://cdn.esawebb.org/archives/images/large/weic0000a.jpg', credit: 'ESA/Webb, NASA, CSA, A. Person', license: 'CC-BY-4.0' });
    assert.deepEqual(recipe.geometry.shape, { source: 'publication-a', basis: 'The mid-infrared basis.', ring: { semiMajorArcsec: 1, expansionKmS: [4, 5, 6] } });
    assert.deepEqual([recipe.id, recipe.target.distancePc, recipe.bake, recipe.observation.northClockwiseDeg, recipe.geometry.kind], ['nebula-miri-layers', 1000, { maxFacePixels: 40, flat: true }, 0, 'inclined-disk']);
    // The star, 2.5 px right of the frame's middle and half a pixel below it, stands at the page's place: with north up and east to the left, the frame's centre is that far east and north of it.
    assert.ok(Math.abs(recipe.observation.centerRaDeg - (10 + 2.5 * 0.0001 / Math.cos(20 * Math.PI / 180))) < 2e-7 && Math.abs(recipe.observation.centerDecDeg - (20 + 0.5 * 0.0001)) < 2e-7, JSON.stringify(recipe.observation));
    const manifest = await json(`${at}/source/manifest.json`);
    assert.deepEqual(manifest.inputs.map((input: { path: string }) => input.path), [`${at}/source/source.jpg`, `${at}/source/speeds.dat`]);
    assert.deepEqual([manifest.inputs[0].sourceBinding.references[0].catalogueId, manifest.inputs[0].capture.attributions[0].facilityId, manifest.documents[0].path], ['esawebb-weic0000a', 'webb', `${at}/source/recipe.json`]);
    assert.equal(await read(`${at}/source/speeds.dat`), '1 2 3\n');
    assert.deepEqual((await read('.gitignore')).split('\n').slice(1, 4), ['src/objects/nebula-layers/source/speeds.dat', `# The same file beside the nebula-miri-layers bank; restored from the same origin (${at}/source/manifest.json).`, `${at}/source/speeds.dat`]);
    assert.deepEqual((await json(`${at}/object.json`)).properties, { preparation: { source: 'source/recipe.json' }, host: 'nebula' });
    const presentation = await json(`${at}/source/presentation.json`);
    assert.deepEqual([presentation.objectId, presentation.name, presentation.datasets[0].id, presentation.datasets[0].label, presentation.datasets[0].facts[0].value], ['nebula-miri-layers', 'A Nebula', 'optical', 'Webb · mid infrared', '7.7 and 18 µm']);
    const provenance = await json(`${at}/source/provenance.json`);
    assert.equal(provenance.displayModel, 'On the shell\'s two walls.');
    assert.match(provenance.registration.method, /the star in the picture, the largest patch of saturated pixels within 1 arcsec of where the tags put it, 9 px, pixel 22, 15, is set at the recipe's target, so the frame's centre is [\d.]+°, [\d.]+°\. The tags alone put the star 0\.92 arcsec from where the picture shows it\./u);
    assert.deepEqual((await json(`${at}/investigations.json`)).entries.map((one: { id: string }) => one.id), ['weic0000a', 'speeds']);
    assert.equal((await json('src/sources/esawebb-weic0000a.json')).statements[0].text, 'ESA/Webb, NASA, CSA, A. Person');
    const page = (await json('src/objects/nebula/source/content/object.json')).datasets.controls;
    assert.deepEqual(page[1], { id: 'mid-infrared', label: 'Webb · mid infrared', thumbnail: 'nebula-dataset-mid-infrared.webp', volume: { objectId: 'nebula-miri-layers', datasetId: 'optical', surface: 'mid-infrared' },
      source: { id: 'nebula-miri-layers-optical', path: '../../nebula-miri-layers/source/manifest.json', url: WEBB }, falseColor: true });
    const text = (await json('src/objects/nebula/text.json')).datasets;
    assert.deepEqual([Object.keys(text), text['mid-infrared'].title, text['mid-infrared'].sources.map((source: { catalogueId: string }) => source.catalogueId)], [['optical', 'mid-infrared'], 'A Nebula in the mid infrared', ['esawebb-weic0000a', 'publication-a']]);
    assert.deepEqual([text['mid-infrared'].sources[0].checked, text['mid-infrared'].sources[1].checked], [new Date().toISOString().slice(0, 10), '2026-01-02']);
    const readme = await read(`${at}/README.md`);
    assert.ok(readme.startsWith('# A Nebula, Webb · mid infrared\n') && readme.includes(TODO) && readme.includes('| [A et al. (2020)](https://example.test/a) | [Record](../../sources/publication-a.json). Sect. 2 |'), readme);
    // Run again with a value changed: the records follow the spec, the README a person wrote stays, and the page holds one such dataset.
    await put(`${at}/README.md`, '# Written by a person\n'); await put('src/objects/nebula/README.md', 'Its datasets show [one](../nebula-layers/README.md) and [another](../nebula-miri-layers/README.md).\n'); await put('spec.json', { pictures: [{ ...entry, facePixels: 32 }] });
    const dated = await json('src/objects/nebula/text.json'); dated.datasets['mid-infrared'].sources[0].checked = '2026-01-01'; await put('src/objects/nebula/text.json', dated);
    const [second] = await runPictures(join(root, 'spec.json'), context);
    assert.deepEqual([second!.todo, (await json(`${at}/source/recipe.json`)).bake.maxFacePixels, await read(`${at}/README.md`), (await json('src/objects/nebula/source/content/object.json')).datasets.controls.length, (await read('.gitignore')).split('\n').length],
      [[], 32, '# Written by a person\n', 2, 6]);
    assert.equal((await json('src/objects/nebula/text.json')).datasets['mid-infrared'].sources[0].checked, '2026-01-01', 'a source cited in the same words keeps the day it was read');
    // A bank that shows another picture is never rewritten; a source with no record and no paper link is refused by its path.
    await put(`${at}/source/recipe.json`, { ...recipe, source: { ...recipe.source, publisherUrl: 'https://esawebb.org/images/other/' } });
    assert.match((await runPictures(join(root, 'spec.json'), context))[0]!.failed!, /src\/objects\/nebula-miri-layers already exists and shows another picture/u);
    await put('spec.json', { pictures: [{ ...entry, bank: 'nebula-other-layers', sources: [{ catalogueId: 'publication-b', url: 'https://example.test/b', label: 'B', locator: 'p. 1' }] }] });
    assert.match((await runPictures(join(root, 'spec.json'), context))[0]!.failed!, /nebula-other-layers: src\/sources\/publication-b\.json does not exist, and https:\/\/example\.test\/b is not an arXiv or DOI link/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
