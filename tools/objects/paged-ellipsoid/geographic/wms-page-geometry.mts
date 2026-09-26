import { prepareProjectiveTextureLayer } from "@cssearth/bake/scene";
import { prepareCityPageGeometry, CITY_PAGE_RASTER_SCALE, cityPageRasterDensity } from "./page-geometry.mts";

import type { GeographicScene, PageAddress, PageGeometry, GeographicBounds } from './contracts.mts';
export const WORLDCOVER_WMS = Object.freeze({
  endpoint: "https://mapproxy.terrascope.be/mapproxy/service",
  layer: "esa-worldcover-s2rgbnir-10m-2021-v2_tcc",
});

const multiply = (a: readonly number[], b: readonly number[], size: number) => Array.from({ length: size * size }, (_, i) =>
  Array.from({ length: size }, (_, k) => a[Math.floor(i / size) * size + k] * b[k * size + i % size])
    .reduce((sum, value) => sum + value, 0));
const transpose4 = (m: readonly number[]) => Array.from({ length: 16 }, (_, i) => m[(i % 4) * 4 + Math.floor(i / 4)]);
function inverse3(m: readonly number[]) {
  const [a,b,c,d,e,f,g,h,i] = m;
  const adj = [e*i-f*h,c*h-b*i,b*f-c*e,f*g-d*i,a*i-c*g,c*d-a*f,d*h-e*g,b*g-a*h,a*e-b*d];
  const determinant = a*adj[0]+b*adj[3]+c*adj[6];
  if (Math.abs(determinant) < 1e-12) throw new Error("Singular WMS geographic mapping.");
  return adj.map(v => v/determinant);
}

// Preparation only. The API returns a north-up geographic rectangle. Compose
// its inverse geographic mapping with the accepted face, instead of resampling
// the API's pixels. The browser receives only a URL and two finished matrices.
export function prepareWmsPage(address: PageAddress, scene: GeographicScene) {
  const page = prepareCityPageGeometry(address, scene);
  if (!page.geographicMatrix) throw new Error("Direct WMS polar mapping is not yet prepared.");
  const { west, east, south, north } = page.sourceBounds;
  const shift = 360 * Math.floor(((west + east) / 2 + 180) / 360);
  const bbox = [west - shift, south, east - shift, north];
  if (bbox[0] < -180 || bbox[2] > 180) throw new Error("Direct WMS antimeridian pages require a prepared split.");
  const width = Math.round(page.width * cityPageRasterDensity(page.level));
  const height = Math.round(page.height * cityPageRasterDensity(page.level));
  const url = new URL(WORLDCOVER_WMS.endpoint);
  const params = { SERVICE:"WMS", VERSION:"1.3.0", REQUEST:"GetMap", LAYERS:WORLDCOVER_WMS.layer,
    STYLES:"", CRS:"CRS:84", BBOX:bbox.join(","), WIDTH:String(width), HEIGHT:String(height),
    FORMAT:"image/png", TRANSPARENT:"TRUE" };
  for (const [key,value] of Object.entries(params)) url.searchParams.set(key,value);
  const mapping = prepareGeographicTextureQuad(page, page.sourceBounds, CITY_PAGE_RASTER_SCALE);
  return {
    key: page.key, level: page.level, x: page.x, y: page.y,
    bounds: page.bounds, sourceBounds: page.sourceBounds, normal: page.normal,
    ...mapping,
    width, height, maximumCssSpan: 512*cityPageRasterDensity(page.level), children: [],
    rasterSource: "terrascope-wms@1", url: url.href,
  };
}

export function prepareGeographicTextureQuad(page: PageGeometry, {west,east,south,north}: GeographicBounds, rasterScale: number) {
  return preparePageTextureQuad(page, geographicTextureMapping(page,{west,east,south,north}),rasterScale);
}

const geographicInverses = new WeakMap<PageGeometry, number[]>(), pageFrames = new WeakMap<Pick<PageGeometry, 'frameMatrix' | 'textureMatrix'>, number[]>();
export function geographicTextureMapping(page: PageGeometry,{west,east,south,north}: GeographicBounds) {
  if (!page.geographicMatrix) throw new TypeError("Geographic texture requires a prepared matrix");
  if (!geographicInverses.has(page)) geographicInverses.set(page, inverse3(page.geographicMatrix));
  return multiply(geographicInverses.get(page)!, [east-west,0,west,0,south-north,north,0,0,1], 3);
}

export function preparePageTextureQuad(page: Pick<PageGeometry, 'frameMatrix' | 'textureMatrix'>,h: readonly number[],rasterScale: number) {
  const side = 32 * CITY_PAGE_RASTER_SCALE;
  // Input is a fixed 32px logical quad; the accepted page's prepared raster
  // coordinates use its original density. Runtime receives finished matrices.
  const mapping = [h[0]*side/32,h[1]*side/32,0,side*h[2],h[3]*side/32,h[4]*side/32,0,side*h[5],0,0,1,0,h[6]/32,h[7]/32,0,h[8]];
  if (!pageFrames.has(page)) pageFrames.set(page, multiply(transpose4(page.frameMatrix.split(",").map(Number)),
    transpose4(page.textureMatrix.split(",").map(Number)), 4));
  const original = pageFrames.get(page)!;
  const mapped = multiply(original, mapping, 4);
  const layer = prepareProjectiveTextureLayer(transpose4(mapped).join(","), rasterScale);
  const point = (u: number,v: number) => {
    const p=[u*32,v*32,0,1];
    const out=[0,1,2,3].map(row=>p.reduce((sum,value,col)=>sum+mapped[row*4+col]*value,0));
    return out.slice(0,3).map(value=>value/out[3]);
  };
  return {
    corners: [[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>point(u,v)),
    frameMatrix: layer.frameMatrix, textureMatrix: layer.textureMatrix,
  };
}
