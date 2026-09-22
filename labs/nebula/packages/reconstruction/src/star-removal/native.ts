/** Configured native-grid processing; cache ownership and pin selection belong to the caller. */
import { spawn } from 'node:child_process';
import sharp from 'sharp';

export interface NativeRemovalRequest {
  schema: 'cssearth-star-removal@1'; operation: 'apply';
  source: { path: string; sha256: string; nativeDimensions: [number, number] };
  model: { path: string }; outputDirectory: string;
}
export interface NativeExecution { executable: string; script: string; cwd: string }
/** Allow model startup plus bounded per-tile work on the full published grid. */
export const nativeRemovalTimeoutMs = ([width, height]: [number, number]) =>
  Math.max(300_000, 60_000 + Math.ceil(width / 384) * Math.ceil(height / 384) * 2000);

export async function prepareNativeRemovalSource(source: Buffer, dimensions: [number, number]) {
  if (dimensions.some(value => !Number.isInteger(value) || value < 1 || value > 40000))
    throw new TypeError('Native removal dimensions must be within 1–40,000 pixels per side.');
  const native = sharp(source, { limitInputPixels: 40000 * 40000 });
  const metadata = await native.metadata();
  if (metadata.width !== dimensions[0] || metadata.height !== dimensions[1] || (metadata.pages ?? 1) !== 1)
    throw new TypeError('Native removal source dimensions differ.');
  return native.removeAlpha().toColourspace('srgb').png().toBuffer();
}
export async function decodeNativeDiffuse(bytes: Buffer, dimensions: [number, number]) {
  const diffuse = await sharp(bytes, { limitInputPixels: 40000 * 40000 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (diffuse.info.width !== dimensions[0] || diffuse.info.height !== dimensions[1] || diffuse.info.channels !== 3)
    throw new Error('Native separation changed image dimensions.');
  return diffuse.data;
}
export async function runNativeRemoval(request: NativeRemovalRequest, execution: NativeExecution): Promise<void> {
  await new Promise<void>((accept, reject) => {
    const child = spawn(execution.executable, [execution.script],
      { cwd: execution.cwd, stdio: ['pipe', 'inherit', 'inherit'] });
    let timedOut = false;
    const timeoutMs = nativeRemovalTimeoutMs(request.source.nativeDimensions);
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
}
/** Preserve compact scientific emission with exact native RGB accounting. */
export async function prepareNativePreservation(source: Buffer, dimensions: [number, number]) {
  const decoded = await sharp(source).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  if (decoded.info.width !== dimensions[0] || decoded.info.height !== dimensions[1] || decoded.info.channels !== 3) throw new Error('Native preserved grid differs.');
  const raw = { width: dimensions[0], height: dimensions[1], channels: 3 as const };
  const expectedDiffuse = await sharp(decoded.data, { raw }).png().toBuffer();
  const expectedStars = await sharp(Buffer.alloc(decoded.data.length), { raw }).png().toBuffer();
  return { decoded, expectedDiffuse, expectedStars };
}
