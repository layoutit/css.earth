/** `--star-limb` on a star that already has a law: the new law replaces the earlier one, and a rerun changes nothing; and on a star
 * drawn flat for want of a gravity, which takes the one published at its J2000 position (star-limb.mts). */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import type { Archive } from './archives/archives.mts';
import { starLimb } from './star-limb.mts';

// Claret & Bloemen (2011), J/A+A/529/A75 table-af, the Johnson V nodes around 6,432 K and log g 4.37 as VizieR serves them, 2026-10-03.
const ATLAS = ['logg\tTeff\tZ\txi\ta\tb\tFilt\tMet\tMod', '[cm/s2]\tK\t[Sun]\tkm/s\t \t \t \t \t', '-----\t------\t----\t----\t-------\t-------\t--\t-\t-',
  ' 4.00\t  6250\t 0.0\t 2.0\t 0.3758\t 0.3047\tV \tL\tA', ' 4.50\t  6250\t 0.0\t 2.0\t 0.3771\t 0.3051\tV \tL\tA',
  ' 4.00\t  6500\t 0.0\t 2.0\t 0.3490\t 0.3170\tV \tL\tA', ' 4.50\t  6500\t 0.0\t 2.0\t 0.3492\t 0.3166\tV \tL\tA'].join('\n');
const archive: Archive = { async text(_url, form) { return form?.['-source'] === 'J/A+A/529/A75/table-af' ? ATLAS : '#\n'; }, async bytes() { return Buffer.from(''); }, async exists() { return false; } };

const OLD = 'photometry/claret-2017-tess-quadratic.tsv', OLD_ID = 'a-star-claret-2017-limb-darkening';
const EARLIER = 'dimmed toward the limb by the quadratic law of an earlier run (u1 0.3, u2 0.2): a model';
/** A star whose color dataset reads the TESS-band table, with the sentences and ledger entry an earlier run of the tool left. */
async function starWithEarlierLaw() {
  const root = await mkdtemp(join(tmpdir(), 'star-limb-')), o = 'src/objects/a-star', s = `${o}/source`;
  const files: Record<string, unknown> = {
    'packages/astronomy/data/bodies/a-star.json': { physical: { name: 'A Star', meanRadiusKm: 874495, gravitationalParameterKm3PerS2: 1.8e11 }, star: { rightAscensionDegrees: 10, declinationDegrees: -20 } },
    [`${o}/text.json`]: { datasets: { color: { summary: 'The color of the star.' } } },
    [`${o}/investigations.json`]: { schema: 'ledger', objectId: 'a-star', entries: [{ id: 'limb-darkening', subject: 'Limb darkening', status: 'included', finding: `The disc is ${EARLIER}. Gravity: log g 4.31 from a paper.`, evidence: [] }] },
    [`${s}/measurements.json`]: { effectiveTemperatureK: 6432, surfaceGravityLogg: 4.31, surfaceGravitySource: 'a paper' },
    [`${s}/preparation/raster.json`]: { surfaces: [{ id: 'color', science: { kind: 'stellar-photometric-color', qualification: `Photosphere color from a spectrum. The disc is ${EARLIER}.`,
      limbDarkening: { law: 'quadratic', path: OLD, grid: { teffK: 6432, logg: 4.31, models: { Type: 'q', Mod: 'PC' } }, columns: { teff: 'Teff', logg: 'logg', u1: 'aLSM', u2: 'bLSM' } } } }] },
    [`${s}/content/object.json`]: { datasets: { controls: [{ id: 'color', qualification: 'Color from a spectrum; darkening toward the edge from a model atmosphere. The disc itself is unresolved.',
      notes: `The color of a spectrum. The darkening toward the edge is ${EARLIER.replace('dimmed toward the limb by ', '')}.` }] } },
    [`${s}/manifest.json`]: { inputs: [{ id: 'a-star-stellar-color', path: 'photometry/stellar-color.json', sourceBinding: { kind: 'local' } }, { id: OLD_ID, path: OLD, sourceBinding: { kind: 'local' } }],
      generatedIntermediates: [{ path: 'presentation/context.png', credit: 'The color dataset as a disc; rendered here', recipe: { inputs: ['a-star-stellar-color', OLD_ID] } }] },
    [`${s}/preparation/acquisition.json`]: { operations: [{ kind: 'download', path: OLD, url: 'https://vizier.cds.unistra.fr/viz-bin/asu-tsv' }] },
  };
  for (const [path, value] of Object.entries(files)) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), `${JSON.stringify(value, null, 2)}\n`); }
  for (const [path, text] of [[`${s}/${OLD}`, 'logg\tTeff\n'], [`${o}/README.md`, '# A Star\n\n## Evidence\n\n## Known problems\n'], [`${o}/NOTICE.md`, 'A Star.\n']] as const) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), text); }
  return { root, read: async (path: string) => readFile(join(root, path), 'utf8'), source: s, package: o };
}

test('a new law replaces the earlier one: its table, inputs and sentences leave, and a rerun changes nothing', async t => {
  const star = await starWithEarlierLaw();
  t.after(() => rm(star.root, { recursive: true, force: true }));
  const [result] = await starLimb(star.root, ['a-star'], { archive });
  assert.equal(result?.limb, 'atlas');
  assert.deepEqual(await readdir(join(star.root, star.source, 'photometry')), ['claret-2011-v-quadratic.tsv'], 'the earlier table is removed');
  const manifest = JSON.parse(await star.read(`${star.source}/manifest.json`)) as { inputs: { id: string }[]; generatedIntermediates: { recipe: { inputs: string[] } }[] };
  assert.deepEqual(manifest.inputs.map(input => input.id), ['a-star-stellar-color', 'a-star-claret-2011-limb-darkening']);
  assert.deepEqual(manifest.generatedIntermediates[0]!.recipe.inputs, ['a-star-stellar-color', 'a-star-claret-2011-limb-darkening']);
  assert.doesNotMatch(await star.read(`${star.source}/preparation/acquisition.json`), /claret-2017/u);
  const raster = await star.read(`${star.source}/preparation/raster.json`), content = JSON.parse(await star.read(`${star.source}/content/object.json`)) as { datasets: { controls: { qualification: string; notes: string }[] } };
  assert.doesNotMatch(raster, /an earlier run/u);
  assert.equal(raster.match(/The disc is dimmed toward the limb by/gu)?.length, 1);
  assert.equal(content.datasets.controls[0]!.qualification, 'Color from a spectrum; darkening toward the edge from a model atmosphere. The disc itself is unresolved.');
  assert.match(content.datasets.controls[0]!.notes, /^The color of a spectrum\. The darkening toward the edge is the quadratic law Claret & Bloemen \(2011\), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,432 K and log g 4\.37 /u);
  // The gravity the law was read at is the one on record: the star's own mass and radius, not the earlier paper value.
  assert.equal((JSON.parse(await star.read(`${star.source}/measurements.json`)) as { surfaceGravityLogg: number }).surfaceGravityLogg, 4.37);
  const paths = [`${star.source}/preparation/raster.json`, `${star.source}/content/object.json`, `${star.source}/manifest.json`, `${star.source}/preparation/acquisition.json`, `${star.package}/README.md`, `${star.package}/NOTICE.md`, `${star.package}/investigations.json`];
  const first = await Promise.all(paths.map(star.read));
  await starLimb(star.root, ['a-star'], { archive });
  assert.deepEqual(await Promise.all(paths.map(star.read)), first);
});

test('a law a paper measured on the star replaces the model grid and leaves the cited gravity as it is', async t => {
  const star = await starWithEarlierLaw();
  t.after(() => rm(star.root, { recursive: true, force: true }));
  await writeFile(join(star.root, star.source, 'photometry/a-paper-limb-darkening.json'), `${JSON.stringify({ schema: 'cssearth-published-limb-darkening@1', objectId: 'a-star', law: 'power',
    source: 'A Paper (2017), Table 3 (https://doi.org/10.1000/example)', band: 'H band; not a visible band', alpha: { value: 0.14, uncertainty: 0.005, cell: 'alpha = 0.14 ± 0.005' } }, null, 2)}\n`);
  const [result] = await starLimb(star.root, ['a-star'], { archive });
  assert.equal(result?.limb, 'published');
  assert.deepEqual(await readdir(join(star.root, star.source, 'photometry')), ['a-paper-limb-darkening.json'], 'the model table is removed');
  assert.match(await star.read(`${star.source}/preparation/raster.json`), /"published": true/u);
  assert.deepEqual(JSON.parse(await star.read(`${star.source}/measurements.json`)), { effectiveTemperatureK: 6432, surfaceGravityLogg: 4.31, surfaceGravitySource: 'a paper' });
});

test('the row of a model grid nearest a star no grid reaches is read as a model limb, in the record\'s own words', async t => {
  const star = await starWithEarlierLaw();
  t.after(() => rm(star.root, { recursive: true, force: true }));
  await writeFile(join(star.root, star.source, 'photometry/a-grid-limb-darkening.json'), `${JSON.stringify({ schema: 'cssearth-published-limb-darkening@1', objectId: 'a-star', law: 'quadratic', basis: 'model-prior',
    source: 'A Grid (2020), Table ab (https://doi.org/10.1000/grid)', band: 'Johnson V', u1: { value: 0.0593, fixed: 'the row at 100000 K: a = 0.0593' }, u2: { value: 0.0996, fixed: 'the row at 100000 K: b = 0.0996' },
    derived: 'of the nearest model A Grid (2020) tabulate, a white dwarf at 100,000 K' }, null, 2)}\n`);
  const [result] = await starLimb(star.root, ['a-star'], { archive });
  assert.equal(result?.limb, 'published');
  const readme = await star.read(`${star.package}/README.md`);
  assert.match(readme, /\*\*Limb\.\*\* The disc is dimmed toward the limb by the quadratic law \(u1 0\.0593, u2 0\.0996\) of the nearest model A Grid \(2020\) tabulate, a white dwarf at 100,000 K \(Johnson V\)\./u);
  assert.match(readme, /- \*\*Model limb\.\*\* The limb darkening is the nearest tabulated model atmosphere's, not a measurement of this star\./u);
  assert.doesNotMatch(readme, /Measured limb, other band/u);
});

const DECLINED = 'no mass is measured and no spectroscopic surface gravity is published with this radius: A Paper (2017) assume the gravity of their fit (table column 15)';
const PAPER = 'https://doi.org/10.1000/example', J2000 = { ra: 10.01 - 16000 / 3.6e6 / Math.cos(20 * Math.PI / 180), dec: -20 + 8000 / 3.6e6 };
/** A generated star with no mass, drawn flat: its record is at Gaia's epoch, 17 arcseconds from where the star was at J2000. */
async function flatStar() {
  const star = await starWithEarlierLaw(), write = (path: string, value: unknown) => writeFile(join(star.root, path), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  await rm(join(star.root, star.source, OLD));
  await write('packages/astronomy/data/bodies/a-star.json', { physical: { name: 'A Star', meanRadiusKm: 874495, gravitationalParameterKm3PerS2: 0 },
    star: { rightAscensionDegrees: 10.01, declinationDegrees: -20, positionEpochJulianYear: 2016, properMotionRaMasPerYear: 1000, properMotionDecMasPerYear: -500 } });
  await write(`${star.package}/investigations.json`, { schema: 'ledger', objectId: 'a-star', entries: [] });
  await write(`${star.source}/measurements.json`, { effectiveTemperatureK: 6432 });
  await write(`${star.source}/preparation/raster.json`, { surfaces: [{ id: 'color', science: { kind: 'stellar-photometric-color', qualification: `Uniform photosphere color from a spectrum. No limb darkening is drawn: ${DECLINED}. The disc is unresolved.` } }] });
  await write(`${star.source}/content/object.json`, { datasets: { controls: [{ id: 'color', qualification: 'Color from a spectrum. The disc itself is unresolved.', notes: `The color of a spectrum. No limb darkening is drawn: ${DECLINED}.` }] } });
  await write(`${star.source}/manifest.json`, { inputs: [{ id: 'a-star-stellar-color', path: 'photometry/stellar-color.json', sourceBinding: { kind: 'local' } }],
    generatedIntermediates: [{ path: 'presentation/context.png', credit: 'The color dataset as a disc; rendered here', recipe: { inputs: ['a-star-stellar-color'] } }] });
  await write(`${star.source}/preparation/acquisition.json`, { operations: [] });
  await write(`${star.source}/preparation/new-object.json`, { id: 'a-star', name: 'A Star', system: 'A Star system', description: 'A star.', target: 'HIP 1', paper: { url: PAPER, credit: 'A Paper (2017)' },
    radius: { value: 1.257, source: 'A Paper (2017), table 2', url: PAPER }, mass: 'unmeasured', temperature: { value: 6432, source: 'A Paper (2017), table 2', url: PAPER }, limb: { none: DECLINED }, planets: [], companions: [], notes: [], order: 7 });
  await write(`${star.package}/README.md`, `# A Star\n\n**Star.** Temperature 6,432 K from A Paper (2017). No surface gravity of this star is published.\n\n**Limb.** No limb darkening is drawn: ${DECLINED}.\n\n## Evidence\n\n## Known problems\n`);
  return star;
}
// SIMBAD answers a cone search only where the star was at J2000; at the record's own position it holds nothing.
const simbad: Archive = { ...archive, async text(url, form) {
  const cone = /CIRCLE\('ICRS', ([-\d.]+), ([-\d.]+), /u.exec(form?.QUERY ?? '');
  if (!cone) return archive.text(url, form);
  const arcseconds = Math.hypot((Number(cone[1]) - J2000.ra) * Math.cos(20 * Math.PI / 180), Number(cone[2]) - J2000.dec) * 3600;
  return `main_id\tlog_g\tbibcode\ttitle\n${arcseconds < 1 ? '"* a Sta"\t4.37\t"2020A&A...640A...1X"\t"A study of one star."\n' : ''}`;
} };

test('a star with no mass takes the gravity published at its J2000 position: its README names the paper and its stored spec cites it', async t => {
  const star = await flatStar();
  t.after(() => rm(star.root, { recursive: true, force: true }));
  const [result] = await starLimb(star.root, ['a-star'], { archive: simbad });
  assert.deepEqual(result, { id: 'a-star', limb: 'atlas', gravity: '4.37 (published)' });
  const readme = await star.read(`${star.package}/README.md`);
  assert.match(readme, /^\*\*Star\.\*\* Temperature 6,432 K from A Paper \(2017\)\. log g 4\.37 from 2020A&A\.\.\.640A\.\.\.1X \("A study of one star\."\)\.$/mu);
  assert.match(readme, /^\*\*Limb\.\*\* The disc is dimmed toward the limb by .* Gravity: log g 4\.37 from 2020A&A\.\.\.640A\.\.\.1X; /mu);
  const spec = JSON.parse(await star.read(`${star.source}/preparation/new-object.json`)) as { gravity: { value: number; source: string; url: string }; limb?: unknown };
  assert.equal(spec.limb, undefined, 'the stored spec no longer declines a law, so a refresh keeps it');
  assert.equal(spec.gravity.value, 4.37); assert.equal(spec.gravity.url, 'https://ui.adsabs.harvard.edu/abs/2020A%26A...640A...1X');
  assert.match(spec.gravity.source, /^SIMBAD's compilation of spectroscopic measurements \(mesFe_h\): log g 4\.37 from 2020A&A\.\.\.640A\.\.\.1X; /u);
  assert.deepEqual(Object.keys(spec).slice(7, 10), ['mass', 'temperature', 'gravity']);
  assert.equal((JSON.parse(await star.read(`${star.source}/measurements.json`)) as { surfaceGravityLogg: number }).surfaceGravityLogg, 4.37);
  const paths = [`${star.package}/README.md`, `${star.package}/NOTICE.md`, `${star.package}/investigations.json`, `${star.source}/content/object.json`, `${star.source}/measurements.json`, `${star.source}/preparation/raster.json`, `${star.source}/preparation/new-object.json`];
  const first = await Promise.all(paths.map(star.read));
  for (const written of first) assert.doesNotMatch(written, /No limb darkening is drawn|No surface gravity/u);
  await starLimb(star.root, ['a-star'], { archive: simbad });
  assert.deepEqual(await Promise.all(paths.map(star.read)), first, 'a rerun changes nothing');
});


test('a published law must satisfy the objects coefficient admission before editing a star', async t => {
  const star = await starWithEarlierLaw();
  t.after(() => rm(star.root, { recursive: true, force: true }));
  await mkdir(join(star.root, star.source, 'photometry'), { recursive: true });
  await writeFile(join(star.root, star.source, 'photometry/a-paper-limb-darkening.json'), JSON.stringify({
    schema: 'cssearth-published-limb-darkening@1', law: 'power', source: 'A Paper https://example.org/paper', band: 'V',
    alpha: { value: 0.5, uncertainty: 0.1 },
  }));
  const before = await star.read(`${star.source}/preparation/raster.json`);
  await assert.rejects(starLimb(star.root, ['a-star'], { archive }), /alpha.cell/u);
  assert.equal(await star.read(`${star.source}/preparation/raster.json`), before);
});
