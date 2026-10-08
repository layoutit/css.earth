/**
 * What an object delivers from its `prepared/` directory.
 *
 * The rule: an inventory lists a prepared file only if something reads it after the bake that wrote it. A page, the page
 * server, the site build, or a later bake or refresh tool that cannot rebuild it from the runtime and the tracked
 * sources. A record only its own bake reads again, or a copy of part of another record, is a working record: it stays
 * on the machine that baked it and is never listed, published or restored.
 *
 * Top-level JSON records are where working records pile up, so each one is declared here by name with its reader; a bake
 * that writes an undeclared one is refused until it is declared. Files in subdirectories and files of other types are a
 * record's own banks, images and tables (layers, atlases, minimaps, views, point banks): they are delivered as their
 * record lists them.
 */

/** Who reads a delivered record after its bake. `unaudited`: listed before this ledger existed, no reader traced yet. */
export type PreparedReader = 'page' | 'site-build' | 'later-bake' | 'unaudited';
export interface DeliveredPreparedRecord { readonly name: string | RegExp; readonly reader: PreparedReader; readonly read: string }

export const DELIVERED_PREPARED_RECORDS: readonly DeliveredPreparedRecord[] = [
  // A layered body's page and its build.
  { name: 'runtime.json', reader: 'page', read: 'packages/objects/src/node/prepared-transport.ts builds the object, dataset and page transports from it' },
  { name: 'leaf-boxes.json', reader: 'page', read: 'packages/objects/src/node/prepared-runtime-files.ts puts a sphere\'s leaf boxes back into its runtime' },
  { name: 'controls.json', reader: 'page', read: 'site/server/object-page-data.mts, prepared-transport.ts and the catalogue steps of the site build' },
  { name: 'content.json', reader: 'site-build', read: 'site/components/ObjectPage.astro; packages/bake/src/contract/prepare-factsheets.ts' },
  { name: 'text.json', reader: 'site-build', read: 'site/components/PreparedObjectPanel.astro' },
  { name: 'datasets.json', reader: 'site-build', read: 'site/components/PreparedObjectPanel.astro; a bank package\'s browser-fetched dataset index' },
  { name: 'minimaps.json', reader: 'site-build', read: 'site/components/PreparedObjectPanel.astro' },
  { name: 'arrival-billboard.json', reader: 'site-build', read: 'site/build/prepare/prepare-object-discovery.mts' },
  { name: 'features.json', reader: 'site-build', read: 'site/build/prepare/catalog/prepare-feature-index.mts' },
  // Records a later bake or refresh tool reads and cannot rebuild from the runtime and the tracked sources.
  { name: 'authored-preparation.json', reader: 'later-bake', read: 'site/build/prepare/authored/prepare-authored.ts compares the next bake\'s sources with it' },
  { name: 'assets.json', reader: 'later-bake', read: 'site/build/content/prepare.ts and the content and photograph refreshes' },
  { name: 'surfaces.json', reader: 'later-bake', read: 'the surface, lighting and minimap refreshes (packages/bake/src/refresh-*)' },
  { name: 'material.json', reader: 'later-bake', read: 'the shape and sphere lighting refreshes (packages/bake/src/refresh-*)' },
  { name: /^source-lighting(-[a-z0-9-]+)?\.json$/u, reader: 'later-bake', read: 'packages/bake/src/objects/layers/terrestrial/radial/radial-materials.ts' },
  { name: 'panel.json', reader: 'later-bake', read: 'the content preparation of the bodies that author a panel' },
  { name: 'record.json', reader: 'later-bake', read: 'the volume bank preparation' },
  { name: 'texture-levels.json', reader: 'later-bake', read: 'the paged-ellipsoid preparation' },
  // The world and the bank packages: the site resolves these by content address (site/prepared/prepared-context-objects.mts).
  { name: 'members.json', reader: 'page', read: 'site/server/world-places.mts' },
  { name: 'places.json', reader: 'page', read: 'site/server/world-places.mts; site/world/application/world-approach.mts' },
  { name: 'world.json', reader: 'page', read: 'site/prepared/prepared-context-objects.mts' },
  { name: 'world-context.json', reader: 'page', read: 'site/prepared/prepared-context-objects.mts' },
  { name: 'world-index.json', reader: 'page', read: 'site/server/world-places.mts; site/directory/world-context-plan.mts' },
  { name: 'presentation.json', reader: 'site-build', read: 'site/build/prepare/catalog/prepare-context-availability.mts' },
  { name: 'delivery.json', reader: 'site-build', read: 'site/build/prepare/catalog/prepare-volume-presentation.mts' },
  { name: 'backing.json', reader: 'page', read: 'site/world/application/application-world-resources.mts' },
  { name: 'catalogue.json', reader: 'page', read: 'site/server/dot-catalogue-data.mts' },
  { name: 'display-sample.json', reader: 'site-build', read: 'site/build/prepare/catalog/prepare-catalog.mts' },
  { name: 'image-layers.json', reader: 'page', read: 'site/prepared/prepared-context-objects.mts' },
  { name: 'volume.json', reader: 'page', read: 'packages/renderer/src/volume/prepared-volume-readers.ts' },
  { name: 'volume-slices.json', reader: 'page', read: 'site/prepared/prepared-context-objects.mts' },
  { name: 'cmb.json', reader: 'page', read: 'site/prepared/prepared-context-objects.mts' },
  { name: 'stars.json', reader: 'page', read: 'site/prepared/prepared-context-objects.mts' },
  { name: 'stars-provenance.json', reader: 'page', read: 'site/prepared/prepared-context-objects.mts' },
  { name: 'shell.json', reader: 'page', read: 'site/prepared/prepared-context-objects.mts' },
  { name: 'surface-mesh.json', reader: 'page', read: 'site/prepared/prepared-context-objects.mts' },
  // Listed before this ledger and not traced to a reader by name (2026-10-08): fourteen files, under 1 MB together.
  // Each stays until its lane's next bake shows whether anything reads it.
  ...['image-quality.json', 'title.json', 'surface-raster-plan.json', 'raster-assets.json', 'runtime-assets.json', 'layouts.json', 'material-datasets.json', 'views.json']
    .map(name => ({ name, reader: 'unaudited' as const, read: 'no reader found by name' })),
];

export interface WorkingPreparedRecord { readonly name: string | RegExp; readonly why: string; readonly unless?: 'retains-scene' }

/**
 * The lanes that keep their scene delivered: a later refresh repaints from it and cannot rebuild it without the body's
 * downloads. The terrestrial and shape-model lanes read its atlas layout and faces
 * (packages/bake/src/objects/layers/terrestrial/retained-atlas.ts); the paged-ellipsoid lane reads its surface asset banks
 * on a reuse-images run (packages/bake/src/objects/layers/paged-ellipsoid/object.ts). A sphere's scene is rebuilt from its
 * tracked profile (packages/bake/src/scene/geometry-scene.ts), so it is a working record.
 */
export const SCENE_RETAINING_SOURCES: readonly string[] = ['terrestrial', 'shape-model', 'paged-ellipsoid'];
export interface PreparedDeliveryContext { readonly retainsScene?: boolean }
/** Whether an object descriptor's recipe names a lane that keeps its scene delivered. */
export function retainsPreparedScene(descriptor: unknown): boolean {
  const record = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const sources = record(record(record(descriptor).properties).recipe).sources;
  return Array.isArray(sources) && sources.some(source => SCENE_RETAINING_SOURCES.includes(String(record(source).id)));
}
/** Records a checkout writes for itself. Never inventoried, published or restored. */
export const WORKING_PREPARED_RECORDS: readonly WorkingPreparedRecord[] = [
  { name: 'inventory.json', why: 'the staging copy of the inventory itself' },
  { name: 'object.json', why: 'the object transport, built from the runtime when read' },
  { name: 'page.json', why: 'the page transport, built from the runtime when read' },
  { name: /^terrain(-[a-z0-9-]+)?\.json$/u, why: 'a radial-terrain report only the audits read' },
  { name: /-source-index\.json$/u, why: 'a source-index raster only the audits read' },
  { name: 'scene.json', why: 'the scene a bake builds before its presentation: the runtime carries what the page draws', unless: 'retains-scene' },
  { name: 'sky.json', why: 'a copy of the runtime\'s sky' },
  { name: 'sun.json', why: 'a copy of the runtime\'s sun' },
  { name: 'world-navigation.json', why: 'the receipt of the world-navigation step, which every page step rewrites' },
  // Written by an earlier preparation and by none now; a checkout baked before the retirement still holds them.
  { name: 'provenance.json', why: 'retired 2026-09-29: lineage is read from the source records' },
  { name: 'lenses.json', why: 'retired 2026-09-29: datasets.json replaced it' },
];

const names = (entry: { readonly name: string | RegExp }, filename: string) => typeof entry.name === 'string' ? entry.name === filename : entry.name.test(filename);
const topLevelRecord = (filename: string) => !filename.includes('/') && filename.endsWith('.json');

/** The record a scene-retaining lane delivers in place of treating its scene as a working record. */
const RETAINED_SCENE: DeliveredPreparedRecord = { name: 'scene.json', reader: 'later-bake', read: 'the shape refreshes (retained-atlas.ts) and the paged-ellipsoid reuse-images run' };

/** A file the checkout keeps to itself. */
export function isWorkingPreparedFile(filename: string, { retainsScene = false }: PreparedDeliveryContext = {}): boolean {
  return topLevelRecord(filename) && WORKING_PREPARED_RECORDS.some(entry => names(entry, filename) && !(entry.unless === 'retains-scene' && retainsScene));
}

/** The ledger's entry for a top-level record, when it is delivered. */
export function deliveredPreparedRecord(filename: string, { retainsScene = false }: PreparedDeliveryContext = {}): DeliveredPreparedRecord | undefined {
  if (!topLevelRecord(filename)) return undefined;
  return retainsScene && filename === RETAINED_SCENE.name ? RETAINED_SCENE : DELIVERED_PREPARED_RECORDS.find(entry => names(entry, filename));
}

/**
 * The files of `prepared/` an inventory lists, from every file found there. A top-level record that is neither delivered
 * nor a working record is refused: declare it above with its reader, or as a working record.
 */
export function deliveredPreparedFiles(filenames: readonly string[], objectId: string, context: PreparedDeliveryContext = {}): string[] {
  const undeclared = filenames.filter(filename => topLevelRecord(filename) && !isWorkingPreparedFile(filename, context) && !deliveredPreparedRecord(filename, context));
  if (undeclared.length) {
    throw new TypeError(`Object ${objectId} wrote prepared record(s) the delivery ledger does not declare: ${undeclared.join(', ')}. ` +
      'Name each in packages/objects/src/node/prepared-delivery.ts with what reads it after the bake, or as a working record; delete it if an earlier preparation left it.');
  }
  return filenames.filter(filename => !isWorkingPreparedFile(filename, context));
}
