import type {Relief} from '../terrestrial-layers/contracts.mts';
export interface Dimensions {width: number; height: number;}
export interface Cutaway {centerLongitudeDegrees: number; widthDegrees: number;}
export interface ElevationGrid extends Dimensions {firstIndex: number; stride: number; nativeCellDegrees: number;}
export interface ElevationRecipe {
  metadata: string; grid: ElevationGrid; blocks?: readonly {path: string; rowOffset: number; rows: number}[];
  palette: readonly {meters: number; color: string}[]; relief?: Relief;
  legend: {width: number; height: number; minimum: number; maximum: number};
}
export interface NightLightGrid extends Dimensions {cellDegrees: number; bounds: readonly number[];}
export interface NightLightDisplay {missing: readonly number[]; softening: number; maximum: number;}
export interface NightLightRecipe {
  kind: string; member: string; year: number; product: string; band: string; units: string;
  archiveBytes: number; grid: NightLightGrid; display: NightLightDisplay;
}
export interface MapSource<T> {path: string; scientific: T;}
export interface EnsoRecipe {date: string; baseline: string; checked: string; advisory: {status: string; date: string};}
export interface AnomalyPalette {minimum: number; maximum: number; palette: readonly (readonly number[])[]; missingColor: readonly number[];}
export interface CoraltempRecipe extends EnsoRecipe, AnomalyPalette {filename: string;}
export interface SurfaceBankPlan {
  body: {assets: {surface: {url: string; urls: readonly string[]}}};
  interior: {outerAssets: {surface: {one: string; two: string; oneUrls: readonly string[]; twoUrls: readonly string[]}; litSurface: {urls: readonly string[]}}};
}
export interface SurfaceBankLenses {defaultLens: string; controls: readonly {id: string; surfaceBankId?: string; view?: string; surfaceUrls?: readonly string[]; surfaceUrl?: string; polesUrl?: string}[];}
export interface MurTile {row: number; col: number; url: string; actualTime: string | null; actualLayer: string | null; empty: boolean; bytes: number;}
export interface MurInventory {date: string; complete: boolean; grid: {level: number}; tiles: readonly MurTile[];}
export interface MurMosaic {width: number; height: number; sourceWidth: number; sourceHeight: number; sampling: string; covered: number; missing: number;}
export interface MurReceipt extends MurInventory {schema: string; checked: string; baseline: string; sourceBytes: number; archiveBytes: number; mosaic: MurMosaic;}
