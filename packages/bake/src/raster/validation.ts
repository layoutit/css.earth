import { parseRasterRecipe, type RasterRecipe } from '@cssearth/objects';
import { resolveLightingRecipe } from './lighting-banks.ts';

/** Read the authored recipe with preparation-owned lighting bank resolution. */
export const readRasterRecipe = (value: unknown): RasterRecipe => parseRasterRecipe(value, resolveLightingRecipe);
