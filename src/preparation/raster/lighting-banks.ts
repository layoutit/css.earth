import type { LightingRecipe } from './config.js';

/**
 * Shared lighting banks: the pixel-determining fields of a lighting recipe that many bodies draw the same. A body's raster
 * recipe names a bank (`"lighting": { "bank": "sphere", ... }`) and keeps only its own presentation fields and metadata; its
 * bake copies the bank's rows and billboard from `public/lighting/<bank>/` instead of encoding them, and its prepared output
 * is what encoding them would give. `tools/objects/prepare-lighting-bank.mts` bakes the banks and checks the tracked files
 * against a fresh bake, so the copy is never a stale cache.
 *
 * `sphere` is the opaque sphere lit by the Sun with no atmosphere: 61 bodies (the shape-only planets, the moons drawn from
 * photographs, Mercury, the Moon...) carried this block verbatim and encoded byte-identical 7 MB banks one by one.
 */
export type LightingBankFields = Pick<LightingRecipe,
  'frameSize' | 'columns' | 'billboardFrameSize' | 'billboardColumns' | 'rowOutput' | 'billboardOutput' |
  'minimumLightViewZ' | 'maximumLightViewZ' | 'frameCount' | 'shadowlessFloodLimbFloor' | 'ambientIntensity' | 'radiusScale' | 'terminator' | 'maximumAlpha'>;

export const LIGHTING_BANK_KEYS = Object.freeze(['frameSize', 'columns', 'billboardFrameSize', 'billboardColumns', 'rowOutput', 'billboardOutput',
  'minimumLightViewZ', 'maximumLightViewZ', 'frameCount', 'shadowlessFloodLimbFloor', 'ambientIntensity', 'radiusScale', 'terminator', 'maximumAlpha'] as const);

export const LIGHTING_BANKS: Readonly<Record<string, LightingBankFields>> = Object.freeze({
  sphere: Object.freeze({
    frameSize: 512, columns: 8, frameCount: 256, billboardFrameSize: 24, billboardColumns: 16,
    rowOutput: 'lighting-{density}x-row-{row}.webp', billboardOutput: 'lighting-{density}x-billboard.webp',
    minimumLightViewZ: -1, maximumLightViewZ: 1, shadowlessFloodLimbFloor: 0.35, ambientIntensity: 0.05, radiusScale: 0.505, terminator: [0, 0.1], maximumAlpha: 0.95,
  }),
});

/** Where a bank's baked rows and billboard live, tracked in git beside the navigation atlases (relative to the repository). */
export const LIGHTING_BANK_ROOT = 'public/lighting';

/** A bank recipe with the bank's fields filled in; an inline recipe unchanged. */
export function resolveLightingRecipe(recipe: LightingRecipe): LightingRecipe {
  if (recipe.bank === undefined) return recipe;
  const bank = LIGHTING_BANKS[recipe.bank];
  if (!bank) throw new TypeError(`Unknown lighting bank ${recipe.bank}; banks are ${Object.keys(LIGHTING_BANKS).join(', ')}.`);
  for (const key of LIGHTING_BANK_KEYS) if (key in recipe) throw new TypeError(`lighting.${key} is the bank's; a recipe naming bank ${recipe.bank} does not restate it.`);
  return { ...bank, ...recipe };
}
