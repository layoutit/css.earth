import type { AuthoredPreparationResult } from '../prepare-authored.js';
export function isLayeredOblateRecipe(value: unknown): boolean;
export function prepareLayeredOblateObject(context: {
  objectDirectory: string;
  publicDirectory: string;
  outputDirectory: string;
  write?: boolean;
  prepareContent: (context: any) => Promise<any>;
}): Promise<AuthoredPreparationResult>;
