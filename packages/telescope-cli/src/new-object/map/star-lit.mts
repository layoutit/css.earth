/** One way of drawing a planet that carries a map. A planet the generator makes is lit by its star, and a heat map installed on
 * it stays lit: a sphere under its star's light, with the shared lighting bank. Nine planets built by hand before the generator
 * were drawn self-luminous instead, a flat disc with no limb, because their maps are of their own heat. That left two looks for
 * the same kind of dataset. This moves such a package to the lit lane:
 *
 *   new-object --star-lit <id>...
 *
 * It applies only to a planet on a hosted orbit whose datasets are all maps or illustrations. A body seen by its own light (a
 * star, or an imaged planet with a disc color) stays emissive and takes a limb law instead (imaged/imaged-limb.mts). The lighting
 * is a display convention, not data: the texts say that the map's colors are read against the legend where the disc is fully
 * lit. Nothing is baked here. */
import { readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { json, type PackageFiles } from '../dataset.mts';
import { HOSTED_PLANET_STYLESHEET, hostedPlanetLighting } from '../new-hosted-planet.mts';

const FILES = ['object.json', 'README.md', 'source/preparation/raster.json', 'source/preparation/geometry.json', 'source/preparation/presentation.json', 'source/content/object.json', 'source/manifest.json'] as const;
const MAP_KINDS = new Set(['terrestrial-scientific', 'equirectangular-illustration']);
export const LIT_NOTE = ' The shading is its star\'s light, a display convention: read the colors against the legend where the disc is lit.';
export const LIT_README = '**Lighting.** The planet is drawn lit by its star, as every planet with a map is: a sphere under the shared lighting bank. The shading is a display convention, not data; the map\'s colors are read against the legend where the disc is fully lit.';

/** Move the package in `files` from the emissive lane to the lit one. Returns the stylesheet it no longer uses, or why it stays. */
export function starLight(files: PackageFiles, id: string, hosted: boolean): { retired?: string; why?: string } {
  const o = `src/objects/${id}`, s = `${o}/source`, read = (path: string) => requireRecord(JSON.parse(String(files.get(path))), path);
  const raster = read(`${s}/preparation/raster.json`), surfaces = requireArray(raster.surfaces, `${id} raster surfaces`).map(entry => requireRecord(entry, `${id} raster surface`));
  if (raster.emission === undefined) return { why: 'it is lit by its star already' };
  if (!hosted) return { why: 'it is not on an orbit around a star that could light it' };
  const own = surfaces.find(surface => !MAP_KINDS.has(String(requireRecord(surface.science, `${id} science`).kind)));
  if (own) return { why: `its ${String(own.id)} dataset is its own light (${String(requireRecord(own.science, `${id} science`).kind)}), so it stays self-luminous` };
  delete raster.emission;
  raster.lighting = hostedPlanetLighting(id);
  files.set(`${s}/preparation/raster.json`, json(raster));

  const descriptor = read(`${o}/object.json`), properties = requireRecord(descriptor.properties, `${id} properties`), recipe = requireRecord(properties.recipe, `${id} recipe`);
  recipe.materials = [{ id: 'lighting', source: 'raster', model: 'lit' }];
  delete recipe.emission;
  for (const surface of requireArray(recipe.surfaces, `${id} recipe surfaces`)) for (const dataset of requireArray(requireRecord(surface, `${id} recipe surface`).datasets, `${id} recipe datasets`)) requireRecord(dataset, `${id} recipe dataset`).material = 'lighting';
  // The lit lane prepares the star's direction in the planet's sky.
  const preparation = requireRecord(properties.preparation, `${id} preparation`), steps = requireArray(preparation.steps, `${id} preparation steps`).map(String);
  if (!steps.includes('sky-sun')) steps.splice(steps.indexOf('starfield') + 1, 0, 'sky-sun');
  preparation.steps = steps;
  const page = requireRecord(properties.page, `${id} page`), own_css = `src/renderers/css/styles/${id}-surfaces.css`, sheets = requireArray(page.stylesheets, `${id} stylesheets`).map(String);
  page.stylesheets = sheets.map(sheet => sheet === own_css ? HOSTED_PLANET_STYLESHEET : sheet);
  files.set(`${o}/object.json`, json(descriptor));

  const geometry = read(`${s}/preparation/geometry.json`);
  requireRecord(geometry.output, `${id} geometry output`).materialSchema = `css${id}-prepared-lighting@1`;
  files.set(`${s}/preparation/geometry.json`, json(geometry));
  const presentation = read(`${s}/preparation/presentation.json`);
  presentation.mode = 'composite';
  files.set(`${s}/preparation/presentation.json`, json(presentation));

  const content = read(`${s}/content/object.json`);
  for (const entry of requireArray(requireRecord(content.datasets, `${id} datasets`).controls, `${id} controls`)) {
    const control = requireRecord(entry, `${id} control`);
    if (typeof control.notes === 'string' && !control.notes.includes(LIT_NOTE)) control.notes = `${control.notes.trimEnd()}${LIT_NOTE}`;
  }
  // The lit lane's one setting: the star's shadows, off until the reader turns them on.
  const settings = requireRecord(content.settings, `${id} settings`), toggles = requireArray(settings.controls, `${id} settings controls`);
  if (!toggles.some(entry => requireRecord(entry, `${id} setting`).name === 'shadows')) settings.controls = [...toggles, { kind: 'toggle', name: 'shadows', label: 'Shadows', checked: false }];
  files.set(`${s}/content/object.json`, json(content));

  const manifest = read(`${s}/manifest.json`);
  for (const key of ['inputs', 'generatedIntermediates']) for (const entry of requireArray(manifest[key] ?? [], `${id} manifest ${key}`)) {
    const input = requireRecord(entry, `${id} manifest entry`);
    if (typeof input.origin === 'string') input.origin = input.origin.replace(', emissive material', ', lit material').replace('presentation profile: emissive mode', 'presentation profile: composite mode').replace(', self-luminous with transparent plates', ', lit by its own star');
  }
  files.set(`${s}/manifest.json`, json(manifest));

  const readme = requireString(String(files.get(`${o}/README.md`)), `${id} README`).split('\n').filter(line => !line.startsWith('**Lighting.**'));
  const at = readme.findIndex(line => line.startsWith('## Evidence'));
  if (at < 0) throw new TypeError(`${id}: README.md has no "## Evidence" to place the lighting paragraph before.`);
  readme.splice(at, 0, LIT_README, '');
  files.set(`${o}/README.md`, readme.join('\n').replace(/\n{3,}/gu, '\n\n'));
  return { retired: sheets.includes(own_css) ? own_css : undefined };
}

/** `new-object --star-lit`: one line per planet. */
export async function addStarLight(root: string, ids: readonly string[], progress = (_line: string) => {}): Promise<string[]> {
  const lines: string[] = [], say = (line: string) => { lines.push(line); progress(line); };
  for (const id of ids) {
    const files: PackageFiles = new Map();
    for (const path of FILES) files.set(`src/objects/${id}/${path}`, await readFile(resolve(root, 'src/objects', id, path), 'utf8'));
    const body = requireRecord(JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies', `${id}.json`), 'utf8')), `${id} body`);
    const { retired, why } = starLight(files, id, body.hostedOrbit !== undefined);
    if (why) { say(`${id}: unchanged, ${why}`); continue; }
    for (const [path, value] of files) await writeFile(resolve(root, path), value);
    if (retired) await rm(resolve(root, retired), { force: true });
    say(`${id}: now lit by its star${retired ? `; ${retired} is no longer used and was removed` : ''}`);
  }
  return lines;
}
