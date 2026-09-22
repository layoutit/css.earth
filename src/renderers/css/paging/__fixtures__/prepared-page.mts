import {parsePreparedPagePlan} from '../capabilities.js';
import {requireRecord} from '../../../../../tools/sources/source-values.mts';
import {requireObjectRuntimeDefinition} from '../../../../../tools/contract/object-runtime-contract.mts';
import { readFile } from 'node:fs/promises';

// Paging is an optional authored capability. Exercise the retained, source-backed
// page plans without requiring Earth's current product card to enable city lenses.
const read = async (name:string) => requireRecord(JSON.parse(await readFile(new URL(`../../../../objects/earth/prepared/${name}.json`, import.meta.url), 'utf8')));
const runtime = requireObjectRuntimeDefinition(requireRecord(await read('object')).data);
const nodes = runtime.tree.nodes;
const carrier = nodes.findIndex(node => node.className === 'polycss-mesh earth-body');
const system = nodes.findIndex(node => node.className === 'polycss-mesh earth-system');
const pageLayers = await Promise.all(['pages', 'noise'].map(async (name, index) => {
  const lensIds = index ? ['topography'] : ['normal', 'clouds'];
  return { id: index ? 'noise' : 'city', carrier, system, lensIds,
    className: 'earth-city-page', textureClassName: 'earth-api-texture',
    plan: parsePreparedPagePlan({ ...await read(name), schema: 'cssearth-prepared-map-pages@1', assetPath: '/scenes/earth/', lensIds }) };
}));

export const preparedPagingFixture = {...runtime,pageLayers};
