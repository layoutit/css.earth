import { PREPARED_NEBULA_CATALOG_SCHEMA, parsePreparedGalaxyCatalog, parsePreparedClusterCatalog, parsePreparedNebulaCatalog } from '@cssearth/objects';
// Build-owned catalogue transport. The browser and native requests read the
// same authenticated files; catalogue contents are not application JavaScript.
import galaxies from '../src/objects/local-group-galaxies/prepared/catalogue.json' with { type: 'json' };
import clusters from '../src/objects/galaxy-clusters/prepared/catalogue.json' with { type: 'json' };

const parts = Object.values(import.meta.glob('../src/objects/*/source/nebula.json', { eager: true, import: 'default' })).map(parsePreparedNebulaCatalog);
const nebulae = parsePreparedNebulaCatalog({ schema: PREPARED_NEBULA_CATALOG_SCHEMA, frame: galaxies.frame,
  sources: [...new Map(parts.flatMap(part => part.sources).map(source => [source.id, source])).values()],
  objects: parts.flatMap(part => part.objects) });
export const DOT_CATALOGUE_DATA = [
  { id: 'galaxies', data: parsePreparedGalaxyCatalog(galaxies) },
  { id: 'clusters', data: parsePreparedClusterCatalog(clusters) },
  { id: 'nebulae', data: nebulae },
].map(({ id, data }) => {
  return { id, data, text: JSON.stringify(data) };
});
