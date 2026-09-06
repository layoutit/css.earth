export interface PagedEllipsoidContext {
  objectDirectory: string; publicDirectory: string; outputDirectory: string;
  packDirectory?: string;
  prepareContent: typeof import('../content/prepare').prepareObjectContentAssets;
}
export function isPagedEllipsoidRecipe(value: unknown): boolean;
export function preparePagedEllipsoidObject(context: PagedEllipsoidContext): Promise<{
  raster: unknown; celestial: unknown; scene: Record<string, unknown>;
  definition: Record<string, unknown>; content: unknown;
}>;
