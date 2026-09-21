/** Package facts that copying one object into another used to get wrong, checked across every object:
 * no scaffold placeholder is left, every content provenance path resolves, every editorial credit link is cited by its own
 * package, and every placed star's catalogue distance, colour and stylesheet follow from its own records: its colour is its
 * measured colour lens, or the star field's colour fit at the effective temperature its measurement record cites. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { isRecord, requireArray, requireFiniteNumber, requireRecord, requireString } from './source-values.mts';
import { TODO, starStylesheet } from './objects/new-star.mts';
import { readStarTemperature, temperatureCatalogueColor } from './objects/star-catalogue-color.mts';

const root = resolve(import.meta.dirname, '..');
const objectsDirectory = resolve(root, 'src/objects');
const exists = (path: string) => stat(path).then(() => true, () => false);
const TEXT = /\.(?:json|md|txt|cat|lbl|xml|asc)$/iu;

async function objectIds() {
  return (await readdir(objectsDirectory, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
}

/** Every authored text file of a package: its records, documents and references, not its prepared outputs. */
async function authoredText(directory: string): Promise<string> {
  let text = '';
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'prepared') text += await authoredText(path); continue; }
    if (TEXT.test(entry.name) && (await stat(path)).size < 8_000_000) text += await readFile(path, 'utf8');
  }
  return text;
}

/** A shared dataset folder counts as a citation: a PDS dataset's catalog file credits the data its manifest downloads. */
function sharesDataset(url: string, origins: readonly string[]) {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return false; }
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 3) return false;
  const folder = `${parsed.origin}/${segments.slice(0, -2).join('/')}/`;
  return origins.some(origin => origin.startsWith(folder));
}

test('no scaffold placeholder is left in any object package', async () => {
  const left: string[] = [];
  for (const id of await objectIds()) if ((await authoredText(resolve(objectsDirectory, id))).includes(TODO)) left.push(id);
  assert.deepEqual(left, [], `replace every ${TODO} before committing`);
});

test('every content provenance path resolves from the content record', async () => {
  const missing: string[] = [];
  for (const id of await objectIds()) {
    const contentPath = resolve(objectsDirectory, id, 'source/content/object.json');
    if (!await exists(contentPath)) continue;
    const provenance = requireRecord(JSON.parse(await readFile(contentPath, 'utf8')) as unknown).provenance;
    if (!isRecord(provenance)) continue;
    for (const [key, entry] of Object.entries(provenance)) {
      if (!isRecord(entry) || typeof entry.path !== 'string') continue;
      const target = resolve(dirname(contentPath), entry.path);
      if (!await exists(target)) missing.push(`${id} ${key}: ${entry.path}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('every editorial credit link is cited by its own package or credits the dataset it downloads', async () => {
  const uncited: string[] = [];
  for (const id of await objectIds()) {
    const contentPath = resolve(objectsDirectory, id, 'source/content/object.json');
    if (!await exists(contentPath)) continue;
    const content = requireRecord(JSON.parse(await readFile(contentPath, 'utf8')) as unknown);
    const editorial = isRecord(content.provenance) && isRecord(content.provenance.editorial) ? content.provenance.editorial : null;
    if (!editorial || typeof editorial.url !== 'string') continue;
    const { provenance: _provenance, ...rest } = content;
    const text = JSON.stringify(rest) + (await authoredText(resolve(objectsDirectory, id))).replace(await readFile(contentPath, 'utf8'), '');
    if (text.includes(editorial.url)) continue;
    const manifestPath = resolve(objectsDirectory, id, 'source/manifest.json');
    const manifest = await exists(manifestPath) ? requireRecord(JSON.parse(await readFile(manifestPath, 'utf8')) as unknown) : {};
    const origins = ['inputs', 'generatedIntermediates', 'documents'].flatMap(key => Array.isArray(manifest[key]) ? manifest[key] : [])
      .flatMap(entry => isRecord(entry) && typeof entry.origin === 'string' ? [entry.origin] : []);
    if (!sharesDataset(editorial.url, origins)) uncited.push(`${id}: ${editorial.url}`);
  }
  assert.deepEqual(uncited, [], 'an editorial link nothing else in the package cites is usually a copy from another object');
});

test('every placed star states its catalogue distance, colour and stylesheet from its own records', async () => {
  const stars: string[] = [];
  for (const file of (await readdir(resolve(root, 'packages/astronomy/data/bodies'))).sort()) {
    const record = requireRecord(JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies', file), 'utf8')) as unknown);
    if (!isRecord(record.star)) continue;
    const id = requireString(record.id), directory = resolve(objectsDirectory, id);
    const descriptor = requireRecord(JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8')) as unknown), properties = requireRecord(descriptor.properties);
    const catalog = requireRecord(properties.catalog), frame = requireRecord(properties.worldFrame);
    const frameAu = Math.hypot(...(frame.originM as number[])) / 149597870700;
    assert.ok(Math.abs(requireFiniteNumber(catalog.distanceAu) - frameAu) / frameAu < 1e-3, `${id}: catalogue distance ${catalog.distanceAu} AU, world frame ${frameAu} AU`);
    const geometry = requireRecord(JSON.parse(await readFile(resolve(directory, 'source/preparation/geometry.json'), 'utf8')) as unknown);
    assert.equal(requireRecord(geometry.surface).color, catalog.color, `${id}: the surface colour is the catalogue colour`);
    const raster = requireRecord(JSON.parse(await readFile(resolve(directory, 'source/preparation/raster.json'), 'utf8')) as unknown);
    const measured = requireArray(raster.surfaces).map(surface => requireRecord(surface)).find(surface => isRecord(surface.science) && surface.science.kind === 'stellar-photometric-color');
    if (measured) {
      const lenses = requireRecord(JSON.parse(await readFile(resolve(directory, 'prepared/lenses.json'), 'utf8')) as unknown);
      const control = requireArray(lenses.controls).map(value => requireRecord(value)).find(value => value.id === measured.id);
      assert.equal(catalog.color, control?.billboardColor, `${id}: the catalogue colour is the prepared colour of its measured ${String(measured.id)} lens`);
      // A model limb-darkening law is read at the temperature and gravity the measurement record cites.
      const limb = requireRecord(measured.science).limbDarkening;
      if (isRecord(limb) && isRecord(limb.grid) && limb.path === 'photometry/claret-2011-v-quadratic.tsv') {
        const measurements = requireRecord(JSON.parse(await readFile(resolve(directory, 'source/measurements.json'), 'utf8')) as unknown);
        assert.equal(limb.grid.teffK, readStarTemperature(measurements).kelvin, `${id}: the limb-darkening grid is read at the cited temperature`);
        assert.equal(limb.grid.logg, requireFiniteNumber(measurements.surfaceGravityLogg), `${id}: the limb-darkening grid is read at the recorded gravity`);
        requireString(measurements.surfaceGravitySource);
      }
    } else {
      const temperature = readStarTemperature(JSON.parse(await readFile(resolve(directory, 'source/measurements.json'), 'utf8')) as unknown);
      assert.equal(catalog.color, temperatureCatalogueColor(temperature.kelvin), `${id}: the catalogue colour is the star field's colour at its cited ${temperature.kelvin} K`);
    }
    const stylesheet = await readFile(resolve(root, 'src/renderers/css/styles', `${id}-surfaces.css`), 'utf8');
    const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\n{2,}/gu, '\n');
    assert.equal(stripComments(stylesheet), stripComments(starStylesheet(id, id, requireFiniteNumber(requireRecord(raster.emission).offLimbSize), '', undefined,
      requireFiniteNumber(requireRecord(JSON.parse(await readFile(resolve(directory, 'source/presentation/solar-system.json'), 'utf8')) as unknown).geometryScale))),
      `${id}: ${relative(root, resolve(root, 'src/renderers/css/styles', `${id}-surfaces.css`))} is the star stylesheet template`);
    stars.push(id);
  }
  assert.ok(stars.length >= 4, `placed stars checked: ${stars.join(', ')}`);
});
