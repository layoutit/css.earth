// Preparation only. Stream bounded source-window jobs over the accepted faces.
// The publisher inventory proves object presence, never usable pixel coverage.
import { childAddresses, pageBounds, pageKey, prepareCityPageGeometry,
  CITY_PAGE_LAST_LEVEL, CITY_POLAR_PAGE_LAST_LEVEL } from '../page-geometry.mts';
import { sourceTilesForBounds } from '../worldcover-catalog.mts';
import { citySourceWindow, CITY_SOURCE_WINDOW_MAX_PIXELS } from './worldcover-source.mts';

import type { GeographicBounds, PolarBounds, GeographicScene, WorldCoverEntry, PageAddress, CityCoverageJob } from '../contracts.mts';
export function cityCoverageRoots() {
  return Array.from({length:16},(_,y)=>Array.from({length:y===0||y===15?1:32},(_,x)=>({level:0,x,y}))).flat();
}

function outsideCap(bounds: GeographicBounds | PolarBounds) {
  if(bounds.projection!=='polar')return false;
  const nearest=(lo: number,hi: number)=>lo>.5?2*lo-1:hi<.5?2*hi-1:0;
  return nearest(bounds.u0,bounds.u1)**2+nearest(bounds.v0,bounds.v1)**2>=1;
}

export function* planCityCoverage(scene: GeographicScene,catalog: ReadonlyMap<string,WorldCoverEntry>,roots=cityCoverageRoots()) {
  function* visit(address: PageAddress): Generator<CityCoverageJob> {
    const bounds=pageBounds(address);
    if(outsideCap(bounds))return;
    const page=prepareCityPageGeometry(address,scene);
    const sources=sourceTilesForBounds(page.sourceBounds,catalog);
    if(!sources.available.length)return;
    const polar=bounds.projection==='polar';
    const targetLevel=polar?7:5;
    const lastLevel=polar?CITY_POLAR_PAGE_LAST_LEVEL:CITY_PAGE_LAST_LEVEL;
    const window=citySourceWindow(page.sourceBounds);
    if(address.level<targetLevel||(window.pixels>CITY_SOURCE_WINDOW_MAX_PIXELS&&address.level<lastLevel)) {
      for(const child of childAddresses(address))yield* visit(child);
      return;
    }
    yield {id:pageKey(address),root:address,bounds:page.sourceBounds,window,lastLevel,
      sources:sources.available,unavailableTiles:sources.unavailable,
      blocked:window.pixels>CITY_SOURCE_WINDOW_MAX_PIXELS?'source-window-too-large':null};
  }
  for(const root of roots)yield* visit(root);
}
