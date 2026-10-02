import { CSS_COMPILER_RENDER_BUDGET, validatePreparedCssVolume } from '@cssearth/objects';
/** cssEarth representation adapter; compact replay does not depend on research processing. */
import { replayCompactCompiler as replay, type CompactCompilerBackend, type CompilerBakeProgress, type Pin } from '@cssearth/bake/volume/node';
import { compileCssVolume } from '@cssearth/bake/volume-leaves';
import { prepareCompilerStarSprites } from '../star-sprites.ts';

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
