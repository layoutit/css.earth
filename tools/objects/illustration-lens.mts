#!/usr/bin/env node
// Add NASA's artist's concept map to a hosted planet as a second, non-default Illustration lens.
//
//   node tools/objects/illustration-lens.mts --object=trappist-1e --map=<local copy of TRAPPIST-1_e.jpg>
//
// The map is the texture NASA's Eyes on Exoplanets app wraps around the planet (credited NASA/JPL-Caltech; NASA calls each
// planet's look an artist's concept). It is copied unchanged into source/illustration/, restored from its origin by the
// acquisition plan, and listed in catalog.illustrationLenses, so it never counts as imagery. The default lens is unchanged.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { hostedPlanetStylesheet } from './new-hosted-planet.mts';

const EYES_ASSETS = 'https://eyes.nasa.gov/apps/exo/assets/image/exoplanet/';
const EYES_APP = 'https://eyes.nasa.gov/apps/exo/';
const EYES_TUTORIAL = 'https://science.nasa.gov/tutorials/eyes-on-exoplanets-tutorial/';
const NASA_MEDIA = 'https://www.nasa.gov/nasa-brand-center/images-and-media/';
const RECORD = 'nasa-eyes-on-exoplanets';
const LENS = 'illustration';

type Json = Record<string, any>;
const root = resolve(import.meta.dirname, '../..');
const read = async (path: string): Promise<Json> => JSON.parse(await readFile(resolve(root, path), 'utf8')) as Json;
const write = (path: string, value: unknown) => writeFile(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`);

const { values } = parseArgs({ options: { object: { type: 'string' }, map: { type: 'string' }, checked: { type: 'string' }, commit: { type: 'string' } } });
const { object: id, map, checked, commit } = values;
if (!id || !map || !checked || !commit) throw new TypeError('Usage: --object=<id> --map=<Eyes map> --checked=<YYYY-MM-DD> --commit=<commit the ledger entry was checked at>');
const file = basename(map), origin = `${EYES_ASSETS}${file}`, o = `src/objects/${id}`, s = `${o}/source`, sourcePath = `illustration/${file}`;

const content = await read(`${s}/content/object.json`), name = String(content.displayName);
if (content.lenses.controls.some((control: Json) => control.id === LENS)) throw new TypeError(`${id}: already has an ${LENS} lens.`);
const inputId = `${id}-nasa-eyes-illustration`;

await mkdir(resolve(root, s, 'illustration'), { recursive: true });
await copyFile(map, resolve(root, s, sourcePath));

const manifest = await read(`${s}/manifest.json`);
manifest.inputs.push({ id: inputId, path: sourcePath, origin, productId: file, title: `Eyes on Exoplanets artist's concept map of ${name}`, sourceUrl: EYES_APP,
  credit: 'NASA/JPL-Caltech (Eyes on Exoplanets)', license: `NASA images and media usage guidelines (${NASA_MEDIA}); NASA acknowledged as the source`,
  acquisition: `Original JPEG from the Eyes on Exoplanets app, unchanged; the app's texture table names it as ${name}'s map.`,
  redistribution: 'NASA media; an artist\'s concept, not an observation', consumers: ['assets', 'lenses'],
  sourceBinding: { kind: 'catalogued', references: [{ catalogueId: RECORD, role: 'material', evidence: origin }] } });
await write(`${s}/manifest.json`, manifest);

const acquisition = await read(`${s}/preparation/acquisition.json`);
acquisition.operations.push({ kind: 'download', groups: ['restore', 'refresh'], path: sourcePath, url: origin });
await write(`${s}/preparation/acquisition.json`, acquisition);
const ignore = await readFile(resolve(root, o, '.gitignore'), 'utf8').catch(() => '');
await writeFile(resolve(root, o, '.gitignore'), `${ignore}${ignore && !ignore.endsWith('\n') ? '\n' : ''}# NASA's artist's concept map is restored by source/preparation/acquisition.json.\n/source/${sourcePath}\n`);

const raster = await read(`${s}/preparation/raster.json`), first = raster.surfaces[0];
raster.surfaces.push({ id: LENS, output: first.output, thumbnail: first.thumbnail, source: sourcePath, falseColor: false, science: { kind: 'equirectangular-illustration' } });
await write(`${s}/preparation/raster.json`, raster);

const surfaceName = (template: string) => String(template).replace('{id}', LENS).replace('{suffix}', '@2x');
content.lenses.controls.push({ id: LENS, label: 'Illustration', qualification: `NASA's artist's concept of ${name}, from Eyes on Exoplanets; not an observation.`,
  thumbnail: String(first.thumbnail).replace('{id}', LENS), surface: surfaceName(first.output), poles: surfaceName(raster.polesOutput),
  source: { id: inputId, path: '../manifest.json', url: EYES_APP }, falseColor: false,
  notes: `NASA's artist's concept of ${name}: the map its Eyes on Exoplanets app wraps around the planet. Nobody has resolved this planet's disc, so none of the colour, clouds or terrain in it was observed. Its longitudes are arbitrary.` });
await write(`${s}/content/object.json`, content);

const text = await read(`${o}/text.json`);
text.datasets[LENS] = { title: 'NASA artist\'s concept', detail: 'Illustration, not observed', summary: 'The map NASA\'s Eyes on Exoplanets wraps around this planet. None of it was observed, and its longitudes are arbitrary.' };
await write(`${o}/text.json`, text);

const descriptor = await read(`${o}/object.json`), lenses = descriptor.properties.recipe.surfaces[0].lenses;
lenses.push({ id: LENS, source: 'content', material: lenses[0].material });
descriptor.properties.catalog = { illustrationLenses: [LENS], ...descriptor.properties.catalog };
await write(`${o}/object.json`, descriptor);

// A lit planet's own stylesheet names its lens images; an emissive one takes them from per-lens variables.
if (!raster.emission) {
  const path = `src/renderers/css/styles/${id}-surfaces.css`, current = await readFile(resolve(root, path), 'utf8');
  if (current !== hostedPlanetStylesheet(id, first.id)) throw new TypeError(`${id}: ${path} is not the generated one-lens stylesheet; edit it by hand.`);
  await writeFile(resolve(root, path), hostedPlanetStylesheet(id, first.id, [LENS]));
}

const ledger = await read(`${o}/investigations.json`);
ledger.entries.push({ id: 'nasa-eyes-illustration', subject: 'NASA Eyes on Exoplanets artist\'s concept map as an illustration lens', status: 'included',
  finding: `Shown as the non-default Illustration lens, never as imagery: the map NASA's Eyes on Exoplanets app lists for ${name} (${file}), resized unchanged onto the sphere with its left edge at 0° longitude, so its longitudes are arbitrary. No image resolves this planet; nothing in the map was observed. NASA credits the app NASA/JPL-Caltech and calls each planet's look an artist's concept; the file itself carries no credit or date.`,
  evidence: [origin, EYES_TUTORIAL], checked: [{ date: checked, commit }] });
await write(`${o}/investigations.json`, ledger);

await writeFile(resolve(root, o, 'NOTICE.md'), `${(await readFile(resolve(root, o, 'NOTICE.md'), 'utf8')).trimEnd()}\n\nIllustration lens: NASA's artist's concept map of ${name} from Eyes on Exoplanets, NASA/JPL-Caltech (${origin}), used unchanged under NASA's media guidelines (${NASA_MEDIA}). An artist's concept, not an observation.\n`);
console.log(`${id}: Illustration lens added from ${file}`);
