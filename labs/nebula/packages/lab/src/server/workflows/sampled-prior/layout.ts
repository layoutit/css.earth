/** cssEarth binding for generic retained-bank registration. */
import { registerComponentBanks as register } from '@cssearth/bake/volume/node';
import { compileCssVolume } from '../../../adapters/preparation/css-volume.ts';
import { validatePreparedCssVolume } from '../../../adapters/renderer/volume-validation.ts';
import { readGeometryPin } from '../geometry/registered-source.ts';
import type { CompilerBakeResult, CompilerDatasetVolume, CompilerPin } from '@cssearth/objects';
export * from '@cssearth/bake/volume/node';
export function registerComponentBanks(root: string, outputDirectory: string, neutral: CompilerBakeResult,
  datasets: CompilerDatasetVolume[], signal: AbortSignal,
  readPinned: (pin: CompilerPin) => Promise<Buffer> = pin => readGeometryPin(root, pin)) {
  return register(root, outputDirectory, neutral, datasets, signal, readPinned, {
    compileVolume: input => compileCssVolume({ ...input, recipe: { anchors: [] } }),
    validateVolume: validatePreparedCssVolume,
  });
}
