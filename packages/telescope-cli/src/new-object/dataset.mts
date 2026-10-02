/** A star's color dataset installed in a generated package: the color record and its spectra, the limb law, the raster surface, the
 * catalogue and surface color, the dataset control, the dataset text, the manifest entries, the acquisition steps and the marker
 * recipe. Shared by placed stars (generate.mts) and companion stars on hosted orbits (hosted.mts), which are the same dataset. */
import { loadStellarPhotometricColor, type StellarColor } from '@cssearth/bake/objects/stellar';
import type { ColorChoice } from './color.mts';
import type { LimbChoice } from './limb.mts';

export const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const hex = (color: StellarColor) => `#${color.srgb.map(value => value.toString(16).padStart(2, '0')).join('')}`;

export type PackageFiles = Map<string, string | Buffer>;

/** Rewrite a scaffolded emissive package (its one `shape` dataset) into the color dataset. Returns the prepared color and the words
 * the rest of the package uses for it. */
export async function installColorDataset(files: PackageFiles, id: string, color: ColorChoice, limb: LimbChoice) {
  const o = `src/objects/${id}`, s = `${o}/source`, read = (path: string) => JSON.parse(String(files.get(path))) as Record<string, any>;
  for (const [path, bytes] of color.files) files.set(`${s}/${path}`, bytes);
  for (const file of limb.files ?? []) files.set(`${s}/${file.path}`, file.text);
  files.set(`${s}/photometry/stellar-color.json`, json(color.record));

  const words = color.route === 'planck' ? "a blackbody at the star's published temperature" : color.route === 'gaia-xp' ? "the star's Gaia DR3 BP/RP spectrum" : `the star's measured spectrum (${color.summary.split(':')[0]})`;
  const short = color.route === 'planck' ? "Color of a blackbody at the star's temperature" : color.route === 'gaia-xp' ? "Color from Gaia's spectrum of the star" : 'Color from its measured spectrum';
  const science: Record<string, unknown> = { kind: 'stellar-photometric-color', ...(limb.limbDarkening ? { limbDarkening: limb.limbDarkening } : {}),
    qualification: `${limb.limbDarkening ? 'Photosphere' : 'Uniform photosphere'} color from ${words}${limb.limbDarkening ? `, ${limb.sentence}` : `. ${limb.sentence}`}. The disc is unresolved: no map or absolute brightness is implied. Self-luminous, so no lighting.` };
  // The prepared color, through the dataset's own loader on the files as they will be written.
  const loaded = await loadStellarPhotometricColor(async path => { const value = files.get(`${s}/${path}`); if (value === undefined) throw new Error(`${id}: ${path} is not in the generated package.`); return Buffer.from(value); }, science, 'photometry/stellar-color.json');
  const colorHex = hex(loaded.color);

  const raster = read(`${s}/preparation/raster.json`);
  raster.surfaces = [{ id: 'color', output: `${id}-surface-{id}{suffix}.webp`, thumbnail: `${id}-dataset-{id}.webp`, source: 'photometry/stellar-color.json', falseColor: false, science }];
  if (limb.limbDarkening) raster.emission.metadata.limbMaterial.composition = 'black alpha darkens the photosphere according to the selected quadratic limb-darkening law; transparent outside the silhouette';
  files.set(`${s}/preparation/raster.json`, json(raster));
  const descriptor = read(`${o}/object.json`);
  descriptor.properties.recipe.surfaces[0].datasets = [{ id: 'color', source: 'content', material: 'emission' }];
  descriptor.properties.catalog.color = colorHex;
  files.set(`${o}/object.json`, json(descriptor));
  const geometry = read(`${s}/preparation/geometry.json`);
  geometry.surface.color = colorHex;
  geometry.surface.surface.url = `/scenes/${id}/${id}-surface-color@2x.webp`; geometry.surface.poles.url = `/scenes/${id}/${id}-poles-color@2x.webp`;
  if (geometry.output?.body) { geometry.output.body.sourceProjection = 'the color dataset: a uniform photosphere color on the reference sphere'; geometry.output.body.polarPreparation = 'the same color on the polar tiles'; }
  files.set(`${s}/preparation/geometry.json`, json(geometry));

  const content = read(`${s}/content/object.json`);
  content.datasets = { titleKey: 'datasets', defaultDataset: 'color', controls: [{ id: 'color', label: 'Color',
    qualification: `${short}${limb.limbDarkening ? '; darkening toward the edge from a model atmosphere' : ''}. The disc itself is unresolved.`,
    thumbnail: `${id}-dataset-color.webp`, surface: `${id}-surface-color@2x.webp`, poles: `${id}-poles-color@2x.webp`,
    source: { id: `${id}-stellar-color`, path: '../manifest.json', url: String(color.inputs.find(entry => entry.id === `${id}-stellar-color`)?.origin) }, falseColor: false,
    notes: `The color of ${words}. ${limb.limbDarkening ? `The darkening toward the edge is ${limb.sentence.replace(/^dimmed toward the limb by /u, '')}.` : `${limb.sentence}.`} The spin axis's direction on the sky is a display convention.` }] };
  files.set(`${s}/content/object.json`, json(content));
  const text = read(`${o}/text.json`);
  text.datasets = { color: { title: 'Photosphere color', detail: color.route === 'planck' ? 'From its temperature' : color.route === 'gaia-xp' ? 'From its Gaia spectrum' : 'From its spectrum',
    summary: `The color of the star's light${limb.limbDarkening ? ', dimmed toward the edge by a model atmosphere' : ''}.` } };
  files.set(`${o}/text.json`, json(text));

  const manifest = read(`${s}/manifest.json`);
  // The CIE table is the shared reference bank (src/references/cie-1931-2deg); bodies no longer carry a copy.
  manifest.inputs = [...manifest.inputs, ...color.inputs, ...limb.inputs ?? []];
  const markerInputs = [`${id}-stellar-color`, ...color.inputs.filter(entry => entry.id !== `${id}-stellar-color` && entry.id !== `${id}-crosscheck-spectrum`).map(entry => String(entry.id)), ...(limb.inputs ?? []).map(input => String(input.id)), `${id}-preparation-raster`];
  manifest.generatedIntermediates = [...(manifest.generatedIntermediates ?? []).filter((entry: { path: string }) => entry.path !== 'presentation/context.png'), {
    id: limb.limbDarkening ? 'limb-darkened-disc-context-marker' : 'uniform-disc-context-marker', path: 'presentation/context.png', origin: String(color.inputs[0]?.origin),
    credit: `The color dataset as a disc${limb.limbDarkening ? ', dimmed toward the limb by its model law' : ''}; rendered by packages/telescope-cli/src/source-authoring/context-markers.mts`, license: 'Project-authored display derivative.', consumers: ['navigation'],
    recipe: { generator: 'packages/telescope-cli/src/source-authoring/context-markers.mts', inputs: markerInputs }, generator: 'packages/telescope-cli/src/source-authoring/context-markers.mts',
    sourceBinding: { kind: 'local', reason: `The color dataset rendered as a disc${limb.limbDarkening ? ' with its limb darkening' : ''}; \`context-markers.mts --check\` recomputes it.` } }];
  files.set(`${s}/manifest.json`, json(manifest));
  const plan = read(`${s}/preparation/acquisition.json`);
  plan.operations = [...plan.operations, ...color.acquisition, ...limb.acquisitions ?? []];
  files.set(`${s}/preparation/acquisition.json`, json(plan));
  return { hex: colorHex, words, color: loaded.color };
}

/** Bind every manifest input that has no binding yet to its own catalogue record, `source-<object>-<entry>`, as the placed stars'
 * Gaia rows and limb grids are: site/build/prepare/author-source-records.mts writes the record in the bake. */
export function bindInputs(files: PackageFiles, id: string) {
  const path = `src/objects/${id}/source/manifest.json`, manifest = JSON.parse(String(files.get(path))) as { inputs: Record<string, unknown>[] };
  for (const input of manifest.inputs) if (input.sourceBinding === undefined) {
    const entry = String(input.id).startsWith(`${id}-`) ? String(input.id).slice(id.length + 1) : String(input.id);
    input.sourceBinding = { kind: 'catalogued', references: [{ catalogueId: `source-${id}-${entry}`, role: 'material', evidence: 'Origin and product identifier recorded on this manifest entry.' }] };
  }
  files.set(path, json(manifest));
}
