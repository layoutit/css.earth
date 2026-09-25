/** cssEarth renderer adapter for the deterministic internal baker. */
import { bakeCompiler as bake, type BakeCompilerOptions } from '@cssearth/bake/volume/node';
import { compileCssVolume, CSS_COMPILER_RENDER_BUDGET } from '../../../adapters/preparation/css-volume.ts';
import { validatePreparedCssVolume } from '../../../adapters/renderer/volume-validation.ts';
import { prepareCompilerStarSprites } from '../../../adapters/application/star-sprites.ts';
export * from '@cssearth/bake/volume/node';

export function bakeCompiler(options: BakeCompilerOptions) {
  return bake(options, {
    renderBudget: CSS_COMPILER_RENDER_BUDGET,
    compileVolume: input => validatePreparedCssVolume(compileCssVolume({ ...input, recipe: { anchors: [] } })),
    prepareStarSprites: prepareCompilerStarSprites,
  });
}
