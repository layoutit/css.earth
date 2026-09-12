/** Reuse the lab's pinned native NOX stage before any image-to-volume fit. */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';

export interface NativeRemoval {
  directory: string;
  model: { path: string; sha256: string };
  scriptSha256: string;
}
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
/** Allow model startup plus bounded per-tile work on the full published grid. */
export const nativeRemovalTimeoutMs = ([width, height]: [number, number]) =>
  Math.max(300_000, 60_000 + Math.ceil(width / 384) * Math.ceil(height / 384) * 2000);
export async function nativeStarless(source: Buffer, dimensions: [number, number], settings: NativeRemoval,
  options: { allowProcessing?: boolean } = {}) {
  const root = process.cwd(), directory = resolve(root, settings.directory);
  if (!relative(resolve(root, '.local/nebula-lab'), directory).match(/^(?!\.\.)(?!\/).+/))
    throw new TypeError('Native removal output must be inside the ignored lab cache.');
  const script = resolve(root, 'labs/nebula/src/star-removal/star-removal.py');
  if (sha(await readFile(script)) !== settings.scriptSha256 || sha(await readFile(settings.model.path)) !== settings.model.sha256)
    throw new Error('Pinned NOX implementation/model is missing or changed.');
  await mkdir(directory, { recursive: true });
  if (dimensions.some(value => !Number.isInteger(value) || value < 1 || value > 40000))
    throw new TypeError('Native removal dimensions must be within 1–40,000 pixels per side.');
  const native = sharp(source, { limitInputPixels: 40000 * 40000 });
  const metadata = await native.metadata();
  if (metadata.width !== dimensions[0] || metadata.height !== dimensions[1] || (metadata.pages ?? 1) !== 1)
    throw new TypeError('Native removal source dimensions differ.');
  const working = await native.removeAlpha().toColourspace('srgb').png().toBuffer();
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
    const request = { schema: 'cssearth-star-removal@1', operation: 'apply',
      source: { path: input, sha256: sourceSha, nativeDimensions: dimensions },
      model: { ...settings.model, path: resolve(root, settings.model.path) }, outputDirectory: directory };
    await writeFile(resolve(directory, 'request.json'), JSON.stringify(request, null, 2) + '\n');
    await new Promise<void>((accept, reject) => {
      const child = spawn(resolve(root, '.local/open-star-removal/venv/bin/python'), [script],
        { cwd: root, stdio: ['pipe', 'inherit', 'inherit'] });
      let timedOut = false;
      const timeoutMs = nativeRemovalTimeoutMs(dimensions);
      const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs);
      child.on('error', error => { clearTimeout(timer); reject(error); });
      child.on('exit', (code, signal) => {
        clearTimeout(timer);
        if (timedOut) reject(new Error(`NOX exceeded the ${Math.round(timeoutMs / 1000)}s native-grid work limit.`));
        else code === 0 ? accept() : reject(new Error(`NOX stopped: ${code ?? signal}`));
      });
      child.stdin.on('error', error => { clearTimeout(timer); child.kill('SIGTERM'); reject(error); });
      child.stdin.end(JSON.stringify(request));
    });
    receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
  }
  if (receipt.schema !== 'cssearth-nox-output@1' || receipt.operation !== 'apply' || receipt.sourceSha256 !== sourceSha ||
      receipt.modelSha256 !== settings.model.sha256 || receipt.scriptSha256 !== settings.scriptSha256 ||
      receipt.baselineSha256 !== null || JSON.stringify(receipt.nativeDimensions) !== JSON.stringify(dimensions) ||
      receipt.applied?.verification?.maximumReconstructionErrorCodeValues !== 0 || !receipt.applied?.verification?.coverageComplete)
    throw new Error('Native NOX receipt does not match this source and configured model.');
  const diffuseBytes = await readFile(resolve(directory, 'diffuse.png'));
  if (sha(diffuseBytes) !== receipt.artifactSha256?.['diffuse.png']) throw new Error('Native diffuse pixels changed.');
  const diffuse = await sharp(diffuseBytes, { limitInputPixels: 40000 * 40000 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (diffuse.info.width !== dimensions[0] || diffuse.info.height !== dimensions[1] || diffuse.info.channels !== 3)
    throw new Error('Native separation changed image dimensions.');
  return { pixels: diffuse.data, provenance: { settings, sourceSha256: sourceSha,
    receiptSha256: sha(await readFile(receiptPath)), diffuseSha256: sha(diffuseBytes), timing: receipt.timing } };
}
