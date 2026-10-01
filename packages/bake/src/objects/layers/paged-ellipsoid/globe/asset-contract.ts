import type {KernelEnum, WebpOptions} from 'sharp';
import type {AtmosphereConfiguration} from './atmosphere.ts';
import type { PagedSceneProfile } from '../scene-contract.ts';
import type { EnsoRecipe, ElevationRecipe } from '../contracts.ts';
import type { DeepOceanFillRecipe } from '../deep-ocean-fill.ts';
export type ResizeKernel = keyof KernelEnum;
export type ScientificSurfaceRecipe = (EnsoRecipe & {kind: 'gibs-mur-imagery'}) |
  (ElevationRecipe & {kind: 'gebco-elevation'; legend: ElevationRecipe['legend'] & {image: string}});
// Opt in only for complete, cylindrical RGB photographs whose source grid is
// at least as large as the canonical map. The retained atlas layout stays
// fixed; the inverse bake samples this source grid directly.
export interface SurfaceMapInput {path: string | Buffer; scientific?: ScientificSurfaceRecipe; compositeClouds?: boolean; displayGamma?: number; nativePhotographicSampling?: boolean;
  deepOceanFill?: DeepOceanFillRecipe;}
export interface SurfaceMapRecipe extends SurfaceMapInput {path: string; name: string; thumbnail: string; webp?: WebpOptions; maximumTextureWidth?: number; thumbnailRegion?: {longitude?: number; latitude?: number; spanDegrees?: number};}
export interface SurfaceAssetsConfiguration {surface: {width: number; height: number; quality: number; maps: readonly SurfaceMapRecipe[];
  clouds: {path: string; maximumAlpha: number; threshold: number; scale: number; color: readonly number[]}};}
export interface PagedAssetConfiguration extends PagedSceneProfile, SurfaceAssetsConfiguration, AtmosphereConfiguration {
  material: AtmosphereConfiguration['material'] & {frameCount: number};
  interiorPath: string; interiorSchema: string;
  /** The canonical atlas bakes at this density; surface cells take half of it per source-grid unit. */
  atlas: {density: number};
}
