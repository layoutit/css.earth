/** Reuse the lab's pinned native NOX stage before any image-to-volume fit. */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import {prepareNativeRemovalSource,decodeNativeDiffuse,runNativeRemoval,type NativeRemovalRequest} from '@cssearth/nebula-reconstruction/star-removal/native';
export {nativeRemovalTimeoutMs} from '@cssearth/nebula-reconstruction/star-removal/native';

export interface NativeRemoval {
  directory: string;
  model: { path: string };
}
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export async function nativeStarless(source: Buffer, dimensions: [number, number], settings: NativeRemoval,
  options: { allowProcessing?: boolean } = {}) {
  const root = process.cwd(), directory = resolve(root, settings.directory);
  if (!relative(resolve(root, '.local/nebula-lab'), directory).match(/^(?!\.\.)(?!\/).+/))
    throw new TypeError('Native removal output must be inside the ignored lab cache.');
  const script = resolve(root, 'labs/nebula/packages/reconstruction/src/star-removal/star-removal.py');
  await mkdir(directory, { recursive: true });
  const working = await prepareNativeRemovalSource(source, dimensions);
  const sourceSha = sha(working), input = resolve(dirname(directory), `nox-source-${sourceSha}.png`);
  try { if (sha(await readFile(input)) !== sourceSha) throw new Error('Native working copy changed.'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await writeFile(input, working);
  }
  const receiptPath = resolve(directory, 'result.json');
  let receipt;
  try { receipt = JSON.parse(await readFile(receiptPath, 'utf8')); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    if (options.allowProcessing === false) throw new Error('Native separation is not prepared; this operation cannot start NOX.');
    const request: NativeRemovalRequest = { schema: 'cssearth-star-removal@1', operation: 'apply',
      source: { path: input, sha256: sourceSha, nativeDimensions: dimensions },
      model: { path: resolve(root, settings.model.path) }, outputDirectory: directory };
    await writeFile(resolve(directory, 'request.json'), JSON.stringify(request, null, 2) + '\n');
    await runNativeRemoval(request,{executable:resolve(root,'.local/open-star-removal/venv/bin/python'),script,cwd:root});
    receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
  }
  if (receipt.schema !== 'cssearth-nox-output@1' || receipt.operation !== 'apply' || receipt.sourceSha256 !== sourceSha ||
      receipt.baselineSha256 !== null || JSON.stringify(receipt.nativeDimensions) !== JSON.stringify(dimensions) ||
      receipt.applied?.verification?.maximumReconstructionErrorCodeValues !== 0 || !receipt.applied?.verification?.coverageComplete)
    throw new Error('Native NOX receipt does not match this source and configured model.');
  const diffuseBytes = await readFile(resolve(directory, 'diffuse.png'));
  if (sha(diffuseBytes) !== receipt.artifactSha256?.['diffuse.png']) throw new Error('Native diffuse pixels changed.');
  const pixels = await decodeNativeDiffuse(diffuseBytes, dimensions);
  return { pixels, provenance: { settings, sourceSha256: sourceSha,
    receiptSha256: sha(await readFile(receiptPath)), diffuseSha256: sha(diffuseBytes), timing: receipt.timing } };
}
