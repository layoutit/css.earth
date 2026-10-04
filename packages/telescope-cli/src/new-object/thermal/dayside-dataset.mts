/** A measured day side as a dataset of its own, for a planet whose eclipse was measured but whose heat cannot be shown as a
 * glow: a day side under 1,000 K has no visible black-body color, and on an eccentric orbit one eclipse is one moment of the
 * orbit. The measurement is still a measurement, so it is drawn the way the heat maps are: the `measured-dayside` format
 * (packages/bake/src/objects/raster/eclipse-map/eclipse-map-fit.ts) paints the hemisphere under the star in false color at
 * the one printed brightness temperature and leaves the night hemisphere blank, because an eclipse says nothing of it. Every
 * planet shown this way shares one scale, so their colors compare. */
import { requireArray, requireRecord } from '@cssearth/core';
import { DAYSIDE_TEMPERATURE_SCHEMA } from '@cssearth/objects';
import { bindInputs, json, openOnMap, type PackageFiles } from '../dataset.mts';
import type { ThermalSpec } from '../spec.mts';

/** The scale every measured day side shares: plasma from 300 to 3,000 K. */
export const DAYSIDE_SCALE = { minimum: 300, maximum: 3000, colors: ['#0d0887', '#7e03a8', '#cc4778', '#f89540', '#f0f921'], labels: ['300', '1650', '3000'] };
export const DAYSIDE_DATASET = 'dayside';
const RECORD_PATH = 'photometry/dayside-temperature.json';

/** The body README's paragraph for the dataset. */
export const daysideLine = (thermal: ThermalSpec, atEclipse: boolean) =>
  `**Measured day side.** The page opens on the one thing measured of its surface: a dayside brightness temperature of ${thermal.temperatureK.toLocaleString('en-US')} K at ${thermal.wavelengthMicrometres} µm${atEclipse ? ', at secondary eclipse,' : ''} (${thermal.source}; [record](source/${RECORD_PATH})). ${thermal.where ? `Read from the paper (${thermal.where}): ` : 'Chosen by rule: '}${thermal.chosen}. The \`measured-dayside\` format paints the hemisphere under the star in false color at that temperature, on the 300 to 3,000 K scale every measured day side shares, and leaves the night hemisphere blank. ${atEclipse ? 'The orbit is eccentric, so this is the day side at the moment of eclipse, not round the orbit. ' : ''}${thermal.temperatureK <= 1000 ? 'It is too cool for a visible glow, so no black-body color is shown.' : 'No black-body glow is shown, since the temperature holds for one moment of the orbit.'}`;

/** Add the dataset to the package in `files`, beside its shape. It becomes the default where the default was one color or the
 * neutral shape. `atEclipse` says the orbit is eccentric: the texts then say when the temperature holds. */
export function installDaysideDataset(files: PackageFiles, id: string, name: string, thermal: ThermalSpec, atEclipse: boolean) {
  const o = `src/objects/${id}`, s = `${o}/source`, read = (path: string) => requireRecord(JSON.parse(String(files.get(path))), path);
  const without = (list: unknown, where: string, key: string, values: readonly string[]) => requireArray(list, where).filter(item => !values.includes(String(requireRecord(item, where)[key])));
  const kelvin = thermal.temperatureK, error = thermal.uncertaintyK ?? 0, shown = kelvin.toLocaleString('en-US'), when = atEclipse ? ' at secondary eclipse' : '';
  const { minimum, maximum, colors, labels } = DAYSIDE_SCALE, consumer = `${id}-measured-dayside`, input = `${id}-dayside-temperature`;
  if (!(kelvin >= minimum && kelvin <= maximum)) throw new RangeError(`${id}: a dayside temperature of ${kelvin} K is outside the ${minimum} to ${maximum} K scale the measured day sides share.`);
  files.set(`${s}/${RECORD_PATH}`, json({ schema: DAYSIDE_TEMPERATURE_SCHEMA, planet: id, temperatureK: { value: kelvin, lower: kelvin - error, upper: kelvin + error }, wavelengthMicrons: thermal.wavelengthMicrometres,
    source: `${thermal.source}${thermal.where ? ` (${thermal.where})` : ''}. ${thermal.chosen}. ${thermal.url}` }));

  const raster = read(`${s}/preparation/raster.json`), lit = raster.emission === undefined;
  const science = { kind: 'terrestrial-scientific', id: DAYSIDE_DATASET, label: 'Day side', format: 'measured-dayside', path: RECORD_PATH, sampling: 'bilinear', units: 'K', planet: id, consumer, displaySampling: 'bilinear',
    outputLongitudeOrigin: 0, minimum, maximum, colors, labels,
    description: `Measured: the day side's brightness temperature${when}, ${shown} K at ${thermal.wavelengthMicrometres} µm (${thermal.facility}). One number for the whole day side; the night side is not measured and is left blank.`,
    title: `${thermal.facility} · measured day side`, sourceUrl: thermal.url };
  raster.surfaces = [...without(raster.surfaces, `${id} raster surfaces`, 'id', [DAYSIDE_DATASET]),
    { id: DAYSIDE_DATASET, output: `${id}-surface-{id}{suffix}.webp`, thumbnail: `${id}-dataset-{id}.webp`, source: RECORD_PATH, falseColor: true, science }];
  files.set(`${s}/preparation/raster.json`, json(raster));
  const descriptor = read(`${o}/object.json`), recipe = requireRecord(requireRecord(descriptor.properties, `${id} properties`).recipe, `${id} recipe`);
  const surface = requireRecord(requireArray(recipe.surfaces, `${id} recipe surfaces`)[0], `${id} recipe surface`);
  surface.datasets = [...without(surface.datasets, `${id} recipe datasets`, 'id', [DAYSIDE_DATASET]), { id: DAYSIDE_DATASET, source: 'content', material: lit ? 'lighting' : 'emission' }];
  files.set(`${o}/object.json`, json(descriptor));

  const content = read(`${s}/content/object.json`), palette = colors.map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
  const control = { id: DAYSIDE_DATASET, label: 'Day side', qualification: `Measured in eclipse${when}: ${thermal.source}`,
    thumbnail: `${id}-dataset-${DAYSIDE_DATASET}.webp`, surface: `${id}-surface-${DAYSIDE_DATASET}@2x.webp`, poles: `${id}-poles-${DAYSIDE_DATASET}@2x.webp`, source: { id: input, path: '../manifest.json', url: thermal.url }, falseColor: true,
    legend: { kind: 'scale', title: 'Brightness temperature', labels, recipe: { palette, labels }, meta: 'K', sourceUrl: thermal.url },
    notes: `The day side of ${name} is ${shown} K${when}: its brightness temperature at ${thermal.wavelengthMicrometres} µm (${thermal.facility}), measured from the light lost when the planet passes behind its star. The false color shows that one number over the day side, on a scale every planet shown this way shares. The night side is not measured and is left blank.${atEclipse ? ' The orbit is eccentric, so the temperature holds for the moment of eclipse, not round the orbit.' : ''}${lit ? " With shadows on, the star's light darkens the night half." : ''}` };
  const datasets = requireRecord(content.datasets, `${id} content datasets`);
  datasets.controls = [...without(datasets.controls, `${id} dataset controls`, 'id', [DAYSIDE_DATASET]), control];
  files.set(`${s}/content/object.json`, json(content));
  const text = read(`${o}/text.json`);
  text.datasets = { ...requireRecord(text.datasets ?? {}, `${id} text datasets`), [DAYSIDE_DATASET]: { title: 'Measured day side', detail: 'Measured in eclipse',
    summary: `The day side is ${shown} K${when}, measured at ${thermal.wavelengthMicrometres} µm. The night side is not measured.` } };
  files.set(`${o}/text.json`, json(text));

  const manifest = read(`${s}/manifest.json`);
  manifest.inputs = [...without(manifest.inputs, `${id} manifest inputs`, 'id', [input]),
    { id: input, path: RECORD_PATH, origin: thermal.url, credit: thermal.source, license: 'Factual numerical measurement; source attribution retained',
      acquisition: 'Transcribed measurement record: the dayside brightness temperature and its one-sigma range, with the row chosen', redistribution: 'A one-number measurement record', consumers: [consumer] }];
  files.set(`${s}/manifest.json`, json(manifest));
  bindInputs(files, id);
  return { promoted: openOnMap(files, id, DAYSIDE_DATASET) };
}
