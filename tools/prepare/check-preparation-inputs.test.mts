import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
import { restoreDriftedFiles, textBudgetFindings, worldStepOutput } from './check-preparation-inputs.mts';
const test = sourceTest();

const put = async (path: string, bytes: string | Buffer) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes); };
const sha = (bytes: string) => createHash('sha256').update(bytes).digest('hex');

test('reader text over its budget is found before the bake, with the object, slot and length', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-inputs-'));
  try {
    const source = { catalogueId: 'jpl-small-body-database', url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=Aspasia', label: 'JPL Small-Body Database', checked: '2026-09-25' };
    // The summary the DAMIT run for Aspasia wrote; the text step refused it only after the bake.
    const summary = 'Fitted to light curves, adaptive-optics images and stellar occultations, so large hollows can show. The spin angle shown is arbitrary.';
    await put(join(root, 'src/objects/aspasia/text.json'), JSON.stringify({ schema: 'cssearth-object-text@1', objectId: 'aspasia',
      card: { text: 'Main-belt asteroid found in 1892.', sources: [source] }, introduction: { text: 'Aspasia orbits in the main belt.', sources: [source] },
      datasets: { shape: { title: 'Light-curve shape model', detail: 'Published shape', summary } } }));
    await put(join(root, 'src/objects/broken/text.json'), '{"schema":"cssearth-object-text@1","objectId":"broken"}');
    await mkdir(join(root, 'src/objects/m31'), { recursive: true }); // a catalogue object keeps no reader text
    assert.deepEqual(await textBudgetFindings(['aspasia', 'm31'], root),
      [{ objectId: 'aspasia', slot: 'datasets.shape.summary', rule: 'length', detail: '134 characters; the summary budget is 125' }]);
    const [broken] = await textBudgetFindings(['broken'], root);
    assert.deepEqual([broken?.objectId, broken?.slot, broken?.rule], ['broken', 'text.json', 'schema']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("the Sun's stale and missing files are restored by hash, and the world step's own outputs are left to it", async () => {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-inputs-'));
  try {
    const current = { 'prepared/title.json': '{"title":"Sun"}\n', 'prepared/minimaps/corona.webp': 'corona', 'prepared/scene.json': '{}\n',
      'prepared/world-context.json': '{"bodies":[]}\n', 'public/sun-surface@2x.webp': 'surface' };
    await put(join(root, 'src/objects/sun/inventory.json'), JSON.stringify({ schema: 'cssearth-inventory@1', assets: Object.entries(current).map(([path, text]) => {
      const [location, ...rest] = path.split('/');
      return { location, filename: rest.join('/'), bytes: Buffer.byteLength(text), sha256: sha(text) };
    }) }));
    const prepared = join(root, 'src/objects/sun/prepared');
    await put(join(prepared, 'minimaps/corona.webp'), 'photosphere'); // stale
    await put(join(prepared, 'scene.json'), '{}\n'); // current
    await put(join(prepared, 'world-context.json'), '{"bodies":["new"]}\n'); // the world step rewrites it
    // R2 serves each file at runtime-assets/<sha256>/<filename>.
    const published = new Map(Object.values(current).map(text => [sha(text), text])), requested: string[] = [];
    const fetcher = async (url: string | URL | Request) => {
      const [hash = '', ...filename] = String(url).split('/').slice(4);
      requested.push(filename.join('/'));
      const text = published.get(hash);
      return text === undefined ? new Response('missing', { status: 404 }) : new Response(text);
    };
    const restored = await restoreDriftedFiles('sun', { projectRoot: root, keep: worldStepOutput, fetcher });
    assert.deepEqual(restored.sort(), ['prepared/minimaps/corona.webp', 'prepared/title.json', 'public/sun-surface@2x.webp']);
    assert.deepEqual(requested.sort(), ['minimaps/corona.webp', 'sun-surface@2x.webp', 'title.json']);
    assert.equal(await readFile(join(prepared, 'minimaps/corona.webp'), 'utf8'), 'corona');
    assert.equal(await readFile(join(prepared, 'title.json'), 'utf8'), '{"title":"Sun"}\n');
    assert.equal(await readFile(join(root, 'public/scenes/sun/sun-surface@2x.webp'), 'utf8'), 'surface');
    assert.equal(await readFile(join(prepared, 'world-context.json'), 'utf8'), '{"bodies":["new"]}\n');
    assert.deepEqual(await restoreDriftedFiles('sun', { projectRoot: root, keep: worldStepOutput, fetcher }), [], 'a current checkout downloads nothing');
  } finally { await rm(root, { recursive: true, force: true }); }
});
