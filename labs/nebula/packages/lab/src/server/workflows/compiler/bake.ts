/** cssEarth renderer adapter for the deterministic internal baker. */
import { bakeCompiler as bake, type BakeCompilerOptions } from '@cssearth/bake/volume/node';
import { compileCssVolume } from '../../../adapters/preparation/css-volume.ts';
import { CSS_COMPILER_RENDER_BUDGET, validatePreparedCssVolume } from '@cssearth/objects';
import { prepareCompilerStarSprites } from '../../../adapters/application/star-sprites.ts';
export * from '@cssearth/bake/volume/node';

export function bakeCompiler(options: BakeCompilerOptions) {
  return bake(options, {
    renderBudget: CSS_COMPILER_RENDER_BUDGET,
    compileVolume: input => validatePreparedCssVolume(compileCssVolume({ ...input, recipe: { anchors: [] } })),
    prepareStarSprites: prepareCompilerStarSprites,
  });
}
