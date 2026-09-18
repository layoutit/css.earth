import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { COMPARISON_BLOCK_BEGIN, COMPARISON_BLOCK_END, comparisonBlock, parseComparisonEvidence } from '../surface-observations/published-comparison.mts';
import { latitudeSpan, nightsText, noticeWithLens, readmeWithLens, withAnchoredLens } from './install.mts';
import { LENS_ID, SURVEY_LENS_SETTINGS, adamSimplification, surveyFigures } from './setup.mts';

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

test('the survey figure table names each Appendix B figure once, in the paper every survey body pins', async () => {
  const { paper, figures } = await surveyFigures();
  assert.equal(figures.length, 42);
  assert.equal(new Set(figures.map(figure => figure.number)).size, 42);
  assert.equal(new Set(figures.map(figure => figure.object)).size, 42);
  const pinned = (json(resolve(OBJECTS, 'iris/source/manifest.json')).inputs as { path: string; expectedBytes: number; expectedSha256: string }[]).find(input => input.path === 'reference/vernazza-2021.pdf');
  assert.deepEqual([pinned?.expectedBytes, pinned?.expectedSha256], [paper.bytes, paper.sha256]);
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
