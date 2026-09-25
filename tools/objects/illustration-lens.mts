#!/usr/bin/env node
// Add NASA's artist's concept of a hosted planet as a second, non-default Illustration lens.
//
//   node tools/objects/illustration-lens.mts --object=trappist-1e --map=<local copy of TRAPPIST-1_e.jpg> --checked=<date> --commit=<sha>
//   node tools/objects/illustration-lens.mts --object=wasp-12b --model=<local copy of the GLB> --origin=<GLB url> --landing=<resource page> ...
//
// A map is the texture NASA's Eyes on Exoplanets app wraps around the planet (credited NASA/JPL-Caltech; NASA calls each planet's look
// an artist's concept). A model is a NASA Science 3D model credited to NASA Visualization Technology Applications and Development
// (VTAD), whose base-colour texture is carried through its own UVs, as Eris's is. Either file is copied unchanged into
// source/illustration/, restored from its origin by the acquisition plan, and listed in catalog.illustrationLenses, so it never counts
// as imagery. The default lens is unchanged.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const EYES_ASSETS = 'https://eyes.nasa.gov/apps/exo/assets/image/exoplanet/';
const EYES_APP = 'https://eyes.nasa.gov/apps/exo/';
const EYES_TUTORIAL = 'https://science.nasa.gov/tutorials/eyes-on-exoplanets-tutorial/';
const NASA_MEDIA = 'https://www.nasa.gov/nasa-brand-center/images-and-media/';
const EYES_RECORD = 'nasa-eyes-on-exoplanets';
const VTAD = 'NASA Visualization Technology Applications and Development (VTAD)';
const LENS = 'illustration';

type Json = Record<string, any>;
const root = resolve(import.meta.dirname, '../..');
const read = async (path: string): Promise<Json> => JSON.parse(await readFile(resolve(root, path), 'utf8')) as Json;
const write = (path: string, value: unknown) => writeFile(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`);

const { values } = parseArgs({ options: { object: { type: 'string' }, map: { type: 'string' }, model: { type: 'string' }, origin: { type: 'string' },
  landing: { type: 'string' }, checked: { type: 'string' }, commit: { type: 'string' } } });
const { object: id, map, model, checked, commit } = values;
if (!id || !checked || !commit || !map === !model || model && (!values.origin || !values.landing))
  throw new TypeError('Usage: --object=<id> (--map=<Eyes map> | --model=<GLB> --origin=<GLB url> --landing=<NASA resource page>) --checked=<YYYY-MM-DD> --commit=<commit the ledger entry was checked at>');
const local = (map ?? model)!, file = basename(local), o = `src/objects/${id}`, s = `${o}/source`, sourcePath = `illustration/${file}`;

const content = await read(`${s}/content/object.json`), name = String(content.displayName);
if (content.lenses.controls.some((control: Json) => control.id === LENS)) throw new TypeError(`${id}: already has an ${LENS} lens.`);
const inputId = `${id}-nasa-${model ? 'vtad-model' : 'eyes-illustration'}`;
const record = model ? `source-${inputId}` : EYES_RECORD;

// What differs between an Eyes map and a NASA 3D model: where it lives, who made it and how the lane reads it.
const kind = model
  ? { origin: values.origin!, landing: values.landing!, credit: VTAD, title: `${name} 3D Model`,
      acquisition: `Original GLB from the NASA Science resource page ${values.landing}, unchanged; its base-colour texture is the lens.`,
      science: { kind: 'glb-base-color', model: sourcePath }, qualification: `An artist's surface from NASA's ${name} 3D model; not an observation.`,
      notes: `NASA's illustration of ${name}, from its 3D model. Nobody has resolved this planet's disc, so none of the colour or features in it was observed. Its longitudes are arbitrary.`,
      text: { title: 'NASA artist\'s texture', summary: 'NASA\'s illustrated surface from its 3D model. None of it was observed, and its longitudes are arbitrary.' },
      finding: `the base-colour texture of NASA's ${name} 3D Model (${file}), carried through the model's own UVs onto the sphere, unrepainted, with arbitrary longitudes. No image resolves this planet; nothing in the texture was observed. The resource page gives the credit and a one-line description; it does not say how the texture was made.`,
      evidence: [values.landing!, NASA_MEDIA],
      notice: `base-colour texture of the ${name} 3D Model by ${VTAD}, ${values.landing}` }
  : { origin: `${EYES_ASSETS}${file}`, landing: EYES_APP, credit: 'NASA/JPL-Caltech (Eyes on Exoplanets)', title: `Eyes on Exoplanets artist's concept map of ${name}`,
      acquisition: `Original JPEG from the Eyes on Exoplanets app, unchanged; the app's texture table names it as ${name}'s map.`,
      science: { kind: 'equirectangular-illustration' }, qualification: `NASA's artist's concept of ${name}, from Eyes on Exoplanets; not an observation.`,
      notes: `NASA's artist's concept of ${name}: the map its Eyes on Exoplanets app wraps around the planet. Nobody has resolved this planet's disc, so none of the colour, clouds or terrain in it was observed. Its longitudes are arbitrary.`,
      text: { title: 'NASA artist\'s concept', summary: 'The map NASA\'s Eyes on Exoplanets wraps around this planet. None of it was observed, and its longitudes are arbitrary.' },
      finding: `the map NASA's Eyes on Exoplanets app lists for ${name} (${file}), resized unchanged onto the sphere with its left edge at 0° longitude, so its longitudes are arbitrary. No image resolves this planet; nothing in the map was observed. NASA credits the app NASA/JPL-Caltech and calls each planet's look an artist's concept; the file itself carries no credit or date.`,
      evidence: [`${EYES_ASSETS}${file}`, EYES_TUTORIAL],
      notice: `NASA's artist's concept map of ${name} from Eyes on Exoplanets, NASA/JPL-Caltech (${EYES_ASSETS}${file})` };

await mkdir(resolve(root, s, 'illustration'), { recursive: true });
await copyFile(local, resolve(root, s, sourcePath));

const manifest = await read(`${s}/manifest.json`);
manifest.inputs.push({ id: inputId, path: sourcePath, origin: kind.origin, productId: file, title: kind.title, sourceUrl: kind.landing, credit: kind.credit,
  license: `NASA images and media usage guidelines (${NASA_MEDIA}); NASA acknowledged as the source`, acquisition: kind.acquisition,
  redistribution: model ? 'NASA media; an illustrative model, not photographed terrain or a measured map' : 'NASA media; an artist\'s concept, not an observation',
  consumers: ['assets', 'lenses'], sourceBinding: { kind: 'catalogued', references: [{ catalogueId: record, role: 'material', evidence: kind.origin }] } });
await write(`${s}/manifest.json`, manifest);
const inputIndex = manifest.inputs.length - 1;

if (model) await write(`src/sources/${record}.json`, { id: record, kind: 'artwork', identityLevel: 'work', title: kind.title, identifiers: [],
  links: [{ role: 'landing', url: kind.landing, label: 'NASA Science resource page' }, { role: 'original', url: kind.origin, label: 'Original GLB' },
    { role: 'rights', url: NASA_MEDIA, label: 'NASA images and media usage guidelines' }],
  evidence: [{ path: `${s}/manifest.json`, locator: `/inputs/${inputIndex}` }], relations: [],
  statements: [{ kind: 'credit', text: VTAD, scope: `${name} 3D model and its base-color texture.`, evidence: `Credit line on the NASA Science resource page, checked ${checked}.` },
    { kind: 'rights', text: `NASA content is generally not subject to copyright in the United States; NASA is acknowledged as the source. Terms: ${NASA_MEDIA}`, scope: 'The GLB model and its embedded texture.', evidence: `NASA images and media usage guidelines, checked ${checked}.` },
    { kind: 'limitation', text: `An illustration. No image resolves the surface of ${name}; the texture is not an observation and its longitudes are arbitrary.`, scope: 'The base-color texture used as an illustration lens.', evidence: 'No resolved imagery exists for this body; see the object README.' }],
  publisher: VTAD });
else {
  const eyes = await read(`src/sources/${EYES_RECORD}.json`);
  eyes.evidence.push({ path: `${s}/manifest.json`, locator: `/inputs/${inputIndex}` });
  await write(`src/sources/${EYES_RECORD}.json`, eyes);
}

const acquisition = await read(`${s}/preparation/acquisition.json`);
acquisition.operations.push({ kind: 'download', groups: ['restore', 'refresh'], path: sourcePath, url: kind.origin });
await write(`${s}/preparation/acquisition.json`, acquisition);
const ignore = await readFile(resolve(root, o, '.gitignore'), 'utf8').catch(() => '');
await writeFile(resolve(root, o, '.gitignore'), `${ignore}${ignore && !ignore.endsWith('\n') ? '\n' : ''}# NASA's artist's ${model ? 'model' : 'concept map'} is restored by source/preparation/acquisition.json.\n/source/${sourcePath}\n`);

const raster = await read(`${s}/preparation/raster.json`), first = raster.surfaces[0];
raster.surfaces.push({ id: LENS, output: first.output, thumbnail: first.thumbnail, source: sourcePath, falseColor: false, science: kind.science });
await write(`${s}/preparation/raster.json`, raster);

const surfaceName = (template: string) => String(template).replace('{id}', LENS).replace('{suffix}', '@2x');
content.lenses.controls.push({ id: LENS, label: 'Illustration', qualification: kind.qualification,
  thumbnail: String(first.thumbnail).replace('{id}', LENS), surface: surfaceName(first.output), poles: surfaceName(raster.polesOutput),
  source: { id: inputId, path: '../manifest.json', url: kind.landing }, falseColor: false, notes: kind.notes });
await write(`${s}/content/object.json`, content);

const text = await read(`${o}/text.json`);
text.datasets[LENS] = { title: kind.text.title, detail: 'Illustration, not observed', summary: kind.text.summary };
await write(`${o}/text.json`, text);

const descriptor = await read(`${o}/object.json`), lenses = descriptor.properties.recipe.surfaces[0].lenses;
lenses.push({ id: LENS, source: 'content', material: lenses[0].material });
descriptor.properties.catalog = { illustrationLenses: [LENS], ...descriptor.properties.catalog };
await write(`${o}/object.json`, descriptor);

// No stylesheet names a lens's images: the new lens's variant writes the textures every leaf reads (scene/projector.ts).

const ledger = await read(`${o}/investigations.json`);
ledger.entries.push({ id: model ? 'nasa-vtad-illustration' : 'nasa-eyes-illustration', subject: model ? `NASA VTAD ${name} 3D model texture as an illustration lens` : 'NASA Eyes on Exoplanets artist\'s concept map as an illustration lens',
  status: 'included', finding: `Shown as the non-default Illustration lens, never as imagery: ${kind.finding}`, evidence: kind.evidence, checked: [{ date: checked, commit }] });
await write(`${o}/investigations.json`, ledger);

await writeFile(resolve(root, o, 'NOTICE.md'), `${(await readFile(resolve(root, o, 'NOTICE.md'), 'utf8')).trimEnd()}\n\nIllustration lens: ${kind.notice}, used unchanged under NASA's media guidelines (${NASA_MEDIA}). An artist's ${model ? 'illustration' : 'concept'}, not an observation.\n`);
console.log(`${id}: Illustration lens added from ${file}`);
