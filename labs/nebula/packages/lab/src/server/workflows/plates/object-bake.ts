/** `bake <id> [--draft]`: the one entry the CLI and the lab's Draft and Bake full buttons call. It runs the shared
 * bake (`bakePlates`, the site's own preparation commands) and writes its progress to the object's progress file. */
import { bakePlates } from './bake.ts';
import { withProgress } from './progress.ts';
import type { PlateQuality } from '../../../features/plates/plates-paths.ts';
import type { PlateBakeReceipt } from '../../../features/plates/plates-receipt.ts';

export const objectPath = (id: string) => `src/objects/${id}`;
export const objectIdOf = (object: string) => object.replace(/^src\/objects\//, '');

export function bakeObject(root: string, id: string, quality: PlateQuality, signal: AbortSignal,
  onStage: (message: string, fraction: number, line?: string) => void = () => {}): Promise<PlateBakeReceipt> {
  const object = objectPath(id);
  return withProgress(root, id, quality === 'full' ? 'bake' : quality,
    stage => bakePlates(root, { action: 'apply', imageId: object, object, quality }, signal, (message, fraction, line) => { stage(message, fraction); onStage(message, fraction, line); }),
    receipt => ({ leaves: receipt.leaves, resources: receipt.resources, bytes: receipt.bytes, seconds: receipt.seconds }));
}
