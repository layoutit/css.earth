/** Concrete cssEarth representation and point-profile backend; numerical replay stays package-owned. */
import { CSS_COMPILER_RENDER_BUDGET, validatePreparedCssVolume } from '@cssearth/objects';
import { compileCssVolume } from '../volume-leaves/index.ts';
import type { CompilerBakeBackend } from '../volume/node/index.ts';

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
