import { isPreparedCluster, isPreparedNebula, type PreparedCatalogObject } from '@cssearth/objects';
/** What a catalogue subject is, as the registry classifies its page: a galaxy cluster, a nebula catalogue row's own kind
 * (a nebula, a globular cluster), or a galaxy. Preparation gives each catalogue focus this classification, and the
 * application finds the level that holds it from the same rule. */
export function catalogueClassification(object: PreparedCatalogObject): string {
  return isPreparedCluster(object) ? 'galaxy-cluster' : isPreparedNebula(object) ? object.kind : 'galaxy';
}

/** A catalogue subject the application can open: a galaxy cluster, or a subject an object package details. Only these are
 * clickable on the map and have a page; every other catalogue row is a label. */
export function isNavigableCatalogObject(object: PreparedCatalogObject): boolean {
  return isPreparedCluster(object) || Boolean(object.detailedObjectId);
}
