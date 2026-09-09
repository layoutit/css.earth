import { readFile } from 'node:fs/promises';

// Paging is an optional authored capability. Exercise the retained, source-backed
// page plans without requiring Earth's current product card to enable city lenses.
const read = async (name) => JSON.parse(await readFile(new URL(`../../../planets/earth/prepared/${name}.json`, import.meta.url), 'utf8'));
export const preparedPagingFixture = await read('runtime');
const nodes = preparedPagingFixture.tree.nodes;
const carrier = nodes.findIndex(node => node.className === 'polycss-mesh earth-body');
const system = nodes.findIndex(node => node.className === 'polycss-mesh earth-system');
preparedPagingFixture.pageLayers = await Promise.all(['pages', 'noise'].map(async (name, index) => {
  const lensIds = index ? ['topography'] : ['normal', 'clouds'];
  return { id: index ? 'noise' : 'city', carrier, system, lensIds,
    className: 'earth-city-page', textureClassName: 'earth-api-texture',
    plan: { ...await read(name), schema: 'cssearth-prepared-map-pages@1', assetPath: '/scenes/earth/', lensIds } };
}));
