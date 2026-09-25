import type { CompilerBakeResult, CompilerLensVolume, DensityVolumeFrame } from '@cssearth/bake/volume';
import type { ViewFraming } from '../camera/framing.ts';

export interface BankResource { readonly path: string; readonly sha256: string; readonly bytes: number; readonly width: number; readonly height: number }
export interface SceneImage { width: number; height: number; unitsPerPixel: number }
export interface SceneViewport { width: number; height: number }
export interface SceneCamera<Publication> { publication: Publication; transform: string }
export interface MaterialSurface { nodes: HTMLElement[]; texturePath: string }
export interface RetainedVolumeMount<Publication> {
  materials: MaterialSurface[];
  setTextures(urls: readonly string[]): void;
  publish(camera: SceneCamera<Publication>): void;
  destroy(): void;
}
export interface StarProjection {
  focal: number; halfWidth: number; halfHeight: number;
  project(position: readonly number[]): { x: number; y: number; depth: number };
}

export interface BankAssetsBackend<Bank> {
  validateBank(value: unknown): Bank;
  resources(bank: Bank): readonly BankResource[];
}
export interface VolumeViewerBackend<Bank, Publication> extends BankAssetsBackend<Bank> {
  frame(bank: Bank): DensityVolumeFrame;
  texturePaths(bank: Bank): readonly string[];
  mount(host: HTMLElement, before: Element, bank: Bank, texture: (path: string) => string): RetainedVolumeMount<Publication>;
  camera(frame: DensityVolumeFrame, image: SceneImage, viewport: SceneViewport, framing: ViewFraming,
    yawDegrees: number, pitchDegrees: number): SceneCamera<Publication>;
}
/** Per-instance host integration. Payloads and camera publications stay owned by the renderer. */
export interface CompilerViewerBackend<Bank, Publication> extends VolumeViewerBackend<Bank, Publication> {
  assertIdentity(bank: Bank, result: CompilerBakeResult): void;
  assertLensGeometry(neutral: Bank, textured: Bank, result: CompilerBakeResult, lens: CompilerLensVolume): void;
  starProjection(publication: Publication, frame: DensityVolumeFrame, viewport: SceneViewport): StarProjection;
}
