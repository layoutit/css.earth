import type { Relief } from '../../raster/index.ts';
export interface Dimensions {width: number; height: number;}
export interface Cutaway {centerLongitudeDegrees: number; widthDegrees: number;}
export interface ElevationGrid extends Dimensions {firstIndex: number; stride: number; nativeCellDegrees: number;}
export interface ElevationRecipe {
  metadata: string; grid: ElevationGrid; blocks?: readonly {path: string; rowOffset: number; rows: number}[];
  palette: readonly {meters: number; color: string}[]; relief?: Relief;
  legend: {width: number; height: number; minimum: number; maximum: number};
}
export interface MapSource<T> {path: string; scientific: T;}
export interface EnsoRecipe {date: string; baseline: string; checked: string; advisory: {status: string; date: string};}
export interface SurfaceBankPlan {
  body: {assets: {surface: {url: string; urls: readonly string[]}}};
  interior: {outerAssets: {surface: {one: string; two: string; oneUrls: readonly string[]; twoUrls: readonly string[]}; litSurface: {urls: readonly string[]}}};
}
export interface SurfaceBankDatasets {defaultDataset: string; controls: readonly {id: string; surfaceBankId?: string; view?: string; surfaceUrls?: readonly string[]; surfaceUrl?: string; polesUrl?: string}[];}
/** A date's 80 × 40 native tiles in row order: each tile's byte count, and the indices of those without observations. */
export interface MurTiles {bytes: readonly number[]; empty: readonly number[];}
export interface MurInventory {date: string; grid: {level: number}; tiles: MurTiles;}
export interface MurMosaic {width: number; height: number; sourceWidth: number; sourceHeight: number; sampling: string; covered: number; missing: number;}
export interface MurReceipt extends MurInventory {schema: string; checked: string; baseline: string; sourceBytes: number; archiveBytes: number; mosaic: MurMosaic;}
