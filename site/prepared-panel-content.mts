import { requireControls } from '../src/renderers/css/dist/index.js';
import { record } from './browser-types.mts';
import type { Props, ObjectTitle, PreparedTitle, Fact, Chart, Gallery, Lens, LensControl, DatasetReaderText } from './object-shell-types.js';

const object = (value: unknown, label: string): Record<string, unknown> => {
  if (!record(value)) throw new TypeError(`Prepared ${label} must be an object.`);
  return value;
};
const text = (value: unknown, label: string): string => {
  if (typeof value !== 'string') throw new TypeError(`Prepared ${label} must be text.`);
  return value;
};
const number = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`Prepared ${label} must be finite.`);
  return value;
};
const optionalText = (value: unknown, label: string) => value === undefined ? undefined : text(value, label);
const optionalBoolean = (value: unknown, label: string) => {
  if (value !== undefined && typeof value !== 'boolean') throw new TypeError(`Prepared ${label} must be boolean.`);
  return value;
};
const array = (value: unknown, label: string): readonly unknown[] => {
  if (!Array.isArray(value)) throw new TypeError(`Prepared ${label} must be an array.`);
  return value;
};
function rasterTitle(value: unknown): PreparedTitle {
  const title = object(value, 'raster title');
  return { label: text(title.label, 'title label'), src: text(title.src, 'title image'), width: number(title.width, 'title width'), height: number(title.height, 'title height') };
}
function objectTitle(value: unknown): ObjectTitle {
  const title = object(value, 'object title');
  return { label: text(title.label, 'title label'), path: text(title.path, 'title path'), viewBox: text(title.viewBox, 'title view box'),
    renderViewBox: text(title.renderViewBox, 'title render view box'), renderWidth: number(title.renderWidth, 'title width'), renderHeight: number(title.renderHeight, 'title height'),
    renderPathOffsetY: number(title.renderPathOffsetY, 'title offset'), baseline: number(title.baseline, 'title baseline') };
}
function facts(value: unknown): Fact[] {
  return array(value, 'facts').map(value => { const fact = object(value, 'fact'); return { id: text(fact.id, 'fact id'), label: text(fact.label, 'fact label'), value: text(fact.value, 'fact value') }; });
}
function chart(value: unknown): Chart {
  const chart = object(value, 'chart'), title = object(chart.title, 'chart title');
  return { id: text(chart.id, 'chart id'), title: { label: text(title.label, 'chart title') }, open: optionalBoolean(chart.open, 'chart open'), src: text(chart.src, 'chart image'),
    width: number(chart.width, 'chart width'), height: number(chart.height, 'chart height'), alt: text(chart.alt, 'chart description') };
}
function gallery(value: unknown): Gallery {
  const gallery = object(value, 'gallery');
  return { id: text(gallery.id, 'gallery id'), title: rasterTitle(gallery.title), open: optionalBoolean(gallery.open, 'gallery open'), hidden: optionalBoolean(gallery.hidden, 'gallery hidden'),
    qualification: optionalText(gallery.qualification, 'gallery qualification'), items: array(gallery.items, 'gallery images').map(value => {
      const item = object(value, 'gallery image');
      return { id: text(item.id, 'image id'), label: text(item.label, 'image label'), src: text(item.src, 'image URL'), width: number(item.width, 'image width'), height: number(item.height, 'image height'),
        alt: text(item.alt, 'image alt'), caption: text(item.caption, 'image caption'), sourceUrl: text(item.sourceUrl, 'image source') };
    }) };
}
function legend(value: unknown, label: string): Lens['legend'] {
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
/** Volume presentations publish their own reader text with each lens; body controls carry none and join prepared text instead. */
export function parseDatasetLens(value: unknown): Lens {
  const lens = object(value, 'lens'), label = text(lens.label, 'lens label');
  const texture = lens.texture === undefined ? undefined : object(lens.texture, 'lens texture');
  const attribution = texture?.attribution === undefined ? undefined : object(texture.attribution, 'texture attribution');
  return { id: text(lens.id, 'lens id'), label, title: text(lens.title, 'lens title'), summary: text(lens.summary, 'lens summary'), description: optionalText(lens.description, 'lens description'),
    detail: optionalText(lens.detail, 'lens detail'), thumbnailUrl: text(lens.thumbnailUrl, 'lens thumbnail'),
    texture: texture && { url: text(texture.url, 'texture URL'), width: number(texture.width, 'texture width'), height: number(texture.height, 'texture height'),
      minimap: texture.minimap, attribution: attribution && { label: text(attribution.label, 'texture attribution'), url: optionalText(attribution.url, 'texture source') } },
    facts: lens.facts === undefined ? undefined : facts(lens.facts), legend: legend(lens.legend, label) };
}
function lensControl(value: unknown): LensControl {
  const lens = object(value, 'lens'), label = text(lens.label, 'lens label');
  const prose = ['title', 'detail', 'summary', 'description'].filter(key => Object.hasOwn(lens, key));
  if (prose.length) throw new TypeError(`Prepared lens controls carry reader text (${prose.join(', ')}); it belongs in prepared content.`);
  const noData = optionalBoolean(lens.noData, 'lens no-data grid');
  // A dataset that draws a companion cloud borrows another dataset's prepared surface for the body. The panel needs
  // the marker to publish that dataset's legend beside this one's; without it the body is drawn in an unexplained scale.
  const volume = lens.volume === undefined ? undefined : object(lens.volume, 'lens volume');
  return { id: text(lens.id, 'lens id'), label, thumbnailUrl: text(lens.thumbnailUrl, 'lens thumbnail'),
    ...(noData === undefined ? {} : { noData }),
    ...(volume === undefined ? {} : { volume: { objectId: text(volume.objectId, 'volume object'), lensId: text(volume.lensId, 'volume lens'), surface: text(volume.surface, 'volume surface') } }),
    facts: lens.facts === undefined ? undefined : facts(lens.facts), legend: legend(lens.legend, label) };
}

export interface PanelControls {
  lenses?: Omit<NonNullable<Props['lenses']>, 'controls'> & { controls: LensControl[] };
  settings: Props['settings'];
}

/** Join each dataset control to its published reader text; a control without text is an incomplete package. */
export function withDatasetText(lenses: PanelControls['lenses'], datasets: Readonly<Record<string, DatasetReaderText>>): Props['lenses'] {
  if (!lenses) return undefined;
  return { ...lenses, controls: lenses.controls.map((control): Lens => {
    const dataset = datasets[control.id];
    if (!dataset) throw new TypeError(`Dataset ${control.id} has no published reader text.`);
    return { ...control, title: dataset.title, ...(dataset.detail === undefined ? {} : { detail: dataset.detail }), summary: dataset.summary };
  }) };
}

/** Validate the fields the shared Astro panel renders, before assigning display types. */
export function parsePreparedPanelContent(value: unknown): Pick<Props, 'objectId' | 'title' | 'facts' | 'moreFacts' | 'charts' | 'galleries' | 'destinations' | 'features'> {
  const content = object(value, 'panel content');
  if (content.schema !== 'cssearth-prepared-content@1') throw new TypeError('Prepared panel content schema is incompatible.');
  const destinations = content.destinations === undefined ? undefined : object(content.destinations, 'destinations');
  const features = content.features === undefined ? undefined : object(content.features, 'features');
  return { objectId: text(content.objectId, 'object id'), title: objectTitle(content.title),
    facts: facts(content.facts), moreFacts: facts(content.moreFacts), charts: array(content.charts, 'charts').map(chart), galleries: array(content.galleries, 'galleries').map(gallery),
    destinations: destinations ? { searchLabel: text(destinations.searchLabel, 'destination search label'), description: text(destinations.description, 'destination description') } : undefined,
    features: features ? { searchLabel: text(features.searchLabel, 'feature search label'), description: text(features.description, 'feature description') } : undefined };
}

export function parsePanelControls(input: unknown): PanelControls {
  requireControls(input);
  const controls = input;
  return { lenses: controls.lenses ? { title: rasterTitle(controls.lenses.title), defaultLens: controls.lenses.defaultLens, controls: controls.lenses.controls.map(lensControl) } : undefined,
    settings: controls.settings ? { title: rasterTitle(controls.settings.title), controls: [...controls.settings.controls] } : undefined };
}
