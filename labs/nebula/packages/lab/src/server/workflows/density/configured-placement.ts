/** Restore model-only placements from compact density inputs, independent of image processing. */
import { resolve } from 'node:path';
import { bakeDensity } from './assets.ts';
import { preparePlacedDensity } from './placed-assets.ts';
import { json, pinned } from './io.ts';

export async function prepareConfiguredDensityPlacements(root: string, subjectId?: string): Promise<void> {
  const subjects: unknown = await json(resolve(root, 'labs/nebula/packages/lab/src/state/processing-subjects.json'));
  if (!Array.isArray(subjects)) throw new TypeError('Invalid subject catalogue.');
  for (const subject of subjects) {
    if (subjectId !== undefined && subject.id !== subjectId) continue;
    const density = subject.density;
    if (!density?.modelPlacement) continue;
    const pin = density.modelPlacement;
    if (typeof pin.path !== 'string' || Object.keys(pin).join() !== 'path' || typeof density.directory !== 'string')
      throw new TypeError(`Subject ${subject.id} field density.modelPlacement must name only a settings path, with density.directory as output.`);
    const placement: unknown = JSON.parse((await pinned(root, pin)).toString());
    if (!placement || typeof placement !== 'object' || !('sourceDirectory' in placement) || typeof placement.sourceDirectory !== 'string')
      throw new TypeError('Density placement must name its original compact density.');
    await bakeDensity(root, placement.sourceDirectory);
    await preparePlacedDensity(root, { sourceDirectory: placement.sourceDirectory, outputDirectory: density.directory, placement: pin });
    console.log(`DENSITY_PLACEMENT_READY ${subject.id}: original density bytes preserved`);
  }
}
