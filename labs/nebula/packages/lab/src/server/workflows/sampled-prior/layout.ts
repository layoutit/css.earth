/** cssEarth binding for generic retained-bank registration. */
import { registerComponentBanks as register } from '@cssearth/bake/volume/node';
import { compileCssVolume } from '../../../adapters/preparation/css-volume.ts';
import { validatePreparedCssVolume, type CompilerBakeResult, type CompilerDatasetVolume, type CompilerPin } from '@cssearth/objects';
import { readGeometryPin } from '../geometry/registered-source.ts';

export * from '@cssearth/bake/volume/node';
export function registerComponentBanks(root: string, outputDirectory: string, neutral: CompilerBakeResult,
  datasets: CompilerDatasetVolume[], signal: AbortSignal,
  readPinned: (pin: CompilerPin) => Promise<Buffer> = pin => readGeometryPin(root, pin)) {
  return register(root, outputDirectory, neutral, datasets, signal, readPinned, {
    compileVolume: input => compileCssVolume({ ...input, recipe: { anchors: [] } }),
    validateVolume: validatePreparedCssVolume,
  });
}
