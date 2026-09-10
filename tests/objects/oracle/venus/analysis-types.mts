import type { analyzeScenePng } from "./image-analysis.mts";
import type { detectPlanet, detectSilhouette, detectSun } from "./scene-detection.mts";
import type { analyzeIlluminationProfile, analyzeTerminatorShape } from "./scene-illumination.mts";
export type Point = Readonly<{ x: number; y: number }>;
export type Dimensions = Readonly<{ width: number; height: number }>;
export type Bounds = { minimumX: number; minimumY: number; maximumX: number; maximumY: number };
export type Silhouette = ReturnType<typeof detectSilhouette>;
export type Planet = ReturnType<typeof detectPlanet>;
export type Sun = ReturnType<typeof detectSun>;
export type VisibleSun = Extract<Sun, { visible: true }>;
export type Terminator = ReturnType<typeof analyzeTerminatorShape>;
export type Illumination = ReturnType<typeof analyzeIlluminationProfile>;
export type Analysis = ReturnType<typeof analyzeScenePng>;
export interface SunDetector { planet: Planet; exclusionRadiusX: number; exclusionRadiusY: number; maximumComponentDiameter: number; maximumComponentAspectRatio: number; minimumCorePixels: number; minimumClippedCorePixels: number }
export interface SunComponent { pixelCount: number; corePixelCount: number; maximumLuminance: number; luminanceSum: number; centroid: Point; bounds: Bounds; touchesSceneEdge: boolean; overlapsPlanetLimb: boolean }
export interface IndependentCapture { basis: string; changedPixelRatio: number; reference: ImageRef; browser: ImageRef; absoluteDiff: ImageRef; triptych: ImageRef }
export interface ImageRef { path: string; sha256: string }
