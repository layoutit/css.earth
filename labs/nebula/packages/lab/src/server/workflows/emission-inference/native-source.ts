/** Reuse the lab's native NOX stage before any image-to-volume fit. */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';
import {prepareNativeRemovalSource,decodeNativeDiffuse,runNativeRemoval,type NativeRemovalRequest} from '@cssearth/nebula-reconstruction/star-removal/native';
import { isLabScratchPath } from '../../../resources/model-paths.ts';
export {nativeRemovalTimeoutMs} from '@cssearth/nebula-reconstruction/star-removal/native';

export interface NativeRemoval {
  directory: string;
  model: { path: string };
}
export async function nativeStarless(source: Buffer, dimensions: [number, number], settings: NativeRemoval,
  options: { allowProcessing?: boolean } = {}) {
  const root = process.cwd(), directory = resolve(root, settings.directory);
  if (!isLabScratchPath(relative(root, directory).split(sep).join('/')) || relative(root, directory).split(sep).includes('..'))
    throw new TypeError('Native removal output must be inside the ignored lab cache.');
  const script = resolve(root, 'labs/nebula/packages/reconstruction/src/star-removal/star-removal.py');
  await mkdir(directory, { recursive: true });
  const working = await prepareNativeRemovalSource(source, dimensions);
  // The working copy sits beside its NOX output. A source whose working pixels changed invalidates that output.
  const input = resolve(dirname(directory), 'nox-source.png'), receiptPath = resolve(directory, 'result.json');
  const existing = await readFile(input).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
  if (!existing || !existing.equals(working)) {
    if (existing && options.allowProcessing === false) throw new Error(`Native working copy ${relative(root, input)} differs from its source; re-run native separation explicitly.`);
    await writeFile(input, working); await rm(receiptPath, { force: true });
  }
  let receipt;
  try { receipt = JSON.parse(await readFile(receiptPath, 'utf8')); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    if (options.allowProcessing === false) throw new Error('Native separation is not prepared; this operation cannot start NOX.');
    const request: NativeRemovalRequest = { schema: 'cssearth-star-removal@1', operation: 'apply',
      source: { path: input, nativeDimensions: dimensions },
      model: { path: resolve(root, settings.model.path) }, outputDirectory: directory };
    await writeFile(resolve(directory, 'request.json'), JSON.stringify(request, null, 2) + '\n');
    await runNativeRemoval(request,{executable:resolve(root,'.local/open-star-removal/venv/bin/python'),script,cwd:root});
    receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
  }
  if (receipt.schema !== 'cssearth-nox-output@1' || receipt.operation !== 'apply' || JSON.stringify(receipt.nativeDimensions) !== JSON.stringify(dimensions) ||
      receipt.applied?.verification?.maximumReconstructionErrorCodeValues !== 0 || !receipt.applied?.verification?.coverageComplete)
    throw new Error(`Native NOX receipt ${relative(root, receiptPath)} does not match this source and configured model.`);
  const diffusePath = resolve(directory, 'diffuse.png'), diffuseBytes = await readFile(diffusePath);
  const pixels = await decodeNativeDiffuse(diffuseBytes, dimensions);
  return { pixels, provenance: { settings, source: relative(root, input),
    receipt: relative(root, receiptPath), diffuse: relative(root, diffusePath), timing: receipt.timing } };
}
