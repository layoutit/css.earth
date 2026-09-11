/** Shared wire contract for the lab's explicitly authored, automatically initialized shape cloud. */
export interface ShapeCloudComponent {
  id: string; label: string; memberIds: string[]; groupId: string;
  x: number; y: number; radiusX: number; radiusY: number; rotationDegrees: number;
  weight: number; thickness: number; softness: number; depth: number; enabled: boolean;
}
export interface ShapeCloudSettings { components: ShapeCloudComponent[]; exposure: number }
export interface ShapeCloudRequest {
  action: 'apply'; imageId: string; cataloguePath: string; geometrySha256: string;
  width: number; height: number; settings: ShapeCloudSettings;
}
export interface ShapeCloudPin { path: string; sha256: string }
export interface ShapeCloudResult {
  schema: 'cssearth-shape-cloud-result@1'; id: string; imageId: string;
  sourceSha256: string; mapSha256: string; geometrySha256: string;
  width: number; height: number; unitsPerPixel: number;
  settings: ShapeCloudSettings; empty: boolean;
  neutral?: ShapeCloudPin; textured?: ShapeCloudPin;
  source: ShapeCloudPin; projection?: ShapeCloudPin;
}
export type ShapeCloudMode = 'compare' | 'overlay' | 'textured';
