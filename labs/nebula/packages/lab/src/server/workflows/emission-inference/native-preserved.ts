/** Native identity treatment for maps whose compact emission is scientifically meaningful. */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import {prepareNativePreservation} from '@cssearth/nebula-reconstruction/star-removal/native';

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid native preservation receipt.');
  return value as Record<string, unknown>;
};
export async function nativePreserved(source: Buffer, dimensions: [number, number], outputDirectory: string,
  options: { allowProcessing?: boolean } = {}) {
  const directory = resolve(outputDirectory), within = relative(resolve('.local/nebula-lab'), directory);
  if (!within || within.startsWith('..') || within.startsWith('/')) throw new TypeError('Native preservation requires the ignored lab cache.');
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
      sourceSha256: sha(source), nativeDimensions: dimensions, conversion: 'Native RGB8 sRGB; no crop, resampling or neural extraction.',
      interpretation: 'Star removal is not applicable: preserve compact structural emission. Any foreground stars remain in this map.',
      artifactSha256: { 'diffuse.png': sha(expectedDiffuse), 'stars.png': sha(expectedStars) }, accounting }, null, 2) + '\n');
    await writeFile(`${receiptPath}.pending`, receiptBytes); await rename(`${receiptPath}.pending`, receiptPath);
  }
  const receipt = object(JSON.parse(receiptBytes.toString())), artifacts = object(receipt.artifactSha256);
  const diffuseBytes = await readFile(resolve(directory, 'diffuse.png')), starsBytes = await readFile(resolve(directory, 'stars.png'));
  if (receipt.schema !== 'cssearth-native-preservation@1' || receipt.stellarTreatment !== 'preserve' || receipt.sourceSha256 !== sha(source) ||
    JSON.stringify(receipt.nativeDimensions) !== JSON.stringify(dimensions) || JSON.stringify(receipt.accounting) !== JSON.stringify(accounting) ||
    artifacts['diffuse.png'] !== sha(expectedDiffuse) || artifacts['stars.png'] !== sha(expectedStars) ||
    sha(diffuseBytes) !== sha(expectedDiffuse) || sha(starsBytes) !== sha(expectedStars)) throw new Error('Native preservation receipt/artifacts differ from identity treatment.');
  return { pixels: decoded.data, provenance: { stellarTreatment: 'preserve' as const, sourceSha256: sha(source),
    receiptSha256: sha(receiptBytes), diffuseSha256: sha(diffuseBytes), residualSha256: sha(starsBytes), accounting } };
}
