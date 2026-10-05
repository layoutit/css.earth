import { requireControls, preparedPanelReaders, type PreparedTitle, type Fact } from '@cssearth/objects';
const { object, text, number, optionalText, optionalBoolean, array } = preparedPanelReaders;
import type { Props, Dataset, DatasetControl, DatasetReaderText } from '../contracts/object-shell-types.js';

const stepOpens = (value: unknown) => {
  if (value !== 'first' && value !== 'last') throw new TypeError(`Prepared dataset step opens must be "first" or "last", not ${JSON.stringify(value)}.`);
  return value;
};
function rasterTitle(value: unknown): PreparedTitle {
  const title = object(value, 'raster title');
  return { label: text(title.label, 'title label'), src: text(title.src, 'title image'), width: number(title.width, 'title width'), height: number(title.height, 'title height') };
}
function facts(value: unknown): Fact[] {
  return array(value, 'facts').map(value => { const fact = object(value, 'fact'); return { id: text(fact.id, 'fact id'), label: text(fact.label, 'fact label'), value: text(fact.value, 'fact value') }; });
}
function legend(value: unknown, label: string): Dataset['legend'] {
  if (value === undefined) return undefined;
  const legend = Array.isArray(value) ? { kind: 'categories', title: label, items: value } : object(value, 'legend');
  if (legend.kind !== 'scale' && legend.kind !== 'categories') throw new TypeError('Prepared legend kind is invalid.');
  return { kind: legend.kind, title: text(legend.title, 'legend title'), meta: optionalText(legend.meta, 'legend metadata'), src: optionalText(legend.src, 'legend image'),
    width: legend.width === undefined ? undefined : number(legend.width, 'legend width'), height: legend.height === undefined ? undefined : number(legend.height, 'legend height'),
    sourceUrl: optionalText(legend.sourceUrl, 'legend source'), colors: legend.colors === undefined ? undefined : array(legend.colors, 'legend colors').map(value => text(value, 'legend color')),
    labels: legend.labels === undefined ? undefined : array(legend.labels, 'legend labels').map(value => text(value, 'legend label')),
    items: legend.items === undefined ? undefined : array(legend.items, 'legend categories').map(value => { const item = object(value, 'legend category');
      return { label: text(item.label, 'legend category label'), description: optionalText(item.description, 'legend category description') ?? '', color: text(item.color, 'legend category color') }; }) };
}
/** Volume presentations publish their own reader text with each dataset; body controls carry none and join prepared text instead. */
export function parseDatasetControl(value: unknown): Dataset {
  const dataset = object(value, 'dataset'), label = text(dataset.label, 'dataset label');
  const texture = dataset.texture === undefined ? undefined : object(dataset.texture, 'dataset texture');
  const attribution = texture?.attribution === undefined ? undefined : object(texture.attribution, 'texture attribution');
  return { id: text(dataset.id, 'dataset id'), label, title: text(dataset.title, 'dataset title'), summary: text(dataset.summary, 'dataset summary'), description: optionalText(dataset.description, 'dataset description'),
    detail: optionalText(dataset.detail, 'dataset detail'), thumbnailUrl: text(dataset.thumbnailUrl, 'dataset thumbnail'),
    texture: texture && { url: text(texture.url, 'texture URL'), width: number(texture.width, 'texture width'), height: number(texture.height, 'texture height'),
      minimap: texture.minimap, attribution: attribution && { label: text(attribution.label, 'texture attribution'), url: optionalText(attribution.url, 'texture source') } },
    facts: dataset.facts === undefined ? undefined : facts(dataset.facts), legend: legend(dataset.legend, label) };
}
function datasetControl(value: unknown): DatasetControl {
  const dataset = object(value, 'dataset'), label = text(dataset.label, 'dataset label');
  const prose = ['title', 'detail', 'summary', 'description'].filter(key => Object.hasOwn(dataset, key));
  if (prose.length) throw new TypeError(`Prepared dataset controls carry reader text (${prose.join(', ')}); it belongs in prepared content.`);
  const noData = optionalBoolean(dataset.noData, 'dataset no-data grid');
  // A dataset that draws a companion cloud borrows another dataset's prepared surface for the body. The panel needs
  // the marker to publish that dataset's legend beside this one's; without it the body is drawn in an unexplained scale.
  const volume = dataset.volume === undefined ? undefined : object(dataset.volume, 'dataset volume');
  const step = dataset.step === undefined ? undefined : object(dataset.step, 'dataset step');
  // A dataset that is a bank's (a galaxy's image, a nebula's volume) publishes its own preview image; a body's dataset
  // takes its preview from its surface minimap (PreparedObjectPanel.astro).
  const texture = dataset.texture === undefined ? undefined : object(dataset.texture, 'dataset texture');
  const attribution = texture?.attribution === undefined ? undefined : object(texture.attribution, 'texture attribution');
  return { id: text(dataset.id, 'dataset id'), label, thumbnailUrl: text(dataset.thumbnailUrl, 'dataset thumbnail'),
    ...(texture === undefined ? {} : { texture: { url: text(texture.url, 'texture URL'), width: number(texture.width, 'texture width'), height: number(texture.height, 'texture height'),
      attribution: attribution && { label: text(attribution.label, 'texture attribution'), url: optionalText(attribution.url, 'texture source') } } }),
    ...(noData === undefined ? {} : { noData }),
    ...(step === undefined ? {} : { step: { group: text(step.group, 'dataset step group'), label: text(step.label, 'dataset step label'),
      ...(step.autoplay === undefined ? {} : { autoplay: optionalBoolean(step.autoplay, 'dataset step autoplay') }),
      ...(step.opens === undefined ? {} : { opens: stepOpens(step.opens) }) } }),
    ...(volume === undefined ? {} : { volume: { objectId: text(volume.objectId, 'volume object'), datasetId: text(volume.datasetId, 'volume dataset'), surface: text(volume.surface, 'volume surface') } }),
    facts: dataset.facts === undefined ? undefined : facts(dataset.facts), legend: legend(dataset.legend, label) };
}

export interface PanelControls {
  datasets?: Omit<NonNullable<Props['datasets']>, 'controls'> & { controls: DatasetControl[] };
  settings: Props['settings'];
}

/** Join each dataset control to its published reader text; a control without text is an incomplete package. */
export function withDatasetText(datasets: PanelControls['datasets'], readerTexts: Readonly<Record<string, DatasetReaderText>>): Props['datasets'] {
  if (!datasets) return undefined;
  return { ...datasets, controls: datasets.controls.map((control): Dataset => {
    const readerText = readerTexts[control.id];
    if (!readerText) throw new TypeError(`Dataset ${control.id} has no published reader text.`);
    return { ...control, title: readerText.title, ...(readerText.detail === undefined ? {} : { detail: readerText.detail }), summary: readerText.summary };
  }) };
}

/** The datasets a body's raster recipe declares as one uniform color, with the color its prepared surface holds. */
export function uniformDatasetColors(raster: unknown, prepared: unknown, objectId: string): Map<string, string> {
  const colors = new Map<string, string>();
  const surfaces = raster === undefined ? [] : array(object(raster, `${objectId} raster recipe`).surfaces ?? [], `${objectId} raster surfaces`);
  const uniform = surfaces.map(value => object(value, `${objectId} raster surface`))
    .filter(surface => surface.science !== undefined && object(surface.science, `${objectId} surface science`).kind === 'stellar-photometric-color')
    .map(surface => text(surface.id, `${objectId} raster surface id`));
  if (!uniform.length) return colors;
  const controls = array(object(prepared, `${objectId} prepared datasets`).controls, `${objectId} prepared dataset controls`).map(value => object(value, `${objectId} prepared dataset`));
  for (const id of uniform) {
    const color = controls.find(control => control.id === id)?.billboardColor;
    if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/iu.test(color)) {
      throw new TypeError(`${objectId}: src/objects/${objectId}/prepared/datasets.json dataset ${id} billboardColor is ${JSON.stringify(color ?? null)}; expected a #rrggbb color for a uniform surface.`);
    }
    colors.set(id, color.toLowerCase());
  }
  return colors;
}

export function parsePanelControls(input: unknown): PanelControls {
  requireControls(input);
  const controls = input;
  return { datasets: controls.datasets ? { title: rasterTitle(controls.datasets.title), defaultDataset: controls.datasets.defaultDataset, controls: controls.datasets.controls.map(datasetControl) } : undefined,
    settings: controls.settings ? { title: rasterTitle(controls.settings.title), controls: [...controls.settings.controls] } : undefined };
}
