import type { AuthoredSphereLaw, LightingRecipe } from '@cssearth/objects';

/**
 * Shared lighting banks: an authored sphere law that many bodies draw the same. A body's raster recipe names a bank
 * (`"lighting": { "bank": "sphere", ... }`); its bake copies the bank's sheet and flood-lit frame from
 * `site/public/lighting/<bank>/` instead of encoding them, and its prepared output is what encoding them would give. Identical
 * files publish under one content address, so every body on a bank asks a browser for the same two URLs.
 * `packages/bake/cli/prepare-lighting-bank.mts` bakes the banks and checks the tracked files against a fresh bake, so the
 * copy is never a stale cache.
 *
 * `sphere` is the opaque sphere lit by the Sun with no atmosphere: the shape-only planets and the moons with no published
 * photometric law. Its law is authored: a 0.35 limb floor when flood-lit, a 0.05 ambient term and a terminator ramp, after
 * OpenSpace's globe shader (modules/globebrowsing/shaders/texturetilemapping.glsl at 56e29b54).
 */
export const LIGHTING_BANKS: Readonly<Record<string, AuthoredSphereLaw>> = Object.freeze({
  sphere: Object.freeze({ shadowlessFloodLimbFloor: 0.35, ambientIntensity: 0.05, terminator: Object.freeze([0, 0.1]), maximumAlpha: 0.95 }),
});

/** The overlay size, in CSS pixels, a bank's flood-lit frame is baked for (lighting-sheet.ts sizes that frame from it). */
export const LIGHTING_BANK_PRESENTATION_SIZE = 460;

/** Where a bank's baked sheet and flood-lit frame live, tracked in git beside the navigation atlases (relative to the repository). */
export const LIGHTING_BANK_ROOT = 'site/public/lighting';

/** A bank recipe with the bank's law filled in; a recipe that names published models unchanged. */
export function resolveLightingRecipe(recipe: LightingRecipe): LightingRecipe {
  if (recipe.bank === undefined) return recipe;
  const bank = LIGHTING_BANKS[recipe.bank];
  if (!bank) throw new TypeError(`Unknown lighting bank ${recipe.bank}; banks are ${Object.keys(LIGHTING_BANKS).join(', ')}.`);
  return { ...bank, ...recipe };
}
