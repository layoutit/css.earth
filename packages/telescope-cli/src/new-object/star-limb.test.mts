/** `--star-limb` on a star that already has a law: the new law replaces the earlier one, and a rerun changes nothing (star-limb.mts). */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import type { Archive } from './archives.mts';
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
