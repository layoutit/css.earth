export interface RemovalRequest { imageId: string; action: 'overview' | 'preview' | 'apply'; }
export interface RemovalProgress { stage: string; current: number; total: number; message: string; }
export interface AppliedStarLayers {
  resultId: string;
  layers: { id: 'diffuse' | 'stars'; url: string; texturePath: string; sha256: string; widthPx: number; heightPx: number }[];
}
export interface StarRemovalPreview {
  id: string; origin: [number, number]; source: string; removed: string; mask: string; stars: string; width: number; height: number;
}
export interface StarRemovalResult {
  schema: 'cssearth-star-removal-result@1'; method: 'nox'; imageId: string; operation: RemovalRequest['action'];
  sourceSha256: string; sourcePreviewSha256: string; nativeDimensions: [number, number];
  overview: { url: string; dimensions: [number, number] };
  previews?: StarRemovalPreview[]; applied?: AppliedStarLayers;
}
