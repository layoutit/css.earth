export interface StaticSurfaceContext { readonly objectDirectory: string; readonly publicDirectory: string; readonly outputDirectory: string; readonly write?: boolean; }
export function isStaticSurfaceRecipe(value: unknown): boolean;
export function prepareStaticSurfaceObject(context: StaticSurfaceContext): Promise<import('../prepare-authored').AuthoredPreparationResult>;
