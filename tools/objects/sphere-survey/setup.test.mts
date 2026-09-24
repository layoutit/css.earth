import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { COMPARISON_BLOCK_BEGIN, COMPARISON_BLOCK_END, comparisonBlock, parseComparisonEvidence } from '../surface-observations/published-comparison.mts';
import { latitudeSpan, nightsText, noticeWithLens, readmeWithLens, unusedWords, withAnchoredLens, withRefreshedLens } from './install.mts';
import { LENS_ID, SURVEY_LENS_SETTINGS, adamSimplification, leaveOutArguments, surveyFigures } from './setup.mts';
import { horizonsCommand } from '../sphere-horizons.mts';

const ROOT = resolve(import.meta.dirname, '../../..'), OBJECTS = resolve(ROOT, 'src/objects');
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

test('every survey lens in the repository uses the settings the setup tool writes', () => {
  let lenses = 0;
  for (const id of readdirSync(OBJECTS)) {
    const path = resolve(OBJECTS, id, 'source/preparation/terrestrial.json');
    if (!existsSync(resolve(OBJECTS, id, 'source/preparation/observer-cameras.json')) || !existsSync(path)) continue;
    const lens = (json(path).raster.surfaceObservations as Record<string, unknown>[]).find(entry => entry.id === LENS_ID);
    if (!lens) continue;
    for (const [key, value] of Object.entries(SURVEY_LENS_SETTINGS)) assert.deepEqual(lens[key], value, `${id}: ${key}`);
    lenses++;
  }
  assert.ok(lenses >= 7, `${lenses} survey lenses`);
});

test('the survey figure table names each Appendix B figure once; bodies cite the paper and keep no copy', async () => {
  const { paper, figures } = await surveyFigures();
  assert.equal(figures.length, 42);
  assert.equal(new Set(figures.map(figure => figure.number)).size, 42);
  assert.equal(new Set(figures.map(figure => figure.object)).size, 42);
  assert.ok(!(json(resolve(OBJECTS, 'iris/source/manifest.json')).inputs as { path: string }[]).some(input => input.path.endsWith('.pdf')));
});

test('the table\'s Table A.1 poles are the ones every survey-sourced package states, and each lens record that states one', async () => {
  // Two readings of one printed table: the survey table's poles and the retained extracts packages made from Table 1
  // and Table A.1. Every pole must agree to the digit; a latitude the table prints outside ±90° is kept as printed.
  const { paper, figures } = await surveyFigures(), byNumber = new Map(figures.map(figure => [figure.number, figure]));
  let compared = 0;
  for (const id of readdirSync(OBJECTS)) {
    const properties = resolve(OBJECTS, id, 'source/reference/model-properties.json'), body = resolve(ROOT, 'packages/astronomy/data/bodies', `${id}.json`);
    if (!existsSync(properties) || !existsSync(body) || json(properties).source !== paper.source) continue;
    const figure = byNumber.get(Number(horizonsCommand(json(body)).replace(/;$/u, '')));
    if (!figure) continue;
    assert.deepEqual(json(properties).poleEclipticJ2000Degrees, figure.pole, `${id}: Table A.1 pole`);
    compared++;
  }
  assert.ok(compared >= 25, `${compared} survey-sourced poles compared`);
  for (const id of readdirSync(OBJECTS)) {
    const record = resolve(OBJECTS, id, 'source/preparation/observer-cameras.json');
    if (!existsSync(record) || json(record).rotation.publishedPole === undefined) continue;
    const stated = json(record).rotation.publishedPole, figure = byNumber.get(Number(horizonsCommand(json(resolve(ROOT, 'packages/astronomy/data/bodies', `${id}.json`))).replace(/;$/u, '')));
    const expected = figure?.releasedModel ? [figure.releasedModel.source, figure.releasedModel.model, figure.releasedModel.pole] : [paper.source, 'Table A.1', figure?.pole];
    assert.deepEqual([stated.source, stated.table, stated.eclipticJ2000Degrees], expected, `${id}: the lens record's pole is Table A.1's, or the released model's where the table names one`);
  }
  assert.deepEqual(figures.find(figure => figure.name === 'Thisbe')?.pole, [350, 116], 'a pole printed past the pole is kept as printed; the setup folds it');
});

test('frames and whole apparitions are left out only by comma-separated lists', () => {
  assert.deepEqual(leaveOutArguments([]), { leaveOut: [], leaveOutApparitions: [] });
  assert.deepEqual(leaveOutArguments(['--leave-out=zimpol-20190803-042450']), { leaveOut: ['zimpol-20190803-042450'], leaveOutApparitions: [] });
  assert.deepEqual(leaveOutArguments(['--leave-out=a,b', '--leave-out-apparition=2017-05-20']), { leaveOut: ['a', 'b'], leaveOutApparitions: ['2017-05-20'] });
  assert.equal(leaveOutArguments(['--other']), null);
  assert.equal(leaveOutArguments(['--leave-out=a', '--leave-out=b']), null);
  assert.equal(leaveOutArguments(['--leave-out-apparition=May 2017']), null, 'an apparition is named by the date of its first night');
});

test('every shipped comparison\'s README section is its evidence, read', () => {
  let bodies = 0;
  for (const id of readdirSync(OBJECTS)) {
    const evidence = resolve(OBJECTS, id, 'evidence/published-comparison.json');
    if (!existsSync(evidence)) continue;
    const readme = readFileSync(resolve(OBJECTS, id, 'README.md'), 'utf8'), begin = readme.indexOf(COMPARISON_BLOCK_BEGIN), end = readme.indexOf(COMPARISON_BLOCK_END);
    assert.ok(begin >= 0 && end > begin, `${id}/README.md carries the comparison markers`);
    assert.equal(readme.slice(begin + COMPARISON_BLOCK_BEGIN.length, end).trim(), comparisonBlock(parseComparisonEvidence(json(evidence))), `${id}: run node tools/objects/published-comparison.mts ${id} --write`);
    bodies++;
  }
  assert.ok(bodies >= 2);
});

test('the install says nights, latitudes and credits the way the READMEs do', () => {
  assert.equal(nightsText(['2017-10-10']), '2017-10-10');
  assert.equal(nightsText(['2017-10-10', '2017-10-11']), '2017-10-10 and 2017-10-11');
  assert.equal(nightsText(['2018-11-28', '2018-12-14', '2019-01-09']), '3 nights from 2018-11-28 to 2019-01-09');
  assert.equal(latitudeSpan([26.2, 34.9]), '26° to 35° north');
  assert.equal(latitudeSpan([-64.3, -60.1]), '60° to 64° south');
  assert.equal(latitudeSpan([-10, 20]), '10° south to 20° north');
  assert.equal(latitudeSpan([-63.7, -63.6]), '64° south');
  const notice = noticeWithLens('# Hebe attribution\n\nCredit. This package does not attribute a photographic surface texture to NASA or ESO. The grid is ours.\n', 'B.5');
  assert.match(notice, /photograph panels of the article’s Figure B\.5 with outlines drawn over them/);
  assert.doesNotMatch(notice, /does not attribute a photographic/);
});

test('the install adds source rows, both generated blocks and the photograph\'s limits to a shape-only README', () => {
  const readme = ['# Body', '', '## Sources', '', '| Input | Selected source |', '| --- | --- |', '| Shape | [x](https://a) |', '', 'Prose.', '', '## Evidence', '', 'Mesh checks.', '',
    '## Known problems', '', 'Gray.', '', '[Investigation ledger](investigations.json) · [Credits](NOTICE.md)', '', '## Methods and source notes', ''].join('\n');
  const written = readmeWithLens(readme, { number: 6, name: 'Hebe', figure: 'B.5', lensFrames: 32, nights: ['2018-11-28', '2019-01-09'], order: 'latitude-first',
    source: 'https://doi.org/10.1051/0004-6361/202141781', spinRecordUrl: 'https://observations.lam.fr/astero/3Dshape/6_Hebe_param.txt', block: 'BLOCK', bodyName: 'Hebe', latitudes: [26, 35] });
  const lines = written.split('\n');
  assert.equal(lines[7], '| SPHERE photograph | [32 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 2018-11-28 and 2019-01-09](https://observations.lam.fr/astero/Data/6Hebe/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/6_Hebe_adam.obj) |');
  assert.ok(written.includes(`### SPHERE photograph\n\n${COMPARISON_BLOCK_BEGIN}\nBLOCK\n${COMPARISON_BLOCK_END}\n\n### Registration\n\n<!-- registration-report:begin -->\n<!-- registration-report:end -->\n\n### Shape\n\nMesh checks.`));
  assert.ok(written.includes('The frames see Hebe from 26° to 35° north, so surface the survey did not see keeps the missing-imagery grid.\n\n[Investigation ledger]'));
  assert.throws(() => readmeWithLens(written, { number: 6, name: 'Hebe', figure: 'B.5', lensFrames: 32, nights: ['2018-11-28'], order: 'latitude-first', source: '', spinRecordUrl: '', block: '', bodyName: 'Hebe', latitudes: [0, 0] }), /already carries/);
});

test('the install says why released frames stay out, and writes a rebuilt lens\'s rows and limits again', () => {
  assert.equal(unusedWords([{ from: '2017-10-08', to: '2017-11-03', frames: 30, cast: 30, sharedSamples: null }, { from: '2019-03-14', to: '2019-03-28', frames: 25, cast: 0, sharedSamples: 0 }], 128),
    '25 from the 2019-03-14 to 2019-03-28 apparition, which shares at most 0 display samples with a cast frame within the level fit\'s angle limit, fewer than the 128 it needs to place their level');
  assert.equal(unusedWords([{ from: '2018-12-22', to: '2019-01-27', frames: 100, cast: 96, sharedSamples: null }], 128), '4 thinned to the controlled-camera bound');
  const readme = ['# Body', '', '## Sources', '', '| Input | Selected source |', '| --- | --- |', '| Shape | [x](https://a) |', '', '## Evidence', '', '## Known problems', '', '[Investigation ledger](investigations.json)', ''].join('\n');
  const lens = { number: 216, name: 'Kleopatra', figure: 'B.37', nights: ['2017-07-14', '2017-08-22'], order: 'latitude-first', source: 'https://doi.org/x', spinRecordUrl: 'https://observations.lam.fr/astero/3Dshape/216_Kleopatra_param.txt', bodyName: 'Kleopatra' };
  const first = readmeWithLens(readme, { ...lens, lensFrames: 30, latitudes: [25.3, 31.7], block: 'BLOCK' });
  const rebuilt = withRefreshedLens(first, { ...lens, lensFrames: 55, nights: ['2017-07-14', '2018-12-10', '2019-01-14'], latitudes: [-36.6, 31.7], apparitions: 2 });
  assert.deepEqual(rebuilt.replaced, ['| SPHERE photograph | [', 'The SPHERE photograph is photographed illumination from the survey']);
  assert.ok(rebuilt.readme.includes('[55 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 3 nights from 2017-07-14 to 2019-01-14]'));
  assert.ok(rebuilt.readme.includes('with matched relative frame levels, each apparition placed through the surface it shares with another, averaged where frames overlap, each fading out toward its disc edge. It is not albedo or colour. The frames see Kleopatra from 37° south to 32° north'));
  assert.equal(rebuilt.readme.split('\n').length, first.split('\n').length, 'lines are replaced in place');
  assert.deepEqual(withRefreshedLens(rebuilt.readme, { ...lens, lensFrames: 55, nights: ['2017-07-14', '2018-12-10', '2019-01-14'], latitudes: [-36.6, 31.7], apparitions: 2 }).replaced, [], 'a second run changes nothing');
});

test('the install adds its lens to the anchor row of a body in place, once', () => {
  const table = '{\n "hebe": {\n  "claim": "Hebe retains Shape",\n  "lenses": [\n   "shape",\n   "elevation"\n  ],\n  "radiusM": 97500.0\n },\n "iris": {\n  "lenses": [\n   "shape"\n  ],\n  "radiusM": 99500.0\n }\n}\n';
  const once = withAnchoredLens(table, 'hebe', 'zimpol');
  assert.equal(once, table.replace('   "elevation"\n', '   "elevation",\n   "zimpol"\n'));
  assert.equal(withAnchoredLens(once, 'hebe', 'zimpol'), once);
  assert.equal(withAnchoredLens(table, 'juno', 'zimpol'), table, 'a body without a row is left alone');
  assert.ok(once.includes('"radiusM": 97500.0'), 'numbers keep their spelling');
});

test('the ADAM mesh keeps the primary error bound where it reaches the face target, and takes the next hundred metres otherwise', async () => {
  // A bumpy 100 km sphere of 2,592 triangles, in kilometres like the survey releases.
  const rows = 36, columns = 72, vertices: string[] = [], faces: string[] = [], index = (r: number, c: number) => 2 + (r - 1) * columns + (c % columns);
  const point = (latitude: number, longitude: number) => { const radius = 100 + 3 * Math.sin(3 * longitude) * Math.cos(2 * latitude);
    return `v ${radius * Math.cos(latitude) * Math.cos(longitude)} ${radius * Math.cos(latitude) * Math.sin(longitude)} ${radius * Math.sin(latitude)}`; };
  vertices.push(point(Math.PI / 2, 0), point(-Math.PI / 2, 0));
  for (let r = 1; r < rows; r++) for (let c = 0; c < columns; c++) vertices.push(point(Math.PI / 2 - r * Math.PI / rows, c * 2 * Math.PI / columns));
  for (let c = 0; c < columns; c++) { faces.push(`f 1 ${index(1, c)} ${index(1, c + 1)}`); faces.push(`f 2 ${index(rows - 1, c + 1)} ${index(rows - 1, c)}`); }
  for (let r = 1; r < rows - 1; r++) for (let c = 0; c < columns; c++) faces.push(`f ${index(r, c)} ${index(r + 1, c)} ${index(r + 1, c + 1)}`, `f ${index(r, c)} ${index(r + 1, c + 1)} ${index(r, c + 1)}`);
  const path = `${mkdtempSync(`${tmpdir()}/adam-`)}/body_adam.obj`;
  writeFileSync(path, [...vertices, ...faces].join('\n') + '\n');
  const counts = { vertices: vertices.length, faces: faces.length }, grid = { metersPerUnit: 1000, expectedVertices: 0, expectedFaces: 0 };
  const loose = await adamSimplification({ method: 'source-meshoptimizer', targetFaces: 800, maximumErrorMeters: 50_000, regularize: true }, path, grid, counts, 800, 230 / 100_000);
  assert.equal(loose.maximumErrorMeters, 50_000, 'a bound that already reaches the target stays');
  const tight = await adamSimplification({ method: 'source-meshoptimizer', targetFaces: 800, maximumErrorMeters: 10, regularize: true }, path, grid, counts, 800, 230 / 100_000);
  assert.ok(tight.maximumErrorMeters > 10 && tight.maximumErrorMeters % 100 === 0, `a tight bound becomes the next hundred metres: ${tight.maximumErrorMeters}`);
});
