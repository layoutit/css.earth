import { PREPARED_NEBULA_CATALOG_SCHEMA, parsePreparedGalaxyCatalog, parsePreparedClusterCatalog, parsePreparedNebulaCatalog } from '@cssearth/objects';
import { nodeProjectFileUrl } from './prepared/prepared-world-context-node-source.mts';
// Build-owned catalogues: their contents are not application JavaScript, and no page fetches one whole.
// Each dot layer's catalogue is the one context object of its type (site/build/prepare/prepare-catalog.mts dotCatalogueIds).
import catalogueIds from './prepared/prepared-dot-catalogues.json' with { type: 'json' };

async function catalogue(layer: 'galaxies' | 'clusters'): Promise<unknown> {
  const id: unknown = (catalogueIds as Record<string, unknown>)[layer];
  if (typeof id !== 'string') throw new TypeError(`site/prepared/prepared-dot-catalogues.json names no catalogue for the ${layer} dot layer. Run pnpm prepare:catalog.`);
  return (await import(/* @vite-ignore */ nodeProjectFileUrl(import.meta.url, `src/objects/${id}/prepared/catalogue.json`), { with: { type: 'json' } })).default;
}
const galaxies = parsePreparedGalaxyCatalog(await catalogue('galaxies')), clusters = parsePreparedClusterCatalog(await catalogue('clusters'));
const parts = Object.values(import.meta.glob('../src/objects/*/source/nebula.json', { eager: true, import: 'default' })).map(parsePreparedNebulaCatalog);
const nebulae = parsePreparedNebulaCatalog({ schema: PREPARED_NEBULA_CATALOG_SCHEMA, frame: galaxies.frame,
  sources: [...new Map(parts.flatMap(part => part.sources).map(source => [source.id, source])).values()],
  objects: parts.flatMap(part => part.objects) });
/** The three spatial catalogues, whole: what the build reads. The page receives only the dots it draws from them
 * (`pages/catalogues/dots.bin.ts`). */
export const DOT_CATALOGUES = { galaxies, clusters, nebulae };
