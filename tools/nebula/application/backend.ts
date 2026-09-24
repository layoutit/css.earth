import { CSS_COMPILER_RENDER_BUDGET } from '../../../src/renderers/css/volume/compiler-render-budget.ts';
/** Concrete cssEarth representation and point-profile backend; numerical replay stays package-owned. */
import { compileCssVolume } from '../../../src/renderers/css/preparation/volume.ts';
import { validatePreparedCssVolume } from '../../../src/renderers/css/volume/validation.ts';
import type { CompilerBakeBackend } from '@cssearth/volume-bake/compiler/bake';
import { prepareCompilerStarSprites } from './star-sprites.ts';
import { decodeFits } from '@cssearth/fits';
export const nebulaBakeBackend = {
  renderBudget: CSS_COMPILER_RENDER_BUDGET,
  compileVolume: (input: Parameters<CompilerBakeBackend['compileVolume']>[0]) =>
    validatePreparedCssVolume(compileCssVolume({ ...input, recipe: { anchors: [] } })),
  readVolume: validatePreparedCssVolume,
  validateVolume: validatePreparedCssVolume,
  prepareStarSprites: prepareCompilerStarSprites,
  decodeFits,
};
