/** Shared wire contract for the lab's explicitly authored, automatically initialized shape cloud. */
import type { ShapeCloudSettings } from '@cssearth/bake/volume';
export type {ShapeCloudComponent,ShapeCloudSettings} from '@cssearth/bake/volume';
export type ShapeCloudQuality = 'draft' | 'detailed';
export interface ShapeCloudRequest {
  action: 'apply'; imageId: string; cataloguePath: string; geometrySha256: string;
  geometryFile?: string;
  width: number; height: number; settings: ShapeCloudSettings; quality?: ShapeCloudQuality;
}
export interface ShapeCloudPin { path: string; sha256: string }
export interface ShapeCloudComparisonLevel {
  gain: number; source: ShapeCloudPin; model: ShapeCloudPin;
  sourceEdges: ShapeCloudPin; modelEdges: ShapeCloudPin; difference: ShapeCloudPin;
}
export interface ShapeCloudComparison {
  schema: 'cssearth-shape-cloud-comparison@1'; width: number; height: number;
  brightnessScale: number;
  metrics: { missingFraction: number; excessFraction: number; normalizedRmse: number };
  levels: ShapeCloudComparisonLevel[];
}
export interface ShapeCloudResult {
  schema: 'cssearth-shape-cloud-result@1'; id: string; imageId: string;
  sourceSha256: string; mapSha256: string; geometrySha256: string;
  width: number; height: number; unitsPerPixel: number;
  settings: ShapeCloudSettings; empty: boolean; quality: ShapeCloudQuality; preparationVersion?: string;
  neutral?: ShapeCloudPin; textured?: ShapeCloudPin;
  source: ShapeCloudPin; projection?: ShapeCloudPin;
  comparison?: ShapeCloudComparison;
}
export type ShapeCloudMode = 'compare' | 'overlay' | 'textured' | 'structure';
