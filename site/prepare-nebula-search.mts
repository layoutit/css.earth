import { parsePreparedNebulaCatalog } from '@cssearth/catalog';
import { normalizeDestinationQuery } from './destination-search.mts';

/** Build-time search rows from the same source records used by the shared world. */
export function prepareNebulaSearch(catalogues: readonly unknown[], hostRoute: string) {
  const ids = new Set<string>();
  return catalogues.flatMap(value => parsePreparedNebulaCatalog(value).objects).map(object => {
    if (ids.has(object.id)) throw new TypeError(`Duplicate nebula search identity: ${object.id}`);
    ids.add(object.id);
    return {
      id: object.id, focusId: object.id, name: object.name,
      searchNames: [...new Set([object.id, object.name, ...object.aliases].map(normalizeDestinationQuery))],
      classification: 'nebula', systemName: 'Milky Way',
      distanceAu: Math.hypot(...object.positionM) / 149597870700,
      distancePc: object.distance.valuePc,
      route: `${hostRoute}?focus=${encodeURIComponent(object.id)}`,
    };
  }).sort((left, right) => left.distanceAu - right.distanceAu);
}
export type NebulaSearchEntry = ReturnType<typeof prepareNebulaSearch>[number];
