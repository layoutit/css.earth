import {parsePreparedPagePlan} from '../../../../src/renderers/css/dist/testing.js';
import {PREPARED_EARTH_CITY_PAGES} from './prepared-fixture.mts';

/** Validate fixture roots inside the authored transport budget and initial frame. */
export function pagePlanFixture(overrides: Record<string, unknown>) {
  const {assetOrigin,dataset,poolSize,decodedPageBytes,maximumDecodedBytes,
    maximumConcurrentLoads,minimumZoom,rasterScale,initialLayer,index}=PREPARED_EARTH_CITY_PAGES;
  return parsePreparedPagePlan({schema:'cssearth-prepared-map-pages@1',assetPath:'/scenes/earth/',
    assetOrigin,dataset,poolSize,decodedPageBytes,maximumDecodedBytes,maximumConcurrentLoads,
    minimumZoom,rasterScale,initialLayer,index,...overrides});
}
export function pageNodesFixture(nodes: readonly unknown[]) {
  return new Map(pagePlanFixture({roots:nodes}).roots.map(node=>[node.key,node]));
}
