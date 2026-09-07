export interface LayeredGiantContext {
  objectDirectory: string;
  publicDirectory: string;
  outputDirectory: string;
  write?: boolean;
  prepareContent: typeof import('../content/prepare').prepareObjectContentAssets;
}
export function isLayeredGiantRecipe(value: unknown): boolean;
export function prepareLayeredGiantObject(context: LayeredGiantContext): Promise<{
  raster: unknown;
  celestial: unknown;
  scene: Record<string, unknown>;
  definition: Record<string, unknown>;
  content: unknown;
}>;
