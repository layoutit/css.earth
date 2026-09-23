// Build-owned catalogue transport. The browser and native requests read the
// same authenticated files; catalogue contents are not application JavaScript.
import { parsePreparedGalaxyCatalog, parsePreparedClusterCatalog, parsePreparedNebulaCatalog } from '@cssearth/catalog';
import galaxies from '../src/objects/local-group/prepared/catalogue.json' with { type: 'json' };
import clusters from '../src/objects/galaxy-clusters/prepared/catalogue.json' with { type: 'json' };
import { focusSourceDocumentation } from './source-documentation.mts';

const parts = Object.values(import.meta.glob('../src/objects/*/source/nebula.json', { eager: true, import: 'default' })).map(parsePreparedNebulaCatalog);
const nebulae = parsePreparedNebulaCatalog({ schema: 'cssearth-nebula-catalog@1', frame: galaxies.frame,
  sources: [...new Map(parts.flatMap(part => part.sources).map(source => [source.id, source])).values()],
  objects: parts.flatMap(part => part.objects) });
export const FOCUS_CATALOG_DATA = [
  { id: 'galaxies', data: parsePreparedGalaxyCatalog(galaxies) },
  { id: 'clusters', data: parsePreparedClusterCatalog(clusters) },
  { id: 'nebulae', data: nebulae },
].map(({ id, data }) => {
  return { id, data, text: JSON.stringify(data) };
});

export const FOCUS_SOURCE_DOCUMENTS = new Map(FOCUS_CATALOG_DATA.flatMap(catalog => catalog.data.objects
  .map(object => [object.id, focusSourceDocumentation(object, catalog.id)] as const)));
