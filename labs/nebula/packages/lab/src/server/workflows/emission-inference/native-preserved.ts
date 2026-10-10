/** Native identity treatment for maps whose compact emission is scientifically meaningful. */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { isAbsolute, resolve, relative, sep } from 'node:path';
import {prepareNativePreservation} from '@cssearth/nebula-reconstruction/star-removal/native';
import { isLabScratchPath } from '../../../resources/model-paths.ts';

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid native preservation receipt.');
  return value as Record<string, unknown>;
};
export async function nativePreserved(source: Buffer, dimensions: [number, number], outputDirectory: string,
  options: { allowProcessing?: boolean } = {}) {
  const directory = resolve(outputDirectory), within = relative(resolve('.'), directory);
  if (!isLabScratchPath(within.split(sep).join('/')) || within.split(sep).includes('..') || isAbsolute(within)) throw new TypeError('Native preservation requires the ignored lab cache.');
  const {decoded,expectedDiffuse,expectedStars} = await prepareNativePreservation(source,dimensions);
  const accounting = { maximumReconstructionErrorCodeValues: 0, coverageComplete: true, residualNonzeroValues: 0 };
  const receiptPath = resolve(directory, 'result.json');
  let receiptBytes: Buffer;
  try { receiptBytes = await readFile(receiptPath); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    if (options.allowProcessing === false) throw new Error('Native preservation is not prepared; this operation is read-only.');
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, 'diffuse.png'), expectedDiffuse);
    await writeFile(resolve(directory, 'stars.png'), expectedStars);
    receiptBytes = Buffer.from(JSON.stringify({ schema: 'cssearth-native-preservation@1', stellarTreatment: 'preserve',
      nativeDimensions: dimensions, conversion: 'Native RGB8 sRGB; no crop, resampling or neural extraction.',
      interpretation: 'Star removal is not applicable: preserve compact structural emission. Any foreground stars remain in this map.',
      artifacts: ['diffuse.png', 'stars.png'], accounting }, null, 2) + '\n');
    await writeFile(`${receiptPath}.pending`, receiptBytes); await rename(`${receiptPath}.pending`, receiptPath);
  }
  const receipt = object(JSON.parse(receiptBytes.toString()));
  const diffuseBytes = await readFile(resolve(directory, 'diffuse.png')), starsBytes = await readFile(resolve(directory, 'stars.png'));
  // The identity claim is re-proved against this source's own pixels on every read.
  if (receipt.schema !== 'cssearth-native-preservation@1' || receipt.stellarTreatment !== 'preserve' ||
    JSON.stringify(receipt.nativeDimensions) !== JSON.stringify(dimensions) || JSON.stringify(receipt.accounting) !== JSON.stringify(accounting) ||
    !diffuseBytes.equals(expectedDiffuse) || !starsBytes.equals(expectedStars))
    throw new Error(`Native preservation receipt/artifacts in ${relative(resolve('.'), directory)} differ from the identity treatment of this source.`);
  return { pixels: decoded.data, provenance: { stellarTreatment: 'preserve' as const, receipt: relative(resolve('.'), receiptPath),
    diffuse: relative(resolve('.'), resolve(directory, 'diffuse.png')), residual: relative(resolve('.'), resolve(directory, 'stars.png')), accounting } };
}
