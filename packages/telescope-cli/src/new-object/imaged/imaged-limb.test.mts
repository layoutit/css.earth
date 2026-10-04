/** An imaged planet's limb law (imaged-limb.mts), offline: lines of the published table as the CDS serves them, and a small
 * package in memory with the documents a planet had while it was still a gray sphere. */
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { diamondbackGrid, diamondbackNodes, picasoInstalled, picasoLimbNodes, picasoPassband, picasoToolchainSync, WORKSPACE } from '@cssearth/telescope/node';
import type { PackageFiles } from '../dataset.mts';
import { exoRem } from '../picaso-limb.mts';
import { ATMOSPHERE_FIT, CLARET_2012, claret2012Grid, claretBand, documentImagedColor, fittedImagedLimb, imagedLimb, installImagedLimb, parseAtmosphereFit, type ImagedLimb } from './imaged-limb.mts';

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
  // The band read is the one that holds the middle band of the planet's color; a color in other bands has none.
  assert.deepEqual(['MKO H', '2MASS H', 'SPHERE H3', 'SPHERE K1', '2MASS Ks', 'MKO K', 'MKO J', 'F430M', 'NACO L′'].map(claretBand), ['H', 'H', 'H', 'K', 'K', 'K', 'J', undefined, undefined]);
  assert.deepEqual(claret2012Grid(TABLE, 'K').trimEnd().split('\n').slice(3), ['3.50\t1700.\t0.0\t2.0\t0.6000\t0.1000\tK\tL\tqs']);
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
  // A law computed from a paper's fitted model (the toolchain's route) takes the table's place: one law, one node file, and the
  // fit's record beside it.
  const computed: ImagedLimb = { ...limb, file: 'photometry/picaso-diamondback-h-quadratic.tsv', limbDarkening: { ...limb.limbDarkening, path: 'photometry/picaso-diamondback-h-quadratic.tsv' },
    input: { id: 'x-b-picaso-diamondback-limb-darkening', path: 'photometry/picaso-diamondback-h-quadratic.tsv', origin: 'https://doi.org/10.5281/zenodo.12735103', sourceBinding: { kind: 'local', reason: 'Computed.' } },
    fit: { id: 'x-b-atmosphere-fit', path: ATMOSPHERE_FIT.path, sourceBinding: { kind: 'local', reason: 'Transcribed.' } } };
  installImagedLimb(files, 'x-b', computed);
  installImagedLimb(files, 'x-b', computed);
  const recomputed = read(files, 'source/manifest.json');
  assert.deepEqual(recomputed.inputs.map((input: { id: string }) => input.id), ['x-b-picaso-diamondback-limb-darkening', 'x-b-atmosphere-fit']);
  assert.deepEqual(recomputed.generatedIntermediates[0].recipe.inputs, ['x-b-band-color', 'x-b-picaso-diamondback-limb-darkening']);
  assert.equal(read(files, 'source/preparation/raster.json').surfaces[0].science.limbDarkening.path, 'photometry/picaso-diamondback-h-quadratic.tsv');
  // The fit is a transcription with its source, of the one grid a law is computed from; a color whose middle band has no filter
  // named here gets no computed law, and the toolchain is not asked.
  const fit = parseAtmosphereFit({ schema: ATMOSPHERE_FIT.schema, grid: 'sonora-diamondback', teffK: 1100, logg: 3.5, metallicity: 0.5, fsed: 2, source: { citation: 'Someone et al. (2024)', url: 'https://example.org/fit', locator: 'Table 9' } }, 'x-b fit');
  assert.deepEqual([fit.teffK, fit.logg, fit.metallicity, fit.fsed], [1100, 3.5, 0.5, 2]);
  assert.throws(() => parseAtmosphereFit({ schema: ATMOSPHERE_FIT.schema, grid: 'atmo', teffK: 1100, logg: 3.5, metallicity: 0.5, fsed: 2, source: fit.source }, 'x-b fit'), /x-b fit: grid is atmo; a law is computed from sonora-diamondback or sonora-elf-owl or exo-rem models only/u);
  // An Exo-REM fit states its C/O; its law is read from the grid's models of the nearest composition, and a fit outside the grid is refused.
  const cloudy = parseAtmosphereFit({ schema: ATMOSPHERE_FIT.schema, grid: 'exo-rem', teffK: 845, logg: 3.89, metallicity: 0.69, co: 0.57, source: fit.source }, 'x-b fit');
  assert.deepEqual([cloudy.co, cloudy.logKzz, cloudy.fsed], [0.57, undefined, undefined]);
  assert.equal(exoRem(cloudy.metallicity, cloudy.co!).name, 'Exo-REM cloudy (Charnay et al. 2018, ApJ 854, 172; 3.16 times solar metallicity, C/O 0.55)');
  assert.equal(exoRem(0.01, 0.61).name, 'Exo-REM cloudy (Charnay et al. 2018, ApJ 854, 172; 1 times solar metallicity, C/O 0.60)');
  assert.throws(() => exoRem(2.5, 0.55), /\[M\/H\] 2\.5 is outside the -0\.5 to 2 of Exo-REM's public grid/u);
  assert.throws(() => exoRem(0, 0.9), /C\/O 0\.9 is outside the 0\.1 to 0\.8 of Exo-REM's public grid/u);
  assert.deepEqual(fittedImagedLimb('x-b', fit, 'L′'), { why: 'no law is computed in L′, the middle band of its color' });
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
  documentImagedColor(cool, 'x-b', RECORD, 'photometry/band-color.json', undefined, 'at 800 K it is outside the table');
  const kept = String(cool.get(`${o}/README.md`));
  assert.ok(kept.includes('**NIRCam color dataset.** Written by hand.') && !kept.includes('**Infrared color dataset.**') && !kept.includes('Model limb'));
  assert.ok(kept.includes('**Limb.** No limb darkening is drawn: at 800 K it is outside the table.\n\n**Rotation.**'));
  assert.ok(!String(cool.get(`${o}/NOTICE.md`)).includes('Limb darkening'));
  // A reason recorded in the ledger, with the papers checked, is the one the README gives, and a rerun keeps it.
  const reasoned = read(cool, 'investigations.json');
  reasoned.entries.push({ id: 'limb-darkening', subject: 'Limb darkening', status: 'unresolved', finding: 'No limb darkening is drawn: its published fits are of a cloudy model whose clouds are not released.', evidence: ['https://example.org/fit'] });
  cool.set(`${o}/investigations.json`, json(reasoned));
  documentImagedColor(cool, 'x-b', RECORD, 'photometry/band-color.json', undefined, 'at 800 K it is outside the table');
  documentImagedColor(cool, 'x-b', RECORD, 'photometry/band-color.json', undefined, 'at 800 K it is outside the table');
  assert.ok(String(cool.get(`${o}/README.md`)).includes('**Limb.** No limb darkening is drawn: its published fits are of a cloudy model whose clouds are not released.\n'));
  assert.equal(read(cool, 'investigations.json').entries.filter((entry: { id: string }) => entry.id === 'limb-darkening').length, 1);
});

// The check that PICASO reads the cloudy release as its authors' own code did: the release publishes synthetic photometry of every
// model (Zenodo 10.5281/zenodo.12735103, photometry/m+0.5_synthetic_photometry_hybrid-grav.dat: MKO J, H, K of 1,100 K, 31.6 m/s^2,
// [M/H] +0.5 are 15.2538, 13.6880, 12.3410 at f_sed 1 and 14.3606, 13.1606, 12.1867 at f_sed 2). Thinning the clouds from f_sed 1
// to 2 makes J-H bluer by 0.366 mag and H-K by 0.373; a difference of colors between two models needs no zero point. It runs where
// the PICASO toolchain is installed.
test('PICASO on the Diamondback release reproduces how its published colors change with the clouds', { skip: picasoInstalled() ? false : 'the PICASO toolchain is not installed (astronomy-toolchains.mts picaso install)' }, () => {
  const flux = (fsed: number, svo: string) => {
    const node = diamondbackNodes(0.5, fsed).find(entry => entry.teffK === 1100 && entry.logg === 3.5)!, prepared = diamondbackGrid(0.5, [node]);
    const [law] = picasoLimbNodes(prepared.nodes, 8, picasoToolchainSync(), picasoPassband(svo), prepared.grid).nodes;
    return law!.centre * (1 - law!.u1 / 3 - law!.u2 / 6);
  };
  const color = (fsed: number, blue: string, red: string) => -2.5 * Math.log10(flux(fsed, blue) / flux(fsed, red));
  const jh = color(1, 'MKO/NSFCam.J', 'MKO/NSFCam.H') - color(2, 'MKO/NSFCam.J', 'MKO/NSFCam.H'), hk = color(1, 'MKO/NSFCam.H', 'MKO/NSFCam.K') - color(2, 'MKO/NSFCam.H', 'MKO/NSFCam.K');
  assert.ok(Math.abs(jh - 0.366) < 0.05, `J-H changes by ${jh.toFixed(3)} mag, published 0.366`);
  assert.ok(Math.abs(hk - 0.373) < 0.05, `H-K changes by ${hk.toFixed(3)} mag, published 0.373`);
});

// A law computed from a release file (Sonora Elf Owl) carries its own check: the file holds the spectrum its authors computed,
// and each node records the band flux computed here over theirs.
test("Epsilon Indi Ab's nodes record that the Elf Owl release's own flux was reproduced within 5%", async () => {
  const nodes = await readFile(resolve(WORKSPACE, 'src/objects/eps-indi-ab/source/photometry/picaso-elf-owl-f1065c-quadratic.tsv'), 'utf8');
  const ratios = [...nodes.matchAll(/band flux ([\d.]+) of the release's own spectrum/gu)].map(match => Number(match[1]));
  assert.equal(ratios.length, 4);
  assert.ok(ratios.every(ratio => Math.abs(ratio - 1) < 0.05), ratios.join(', '));
});

// A law computed from an Exo-REM grid model carries the same check, and it is what told the two solvers apart: across a thick
// cloud PICASO's two-stream flux fell to 60% of the release's, and four-term spherical harmonics stay within the bounds here.
test('every Exo-REM law records, for each model it is read between, the share of the release\'s band flux PICASO finds', async () => {
  const objects = resolve(WORKSPACE, 'src/objects'), files: string[] = [];
  for (const id of await readdir(objects)) for (const file of await readdir(resolve(objects, id, 'source/photometry')).catch(() => [])) if (/^picaso-exo-rem-.*-quadratic\.tsv$/u.test(file)) files.push(resolve(objects, id, 'source/photometry', file));
  assert.ok(files.length > 0);
  for (const file of files) {
    const nodes = await readFile(file, 'utf8'), ratios = [...nodes.matchAll(/band flux ([\d.]+) of the release's own spectrum/gu)].map(match => Number(match[1]));
    assert.match(nodes, /^# solved with four-term spherical harmonics/mu, file);
    assert.equal(ratios.length, nodes.split('\n').filter(line => /^\d/u.test(line)).length, file);
    assert.ok(ratios.every(ratio => ratio > 0.8 && ratio < 1.3), `${file}: ${ratios.join(', ')}`);
  }
});
