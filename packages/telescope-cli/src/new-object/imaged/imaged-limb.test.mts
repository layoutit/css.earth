/** An imaged planet's limb law (imaged-limb.mts), offline: lines of the published table as the CDS serves them, and a small
 * package in memory with the documents a planet had while it was still a gray sphere. */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { PackageFiles } from '../dataset.mts';
import { CLARET_2012, claret2012Grid, documentImagedColor, imagedLimb, installImagedLimb } from './imaged-limb.mts';

// The four H-band nodes around 1,727 K and log g 3.59, with a flux-conservation row and a K-band row the reader must pass over.
const TABLE = [' 3.50  1700.  0.0  2.0   0.8063  -0.0477 H  L qs', ' 4.00  1700.  0.0  2.0   0.8337  -0.0830 H  L qs', ' 3.50  1800.  0.0  2.0   0.7296   0.0478 H  L qs',
  ' 4.00  1800.  0.0  2.0   0.7643   0.0021 H  L qs', ' 3.50  1700.  0.0  2.0   0.9000  -0.2000 H  F qs', ' 3.50  1700.  0.0  2.0   0.6000   0.1000 K  L qs', ' 3.50  1700.  0.0  2.0   0.6100   0.1100 H2 L qs'].join('\n');
const RECORD = { source: { citation: 'Someone et al. (2020)', url: 'https://example.org/paper' }, unit: 'µJy', bands: [{ band: 'MKO K', wavelengthMicrometres: 2.184, value: 879, error: 110 }, { band: 'H', wavelengthMicrometres: 1.635, value: 459.5, error: 160 }, { band: 'J', wavelengthMicrometres: 1.25, value: 813.7, error: 280 }],
  displayRangeSource: 'This planet alone, from zero to its brightest band (MKO K).' };
const o = 'src/objects/x-b', json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const scaffold = (): PackageFiles => new Map([
  [`${o}/README.md`, '# X b\n\n## Sources\n\n**Shape dataset.** A sphere of the model radius in the shared neutral gray ([ledger](investigations.json)).\n\n**Rotation.** None is measured.\n\n## Evidence\n\nNone.\n\n## Known problems\n\n- The radius is a model value.\n\n[Investigation ledger](investigations.json)\n'],
  [`${o}/NOTICE.md`, '# X b credits\n\nShape: a sphere of the model radius in the shared neutral gray; no image or color of the planet\'s surface exists.\n\nPlacement: its star.\n'],
  [`${o}/investigations.json`, json({ entries: [{ id: 'band-color', status: 'unresolved', subject: 'A false color', finding: 'No paper gives its NIRCam flux densities, so the planet is the shared neutral gray.', evidence: ['https://example.org/other'] }] })],
  [`${o}/source/preparation/raster.json`, json({ surfaces: [{ id: 'infrared', source: 'photometry/band-color.json', science: { kind: 'disc-integrated-band-color', qualification: 'Infrared false color of the whole disc. It glows with its own heat, so no lighting.' } }],
    emission: { metadata: { limbMaterial: { composition: 'transparent' } } } })],
  [`${o}/source/content/object.json`, json({ datasets: { controls: [{ id: 'infrared', qualification: 'False color from its measured flux. The disc itself is unresolved.', notes: 'Not a natural color; nobody has resolved its disc.' }] } })],
  [`${o}/source/manifest.json`, json({ inputs: [], generatedIntermediates: [{ id: 'dataset-color-context-marker', path: 'presentation/context.png', credit: 'The default dataset\'s color as a disc; rendered by the marker author', recipe: { generator: 'x', inputs: ['x-b-band-color'] } }] })]]);
const read = (files: PackageFiles, path: string) => JSON.parse(String(files.get(`${o}/${path}`))) as Record<string, any>;

test('the published table is read by its fixed columns, and only the H band\'s least-squares rows are kept', () => {
  const grid = claret2012Grid(TABLE);
  assert.deepEqual(grid.trimEnd().split('\n').slice(3), ['3.50\t1700.\t0.0\t2.0\t0.8063\t-0.0477\tH\tL\tqs', '4.00\t1700.\t0.0\t2.0\t0.8337\t-0.0830\tH\tL\tqs', '3.50\t1800.\t0.0\t2.0\t0.7296\t0.0478\tH\tL\tqs', '4.00\t1800.\t0.0\t2.0\t0.7643\t0.0021\tH\tL\tqs']);
  assert.throws(() => claret2012Grid('3.50 1700. 0.0 2.0 0.8063 -0.0477 H L qs'), /tableab\.dat holds no H-band rows: its layout has changed/u);
});

test('the law is read between the nodes around the planet, and a planet the grid does not reach gets none', () => {
  const grid = claret2012Grid(TABLE), { limb } = imagedLimb(grid, 1727, 3.59);
  assert.ok(limb);
  // Bilinear between the four nodes: 27% of the way in temperature, 18% in gravity.
  assert.ok(Math.abs(limb.u1 - 0.79087) < 1e-4 && Math.abs(limb.u2 + 0.02877) < 1e-4, `${limb.u1}, ${limb.u2}`);
  assert.equal(limb.text, grid);
  assert.match(limb.sentence, /^dimmed toward the limb by the quadratic law Claret, Hauschildt & Witte \(2012\), A&A 546, A14 compute from PHOENIX model atmospheres for the H band at 1,727 K and log g 3\.59 \(u1 0\.791, u2 -0\.029\): a model, not a measurement of this planet$/u);
  assert.deepEqual(limb.limbDarkening, { law: 'quadratic', path: CLARET_2012.file, grid: { teffK: 1727, logg: 3.59, models: { Filt: 'H', Met: 'L', Mod: 'qs' } }, columns: { teff: 'Teff', logg: 'logg', u1: 'a', u2: 'b' } });
  // A cooler planet is below the grid's coolest model: no law, and the reason names the planet's numbers.
  const cool = imagedLimb(grid, 1100, 3.9);
  assert.equal(cool.limb, undefined);
  assert.equal(cool.why, 'at 1,100 K it is outside the 1,700 to 1,800 K of the models Claret, Hauschildt & Witte (2012), A&A 546, A14 tabulate');
  assert.equal(imagedLimb(grid, 1727, 4.4).why, 'at log g 4.4 it is outside the log g 3.5 to 4 of the models Claret, Hauschildt & Witte (2012), A&A 546, A14 tabulate');
});

test('the law goes on the color dataset with its texts, nodes and manifest entry, and a rerun replaces it', () => {
  const files = scaffold(), limb = imagedLimb(claret2012Grid(TABLE), 1727, 3.59).limb!;
  installImagedLimb(files, 'x-b', limb);
  installImagedLimb(files, 'x-b', limb);
  const raster = read(files, 'source/preparation/raster.json'), control = read(files, 'source/content/object.json').datasets.controls[0], manifest = read(files, 'source/manifest.json');
  assert.deepEqual(raster.surfaces[0].science.limbDarkening, limb.limbDarkening);
  assert.equal(raster.surfaces[0].science.qualification, `Infrared false color of the whole disc. It glows with its own heat, so no lighting. The disc is ${limb.sentence}.`);
  assert.match(raster.emission.metadata.limbMaterial.composition, /^black alpha darkens the disc/u);
  assert.equal(control.qualification, 'False color from its measured flux. The disc itself is unresolved; darkening toward the edge from a model atmosphere.');
  assert.equal(control.notes.split('The darkening toward the edge is ').length, 2);
  assert.equal(files.get(`${o}/source/${CLARET_2012.file}`), limb.text);
  assert.deepEqual(manifest.inputs.map((input: { id: string; path: string; origin: string }) => [input.id, input.path, input.origin]), [['x-b-claret-2012-limb-darkening', CLARET_2012.file, CLARET_2012.table]]);
  assert.deepEqual([manifest.generatedIntermediates[0].credit, manifest.generatedIntermediates[0].recipe.inputs], ['The default dataset\'s color as a disc, dimmed toward the limb by its law; rendered by the marker author', ['x-b-band-color', 'x-b-claret-2012-limb-darkening']]);
  // A planet lit by its star, or with no infrared color, has no flat disc to darken.
  const lit = scaffold(), plain = read(lit, 'source/preparation/raster.json');
  delete plain.emission; lit.set(`${o}/source/preparation/raster.json`, json(plain));
  assert.throws(() => installImagedLimb(lit, 'x-b', limb), /x-b: it is lit by its star/u);
});

test('the documents of a planet that was a gray sphere are brought in line with its color and its limb', () => {
  const files = scaffold(), limb = { law: imagedLimb(claret2012Grid(TABLE), 1727, 3.59).limb!, gravity: 'Its temperature is the 1,727 K of its measurements record' };
  documentImagedColor(files, 'x-b', RECORD, 'photometry/band-color.json', limb);
  documentImagedColor(files, 'x-b', RECORD, 'photometry/band-color.json', limb);
  const readme = String(files.get(`${o}/README.md`)).split('\n'), notice = String(files.get(`${o}/NOTICE.md`)), ledger = read(files, 'investigations.json');
  assert.equal(readme.filter(line => line.startsWith('**Shape dataset.**')).length, 0);
  assert.deepEqual(readme.filter(line => /^\*\*(?:Infrared color dataset|Limb|Rotation)\.\*\*/u.test(line)).map(line => line.slice(0, 12)), ['**Infrared c', '**Limb.** Th', '**Rotation.*']);
  assert.match(readme.find(line => line.startsWith('**Infrared color dataset.**'))!, /red MKO K 2\.184 µm \(879 ± 110 µJy\), green H 1\.635 µm \(459\.5 ± 160 µJy\), blue J 1\.25 µm \(813\.7 ± 280 µJy\) \(Someone et al\. \(2020\); \[record\]\(source\/photometry\/band-color\.json\)\)\. Display range: this planet alone/u);
  assert.deepEqual(readme.slice(readme.indexOf('## Known problems') + 2, -2), ['- The radius is a model value.', '- **Model limb.** The limb darkening is a model atmosphere at the planet\'s temperature and gravity, in the middle band of its color, not a measurement of this planet.', '']);
  assert.equal(notice, '# X b credits\n\nShape: a sphere of the model radius; no image resolves the planet.\n\nPlacement: its star.\n\nColor: infrared false color from the flux densities of Someone et al. (2020) (MKO K 2.184 µm, H 1.635 µm, J 1.25 µm).\n\nLimb darkening: Claret, Hauschildt & Witte (2012), A&A 546, A14, CDS J/A+A/546/A14.\n');
  assert.deepEqual(ledger.entries.map((entry: { id: string; status: string }) => [entry.id, entry.status]), [['band-color', 'included'], ['limb-darkening', 'included']]);
  assert.equal(ledger.entries[0].finding, 'Shown in infrared false color from its measured flux in MKO K 2.184 µm, H 1.635 µm, J 1.25 µm (Someone et al. (2020)). No paper gives its NIRCam flux densities.');
  assert.deepEqual(ledger.entries[0].evidence, ['https://example.org/other', 'https://example.org/paper']);

  // A cooler planet gets its color documented and no limb; a color paragraph written by hand is kept.
  const cool = scaffold();
  cool.set(`${o}/README.md`, String(cool.get(`${o}/README.md`)).replace(/\*\*Shape dataset\.\*\*[^\n]*/u, '**NIRCam color dataset.** Written by hand.'));
  documentImagedColor(cool, 'x-b', RECORD, 'photometry/band-color.json', undefined);
  const kept = String(cool.get(`${o}/README.md`));
  assert.ok(kept.includes('**NIRCam color dataset.** Written by hand.') && !kept.includes('**Infrared color dataset.**') && !kept.includes('**Limb.**') && !kept.includes('Model limb'));
  assert.ok(!String(cool.get(`${o}/NOTICE.md`)).includes('Limb darkening'));
});
