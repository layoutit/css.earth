import { isPreparedCluster } from './clusters.js';
import { isPreparedNebula } from './nebulae.js';
import type { PreparedCatalogObject } from './clusters.js';

/** What a catalogue subject is, as the registry classifies its page: a galaxy cluster, a nebula catalogue row's own kind
 * (a nebula, a globular cluster), or a galaxy. Preparation gives each catalogue focus this classification, and the
 * application finds the level that holds it from the same rule. */
export function catalogueClassification(object: PreparedCatalogObject): string {
  return isPreparedCluster(object) ? 'galaxy-cluster' : isPreparedNebula(object) ? object.kind : 'galaxy';
}
