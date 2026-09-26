import { CSS_COMPILER_RENDER_BUDGET } from '@cssearth/renderer/volume/compiler-render-budget.ts';
/** Concrete cssEarth representation and point-profile backend; numerical replay stays package-owned. */
import { compileCssVolume } from '@cssearth/bake/volume-leaves';
import { validatePreparedCssVolume } from '@cssearth/renderer/volume/validation.ts';
import type { CompilerBakeBackend } from '@cssearth/bake/volume/node';
import type { RenderElementProfile as BakeProfile } from '@cssearth/bake/volume';
import type { RenderElementProfile as RuntimeProfile } from '@cssearth/renderer/volume/types.ts';
import { prepareCompilerStarSprites } from './star-sprites.ts';
import { decodeFits } from '@cssearth/fits';
/** The runtime and the bake each declare the render element profile (neither may import the other); both must agree exactly. */
type SameProfile = [RuntimeProfile] extends [BakeProfile] ? ([BakeProfile] extends [RuntimeProfile] ? true : false) : false;
const profilesAgree: SameProfile = true;
void profilesAgree;
export const nebulaBakeBackend = {
  renderBudget: CSS_COMPILER_RENDER_BUDGET,
  compileVolume: (input: Parameters<CompilerBakeBackend['compileVolume']>[0]) =>
    validatePreparedCssVolume(compileCssVolume({ ...input, recipe: { anchors: [] } })),
  readVolume: validatePreparedCssVolume,
  validateVolume: validatePreparedCssVolume,
  prepareStarSprites: prepareCompilerStarSprites,
  decodeFits,
};
