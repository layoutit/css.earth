import { CSS_COMPILER_RENDER_BUDGET } from '../../../../../../../../src/renderers/css/volume/compiler-render-budget.ts';
/** cssEarth representation adapter; compact replay does not depend on research processing. */
import { replayCompactCompiler as replay, type CompactCompilerBackend } from '@cssearth/volume-bake/compact-inputs/compiler';
import type { CompilerBakeProgress } from '@cssearth/volume-bake/compiler/bake';
import type { Pin } from '@cssearth/volume-bake/compact-inputs/io';
import { compileCssVolume } from '../../../../../../../../src/renderers/css/preparation/volume.ts';
import { validatePreparedCssVolume } from '../../../../../../../../src/renderers/css/volume/validation.ts';
import { prepareCompilerStarSprites } from '../star-sprites.ts';
export { readCompactCompiler } from '@cssearth/volume-bake/compact-inputs/compiler';

export function replayCompactCompiler(root: string, pin: Pin, outputDirectory: string,
  progress?: (progress: CompilerBakeProgress) => void) {
  const backend: CompactCompilerBackend = {
    renderBudget: CSS_COMPILER_RENDER_BUDGET,
    compileVolume: input => validatePreparedCssVolume(compileCssVolume({ ...input, recipe: { anchors: [] } })),
    readVolume: validatePreparedCssVolume,
    prepareStarSprites: prepareCompilerStarSprites,
  };
  return replay(root, pin, outputDirectory, backend, progress);
}
