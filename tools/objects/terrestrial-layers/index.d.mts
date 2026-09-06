export interface TerrestrialContext {
  sourceDirectory: string; publicDirectory: string; outputDirectory: string; config: unknown;
  prepareContent: typeof import('../content/prepare').prepareObjectContentAssets;
}
export function prepareTerrestrialLayers(context: TerrestrialContext): Promise<{
  raster: unknown; celestial: unknown; scene: Record<string, unknown>;
  definition: Record<string, unknown>; content: unknown;
}>;
