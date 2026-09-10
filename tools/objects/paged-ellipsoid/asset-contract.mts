import type {KernelEnum, WebpOptions} from 'sharp';
import type {AtmosphereConfiguration} from './atmosphere.mts';
import type {PagedSceneProfile} from './scene-contract.mts';
import type {CoraltempRecipe, EnsoRecipe, ElevationRecipe, NightLightRecipe} from './contracts.mts';
export type ResizeKernel = keyof KernelEnum;
export type ScientificSurfaceRecipe = (CoraltempRecipe & {kind: 'coraltemp-anomaly'}) | (EnsoRecipe & {kind: 'gibs-mur-imagery'}) |
  (ElevationRecipe & {kind: 'gebco-elevation'; legend: ElevationRecipe['legend'] & {image: string}}) |
  (NightLightRecipe & {kind: 'black-marble-radiance'; legend: {image: string}});
export interface SurfaceMapInput {path: string | Buffer; scientific?: ScientificSurfaceRecipe; compositeClouds?: boolean; displayGamma?: number;}
export interface SurfaceMapRecipe extends SurfaceMapInput {path: string; name: string; thumbnail: string; webp?: WebpOptions; thumbnailRegion?: {longitude?: number; latitude?: number; spanDegrees?: number};}
export interface SurfaceAssetsConfiguration {surface: {width: number; height: number; quality: number; maps: readonly SurfaceMapRecipe[];
  clouds: {path: string; maximumAlpha: number; threshold: number; scale: number; color: readonly number[]}};}
export interface PagedAssetConfiguration extends PagedSceneProfile, SurfaceAssetsConfiguration, AtmosphereConfiguration {
  material: AtmosphereConfiguration['material'] & {frameCount: number; worldLight: readonly number[]; solarTint: string;
    shadowlessOverlay?: {color: readonly [number, number, number]; opacity: number}};
  interiorPath: string; interiorSchema: string;
}
