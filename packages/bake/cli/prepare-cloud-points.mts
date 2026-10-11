/** `prepare-cloud-points <object dir>`: an image-layer object's dataset overlays alone, after its layers' bake
 * (@cssearth/bake/image-layers cloud-overlays.ts). */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareCloudOverlays } from '@cssearth/bake/image-layers';

const direct = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (direct) { if (!process.argv[2] || process.argv[3]) throw new TypeError('Usage: prepare-cloud-points <object-directory>'); await prepareCloudOverlays(process.argv[2]); }
