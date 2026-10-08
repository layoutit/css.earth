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

/** Who reads a delivered record after its bake. */
export type PreparedReader = 'page' | 'site-build' | 'later-bake';
/** What a body's descriptor says about its delivery. A directory without a descriptor (a fixture, a stage) has neither. */
export interface PreparedDeliveryContext { readonly retainsScene?: boolean; readonly keepsMaterial?: boolean }
/** `when`: delivered only for a body the named context is true of, and a working record for every other body. */
export interface DeliveredPreparedRecord { readonly name: string | RegExp; readonly reader: PreparedReader; readonly read: string; readonly when?: keyof PreparedDeliveryContext }

export const DELIVERED_PREPARED_RECORDS: readonly DeliveredPreparedRecord[] = [
  // A layered body's page and its build.
  { name: 'runtime.json', reader: 'page', read: 'packages/objects/src/node/prepared-transport.ts builds the object, dataset and page transports from it' },
  { name: 'leaf-boxes.json', reader: 'page', read: 'packages/objects/src/node/prepared-runtime-files.ts puts a sphere\'s leaf boxes back into its runtime' },
  { name: 'content.json', reader: 'site-build', read: 'site/components/ObjectPage.astro; packages/bake/src/contract/prepare-factsheets.ts' },
  { name: 'text.json', reader: 'site-build', read: 'site/components/PreparedObjectPanel.astro' },
  { name: 'datasets.json', reader: 'site-build', read: 'site/components/PreparedObjectPanel.astro; a bank package\'s browser-fetched dataset index' },
  { name: 'minimaps.json', reader: 'site-build', read: 'site/components/PreparedObjectPanel.astro' },
  { name: 'arrival-billboard.json', reader: 'site-build', read: 'site/build/prepare/prepare-object-discovery.mts' },
  { name: 'features.json', reader: 'site-build', read: 'site/build/prepare/catalog/prepare-feature-index.mts' },
  { name: 'geographic-places.json', reader: 'site-build', read: 'site/build/prepare/catalog/prepare-feature-index.mts: the pin of a body\'s city catalogue' },
  // Records a later bake or refresh tool reads and cannot rebuild from the runtime and the tracked sources.
  { name: 'authored-preparation.json', reader: 'later-bake', read: 'site/build/prepare/authored/prepare-authored.ts compares the next bake\'s sources with it' },
  { name: 'assets.json', reader: 'later-bake', read: 'site/build/content/prepare.ts and the content and photograph refreshes' },
  { name: 'surfaces.json', reader: 'later-bake', read: 'the surface, lighting and minimap refreshes (packages/bake/src/refresh-*)' },
  // A solid sphere's material holds its lighting bank and pole images. A shape body bakes its light into its mesh atlases:
  // its material would be its surface list again, so it has none.
  { name: 'material.json', reader: 'later-bake', read: 'packages/bake/cli/refresh-sphere-lighting.mts', when: 'keepsMaterial' },
  // A scene is delivered by the lanes whose later refresh repaints from it and cannot rebuild it without the body's
  // downloads: the terrestrial and shape-model lanes read its atlas layout and faces
  // (packages/bake/src/objects/layers/terrestrial/retained-atlas.ts), the paged-ellipsoid lane its surface asset banks on
  // a reuse-images run (packages/bake/src/objects/layers/paged-ellipsoid/object.ts). A sphere's scene is rebuilt from its
  // tracked profile (packages/bake/src/scene/geometry-scene.ts): the runtime carries what the page draws.
  { name: 'scene.json', reader: 'later-bake', read: 'the shape refreshes (retained-atlas.ts) and the paged-ellipsoid reuse-images run', when: 'retainsScene' },
  { name: /^source-lighting(-[a-z0-9-]+)?\.json$/u, reader: 'later-bake', read: 'packages/bake/src/objects/layers/terrestrial/radial/radial-materials.ts' },
  { name: 'panel.json', reader: 'later-bake', read: 'the content preparation of the bodies that author a panel' },
  { name: 'record.json', reader: 'later-bake', read: 'the volume bank preparation' },
  { name: 'texture-levels.json', reader: 'later-bake', read: 'the paged-ellipsoid preparation' },
  { name: 'surface-raster-plan.json', reader: 'later-bake', read: 'packages/bake/src/objects/layers/paged-ellipsoid/object.ts compares a reuse-images run with it' },
  { name: 'raster-assets.json', reader: 'later-bake', read: 'packages/bake/src/objects/layers/paged-ellipsoid/object.ts carries its image metadata into a reuse-images run' },
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
];

export interface WorkingPreparedRecord { readonly name: string | RegExp; readonly why: string }

/** The recipe sources of the lanes that keep their scene delivered. */
export const SCENE_RETAINING_SOURCES: readonly string[] = ['terrestrial', 'shape-model', 'paged-ellipsoid'];
/** The delivery context of the body an object descriptor describes. */
export function preparedDeliveryContext(descriptor: unknown): Required<PreparedDeliveryContext> {
  const record = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const recipe = record(record(record(descriptor).properties).recipe), sources = recipe.sources, shape = record(recipe.shape).kind;
  return { retainsScene: Array.isArray(sources) && sources.some(source => SCENE_RETAINING_SOURCES.includes(String(record(source).id))),
    keepsMaterial: shape !== undefined && shape !== 'radial-terrain' };
}
/** Records a checkout writes for itself. Never inventoried, published or restored. */
export const WORKING_PREPARED_RECORDS: readonly WorkingPreparedRecord[] = [
  { name: 'inventory.json', why: 'the staging copy of the inventory itself' },
  { name: 'object.json', why: 'the object transport, built from the runtime when read' },
  { name: 'page.json', why: 'the page transport, built from the runtime when read' },
  { name: /^terrain(-[a-z0-9-]+)?\.json$/u, why: 'a radial-terrain report only the audits read' },
  { name: /-source-index\.json$/u, why: 'a source-index raster only the audits read' },
  { name: 'controls.json', why: 'the content step\'s controls, which the runtime carries: readers take them from it (prepared-transport.ts)' },
  { name: 'sky.json', why: 'a copy of the runtime\'s sky' },
  { name: 'sun.json', why: 'a copy of the runtime\'s sun' },
  { name: 'world-navigation.json', why: 'the receipt of the world-navigation step, which every page step rewrites' },
  { name: /^(material-datasets|views|layouts)\.json$/u, why: 'the material-composition lane\'s datasets, views and layouts before its runtime carries them' },
  // Written by an earlier preparation and by none now; a checkout baked before the retirement still holds them.
  { name: /^(image-quality|title|runtime-assets)\.json$/u, why: 'nothing writes or reads them (traced 2026-10-08)' },
  { name: 'provenance.json', why: 'retired 2026-09-29: lineage is read from the source records' },
  { name: 'lenses.json', why: 'retired 2026-09-29: datasets.json replaced it' },
];

const names = (entry: { readonly name: string | RegExp }, filename: string) => typeof entry.name === 'string' ? entry.name === filename : entry.name.test(filename);
const topLevelRecord = (filename: string) => !filename.includes('/') && filename.endsWith('.json');

/** The ledger's entry for a top-level record, when this body delivers it. */
export function deliveredPreparedRecord(filename: string, context: PreparedDeliveryContext = {}): DeliveredPreparedRecord | undefined {
  if (!topLevelRecord(filename)) return undefined;
  return DELIVERED_PREPARED_RECORDS.find(entry => names(entry, filename) && (!entry.when || context[entry.when] === true));
}

/** A file the checkout keeps to itself: a working record, or a record only other lanes deliver. */
export function isWorkingPreparedFile(filename: string, context: PreparedDeliveryContext = {}): boolean {
  return topLevelRecord(filename) && !deliveredPreparedRecord(filename, context) &&
    [...WORKING_PREPARED_RECORDS, ...DELIVERED_PREPARED_RECORDS].some(entry => names(entry, filename));
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
